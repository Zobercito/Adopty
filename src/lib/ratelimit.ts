/**
 * Rate-limit en memoria por (clave) — primera capa anti-abuso en API routes (Fase 7).
 * Segunda capa: los límites propios de Supabase Auth (`sign_in_sign_ups`, etc.).
 * Nota: en serverless cada instancia lleva su contador; suficiente para frenar
 * abuso casual. Para producción multi-instancia se migraría a Upstash/KV.
 */

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
