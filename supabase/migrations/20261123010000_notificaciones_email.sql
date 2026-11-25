-- Adopty — avisos por email de solicitudes y mensajes (AUD-05).
--
-- Diseño sin service role: el aviso se encola desde una RPC `SECURITY DEFINER` que
-- comprueba la relación real entre el llamante y el destinatario. El correo se lee
-- dentro de la base y se envía con `pg_net` + el secreto de Vault; el email nunca
-- se devuelve a la aplicación ni se expone a otro usuario.
--
-- Activación (una vez, requiere acceso a Supabase):
--   1. `supabase db push` para aplicar esta migración.
--   2. `select vault.create_secret('<re_...>', 'resend_api_key');`
--   3. Comprobar que `pg_net` está habilitado (esta migración intenta crearlo).
-- Sin el secreto o sin `pg_net`, las funciones no hacen nada: la app sigue igual.

-- ============ 1. Preferencia de avisos ============
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS notificaciones_email BOOLEAN NOT NULL DEFAULT true;

-- El usuario solo puede cambiar esa columna: el resto de `usuarios` sigue cerrado.
DROP POLICY IF EXISTS usuarios_update_notificaciones ON public.usuarios;
CREATE POLICY usuarios_update_notificaciones ON public.usuarios
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

REVOKE UPDATE ON public.usuarios FROM authenticated;
GRANT UPDATE (notificaciones_email) ON public.usuarios TO authenticated;

