-- Adopty Fase D — Cuenta: sincronización del correo, baja lógica y ficha del
-- adoptante para el publicador.

-- ============ 1. usuarios.correo espeja auth.users.email ============
-- `usuarios.correo` se llenaba solo al registrarse. Sin este trigger, cambiar el
-- correo dejaría el panel de admin y la auditoría mostrando el correo viejo.
CREATE OR REPLACE FUNCTION public.sync_usuarios_correo() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    UPDATE public.usuarios SET correo = NEW.email WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_sync_correo ON auth.users;
CREATE TRIGGER trg_sync_correo AFTER UPDATE OF email ON auth.users
  FOR EACH ROW WHEN (NEW.email IS DISTINCT FROM OLD.email)
  EXECUTE FUNCTION public.sync_usuarios_correo();

-- ============ 2. resumen_adoptantes: lo que el publicador puede ver ============
-- El perfil del adoptante solo se abre si el publicador tiene una solicitud de esa
-- persona sobre una de sus mascotas. La autorización va DENTRO de la función
-- (RLS no expresa "tiene una solicitud conmigo") y el admin también puede ver.
CREATE OR REPLACE FUNCTION public.resumen_adoptantes(p_adoptantes uuid[])
RETURNS TABLE (
  id uuid,
  nombre text,
  foto text,
  zona text,
  experiencia text,
  motivacion text,
  sobre_mi text,
  eliminado boolean,
  solicitudes int,
  aprobada boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id,
         CASE WHEN u.activo THEN coalesce(p.nombre, o.nombre_oficial, 'Adoptante')
              ELSE 'Usuario no disponible' END,
         CASE WHEN u.activo THEN coalesce(p.foto_perfil, o.logo) END,
         pe.ubicacion,
         CASE WHEN p.experiencia IS NULL THEN NULL ELSE p.experiencia::text END,
         CASE WHEN u.activo THEN p.motivacion END,
         CASE WHEN u.activo THEN p.descripcion END,
         NOT u.activo,
         count(s.id)::int,
         bool_or(s.estado = 'aprobada')
    FROM public.usuarios u
    JOIN public.solicitudes s ON s.id_adoptante = u.id
    JOIN public.mascotas m ON m.id = s.id_mascota
    LEFT JOIN public.personas p ON p.id = u.id
    LEFT JOIN public.organizaciones o ON o.id = u.id
    LEFT JOIN public.perfil_estilo_vida pe ON pe.id_persona = u.id
   WHERE u.id = ANY (p_adoptantes)
     AND (m.id_publicador = auth.uid() OR public.soy_admin())
   GROUP BY u.id, p.nombre, o.nombre_oficial, p.foto_perfil, o.logo, pe.ubicacion,
            p.experiencia, p.motivacion, p.descripcion, u.activo;
$$;

REVOKE ALL ON FUNCTION public.resumen_adoptantes(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resumen_adoptantes(uuid[]) TO authenticated;

-- ============ 3. eliminar_mi_cuenta: baja lógica + anonimización ============
-- No hay service role en el proyecto, así que `auth.admin.deleteUser()` no es
-- posible: la baja es lógica (`usuarios.activo = false`) y anonimiza lo personal.
-- Además un DELETE en cascada borraría las mascotas ya adoptadas, que
-- /privacidad declara que conservan registro mínimo histórico.
--
-- Reglas acordadas:
--   - si hay una solicitud APROBADA sin resolver, no se permite el borrado (adopción
--     en curso: hay que cerrarla antes)
--   - las mascotas `disponible` se despublican
--   - las solicitudes `pendiente` se cancelan
--   - los mensajes se conservan: la otra parte los sigue viendo, pero la persona
--     aparece como "Usuario no disponible"
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
   WHERE s.id_adoptante = v_id AND s.estado = 'aprobada';
  IF v_aprobadas > 0 THEN
    RAISE EXCEPTION
      'Tienes % adopción(es) aprobada(s) sin resolver. Cancélalas o complétalas antes de eliminar tu cuenta.',
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