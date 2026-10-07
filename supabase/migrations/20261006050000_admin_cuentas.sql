-- Adopty Fase F (parte 2) — Listado de cuentas para el panel de administración.
--
-- Sin esto no había forma de llegar a una cuenta desde /admin: la policy de
-- `usuarios` es `auth.uid() = id`, así que el admin no puede listar usuarios con
-- el cliente. Se expone un RPC acotado (con `soy_admin()` DENTRO, no como filtro
-- opcional) en vez de abrir la tabla entera.
--
-- No devuelve el correo: el panel mantiene su regla de no mostrar correos.

CREATE OR REPLACE FUNCTION public.listar_cuentas(p_busqueda TEXT DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  nombre TEXT,
  tipo text,
  activo BOOLEAN,
  fecha_registro TIMESTAMPTZ,
  borrado_en TIMESTAMPTZ,
  mascotas INT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT soy_admin() THEN
    RAISE EXCEPTION 'Solo un administrador puede listar las cuentas'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT u.id,
           coalesce(p.nombre, o.nombre_oficial, 'Usuario'),
           CASE WHEN o.id IS NOT NULL THEN 'organizacion' ELSE 'persona' END,
           u.activo,
           u.fecha_registro,
           u.borrado_en,
           (SELECT count(*)::int FROM public.mascotas m
             WHERE m.id_publicador = u.id AND m.deleted_at IS NULL)
      FROM public.usuarios u
      LEFT JOIN public.personas p ON p.id = u.id
      LEFT JOIN public.organizaciones o ON o.id = u.id
     WHERE btrim(coalesce(p_busqueda, '')) = ''
        OR coalesce(p.nombre, o.nombre_oficial, '') ILIKE '%' || btrim(p_busqueda) || '%'
     ORDER BY u.fecha_registro DESC
     LIMIT 100;
END; $$;

REVOKE ALL ON FUNCTION public.listar_cuentas(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_cuentas(TEXT) TO authenticated;