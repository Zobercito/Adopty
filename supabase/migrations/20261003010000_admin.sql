-- Adopty — Panel de administración (moderación) + fixes de escalación de privilegios
--
-- 1. Tabla `administradores`: identidad de admin SIN permisos de escritura para
--    `authenticated`, para que nadie pueda auto-ascenderse (a diferencia de una
--    columna `es_admin` en `usuarios`, que sería editable por el propio usuario).
-- 2. Helper `soy_admin()` para policies y guards.
-- 3. Policies de lectura/escritura para admin sobre `reportes` y `verificaciones_org`.
-- 4. RPCs atómicas para resolver reportes y verificaciones.
-- 5. Fixes de seguridad:
--    - `usuarios`: se elimina la policy UPDATE (nadie la usaba; permitía editar
--      `tipo_usuario` y `activo` propios).
--    - `organizaciones`: se limita UPDATE a columnas de perfil, para que una
--      organización no pueda auto-asignarse `verificada`.

-- ============ 1. Administradores ============
CREATE TABLE IF NOT EXISTS administradores (
  id UUID PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  desde TIMESTAMPTZ NOT NULL DEFAULT now(),
  notas TEXT
);

ALTER TABLE administradores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_self ON administradores;
-- Solo lectura de su propia fila. SIN policies de INSERT/UPDATE/DELETE:
-- `authenticated` no puede crear ni quitar admins.
CREATE POLICY admin_self ON administradores FOR SELECT USING (auth.uid() = id);

-- ============ 2. Helper soy_admin() ============
CREATE OR REPLACE FUNCTION public.soy_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.administradores WHERE id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.soy_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soy_admin() TO authenticated;

-- ============ 3. Policies de admin ============
-- reportes: el reportador sigue viendo los suyos; el admin ve todos.
DROP POLICY IF EXISTS reportes_admin_select ON reportes;
CREATE POLICY reportes_admin_select ON reportes FOR SELECT USING (soy_admin());
DROP POLICY IF EXISTS reportes_admin_update ON reportes;
CREATE POLICY reportes_admin_update ON reportes
  FOR UPDATE USING (soy_admin()) WITH CHECK (soy_admin());

-- verificaciones_org: la organización sigue viendo las suyas; el admin ve todas.
DROP POLICY IF EXISTS verificaciones_admin_select ON verificaciones_org;
CREATE POLICY verificaciones_admin_select ON verificaciones_org
  FOR SELECT USING (soy_admin());
DROP POLICY IF EXISTS verificaciones_admin_update ON verificaciones_org;
CREATE POLICY verificaciones_admin_update ON verificaciones_org
  FOR UPDATE USING (soy_admin()) WITH CHECK (soy_admin());

-- ============ 4. RPCs de moderación ============
-- Ocultar (soft-delete) o descartar un reporte.
-- Al ocultar: la mascota se oculta (deleted_at) y el resto de reportes
-- pendientes de esa mascota se descartan automáticamente.
CREATE OR REPLACE FUNCTION public.resolver_reporte(
  p_reporte_id UUID,
  p_accion TEXT -- 'ocultar' | 'descartar'
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_mascota UUID;
  v_estado_actual TEXT;
BEGIN
  IF NOT soy_admin() THEN
    RAISE EXCEPTION 'Solo un administrador puede resolver reportes';
  END IF;
  IF p_accion NOT IN ('ocultar', 'descartar') THEN
    RAISE EXCEPTION 'Acción inválida: use ocultar o descartar';
  END IF;

  SELECT id_mascota, estado INTO v_mascota, v_estado_actual
  FROM public.reportes WHERE id = p_reporte_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reporte no encontrado';
  END IF;
  IF v_estado_actual <> 'pendiente' THEN
    RAISE EXCEPTION 'El reporte ya fue resuelto';
  END IF;

  IF p_accion = 'ocultar' THEN
    UPDATE public.reportes
    SET estado = 'resuelto',
        notas_admin = trim(both ' ' from coalesce(notas_admin, '') || ' Publicación oculta por moderación.'),
        fecha_resolucion = now()
    WHERE id = p_reporte_id;

    -- soft-delete: sale de Explorar pero se conserva (reversible)
    UPDATE public.mascotas SET deleted_at = now()
    WHERE id = v_mascota AND deleted_at IS NULL;

    -- el resto de pendientes de esa mascota se descartan solos
    UPDATE public.reportes
    SET estado = 'descartado',
        notas_admin = 'Descartado automáticamente: la publicación fue oculta.',
        fecha_resolucion = now()
    WHERE id_mascota = v_mascota AND estado = 'pendiente' AND id <> p_reporte_id;
  ELSE
    UPDATE public.reportes
    SET estado = 'descartado', fecha_resolucion = now()
    WHERE id = p_reporte_id;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.resolver_reporte(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolver_reporte(UUID, TEXT) TO authenticated;

-- Aprobar o rechazar la verificación de una organización.
CREATE OR REPLACE FUNCTION public.resolver_verificacion(
  p_verificacion_id UUID,
  p_aprobada BOOLEAN,
  p_notas TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org UUID;
  v_estado_actual TEXT;
BEGIN
  IF NOT soy_admin() THEN
    RAISE EXCEPTION 'Solo un administrador puede resolver verificaciones';
  END IF;

  SELECT id_organizacion, estado INTO v_org, v_estado_actual
  FROM public.verificaciones_org WHERE id = p_verificacion_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud no encontrada';
  END IF;
  IF v_estado_actual <> 'pendiente' THEN
    RAISE EXCEPTION 'La solicitud ya fue resuelta';
  END IF;

  IF p_aprobada THEN
    UPDATE public.verificaciones_org
    SET estado = 'aprobada', notas_admin = p_notas, fecha_resolucion = now()
    WHERE id = p_verificacion_id;
    UPDATE public.organizaciones SET verificada = true WHERE id = v_org;
  ELSE
    UPDATE public.verificaciones_org
    SET estado = 'rechazada', notas_admin = p_notas, fecha_resolucion = now()
    WHERE id = p_verificacion_id;
    -- Quita el badge solo si no existe otra verificación aprobada para esa org.
    UPDATE public.organizaciones o SET verificada = false
    WHERE o.id = v_org
      AND NOT EXISTS (
        SELECT 1 FROM public.verificaciones_org v
        WHERE v.id_organizacion = v_org AND v.estado = 'aprobada' AND v.id <> p_verificacion_id
      );
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.resolver_verificacion(UUID, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolver_verificacion(UUID, BOOLEAN, TEXT) TO authenticated;

-- ============ 5. Fixes de escalación de privilegios ============
-- usuarios: la app nunca hace UPDATE sobre esta tabla (el perfil vive en
-- personas/organizaciones). La policy permitía editarse `tipo_usuario` y `activo`.
DROP POLICY IF EXISTS usuarios_update ON usuarios;

-- organizaciones: se limita el UPDATE a columnas de perfil para que una
-- organización no pueda auto-asignarse el badge `verificada` por REST.
REVOKE UPDATE ON public.organizaciones FROM authenticated;
GRANT UPDATE (nombre_oficial, direccion, descripcion, sitio_web)
  ON public.organizaciones TO authenticated;