-- Adopty — B.1/B.2: la suspensión y la baja lógica se aplican también en la API.
--
-- Hasta ahora `usuarios.activo` solo se miraba en el middleware y en el login.
-- La `anon key` es pública, así que una cuenta suspendida (o dada de baja) podía
-- pedir su JWT directamente a `/auth/v1/token` y escribir por PostgREST: ninguna
-- policy RLS consultaba `activo`.
--
-- `cuenta_activa()` es el único punto que decide. Se añade a las policies de
-- ESCRITURA de las tablas con contenido de usuario; las de lectura no cambian
-- (leer lo propio no permite seguir usando la plataforma).
-- SECURITY DEFINER para poder leer `usuarios` sin recursión: la policy de esa
-- tabla es `auth.uid() = id` y, dentro de otra policy, la subconsulta no vería
-- la fila.
-- Devuelve false sin sesión (`auth.uid()` NULL), así que solo sirve como guardia
-- de escritura: nunca se aplica a `anon` en una policy de lectura.

CREATE OR REPLACE FUNCTION public.cuenta_activa()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT u.activo FROM public.usuarios u WHERE u.id = auth.uid()), false);
$$;

REVOKE ALL ON FUNCTION public.cuenta_activa() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cuenta_activa() TO anon, authenticated;

-- ============ mascotas ============
DROP POLICY IF EXISTS mascotas_insert ON public.mascotas;
CREATE POLICY mascotas_insert ON public.mascotas FOR INSERT
  WITH CHECK (auth.uid() = id_publicador AND public.cuenta_activa());

DROP POLICY IF EXISTS mascotas_update ON public.mascotas;
CREATE POLICY mascotas_update ON public.mascotas FOR UPDATE
  USING (auth.uid() = id_publicador AND public.cuenta_activa())
  WITH CHECK (auth.uid() = id_publicador AND public.cuenta_activa());

DROP POLICY IF EXISTS mascotas_delete ON public.mascotas;
CREATE POLICY mascotas_delete ON public.mascotas FOR DELETE
  USING (auth.uid() = id_publicador AND public.cuenta_activa());

-- ============ fotos_mascota ============
DROP POLICY IF EXISTS fotos_write ON public.fotos_mascota;
CREATE POLICY fotos_write ON public.fotos_mascota FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.mascotas m
      WHERE m.id = id_mascota AND m.id_publicador = auth.uid()
    )
    AND public.cuenta_activa()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.mascotas m
      WHERE m.id = id_mascota AND m.id_publicador = auth.uid()
    )
    AND public.cuenta_activa()
  );

-- ============ solicitudes ============
DROP POLICY IF EXISTS sol_insert ON public.solicitudes;
CREATE POLICY sol_insert ON public.solicitudes FOR INSERT
  WITH CHECK (auth.uid() = id_adoptante AND public.cuenta_activa());

DROP POLICY IF EXISTS sol_update ON public.solicitudes;
CREATE POLICY sol_update ON public.solicitudes FOR UPDATE
  USING ((auth.uid() = id_adoptante OR public.soy_publicador_de(id_mascota)) AND public.cuenta_activa())
  WITH CHECK ((auth.uid() = id_adoptante OR public.soy_publicador_de(id_mascota)) AND public.cuenta_activa());

-- ============ mensajes ============
DROP POLICY IF EXISTS msg_insert ON public.mensajes;
CREATE POLICY msg_insert ON public.mensajes FOR INSERT
  WITH CHECK (
    auth.uid() = id_emisor
    AND public.cuenta_activa()
    AND public.puede_mensajear(id_mascota, id_emisor, id_receptor)
  );

DROP POLICY IF EXISTS msg_update ON public.mensajes;
CREATE POLICY msg_update ON public.mensajes FOR UPDATE
  USING (auth.uid() = id_receptor AND public.cuenta_activa())
  WITH CHECK (auth.uid() = id_receptor AND public.cuenta_activa());

-- ============ favoritos ============
DROP POLICY IF EXISTS fav_all ON public.favoritos;
CREATE POLICY fav_all ON public.favoritos FOR ALL
  USING (auth.uid() = id_usuario AND public.cuenta_activa())
  WITH CHECK (auth.uid() = id_usuario AND public.cuenta_activa());

