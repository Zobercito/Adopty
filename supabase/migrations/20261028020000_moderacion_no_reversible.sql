-- Adopty — C.1: la ocultación por moderación no la puede revertir el dueño.
--
-- `mascotas_update` deja al publicador escribir su propia fila y el trigger
-- `validar_mascota` solo miraba `id_publicador` y `estado`. Un `PATCH` directo a
-- PostgREST con `{"deleted_at": null}` (o un UPDATE desde el cliente) volvía a
-- publicar una mascota oculta por moderación, sin pasar por
-- `restaurar_publicacion()` ni dejar rastro en el reporte.
--
-- No se prohíbe cualquier cambio de `deleted_at`: el dueño tiene que poder
-- ocultar su propia publicación (`DELETE /api/mascotas/:id` hace
-- `deleted_at = now()`). Solo se bloquea oculta → visible.

CREATE OR REPLACE FUNCTION public.validar_mascota()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.estado <> 'disponible' THEN
      RAISE EXCEPTION 'Una publicación nueva debe estar disponible';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.id_publicador IS DISTINCT FROM OLD.id_publicador THEN
    RAISE EXCEPTION 'No puedes cambiar el publicador de la mascota';
  END IF;

  IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL
     AND NOT public.soy_admin() THEN
    RAISE EXCEPTION 'Solo un administrador puede restaurar una publicación oculta'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.estado IS DISTINCT FROM OLD.estado THEN
    IF OLD.estado = 'adoptada' THEN
      RAISE EXCEPTION 'Una mascota adoptada no puede cambiar de estado';
    END IF;
    IF auth.uid() <> OLD.id_publicador AND NOT public.soy_admin() THEN
      RAISE EXCEPTION 'Solo el publicador puede cambiar el estado';
    END IF;
  END IF;

  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.validar_mascota() FROM PUBLIC;
