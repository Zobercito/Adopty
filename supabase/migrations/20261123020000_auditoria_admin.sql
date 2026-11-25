-- Adopty — visor de auditoría para admin y autor correcto (AUD-11).
--
-- 1. El admin puede leer `auditoria` (la policy original solo dejaba al propio
--    usuario ver sus filas).
-- 2. `estado_cuenta` registraba al usuario sancionado como autor; pasa a registrar
--    a `auth.uid()` (el admin) y deja el objetivo en `datos_nuevos.id_objetivo`.

-- ============ 1. Lectura para admin ============
DROP POLICY IF EXISTS auditoria_select_admin ON public.auditoria;
CREATE POLICY auditoria_select_admin ON public.auditoria
  FOR SELECT
  USING (public.soy_admin());

-- ============ 2. Autor correcto en suspender/reactivar ============
CREATE OR REPLACE FUNCTION public.estado_cuenta(p_usuario_id UUID, p_activo BOOLEAN)
RETURNS TABLE (id UUID, nombre TEXT, activo BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_nombre TEXT;
BEGIN
  IF NOT soy_admin() THEN
    RAISE EXCEPTION 'Solo un administrador puede cambiar el estado de una cuenta'
      USING ERRCODE = '42501';
  END IF;
  IF p_usuario_id IS NULL OR NOT p_activo IS NOT NULL THEN
    RAISE EXCEPTION 'Datos inválidos' USING ERRCODE = 'P0001';
  END IF;
  IF p_usuario_id = auth.uid() AND NOT p_activo THEN
    RAISE EXCEPTION 'No puedes suspender tu propia cuenta' USING ERRCODE = 'P0001';
  END IF;

  SELECT coalesce(p.nombre, o.nombre_oficial, 'Usuario') INTO v_nombre
    FROM public.usuarios u
    LEFT JOIN public.personas p ON p.id = u.id
    LEFT JOIN public.organizaciones o ON o.id = u.id
   WHERE u.id = p_usuario_id;

  IF v_nombre IS NULL THEN
    RAISE EXCEPTION 'Cuenta no encontrada' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.usuarios AS u SET activo = p_activo WHERE u.id = p_usuario_id;

  INSERT INTO auditoria (id_usuario, accion, tabla, id_registro, datos_nuevos)
  VALUES (
    auth.uid(),
    CASE WHEN p_activo THEN 'reactivar_cuenta' ELSE 'suspender_cuenta' END,
    'usuarios',
    p_usuario_id,
    jsonb_build_object('id_objetivo', p_usuario_id, 'activo', p_activo, 'por_admin', true)
  );

  RETURN QUERY SELECT p_usuario_id, v_nombre, p_activo;
END; $$;

REVOKE ALL ON FUNCTION public.estado_cuenta(UUID, BOOLEAN) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.estado_cuenta(UUID, BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION public.estado_cuenta(UUID, BOOLEAN) TO authenticated;