-- ============ personas / organizaciones ============
DROP POLICY IF EXISTS personas_insert ON public.personas;
CREATE POLICY personas_insert ON public.personas FOR INSERT
  WITH CHECK (auth.uid() = id AND public.cuenta_activa());

DROP POLICY IF EXISTS personas_update ON public.personas;
CREATE POLICY personas_update ON public.personas FOR UPDATE
  USING (auth.uid() = id AND public.cuenta_activa())
  WITH CHECK (auth.uid() = id AND public.cuenta_activa());

DROP POLICY IF EXISTS org_insert ON public.organizaciones;
CREATE POLICY org_insert ON public.organizaciones FOR INSERT
  WITH CHECK (auth.uid() = id AND public.cuenta_activa());

DROP POLICY IF EXISTS org_update ON public.organizaciones;
CREATE POLICY org_update ON public.organizaciones FOR UPDATE
  USING (auth.uid() = id AND public.cuenta_activa())
  WITH CHECK (auth.uid() = id AND public.cuenta_activa());

-- ============ perfil_estilo_vida ============
DROP POLICY IF EXISTS pev_insert ON public.perfil_estilo_vida;
CREATE POLICY pev_insert ON public.perfil_estilo_vida FOR INSERT
  WITH CHECK (auth.uid() = id_persona AND public.cuenta_activa());

DROP POLICY IF EXISTS pev_update ON public.perfil_estilo_vida;
CREATE POLICY pev_update ON public.perfil_estilo_vida FOR UPDATE
  USING (auth.uid() = id_persona AND public.cuenta_activa())
  WITH CHECK (auth.uid() = id_persona AND public.cuenta_activa());

-- ============ reportes / verificaciones / auditoría ============
DROP POLICY IF EXISTS reportes_insert ON public.reportes;
CREATE POLICY reportes_insert ON public.reportes FOR INSERT
  WITH CHECK (auth.uid() = id_reportador AND public.cuenta_activa());

DROP POLICY IF EXISTS verificaciones_insert ON public.verificaciones_org;
CREATE POLICY verificaciones_insert ON public.verificaciones_org FOR INSERT
  WITH CHECK (
    auth.uid() IN (SELECT id FROM public.organizaciones WHERE id = id_organizacion)
    AND public.cuenta_activa()
  );

DROP POLICY IF EXISTS auditoria_insert ON public.auditoria;
CREATE POLICY auditoria_insert ON public.auditoria FOR INSERT
  WITH CHECK (auth.uid() = id_usuario AND public.cuenta_activa());

-- ============ Admin suspendido ============
-- `soy_admin()` solo miraba `administradores`: un admin suspendido conservaba
-- todos los RPCs de moderación (no pasan por RLS). Se exige cuenta activa.
CREATE OR REPLACE FUNCTION public.soy_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.administradores a WHERE a.id = auth.uid())
     AND public.cuenta_activa();
$$;

REVOKE ALL ON FUNCTION public.soy_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soy_admin() TO authenticated;

-- ============ RPC de aprobación ============
-- SECURITY DEFINER: no pasa por RLS, así que la guardia va dentro. Sin esto una
-- cuenta suspendida seguía aprobando solicitudes llamando a la RPC.
CREATE OR REPLACE FUNCTION public.aprobar_solicitud(p_solicitud_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_mascota uuid; v_publicador uuid;
BEGIN
  IF NOT public.cuenta_activa() THEN
    RAISE EXCEPTION 'La cuenta está suspendida' USING ERRCODE = '42501';
  END IF;
  SELECT s.id_mascota, m.id_publicador INTO v_mascota, v_publicador
  FROM public.solicitudes s JOIN public.mascotas m ON m.id = s.id_mascota
  WHERE s.id = p_solicitud_id AND s.estado = 'pendiente' AND m.deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no válida o ya resuelta'; END IF;
  IF v_publicador IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Solo el publicador puede aprobar'; END IF;
  UPDATE public.solicitudes SET estado = 'aprobada' WHERE id = p_solicitud_id;
  UPDATE public.mascotas SET estado = 'en_proceso' WHERE id = v_mascota;
  UPDATE public.solicitudes SET estado = 'rechazada'
  WHERE id_mascota = v_mascota AND estado = 'pendiente' AND id <> p_solicitud_id;
END $$;

REVOKE ALL ON FUNCTION public.aprobar_solicitud(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aprobar_solicitud(uuid) TO authenticated;
