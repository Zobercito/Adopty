-- Adopty — E (020fot): rutas de foto confinadas en la base.
--
-- `fotos_write`, `personas_update` y `org_update` dejan al dueño escribir
-- `fotos_mascota.url_foto`, `personas.foto_perfil` y `organizaciones.logo` como
-- texto libre. La API valida `userId/uuid.webp`, pero la anon key es pública y
-- PostgREST se alcanza sin pasar por Astro: una ficha pública podía acabar con
-- `<img src="https://tercero/t.gif">` y filtrar IP/Referer de cada visitante
-- (Ley 81). El CHECK es la frontera real; Zod solo mejora el mensaje.
--
-- Se admiten dos formas y nada más:
--   1. Ruta relativa del bucket: `userId/uuid.webp` (lo que sube `storage.ts`).
--   2. Asset local del sitio: `/assets/<nombre>.(jpeg|jpg|png|webp)`, que usan
--      el seed y `mockPets` y se sirve desde el propio dominio. Se permite para
--      no borrar las fotos demo; no abre una URL externa porque no lleva host
--      ni `//`. La extensión se compara sin distinguir mayúsculas (`~*`)
--      porque el seed trae `/assets/6.JPG` y el fichero existe así en disco;
--      con `~` el saneado habría borrado esa fila.
--
-- Saneado de datos existentes: se añade el CHECK como NOT VALID (no escanea ni
-- puede tumbar el despliegue), después se limpian las filas que lo incumplen y
-- solo entonces se valida. Entre el ADD y la limpieza no pueden entrar filas
-- nuevas inválidas porque el CHECK ya se aplica a INSERT/UPDATE. Las rutas
-- externas de `fotos_mascota` no apuntan a ningún objeto del bucket y la
-- columna es NOT NULL, así que se eliminan (no hay nada que conservar); en las
-- columnas de perfil, que sí admiten NULL, se normalizan a NULL.

ALTER TABLE public.fotos_mascota
  ADD CONSTRAINT fotos_mascota_url_foto_ruta_valida CHECK (
    url_foto ~ '^[A-Za-z0-9_-]+/[A-Za-z0-9_-]+\.webp$'
    OR url_foto ~* '^/assets/[A-Za-z0-9_.-]+\.(jpe?g|png|webp)$'
  ) NOT VALID;

ALTER TABLE public.personas
  ADD CONSTRAINT personas_foto_perfil_ruta_valida CHECK (
    foto_perfil IS NULL
    OR foto_perfil ~ '^[A-Za-z0-9_-]+/[A-Za-z0-9_-]+\.webp$'
    OR foto_perfil ~* '^/assets/[A-Za-z0-9_.-]+\.(jpe?g|png|webp)$'
  ) NOT VALID;

ALTER TABLE public.organizaciones
  ADD CONSTRAINT organizaciones_logo_ruta_valida CHECK (
    logo IS NULL
    OR logo ~ '^[A-Za-z0-9_-]+/[A-Za-z0-9_-]+\.webp$'
    OR logo ~* '^/assets/[A-Za-z0-9_.-]+\.(jpe?g|png|webp)$'
  ) NOT VALID;

DELETE FROM public.fotos_mascota
WHERE NOT (
  url_foto ~ '^[A-Za-z0-9_-]+/[A-Za-z0-9_-]+\.webp$'
  OR url_foto ~* '^/assets/[A-Za-z0-9_.-]+\.(jpe?g|png|webp)$'
);

UPDATE public.personas
SET foto_perfil = NULL
WHERE foto_perfil IS NOT NULL
  AND NOT (
    foto_perfil ~ '^[A-Za-z0-9_-]+/[A-Za-z0-9_-]+\.webp$'
    OR foto_perfil ~* '^/assets/[A-Za-z0-9_.-]+\.(jpe?g|png|webp)$'
  );

UPDATE public.organizaciones
SET logo = NULL
WHERE logo IS NOT NULL
  AND NOT (
    logo ~ '^[A-Za-z0-9_-]+/[A-Za-z0-9_-]+\.webp$'
    OR logo ~* '^/assets/[A-Za-z0-9_.-]+\.(jpe?g|png|webp)$'
  );

ALTER TABLE public.fotos_mascota VALIDATE CONSTRAINT fotos_mascota_url_foto_ruta_valida;
ALTER TABLE public.personas VALIDATE CONSTRAINT personas_foto_perfil_ruta_valida;
ALTER TABLE public.organizaciones VALIDATE CONSTRAINT organizaciones_logo_ruta_valida;
