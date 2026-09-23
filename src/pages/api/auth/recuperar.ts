import type { APIRoute } from 'astro';
import { supabaseServer } from '../../../lib/supabase';
import { z } from 'zod';

export const prerender = false;

/** POST /api/auth/recuperar — envía email de recuperación (link vuelve al callback). */
export const POST: APIRoute = async ({ request, cookies, url }) => {
  const parsed = z.object({ correo: z.string().email() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Correo inválido' }, { status: 400 });
  const supabase = supabaseServer(cookies);
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.correo, {
    redirectTo: `${url.origin}/api/auth/callback?next=/perfil`,
  });
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ ok: true });
};
