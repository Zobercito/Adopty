-- Adopty — J: las policies de escritura de Storage también exigen cuenta activa.
--
-- Las policies de `storage.objects` solo comprobaban el prefijo `{uid}/`. La
-- `anon key` es pública, así que una cuenta suspendida (`usuarios.activo =
-- false`) con un JWT vigente seguía subiendo y borrando fotos en `mascotas` y
-- `perfiles` sin pasar por la app.
--
-- `public.cuenta_activa()` (`20261028010000`) ya es lo que decide en las tablas:
-- `SECURITY DEFINER`, `STABLE`, `search_path` fijo y EXECUTE para
-- `authenticated`, así que puede evaluarse desde `storage.objects` (la policy
-- corre con el rol del usuario, pero la función es del owner y no pasa por RLS
-- de `usuarios`).
--
-- Excepción deliberada en DELETE: `eliminar_mi_cuenta()` marca `activo = false`
-- ANTES de que `POST /api/cuenta/borrar` borre la foto de perfil (la policy
-- exige `auth.uid()` y la sesión sigue abierta), así que con la guardia sola la
-- baja legítima dejaría el fichero huérfano. `cuenta_dada_de_baja()` separa la
-- baja (`borrado_en` no nulo) de la suspensión (`borrado_en` NULL): una
-- suspendida no borra nada; una dada de baja solo puede borrar dentro de su
-- propio prefijo. INSERT y UPDATE exigen `cuenta_activa()` sin excepción.

CREATE OR REPLACE FUNCTION public.cuenta_dada_de_baja()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = auth.uid() AND NOT u.activo AND u.borrado_en IS NOT NULL
  );
$$;

REVOKE ALL ON FUNCTION public.cuenta_dada_de_baja() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cuenta_dada_de_baja() TO authenticated;

-- ============ bucket mascotas ============
drop policy if exists storage_mascotas_insert on storage.objects;
create policy storage_mascotas_insert on storage.objects for insert
  with check (
    bucket_id = 'mascotas'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.cuenta_activa()
  );

drop policy if exists storage_mascotas_update on storage.objects;
create policy storage_mascotas_update on storage.objects for update
  using (
    bucket_id = 'mascotas'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.cuenta_activa()
  )
  with check (
    bucket_id = 'mascotas'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.cuenta_activa()
  );

drop policy if exists storage_mascotas_delete on storage.objects;
create policy storage_mascotas_delete on storage.objects for delete
  using (
    bucket_id = 'mascotas'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (public.cuenta_activa() or public.cuenta_dada_de_baja())
  );

-- ============ bucket perfiles ============
drop policy if exists storage_perfiles_insert on storage.objects;
create policy storage_perfiles_insert on storage.objects for insert
  with check (
    bucket_id = 'perfiles'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.cuenta_activa()
  );

drop policy if exists storage_perfiles_update on storage.objects;
create policy storage_perfiles_update on storage.objects for update
  using (
    bucket_id = 'perfiles'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.cuenta_activa()
  )
  with check (
    bucket_id = 'perfiles'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.cuenta_activa()
  );

drop policy if exists storage_perfiles_delete on storage.objects;
create policy storage_perfiles_delete on storage.objects for delete
  using (
    bucket_id = 'perfiles'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (public.cuenta_activa() or public.cuenta_dada_de_baja())
  );
