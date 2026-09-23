-- Adopty Fase 1 — 003_storage.sql — bucket `mascotas` + policies.
-- Límites finos (5MB, MIME, max 5) se refuerzan en servidor en Fase 2.

INSERT INTO storage.buckets (id, name, public)
VALUES ('mascotas', 'mascotas', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS storage_mascotas_select ON storage.objects;
CREATE POLICY storage_mascotas_select ON storage.objects FOR SELECT USING (bucket_id = 'mascotas');

DROP POLICY IF EXISTS storage_mascotas_insert ON storage.objects;
CREATE POLICY storage_mascotas_insert ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'mascotas' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS storage_mascotas_update ON storage.objects;
CREATE POLICY storage_mascotas_update ON storage.objects FOR UPDATE USING (
  bucket_id = 'mascotas' AND auth.uid() = owner
) WITH CHECK (bucket_id = 'mascotas' AND auth.uid() = owner);

DROP POLICY IF EXISTS storage_mascotas_delete ON storage.objects;
CREATE POLICY storage_mascotas_delete ON storage.objects FOR DELETE USING (
  bucket_id = 'mascotas' AND auth.uid() = owner
);
