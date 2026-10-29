-- Adopty — C (307rld): rate-limit distribuido para endpoints sin sesión.
--
-- `consumir_rate_limit` exige `auth.uid()` (correcto: sin eso cualquiera infla
-- el cubo de otro usuario). Pero `login`, `register` y `recuperar` la llaman
-- antes de autenticar, así que respondía 42501 y `rateLimitDistribuido` caía al
-- `Map` en memoria, que es por instancia serverless: el límite real de fuerza
-- bruta quedaba solo en el de Supabase Auth.
--
-- Esta RPC cubre solo los cubos anónimos por IP, con tres candados para que no
-- sea un bypass del límite ni un vertedero de filas:
--   1. La clave es opaca y acotada: `login|register|recuperar:<sha256(ip)>`.
--      El cliente hashea la IP antes de enviarla (Ley 81: no se guardan IPs en
--      claro) y el CHECK de forma impide claves arbitrarias.
--   2. `p_max` y `p_ventana_ms` se recortan en servidor con `LEAST`: llamar a la
--      RPC con `p_max = 999999` o una ventana de un día no relaja nada (solo se
--      puede endurecer). El tope (10 por 60 s) cubre los tres endpoints.
--   3. Purga de cubos expirados en la propia función: cada fila anónima caduca
--      en <= 60 s, así que el tamaño de la tabla queda acotado por el ritmo de
--      peticiones, no por el tiempo transcurrido.
--
-- No toca `consumir_rate_limit` (sigue exigiendo sesión) ni `rate_limits`.

CREATE OR REPLACE FUNCTION public.consumir_rate_limit_ip(
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
  -- Topes duros: el cliente nunca decide cuánto se relaja el límite.
  c_max integer := 10;
  c_ventana_ms bigint := 60000;
  v_max integer;
  v_ventana_ms bigint;
  v_contador integer;
  v_expira timestamptz;
BEGIN
  IF p_clave IS NULL OR p_clave !~ '^(login|register|recuperar):[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'clave de rate limit anónima inválida' USING ERRCODE = '22023';
  END IF;

  v_max := LEAST(greatest(coalesce(p_max, 1), 1), c_max);
  v_ventana_ms := LEAST(greatest(coalesce(p_ventana_ms, 1000), 1000), c_ventana_ms);

  -- Mismo upsert atómico que `consumir_rate_limit`: el lock de fila serializa
  -- dos peticiones simultáneas del mismo cubo y no se pierde ningún conteo.
  INSERT INTO public.rate_limits AS rl (clave, contador, expira_en)
  VALUES (p_clave, 1, now() + make_interval(secs => v_ventana_ms / 1000.0))
  ON CONFLICT (clave) DO UPDATE
    SET contador = CASE WHEN rl.expira_en <= now() THEN 1 ELSE rl.contador + 1 END,
        expira_en = CASE WHEN rl.expira_en <= now() THEN EXCLUDED.expira_en ELSE rl.expira_en END
  RETURNING rl.contador, rl.expira_en INTO v_contador, v_expira;

  -- Purga de cubos caducados (ya no cuentan: el INSERT los reinicia).
  IF random() < 0.01 THEN
    DELETE FROM public.rate_limits WHERE expira_en <= now();
  END IF;

  RETURN jsonb_build_object(
    'ok', v_contador <= v_max,
    'reintento_en', CASE
      WHEN v_contador > v_max
        THEN greatest(1, ceil(extract(epoch FROM (v_expira - now()))))::integer
      ELSE 0
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consumir_rate_limit_ip(text, integer, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consumir_rate_limit_ip(text, integer, bigint) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consumir_rate_limit_ip(text, integer, bigint) TO anon, authenticated;
