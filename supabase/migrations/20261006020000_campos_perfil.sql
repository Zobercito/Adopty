-- Adopty Fase C — Campos del perfil del adoptante, logo/redes de organización,
-- baja lógica de cuenta y fotos de perfil.
--
-- Decisiones de producto:
--   - `personas.telefono` se elimina: se escribía pero no se leía en ningún sitio,
--     contradecía la promesa del chat ("el contacto es por chat interno") y, con la
--     policy anterior, era un dato expuesto.
--   - La foto de perfil usa la columna que existía desde el esquema y nunca se usó.

-- ============ 1. Campos del adoptante ============
DO $$ BEGIN
  CREATE TYPE experiencia_adoptante AS ENUM ('primera_vez', 'alguna_vez', 'experimentada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE personas
  ADD COLUMN IF NOT EXISTS experiencia experiencia_adoptante NULL,
  ADD COLUMN IF NOT EXISTS motivacion TEXT NULL
    CHECK (motivacion IS NULL OR char_length(motivacion) <= 300);

-- `usuarios.activo` existía desde el esquema y nunca se usó: era el gancho natural
-- para la baja lógica (y para la suspensión que ya promete /terminos).
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS borrado_en TIMESTAMPTZ NULL;

-- ============ 2. Organización ============
ALTER TABLE organizaciones
  ADD COLUMN IF NOT EXISTS logo TEXT NULL,
  ADD COLUMN IF NOT EXISTS redes JSONB NULL,
  ADD COLUMN IF NOT EXISTS contacto_visible BOOLEAN NOT NULL DEFAULT false;

-- ============ 3. Fuera el teléfono ============
ALTER TABLE personas DROP COLUMN IF EXISTS telefono;

-- ============ 4. Bucket de fotos de perfil ============
-- El bucket `mascotas` no sirve: es público y su INSERT no limita la ruta, así que
-- cualquier autenticado podía subir sobre la carpeta de otro. Este sí aísla por
-- prefijo `{user_id}/`.
INSERT INTO storage.buckets (id, name, public) VALUES ('perfiles', 'perfiles', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS storage_perfiles_select ON storage.objects;
CREATE POLICY storage_perfiles_select ON storage.objects
  FOR SELECT USING (bucket_id = 'perfiles');

DROP POLICY IF EXISTS storage_perfiles_insert ON storage.objects;
CREATE POLICY storage_perfiles_insert ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'perfiles'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS storage_perfiles_update ON storage.objects;
CREATE POLICY storage_perfiles_update ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'perfiles' AND (storage.foldername(name))[1] = auth.uid()::text
  ) WITH CHECK (
    bucket_id = 'perfiles' AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS storage_perfiles_delete ON storage.objects;
CREATE POLICY storage_perfiles_delete ON storage.objects
  FOR DELETE USING (
    bucket_id = 'perfiles' AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============ 5. perfil_publico ahora incluye el logo de la organización ============
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
         CASE WHEN u.activo THEN coalesce(p.foto_perfil, o.logo) END,
         CASE WHEN o.id IS NOT NULL THEN 'organizacion' ELSE 'persona' END,
         coalesce(o.verificada, false),
         NOT u.activo
    FROM public.usuarios u
    LEFT JOIN public.personas p ON p.id = u.id
    LEFT JOIN public.organizaciones o ON o.id = u.id
   WHERE u.id = ANY (p_ids);
$$;

REVOKE ALL ON FUNCTION public.perfil_publico(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.perfil_publico(uuid[]) TO anon, authenticated;