import type { APIRoute } from 'astro';
import { z } from 'zod';
import { supabaseServer } from '../../../lib/supabase';

export const prerender = false;

/**
 * PATCH /api/mensajes/:id — marcar como leído (solo el receptor).
 */
export const PATCH: APIRoute = async ({ params, cookies }) => {
  const supabase = supabaseServer(cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

  const id = params.id ?? '';
  if (!z.string().uuid().safeParse(id).success) {
    return Response.json({ error: 'ID inválido' }, { status: 400 });
  }

  // Solo el receptor puede marcar como leído
  const { data, error } = await supabase
    .from('mensajes')
    .update({ leido: true })
    .eq('id', id)
    .eq('id_receptor', user.id)
    .eq('leido', false)
    .select('id')
    .maybeSingle();

  if (error) return Response.json({ error: error.message }, { status: 400 });
  if (!data) return Response.json({ error: 'Mensaje no encontrado o ya leído' }, { status: 404 });

  return Response.json({ ok: true });
};
