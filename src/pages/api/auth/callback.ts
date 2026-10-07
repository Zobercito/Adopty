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
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      // Una cuenta dada de baja no debe poder entrar ni por confirmación de correo
      // ni por OAuth: cerramos la sesión en el acto.
      const { data: estado } = await supabase
        .from('usuarios')
        .select('activo')
        .eq('id', data.user.id)
        .maybeSingle();
      if (estado && !estado.activo) {
        await supabase.auth.signOut();
        return redirect('/login?error=cuenta-dada-de-baja', 302);
      }
      return redirect(next.startsWith('/') ? next : '/perfil', 302);
    }
  }
  return redirect('/login?error=callback', 302);
};
