import type { APIRoute } from 'astro';
import { supabaseServer } from '../../../lib/supabase';

export const prerender = false;

/** POST /api/auth/logout — cierra sesión y vuelve al inicio. */
export const POST: APIRoute = async ({ cookies, redirect }) => {
  const supabase = supabaseServer(cookies);
  await supabase.auth.signOut();
  return redirect('/', 302);
};
