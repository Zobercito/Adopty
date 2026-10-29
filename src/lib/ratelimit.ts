/**
 * Rate-limit por clave en API routes (Fase 7).
 *
 * `rateLimitDistribuido` usa la RPC atómica `consumir_rate_limit` (tabla
 * `public.rate_limits`), compartida por todas las instancias serverless. Las
 * claves sin sesión (`login:`, `register:`, `recuperar:`) van por
 * `consumir_rate_limit_ip`, que acepta cubos anónimos con la IP hasheada y el
 * tope fijado en servidor: `consumir_rate_limit` exige `auth.uid()` y esas
 * rutas la llaman antes de autenticar.
 * `rateLimit` es el fallback en memoria para desarrollo o si la RPC falla.
 * Segunda capa: los límites propios de Supabase Auth (`sign_in_sign_ups`, etc.).
 */

import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Prefijos de cubos anónimos por IP (migración `20261028060000`). */
const PREFIJOS_ANONIMOS = ['login:', 'register:', 'recuperar:'];

/**
 * `login:1.2.3.4` → `login:<sha256(1.2.3.4)>`. La RPC anónima solo acepta esa
 * forma, así que la IP nunca se guarda en claro en `rate_limits` (Ley 81).
 */
function claveAnonima(clave: string): string {
  const corte = clave.indexOf(':');
  const prefijo = clave.slice(0, corte + 1);
  const hash = createHash('sha256')
    .update(clave.slice(corte + 1))
    .digest('hex');
  return `${prefijo}${hash}`;
}

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
  const anonima = PREFIJOS_ANONIMOS.some((p) => clave.startsWith(p));
  try {
    const { data, error } = await supabase.rpc(
      anonima ? 'consumir_rate_limit_ip' : 'consumir_rate_limit',
      {
        p_clave: anonima ? claveAnonima(clave) : clave,
        p_max: max,
        p_ventana_ms: ventanaMs,
      },
    );
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
