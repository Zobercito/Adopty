-- Adopty — D.1/D.2: `consumir_rate_limit` deja de ser una herramienta pública.
--
-- La RPC estaba concedida a `anon` y la clave la elegía el cliente, así que
-- cualquiera podía inflar el cubo de otra IP (`login:<ip>`) o de otro usuario
-- (`perfil:<uuid>`, `mensaje:<uuid>`) y dejarlo bloqueado, y crear filas
-- ilimitadas en `rate_limits` sin autenticación.
--
-- Dos cambios, sin tocar la firma ni el formato de respuesta:
--   1. Sin sesión no se puede llamar. `login`/`register`/`recuperar` siguen
--      limitados por el contador en memoria (`rateLimitDistribuido` cae a él si
--      la RPC falla) y por los límites propios de Supabase Auth.
--   2. Con sesión, la clave tiene que terminar en `:<auth.uid()>`. Todos los
--      llamadores de la app cumplen el formato, y así nadie puede inflar el
--      cubo de otro usuario.
-- La limpieza pasa a borrar los cubos ya expirados (antes esperaba un día de
-- más), para que la tabla no crezca con ventanas que ya no cuentan.

CREATE OR REPLACE FUNCTION public.consumir_rate_limit(
  p_clave text,
  p_max integer,
  p_ventana_ms bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_contador integer;
  v_expira timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'rate limit requiere sesión' USING ERRCODE = '42501';
  END IF;

  IF p_clave IS NULL OR length(p_clave) = 0 OR length(p_clave) > 200
     OR p_max < 1 OR p_ventana_ms < 1000 OR p_ventana_ms > 86400000 THEN
    RAISE EXCEPTION 'parámetros de rate limit inválidos';
  END IF;

  -- La clave es del llamador: si no acaba en su id, es de otro usuario.
  IF p_clave NOT LIKE '%:' || v_uid::text THEN
    RAISE EXCEPTION 'clave de rate limit ajena' USING ERRCODE = '42501';
  END IF;

  -- INSERT ... ON CONFLICT DO UPDATE toma un lock de fila: dos peticiones
  -- simultáneas del mismo cubo se serializan y no se pierde ningún conteo.
  INSERT INTO public.rate_limits AS rl (clave, contador, expira_en)
  VALUES (p_clave, 1, now() + make_interval(secs => p_ventana_ms / 1000.0))
  ON CONFLICT (clave) DO UPDATE
    SET contador = CASE WHEN rl.expira_en <= now() THEN 1 ELSE rl.contador + 1 END,
        expira_en = CASE WHEN rl.expira_en <= now() THEN EXCLUDED.expira_en ELSE rl.expira_en END
  RETURNING rl.contador, rl.expira_en INTO v_contador, v_expira;

  -- Limpieza oportunista (1 % de las llamadas): un cubo expirado ya no cuenta
  -- (el INSERT lo reinicia), así que se puede borrar en cuanto caduca.
  IF random() < 0.01 THEN
    DELETE FROM public.rate_limits WHERE expira_en <= now();
  END IF;

  RETURN jsonb_build_object(
    'ok', v_contador <= p_max,
    'reintento_en', CASE
      WHEN v_contador > p_max
        THEN greatest(1, ceil(extract(epoch FROM (v_expira - now()))))::integer
      ELSE 0
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consumir_rate_limit(text, integer, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consumir_rate_limit(text, integer, bigint) FROM anon;
GRANT EXECUTE ON FUNCTION public.consumir_rate_limit(text, integer, bigint) TO authenticated;
