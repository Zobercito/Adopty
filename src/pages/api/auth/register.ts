import type { APIRoute } from 'astro';
import { ipCliente, rateLimitDistribuido, respuestaRateLimit } from '../../../lib/ratelimit';
import {
  avisoCorreoDuplicado,
  esCorreoYaRegistrado,
  respuestaEnvioCorreo,
} from '../../../lib/correo';
import { supabaseServer } from '../../../lib/supabase';
import { registerSchema } from '../../../lib/validation/user';

export const prerender = false;

/** POST /api/auth/register — validación Zod en servidor + signUp con metadata. Rate-limit 10/min por IP. */
export const POST: APIRoute = async ({ request, cookies, redirect, url }) => {
  const supabase = supabaseServer(cookies);
  const rl = await rateLimitDistribuido(supabase, `register:${ipCliente(request)}`, 10, 60_000);
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
  if (error) {
    // Misma respuesta que un alta correcta: no se puede distinguir si el correo
    // ya tenía cuenta (hallazgo I). El aviso real va por correo.
    if (esCorreoYaRegistrado(error)) {
      avisoCorreoDuplicado('register');
      return Response.json({ ...respuestaEnvioCorreo(), confirmaEmail: true });
    }
    console.error(`[auth] register: signUp falló (${error.code ?? 'sin-código'})`);
    return Response.json(
      { error: 'No se pudo crear la cuenta. Inténtalo de nuevo en unos minutos.' },
      { status: 400 },
    );
  }
  // Si el proyecto exige confirmación de email, no hay sesión todavía.
  if (!data.session) {
    return Response.json({ ...respuestaEnvioCorreo(), confirmaEmail: true });
  }
  return redirect('/perfil', 302);
};
