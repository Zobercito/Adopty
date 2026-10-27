-- Adopty — rate-limit distribuido (cierra P2-03).
--
-- El contador en memoria de src/lib/ratelimit.ts no se comparte entre
-- instancias serverless. Esta tabla + RPC atómica mantiene el contador en
-- Postgres, que sí es común a todas las instancias. La app usa la RPC y cae
-- al contador en memoria si la migración aún no está aplicada o la RPC falla.

CREATE TABLE IF NOT EXISTS public.rate_limits (
  clave text PRIMARY KEY,
  contador integer NOT NULL DEFAULT 0,
  expira_en timestamptz NOT NULL,
  CONSTRAINT rate_limits_clave_larga CHECK (length(clave) <= 200)
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Sin policies y sin privilegios directos: solo la función SECURITY DEFINER
-- puede leer o escribir. Evita que un cliente borre o infle su propio cubo.
REVOKE ALL ON public.rate_limits FROM anon, authenticated;

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
  v_contador integer;
  v_expira timestamptz;
BEGIN
  IF p_clave IS NULL OR length(p_clave) = 0 OR length(p_clave) > 200
     OR p_max < 1 OR p_ventana_ms < 1000 OR p_ventana_ms > 86400000 THEN
    RAISE EXCEPTION 'parámetros de rate limit inválidos';
  END IF;

  -- INSERT ... ON CONFLICT DO UPDATE toma un lock de fila: dos peticiones
  -- simultáneas del mismo cubo se serializan y no se pierde ningún conteo.
  INSERT INTO public.rate_limits AS rl (clave, contador, expira_en)
  VALUES (p_clave, 1, now() + make_interval(secs => p_ventana_ms / 1000.0))
  ON CONFLICT (clave) DO UPDATE
    SET contador = CASE WHEN rl.expira_en <= now() THEN 1 ELSE rl.contador + 1 END,
        expira_en = CASE WHEN rl.expira_en <= now() THEN EXCLUDED.expira_en ELSE rl.expira_en END
  RETURNING rl.contador, rl.expira_en INTO v_contador, v_expira;

  -- Limpieza oportunista (1 % de las llamadas) para que la tabla no crezca sin fin.
  IF random() < 0.01 THEN
    DELETE FROM public.rate_limits WHERE expira_en < now() - interval '1 day';
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
GRANT EXECUTE ON FUNCTION public.consumir_rate_limit(text, integer, bigint) TO anon, authenticated;
