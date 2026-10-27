-- Endurece los buckets de fotos: límites de tamaño/MIME y ruta por dueño.
-- La app ya convierte a WebP ≤500 KB; esto es defensa en profundidad frente a
-- subidas directas a la API de Storage usando la sesión del usuario.

update storage.buckets
set file_size_limit = 512000,
    allowed_mime_types = array['image/webp']
where id in ('mascotas', 'perfiles');

drop policy if exists storage_mascotas_insert on storage.objects;
create policy storage_mascotas_insert on storage.objects for insert
  with check (
    bucket_id = 'mascotas'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists storage_mascotas_update on storage.objects;
create policy storage_mascotas_update on storage.objects for update
  using (
    bucket_id = 'mascotas'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'mascotas'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists storage_mascotas_delete on storage.objects;
create policy storage_mascotas_delete on storage.objects for delete
  using (
    bucket_id = 'mascotas'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
