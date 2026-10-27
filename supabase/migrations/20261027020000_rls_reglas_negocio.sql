-- Adopty — reglas de negocio aplicadas en la base (cierra P1-10 y P1-11).
--
-- La anon key es pública y cualquier usuario autenticado puede llamar a PostgREST
-- sin pasar por las API de Astro. Las policies de SELECT ya impedían leer filas
-- ajenas, pero las de escritura no replicaban las reglas de la app:
--   P1-10: el adoptante podía auto-aprobar una solicitud o crearla para una
--          mascota no disponible.
--   P1-11: se podía escribir a cualquier usuario sin solicitud aprobada y el
--          receptor podía editar el contenido de un mensaje.
--
-- Este archivo replica en triggers + policies lo que ya validan
-- src/pages/api/{solicitudes,mensajes,mascotas}. Es idempotente.

-- ============ Helpers ============

CREATE OR REPLACE FUNCTION public.soy_publicador_de(p_mascota uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mascotas m
    WHERE m.id = p_mascota AND m.id_publicador = auth.uid()
  );
$$;
REVOKE ALL ON FUNCTION public.soy_publicador_de(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soy_publicador_de(uuid) TO authenticated;

-- Hay chat solo entre el publicador y el adoptante con solicitud aprobada.
CREATE OR REPLACE FUNCTION public.puede_mensajear(
  p_mascota uuid,
  p_emisor uuid,
  p_receptor uuid
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.mascotas m
    WHERE m.id = p_mascota
      AND m.deleted_at IS NULL
      AND (
        (
          m.id_publicador = p_emisor
          AND EXISTS (
            SELECT 1 FROM public.solicitudes s
            WHERE s.id_mascota = m.id
              AND s.id_adoptante = p_receptor
              AND s.estado = 'aprobada'
          )
        )
        OR (
          m.id_publicador = p_receptor
          AND EXISTS (
            SELECT 1 FROM public.solicitudes s
            WHERE s.id_mascota = m.id
              AND s.id_adoptante = p_emisor
              AND s.estado = 'aprobada'
          )
        )
      )
  );
$$;
REVOKE ALL ON FUNCTION public.puede_mensajear(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.puede_mensajear(uuid, uuid, uuid) TO authenticated;

-- ============ P1-10: solicitudes ============
-- INSERT: estado pendiente, mascota disponible, no propia.
-- UPDATE: solo participantes y solo las transiciones de lib/transiciones.ts.
-- Aprobar mantiene el mismo invariante que la RPC aprobar_solicitud().

CREATE OR REPLACE FUNCTION public.validar_solicitud()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_publicador uuid;
  v_estado public.estado_mascota;
  v_deleted timestamptz;
BEGIN
  -- Seed y service_role no tienen JWT: no hay usuario que validar.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.estado <> 'pendiente' THEN
      RAISE EXCEPTION 'Una solicitud nueva debe estar pendiente';
    END IF;
    SELECT m.id_publicador, m.estado, m.deleted_at
      INTO v_publicador, v_estado, v_deleted
      FROM public.mascotas m
      WHERE m.id = NEW.id_mascota;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Mascota no encontrada';
    END IF;
    IF v_deleted IS NOT NULL OR v_estado <> 'disponible' THEN
      RAISE EXCEPTION 'La mascota ya no está disponible';
    END IF;
    IF v_publicador = NEW.id_adoptante THEN
      RAISE EXCEPTION 'No puedes solicitar tu propia mascota';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.id_mascota IS DISTINCT FROM OLD.id_mascota
     OR NEW.id_adoptante IS DISTINCT FROM OLD.id_adoptante
     OR NEW.mensaje_inicial IS DISTINCT FROM OLD.mensaje_inicial
     OR NEW.fecha_solicitud IS DISTINCT FROM OLD.fecha_solicitud THEN
    RAISE EXCEPTION 'No puedes modificar los datos de la solicitud';
  END IF;
  IF OLD.estado <> 'pendiente' THEN
    RAISE EXCEPTION 'La solicitud ya está %', OLD.estado;
  END IF;

  SELECT m.id_publicador INTO v_publicador
    FROM public.mascotas m
    WHERE m.id = OLD.id_mascota;

  IF auth.uid() = OLD.id_adoptante THEN
    IF NEW.estado <> 'cancelada' THEN
      RAISE EXCEPTION 'El adoptante solo puede cancelar su solicitud';
    END IF;
  ELSIF auth.uid() = v_publicador THEN
    IF NEW.estado NOT IN ('aprobada', 'rechazada') THEN
      RAISE EXCEPTION 'El publicador solo puede aprobar o rechazar';
    END IF;
  ELSE
    RAISE EXCEPTION 'No participas en esta solicitud';
  END IF;

  IF NEW.estado = 'aprobada' THEN
    UPDATE public.mascotas SET estado = 'en_proceso'
      WHERE id = OLD.id_mascota AND estado = 'disponible';
    UPDATE public.solicitudes SET estado = 'rechazada'
      WHERE id_mascota = OLD.id_mascota
        AND estado = 'pendiente'
        AND id <> OLD.id;
  END IF;

  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.validar_solicitud() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_validar_solicitud ON public.solicitudes;
CREATE TRIGGER trg_validar_solicitud
  BEFORE INSERT OR UPDATE ON public.solicitudes
  FOR EACH ROW EXECUTE FUNCTION public.validar_solicitud();

DROP POLICY IF EXISTS sol_insert ON public.solicitudes;
CREATE POLICY sol_insert ON public.solicitudes FOR INSERT
  WITH CHECK (auth.uid() = id_adoptante);

DROP POLICY IF EXISTS sol_update ON public.solicitudes;
CREATE POLICY sol_update ON public.solicitudes FOR UPDATE
  USING (auth.uid() = id_adoptante OR public.soy_publicador_de(id_mascota))
  WITH CHECK (auth.uid() = id_adoptante OR public.soy_publicador_de(id_mascota));

-- ============ P1-11: mensajes ============
-- INSERT: emisor autenticado + hilo habilitado por solicitud aprobada.
-- UPDATE: solo el receptor y solo la columna `leido`.

DROP POLICY IF EXISTS msg_insert ON public.mensajes;
CREATE POLICY msg_insert ON public.mensajes FOR INSERT
  WITH CHECK (
    auth.uid() = id_emisor
    AND public.puede_mensajear(id_mascota, id_emisor, id_receptor)
  );

DROP POLICY IF EXISTS msg_update ON public.mensajes;
CREATE POLICY msg_update ON public.mensajes FOR UPDATE
  USING (auth.uid() = id_receptor)
  WITH CHECK (auth.uid() = id_receptor);

CREATE OR REPLACE FUNCTION public.solo_marcar_leido()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF auth.uid() <> OLD.id_receptor THEN
    RAISE EXCEPTION 'Solo el receptor puede marcar como leído';
  END IF;
  IF NEW.id_emisor IS DISTINCT FROM OLD.id_emisor
     OR NEW.id_receptor IS DISTINCT FROM OLD.id_receptor
     OR NEW.id_mascota IS DISTINCT FROM OLD.id_mascota
     OR NEW.contenido IS DISTINCT FROM OLD.contenido
     OR NEW.fecha_envio IS DISTINCT FROM OLD.fecha_envio THEN
    RAISE EXCEPTION 'No puedes editar el contenido de un mensaje';
  END IF;
  IF OLD.leido AND NOT NEW.leido THEN
    RAISE EXCEPTION 'No puedes marcar un mensaje como no leído';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.solo_marcar_leido() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_solo_marcar_leido ON public.mensajes;
CREATE TRIGGER trg_solo_marcar_leido
  BEFORE UPDATE ON public.mensajes
  FOR EACH ROW EXECUTE FUNCTION public.solo_marcar_leido();

-- ============ Mascotas: transiciones también en la base ============
-- La API ya valida (P1-02); esto cierra el mismo bypass por PostgREST.

CREATE OR REPLACE FUNCTION public.validar_mascota()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.estado <> 'disponible' THEN
      RAISE EXCEPTION 'Una publicación nueva debe estar disponible';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.id_publicador IS DISTINCT FROM OLD.id_publicador THEN
    RAISE EXCEPTION 'No puedes cambiar el publicador de la mascota';
  END IF;

  IF NEW.estado IS DISTINCT FROM OLD.estado THEN
    IF OLD.estado = 'adoptada' THEN
      RAISE EXCEPTION 'Una mascota adoptada no puede cambiar de estado';
    END IF;
    IF auth.uid() <> OLD.id_publicador AND NOT public.soy_admin() THEN
      RAISE EXCEPTION 'Solo el publicador puede cambiar el estado';
    END IF;
  END IF;

  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.validar_mascota() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_validar_mascota ON public.mascotas;
CREATE TRIGGER trg_validar_mascota
  BEFORE INSERT OR UPDATE ON public.mascotas
  FOR EACH ROW EXECUTE FUNCTION public.validar_mascota();

DROP POLICY IF EXISTS mascotas_update ON public.mascotas;
CREATE POLICY mascotas_update ON public.mascotas FOR UPDATE
  USING (auth.uid() = id_publicador)
  WITH CHECK (auth.uid() = id_publicador);
