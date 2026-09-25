import type { APIRoute } from 'astro';
import { supabaseServer } from '../../../lib/supabase';

export const prerender = false;

/**
 * GET /api/auth/google?next=/perfil — inicia OAuth con Google (Fase 1).
 * Requiere provider Google activo en Supabase (Dashboard o env local).
 * Si no está configurado, Supabase devuelve error y respondemos 501 claro
 * en vez de romper: el login por correo sigue funcionando.
 */
export const GET: APIRoute = async ({ url, cookies, redirect }) => {
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
