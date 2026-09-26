import type { APIRoute } from 'astro';
import { ipCliente, rateLimit, respuestaRateLimit } from '../../../lib/ratelimit';
import { supabaseServer } from '../../../lib/supabase';
import { registerSchema } from '../../../lib/validation/user';

export const prerender = false;

/** POST /api/auth/register — validación Zod en servidor + signUp con metadata. Rate-limit 10/min por IP. */
export const POST: APIRoute = async ({ request, cookies, redirect, url }) => {
  const rl = rateLimit(`register:${ipCliente(request)}`, 10, 60_000);
  if (!rl.ok) return respuestaRateLimit(rl.reintentoEn ?? 60);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
      { status: 400 },
    );
  }
  const { nombre, correo, password, tipo_usuario } = parsed.data;
  const supabase = supabaseServer(cookies);
  const { data, error } = await supabase.auth.signUp({
    email: correo,
    password,
    options: {
      data: { nombre, tipo_usuario },
      // El link de confirmación vuelve a NUESTRA app (callback canjea `code` por sesión).
      // Funciona en local/preview/prod siempre que el origen esté en Redirect URLs.
      emailRedirectTo: `${url.origin}/api/auth/callback?next=/perfil`,
    },
  });
  if (error) return Response.json({ error: error.message }, { status: 400 });
  // Si el proyecto exige confirmación de email, no hay sesión todavía.
  if (!data.session) {
    return Response.json({ ok: true, confirmaEmail: true });
  }
  return redirect('/perfil', 302);
};
