/**
 * Rate-limit por clave en API routes (Fase 7).
 *
 * `rateLimitDistribuido` usa la RPC atómica `consumir_rate_limit` (tabla
 * `public.rate_limits`), compartida por todas las instancias serverless.
 * `rateLimit` es el fallback en memoria para desarrollo o si la RPC falla.
 * Segunda capa: los límites propios de Supabase Auth (`sign_in_sign_ups`, etc.).
 */

import type { SupabaseClient } from '@supabase/supabase-js';

interface Cubeta {
  marcas: number[];
}

const cubetas = new Map<string, Cubeta>();

export function rateLimit(
  clave: string,
  max: number,
  ventanaMs: number,
  ahora = Date.now(),
): { ok: boolean; reintentoEn?: number } {
  let cubeta = cubetas.get(clave);
  if (!cubeta) {
    cubeta = { marcas: [] };
    cubetas.set(clave, cubeta);
  }
  const corte = ahora - ventanaMs;
  cubeta.marcas = cubeta.marcas.filter((m) => m > corte);
  if (cubeta.marcas.length >= max) {
    return { ok: false, reintentoEn: Math.ceil((cubeta.marcas[0] + ventanaMs - ahora) / 1000) };
  }
  cubeta.marcas.push(ahora);
  if (cubetas.size > 5000) cubetas.clear();
  return { ok: true };
}

/**
 * Límite compartido en Postgres con fallback en memoria. Fail-open deliberado:
 * si la RPC falla, se aplica el contador local en vez de tumbar la petición.
 */
export async function rateLimitDistribuido(
  supabase: SupabaseClient,
  clave: string,
  max: number,
  ventanaMs: number,
): Promise<{ ok: boolean; reintentoEn?: number }> {
  try {
    const { data, error } = await supabase.rpc('consumir_rate_limit', {
      p_clave: clave,
      p_max: max,
      p_ventana_ms: ventanaMs,
    });
    if (error) return rateLimit(clave, max, ventanaMs);
    const r = data as { ok?: unknown; reintento_en?: unknown } | null;
    if (!r || typeof r.ok !== 'boolean') return rateLimit(clave, max, ventanaMs);
    if (r.ok) return { ok: true };
    return { ok: false, reintentoEn: Math.max(1, Number(r.reintento_en) || 1) };
  } catch {
    return rateLimit(clave, max, ventanaMs);
  }
}

/** IP del cliente en API routes (Vercel pone x-forwarded-for). */
export function ipCliente(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return 'desconocida';
}

/** Respuesta 429 estándar con Retry-After. */
export function respuestaRateLimit(reintentoEn: number): Response {
  return new Response(
    JSON.stringify({ error: `Demasiadas peticiones. Reintenta en ${reintentoEn}s` }),
    {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': String(reintentoEn) },
    },
  );
}
