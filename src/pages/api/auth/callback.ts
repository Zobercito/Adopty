import type { APIRoute } from 'astro';
import { supabaseServer } from '../../../lib/supabase';

export const prerender = false;

/**
 * GET /api/auth/callback?code= — intercambio de código (confirmación de email
 * y futuro Google OAuth) por sesión en cookies SSR.
 */
export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/perfil';
  if (code) {
    const supabase = supabaseServer(cookies);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return redirect(next.startsWith('/') ? next : '/perfil', 302);
  }
  return redirect('/login?error=callback', 302);
};
