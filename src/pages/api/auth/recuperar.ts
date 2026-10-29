import type { APIRoute } from 'astro';
import { ipCliente, rateLimitDistribuido, respuestaRateLimit } from '../../../lib/ratelimit';
import { supabaseServer } from '../../../lib/supabase';
import { z } from 'zod';

export const prerender = false;

/** POST /api/auth/recuperar — envía email de recuperación (link vuelve al callback). Rate-limit 5/min por IP. */
export const POST: APIRoute = async ({ request, cookies, url }) => {
  const supabase = supabaseServer(cookies);
  const rl = await rateLimitDistribuido(supabase, `recuperar:${ipCliente(request)}`, 5, 60_000);
  if (!rl.ok) return respuestaRateLimit(rl.reintentoEn ?? 60);
  const parsed = z
    .object({ correo: z.string().email() })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Correo inválido' }, { status: 400 });
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.correo, {
    redirectTo: `${url.origin}/api/auth/callback?next=/perfil`,
  });
  if (error) {
    // Respuesta uniforme (hallazgo I): el texto de GoTrue puede delatar si el
    // correo tiene cuenta. El detalle queda en el log, sin PII.
    console.warn(`[auth] recuperar: no se pudo enviar (${error.code ?? 'sin-código'})`);
  }
  return Response.json({ ok: true });
};
