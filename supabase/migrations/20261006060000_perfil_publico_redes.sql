-- Adopty Fase E — Redes de la organización en su ficha pública.
--
-- `organizaciones.redes` se creó en 20261006020000 pero no se usaba en ninguna
-- parte (columna muerta). Aquí se le da salida real: el adoptante ve los canales
-- de una organización VERIFICADA, que es justo lo que le da confianza.
--
-- Solo se exponen si la organización está verificada: es el mismo criterio que ya
-- usa la policy `organizaciones_select`. Un particular nunca tiene redes.
--
-- Hay que DROP antes que CREATE OR REPLACE: al cambiar los OUT params cambia el
-- tipo de retorno y PostgreSQL no lo permite sobre una función existente.

DROP FUNCTION IF EXISTS public.perfil_publico(uuid[]);

CREATE FUNCTION public.perfil_publico(p_ids uuid[])
RETURNS TABLE (
  id uuid,
  nombre text,
  foto text,
  tipo text,
  verificada boolean,
  eliminado boolean,
  sitio_web text,
  redes jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id,
         CASE WHEN u.activo THEN coalesce(p.nombre, o.nombre_oficial, 'Usuario')
              ELSE 'Usuario no disponible' END,
         CASE WHEN u.activo THEN coalesce(p.foto_perfil, o.logo) END,
         CASE WHEN o.id IS NOT NULL THEN 'organizacion' ELSE 'persona' END,
         coalesce(o.verificada, false),
         NOT u.activo,
         CASE WHEN o.verificada THEN o.sitio_web END,
         CASE WHEN o.verificada THEN o.redes END
    FROM public.usuarios u
    LEFT JOIN public.personas p ON p.id = u.id
    LEFT JOIN public.organizaciones o ON o.id = u.id
   WHERE u.id = ANY (p_ids);
$$;

REVOKE ALL ON FUNCTION public.perfil_publico(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.perfil_publico(uuid[]) TO anon, authenticated;