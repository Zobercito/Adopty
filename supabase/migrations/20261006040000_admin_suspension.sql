-- Adopty Fase F — Suspensión de cuentas desde el panel de administración.
--
-- `/terminos` promete que "las cuentas que incumplan pueden ser suspendidas", pero
-- no existía ningún mecanismo. Se apoya en `usuarios.activo`, la columna que
-- existía desde el esquema original y que hasta ahora solo se usaba para la baja
-- de cuenta (fase D).
--
-- Es un RPC y no un UPDATE desde el cliente porque la policy de `usuarios` es
-- `auth.uid() = id`: un admin no puede escribir sobre la fila de otro con la
-- anon key (y no hay service role en el proyecto).

-- ============ 1. Suspender / reactivar ============
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

  SELECT coalesce(p.nombre, o.nombre_oficial, 'Usuario') INTO v_nombre
    FROM public.usuarios u
    LEFT JOIN public.personas p ON p.id = u.id
    LEFT JOIN public.organizaciones o ON o.id = u.id
   WHERE u.id = p_usuario_id;

  IF v_nombre IS NULL THEN
    RAISE EXCEPTION 'Cuenta no encontrada' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.usuarios SET activo = p_activo WHERE id = p_usuario_id;

  INSERT INTO auditoria (id_usuario, accion, tabla, id_registro, datos_nuevos)
  VALUES (
    p_usuario_id,
    CASE WHEN p_activo THEN 'reactivar_cuenta' ELSE 'suspender_cuenta' END,
    'usuarios',
    p_usuario_id,
    jsonb_build_object('por_admin', soy_admin())
  );

  RETURN QUERY SELECT p_usuario_id, v_nombre, p_activo;
END; $$;

REVOKE ALL ON FUNCTION public.estado_cuenta(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.estado_cuenta(UUID, BOOLEAN) TO authenticated;

-- ============ 2. Ver la web y las redes que declara la organización ============
-- Para approving una verificación el admin necesita contrastar lo que la
-- organización escribió en su perfil con la evidencia que envía. No hacemos
-- fetch a la URL desde el servidor (sería una petición saliente a un sitio
-- elegido por el usuario): solo se le muestran los datos declarados.
DROP POLICY IF EXISTS organizaciones_admin_select ON organizaciones;
CREATE POLICY organizaciones_admin_select ON organizaciones
  FOR SELECT USING (soy_admin());