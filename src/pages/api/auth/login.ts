import type { APIRoute } from 'astro';
import { ipCliente, rateLimit, respuestaRateLimit } from '../../../lib/ratelimit';
import { supabaseServer } from '../../../lib/supabase';
import { loginSchema } from '../../../lib/validation/user';

export const prerender = false;

/** POST /api/auth/login — signIn con cookies SSR + retorno a ?next=. Rate-limit 10/min por IP. */
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const rl = rateLimit(`login:${ipCliente(request)}`, 10, 60_000);
  if (!rl.ok) return respuestaRateLimit(rl.reintentoEn ?? 60);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Datos inválidos' }, { status: 400 });
  }
  const { correo, password } = parsed.data;
  const supabase = supabaseServer(cookies);
  const { error } = await supabase.auth.signInWithPassword({ email: correo, password });
  if (error) return Response.json({ error: 'Correo o contraseña incorrectos' }, { status: 401 });

  let next = '/perfil';
  try {
    const { next: n } = (body as { next?: string }) ?? {};
    if (n && n.startsWith('/') && !n.startsWith('//')) next = n;
  } catch {
    /* default */
  }
  return redirect(next, 302);
};
