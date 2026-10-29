-- Adopty — endurecimiento de privilegios y search_path (advisors 2026-10-29).
--
-- Supabase concede EXECUTE sobre cada función nueva a `anon` y `authenticated`
-- mediante ALTER DEFAULT PRIVILEGES. El `REVOKE ... FROM PUBLIC` de las
-- migraciones anteriores no retira esa concesión directa, así que el advisor
-- seguía viendo ejecutables por `anon` RPC que solo tienen sentido con sesión.
-- Aquí se retira lo sobrante. Las funciones que evalúan policies de tablas
-- legibles por `anon` (`soy_admin`, `soy_publicador`, `tengo_aprobada`,
-- `cuenta_activa`, `puede_mensajear`…) conservan su GRANT: sin él el propio RLS
-- respondería «permission denied for function» en lugar de filtrar filas.
-- Las funciones de trigger pierden el EXECUTE de los roles de API: el
-- disparador no lo necesita y así no quedan expuestas como `/rest/v1/rpc/...`.

-- ============ 1. RPC que exigen sesión ============
REVOKE EXECUTE ON FUNCTION public.listar_cuentas(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.estado_cuenta(uuid, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.resolver_reporte(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.resolver_verificacion(uuid, boolean, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.restaurar_publicacion(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.aprobar_solicitud(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.eliminar_mi_cuenta() FROM anon;
REVOKE EXECUTE ON FUNCTION public.registrar_auditoria(text, text, uuid, jsonb, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.consumir_rate_limit(text, integer, bigint) FROM anon;
REVOKE EXECUTE ON FUNCTION public.resumen_adoptantes(uuid[]) FROM anon;

-- ============ 2. Funciones de trigger ============
-- Se ejecutan desde el trigger, no por llamada directa; el EXECUTE de los
-- roles de API solo servía para exponerlas en PostgREST.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_usuarios_correo() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_mascota_slug() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validar_solicitud() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.solo_marcar_leido() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validar_mascota() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validar_auto_reporte() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_max_fotos() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated;

-- ============ 3. search_path fijo en triggers sin él ============
-- Son SECURITY INVOKER: un search_path mutable permitiría que un rol con
-- CREATE en otro esquema colocara delante una tabla homónima.
ALTER FUNCTION public.check_max_fotos() SET search_path = public;
ALTER FUNCTION public.set_updated_at() SET search_path = public;

-- ============ 4. Un admin no puede suspender su propia cuenta ============
-- La API ya lo bloquea (`PATCH /api/admin/cuentas`), pero la anon key es
-- pública y `estado_cuenta` se alcanza por PostgREST. Sin esta guardia un
-- admin podía autosuspéndirse y quedarse sin panel.
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
REVOKE EXECUTE ON FUNCTION public.estado_cuenta(UUID, BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION public.estado_cuenta(UUID, BOOLEAN) TO authenticated;

-- ============ 5. pg_trgm fuera del esquema expuesto ============
-- Sus funciones y operadores (`similarity`, `%`, `show_trgm`…) se publicaban
-- en `/rest/v1/rpc/*` sin necesidad. Los índices GIN y el árbol de la función
-- `buscar_por_similitud` guardan OID, así que el traslado no los invalida; se
-- añade `extensions` a su search_path por si se recrea.
ALTER EXTENSION pg_trgm SET SCHEMA extensions;
ALTER FUNCTION public.buscar_por_similitud(text, integer)
  SET search_path = public, extensions;
