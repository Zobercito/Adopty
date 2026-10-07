-- Adopty Fase A — Privacidad de perfiles.
--
-- `personas_select USING (true)` exponía `telefono` y `descripcion` de TODOS los
-- usuarios a cualquier cliente (también anónimo) vía la REST API: la interfaz no
-- los mostraba, pero los datos estaban públicos. `/privacidad` afirmaba lo
-- contrario. Lo mismo con `direccion` de las organizaciones.
--
-- Aquí la lectura directa queda restringida al propio usuario y se abre una función
-- `SECURITY DEFINER` que devuelve SOLO campos públicos (nivel "tarjeta").

DROP POLICY IF EXISTS personas_select ON personas;
CREATE POLICY personas_select ON personas FOR SELECT USING (auth.uid() = id);

-- Las organizaciones no verificadas solo son visibles para sí mismas; las
-- verificadas siguen siendo públicas (badge "verificada" en la ficha de la mascota).
--
-- OJO: hay que tirar las DOS policies. La original de 002_rls.sql se llama
-- `org_select` (no `organizaciones_select`) y las policies de la misma tabla se
-- combinan con OR: dejar `org_select USING (true)` haría inútil este arreglo y
-- seguiría exponiendo la `direccion` de todas las organizaciones.
DROP POLICY IF EXISTS org_select ON organizaciones;
DROP POLICY IF EXISTS organizaciones_select ON organizaciones;
CREATE POLICY organizaciones_select ON organizaciones
  FOR SELECT USING (verificada OR auth.uid() = id);

-- ---------------------------------------------------------------------------
-- perfil_publico(ids) -> datos mínimos para mostrar a alguien.
-- Reemplaza los 5 puntos de código que leían `personas`/`organizaciones` con el
-- cliente del usuario (solicitudes, chat, ficha de mascota, panel admin).
-- Es SECURITY DEFINER porque debe cruzar RLS, y SET search_path para que no le
-- inyecten objetos.
--
-- Reglas:
--   - nunca devuelve telefono / descripcion / direccion / correo
--   - una cuenta eliminada (usuarios.activo = false) sale como "Usuario no disponible"
--   - `anon` puede llamarla: la ficha de una mascota es pública y debe mostrar
--     quién la publica sin sesión.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.perfil_publico(p_ids uuid[])
RETURNS TABLE (
  id uuid,
  nombre text,
  foto text,
  tipo text,
  verificada boolean,
  eliminado boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id,
         CASE WHEN u.activo THEN coalesce(p.nombre, o.nombre_oficial, 'Usuario')
              ELSE 'Usuario no disponible' END,
         CASE WHEN u.activo THEN p.foto_perfil END,
         CASE WHEN o.id IS NOT NULL THEN 'organizacion' ELSE 'persona' END,
         coalesce(o.verificada, false),
         NOT u.activo
    FROM public.usuarios u
    LEFT JOIN public.personas p ON p.id = u.id
    LEFT JOIN public.organizaciones o ON o.id = u.id
   WHERE u.id = ANY (p_ids);
$$;

-- La versión con `o.logo` (logo de organización) la redefine la migración siguiente,
-- que es la que añade esa columna.

REVOKE ALL ON FUNCTION public.perfil_publico(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.perfil_publico(uuid[]) TO anon, authenticated;