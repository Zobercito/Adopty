-- Adopty — permite la baja cuando la adopción aprobada ya se completó.
--
-- Antes, cualquier solicitud `aprobada` bloqueaba la baja para siempre, aunque la
-- mascota ya estuviera `adoptada`: el mensaje pedía "complétala", pero ninguna
-- transición permitía cerrar una solicitud aprobada. Ahora el bloqueo dura
-- mientras la mascota no esté `adoptada` (incluye `en_proceso` y cualquier
-- reversión a `disponible`); `adoptada` cuenta como resuelta.

CREATE OR REPLACE FUNCTION public.eliminar_mi_cuenta()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid := auth.uid();
  v_aprobadas int := 0;
  v_mascotas int := 0;
  v_solicitudes int := 0;
  v_mensajes int := 0;
BEGIN
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;

  SELECT count(*) INTO v_aprobadas
    FROM public.solicitudes s
    JOIN public.mascotas m ON m.id = s.id_mascota
   WHERE s.id_adoptante = v_id
     AND s.estado = 'aprobada'
     AND m.estado <> 'adoptada';
  IF v_aprobadas > 0 THEN
    RAISE EXCEPTION
      'Tienes % adopción(es) en curso. Espera a que el publicador marque la mascota como adoptada antes de eliminar tu cuenta.',
      v_aprobadas USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO v_mascotas FROM public.mascotas
   WHERE id_publicador = v_id AND estado = 'disponible' AND deleted_at IS NULL;

  SELECT count(*) INTO v_solicitudes FROM public.solicitudes
   WHERE id_adoptante = v_id AND estado = 'pendiente';

  SELECT count(*) INTO v_mensajes FROM public.mensajes
   WHERE id_emisor = v_id OR id_receptor = v_id;

  -- Despublicar las mascotas que seguían visibles en el Explorar.
  UPDATE public.mascotas SET deleted_at = now(), updated_at = now()
   WHERE id_publicador = v_id AND estado = 'disponible' AND deleted_at IS NULL;

  -- Cancelar lo pendiente en ambos sentidos.
  UPDATE public.solicitudes SET estado = 'cancelada'
   WHERE id_adoptante = v_id AND estado = 'pendiente';
  UPDATE public.solicitudes s SET estado = 'cancelada'
    FROM public.mascotas m
   WHERE s.id_mascota = m.id AND m.id_publicador = v_id AND s.estado = 'pendiente';

  -- Anonimizar (se conservan las filas: los mensajes las referencian).
  UPDATE public.personas
     SET nombre = 'Usuario no disponible', descripcion = NULL, foto_perfil = NULL
   WHERE id = v_id;
  UPDATE public.organizaciones
     SET nombre_oficial = 'Organización no disponible', descripcion = NULL,
         logo = NULL, verificada = false, contacto_visible = false
   WHERE id = v_id;

  UPDATE public.usuarios SET activo = false, borrado_en = now() WHERE id = v_id;

  -- Log de baja en la auditoría (misma tabla que usa el resto del panel admin).
  INSERT INTO auditoria (id_usuario, accion, tabla, id_registro, datos_nuevos)
  VALUES (v_id, 'baja_cuenta', 'usuarios', v_id, jsonb_build_object(
    'mascotas_despublicadas', v_mascotas,
    'solicitudes_canceladas', v_solicitudes,
    'mensajes_conservados', v_mensajes
  ));

  RETURN jsonb_build_object(
    'mascotas_despublicadas', v_mascotas,
    'solicitudes_canceladas', v_solicitudes,
    'mensajes_conservados', v_mensajes
  );
END; $$;

REVOKE ALL ON FUNCTION public.eliminar_mi_cuenta() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.eliminar_mi_cuenta() TO authenticated;
