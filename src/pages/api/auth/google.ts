import type { APIRoute } from 'astro';
import { supabaseServer } from '../../../lib/supabase';
import { googleActivo } from '../../../lib/oauth';

export const prerender = false;

/**
 * GET /api/auth/google?next=/perfil — inicia OAuth con Google (Fase 1).
 *
 * Solo responde si el provider está habilitado (`PUBLIC_GOOGLE_ENABLED=true`
 * + credenciales en Supabase). Si no, devuelve 404 para que la UI no ofrezca
 * una opción que no puede completarse. El login por correo sigue funcionando.
 */
export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  if (!googleActivo) {
    return new Response('Not found', { status: 404 });
  }

  const rawNext = url.searchParams.get('next') ?? '/perfil';
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/perfil';
  const supabase = supabaseServer(cookies);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${url.origin}/api/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) {
    const msg = encodeURIComponent(
      'Google no está configurado en este entorno. Entra con correo o pide al admin activar el provider.',
    );
    return redirect(`/login?error=oauth&msg=${msg}&next=${encodeURIComponent(next)}`, 302);
  }
  return redirect(data.url, 302);
};
