-- Reabrir una mascota (`en_proceso` → `disponible`) solo cambiaba el estado de
-- `mascotas`: la solicitud aprobada seguía viva, el adoptante la veía como
-- "Aprobada" y la ficha ofrecía el chat en vez de dejar solicitar de nuevo.
-- Ahora la reapertura invalida esa aprobación (rechazada) de forma atómica.

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
    -- Al reabrir la publicación, la aprobación anterior deja de valer: el
    -- publicador puede pasarla a `rechazada` solo con la mascota ya disponible.
    IF OLD.estado = 'aprobada' AND NEW.estado = 'rechazada' THEN
      SELECT m.id_publicador, m.estado INTO v_publicador, v_estado
        FROM public.mascotas m
        WHERE m.id = OLD.id_mascota;
      IF auth.uid() = v_publicador AND v_estado = 'disponible' THEN
        RETURN NEW;
      END IF;
    END IF;
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

-- Reabrir una publicación: solo el publicador, nunca desde `adoptada`, y en la
-- misma transacción invalida la solicitud aprobada para que se pueda pedir de nuevo.
CREATE OR REPLACE FUNCTION public.reabrir_mascota(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_publicador uuid;
  v_estado public.estado_mascota;
BEGIN
  IF NOT public.cuenta_activa() THEN
    RAISE EXCEPTION 'La cuenta está suspendida' USING ERRCODE = '42501';
  END IF;
  SELECT m.id_publicador, m.estado INTO v_publicador, v_estado
    FROM public.mascotas m
    WHERE m.id = p_id AND m.deleted_at IS NULL
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mascota no encontrada';
  END IF;
  IF v_publicador IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Solo el publicador puede reabrir la publicación';
  END IF;
  IF v_estado = 'adoptada' THEN
    RAISE EXCEPTION 'Una mascota adoptada no puede reabrirse';
  END IF;
  IF v_estado = 'disponible' THEN
    RETURN;
  END IF;
  UPDATE public.mascotas SET estado = 'disponible' WHERE id = p_id;
  UPDATE public.solicitudes SET estado = 'rechazada'
    WHERE id_mascota = p_id AND estado = 'aprobada';
END $$;
REVOKE ALL ON FUNCTION public.reabrir_mascota(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reabrir_mascota(uuid) TO authenticated;