-- ============ 2. Antispam: un aviso por tipo/mascota/destinatario/hora ============
-- Sin policies: solo lo escribe/lee la función SECURITY DEFINER. No guarda correo
-- ni contenido, solo IDs y tipo.
CREATE TABLE IF NOT EXISTS public.notificaciones_log (
  id BIGSERIAL PRIMARY KEY,
  tipo TEXT NOT NULL,
  id_mascota UUID NOT NULL,
  id_destinatario UUID NOT NULL,
  fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_hora TIMESTAMPTZ NOT NULL DEFAULT date_trunc('hour', now())
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_notificacion_hora
  ON public.notificaciones_log (tipo, id_mascota, id_destinatario, fecha_hora);
ALTER TABLE public.notificaciones_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notificaciones_log FROM PUBLIC;
REVOKE ALL ON public.notificaciones_log FROM anon, authenticated;

-- ============ 3. pg_net (HTTP saliente) ============
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_net;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pg_net no disponible; los avisos por email quedan desactivados';
END $$;

-- ============ 3. Envío real ============
-- Solo la llama `encolar_notificacion`; no se concede a anon/authenticated.
CREATE OR REPLACE FUNCTION public.notificar_email(
  p_destinatario uuid,
  p_asunto text,
  p_cuerpo text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_correo text;
  v_avisos boolean;
  v_key text;
BEGIN
  SELECT u.correo, u.notificaciones_email
    INTO v_correo, v_avisos
    FROM public.usuarios u
   WHERE u.id = p_destinatario
     AND u.activo
     AND u.borrado_en IS NULL;

  IF v_correo IS NULL OR v_avisos IS NOT TRUE THEN
    RETURN;
  END IF;

  -- El secreto vive en Vault; nunca en una variable de entorno de la app.
  IF to_regclass('vault.decrypted_secrets') IS NULL THEN
    RETURN;
  END IF;
  SELECT s.decrypted_secret
    INTO v_key
    FROM vault.decrypted_secrets s
   WHERE s.name = 'resend_api_key'
   LIMIT 1;
  IF v_key IS NULL OR v_key = '' THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'net') THEN
    RETURN;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := 'https://api.resend.com/emails',
      body := jsonb_build_object(
        'from', 'Adopty <no-reply@adopty.lat>',
        'to', v_correo,
        'subject', p_asunto,
        'text', p_cuerpo
      ),
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || v_key,
        'Content-Type', 'application/json'
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Un fallo del proveedor nunca debe tumbar la operación principal.
    RAISE WARNING 'notificar_email: %', SQLERRM;
  END;
END $$;

REVOKE ALL ON FUNCTION public.notificar_email(uuid, text, text) FROM PUBLIC;

-- ============ 4. Encolado autorizado ============
-- Valida que el llamante puede avisar a `p_destinatario` por ese evento antes de
-- leer el correo. Si no hay relación, no hace nada (no revela si el usuario existe).
CREATE OR REPLACE FUNCTION public.encolar_notificacion(
  p_tipo text,
  p_mascota uuid,
  p_destinatario uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nombre text;
  v_asunto text;
  v_cuerpo text;
  v_url text := 'https://adopty.lat';
BEGIN
  IF auth.uid() IS NULL
     OR NOT public.cuenta_activa()
     OR p_destinatario IS NULL
     OR p_destinatario = auth.uid()
     OR p_tipo NOT IN (
       'solicitud_nueva',
       'solicitud_aprobada',
       'solicitud_rechazada',
       'mensaje_nuevo'
     ) THEN
    RETURN;
  END IF;

  IF p_tipo = 'solicitud_nueva' THEN
    SELECT m.nombre
      INTO v_nombre
      FROM public.mascotas m
      JOIN public.solicitudes s ON s.id_mascota = m.id
     WHERE m.id = p_mascota
       AND m.id_publicador = p_destinatario
       AND s.id_adoptante = auth.uid()
       AND s.estado IN ('pendiente', 'aprobada', 'rechazada')
       AND s.fecha_solicitud > now() - interval '10 minutes'
     LIMIT 1;
    v_asunto := 'Nueva solicitud para ' || v_nombre;
    v_cuerpo := 'Alguien solicitó adoptar a ' || v_nombre ||
      '. Revísalo en ' || v_url || '/panel/solicitudes';
  ELSIF p_tipo IN ('solicitud_aprobada', 'solicitud_rechazada') THEN
    SELECT m.nombre
      INTO v_nombre
      FROM public.mascotas m
      JOIN public.solicitudes s ON s.id_mascota = m.id
     WHERE m.id = p_mascota
       AND m.id_publicador = auth.uid()
       AND s.id_adoptante = p_destinatario
       AND s.estado = (
         CASE
           WHEN p_tipo = 'solicitud_aprobada' THEN 'aprobada'
           ELSE 'rechazada'
         END
       )::public.estado_solicitud
     LIMIT 1;
    v_asunto := CASE
      WHEN p_tipo = 'solicitud_aprobada'
        THEN 'Tu solicitud para ' || v_nombre || ' fue aprobada'
      ELSE 'Tu solicitud para ' || v_nombre || ' fue rechazada'
    END;
    v_cuerpo := CASE
      WHEN p_tipo = 'solicitud_aprobada'
        THEN 'La solicitud fue aprobada. El chat ya está abierto en ' || v_url || '/mensajes'
      ELSE 'La solicitud fue rechazada. Puedes ver el estado en ' || v_url || '/mis-solicitudes'
    END;
  ELSIF p_tipo = 'mensaje_nuevo' THEN
    SELECT m.nombre
      INTO v_nombre
      FROM public.mascotas m
      JOIN public.solicitudes s ON s.id_mascota = m.id
     WHERE m.id = p_mascota
       AND s.estado = 'aprobada'
       AND (
         (s.id_adoptante = auth.uid() AND m.id_publicador = p_destinatario)
         OR (s.id_adoptante = p_destinatario AND m.id_publicador = auth.uid())
       )
     LIMIT 1;

    -- Solo si acaba de enviarse un mensaje (evita llamar la RPC a mano).
    IF v_nombre IS NOT NULL AND NOT EXISTS (
      SELECT 1
        FROM public.mensajes
       WHERE id_mascota = p_mascota
         AND id_emisor = auth.uid()
         AND id_receptor = p_destinatario
         AND fecha_envio > now() - interval '2 minutes'
    ) THEN
      RETURN;
    END IF;

    -- Un aviso por hilo mientras el primero siga sin leer (evita spam).
    IF v_nombre IS NOT NULL AND (
      SELECT count(*)
        FROM public.mensajes
       WHERE id_mascota = p_mascota
         AND id_emisor = auth.uid()
         AND id_receptor = p_destinatario
         AND leido = false
    ) > 1 THEN
      RETURN;
    END IF;

    v_asunto := 'Nuevo mensaje sobre ' || v_nombre;
    v_cuerpo := 'Tienes un mensaje nuevo. Responde en ' || v_url || '/mensajes';
  END IF;

  IF v_nombre IS NULL THEN
    RETURN;
  END IF;

  -- Evita saltos de línea en asuntos y cuerpos (nombres de mascota).
  v_asunto := regexp_replace(v_asunto, '[\r\n]+', ' ', 'g');
  v_cuerpo := regexp_replace(v_cuerpo, '[\r\n]+', ' ', 'g');

  -- Un aviso por tipo/mascota/destinatario/hora (antispam si llaman la RPC a mano).
  INSERT INTO public.notificaciones_log (tipo, id_mascota, id_destinatario)
  VALUES (p_tipo, p_mascota, p_destinatario)
  ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  PERFORM public.notificar_email(p_destinatario, v_asunto, v_cuerpo);
END $$;

REVOKE ALL ON FUNCTION public.encolar_notificacion(text, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.encolar_notificacion(text, uuid, uuid) TO authenticated;
