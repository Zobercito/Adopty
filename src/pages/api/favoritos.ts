import type { APIRoute } from 'astro';
import { z } from 'zod';
import { supabaseServer } from '../../lib/supabase';

export const prerender = false;

const uuid = z.string().uuid('id_mascota inválido');

/**
 * GET /api/favoritos — lista ids favoritos del usuario (para migrar/hidratar UI).
 * POST /api/favoritos {id_mascota} — guarda (idempotente).
 * DELETE /api/favoritos?id_mascota= — quita.
 * Solo acepta UUIDs reales (Supabase). Los ids del mock Fase 0 (toby, luna…)
 * se quedan en localStorage hasta Fase 2/3 cuando explorar lea de DB.
 */
export const GET: APIRoute = async ({ cookies }) => {
  const supabase = supabaseServer(cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });
  const { data, error } = await supabase
    .from('favoritos')
    .select('id_mascota')
    .eq('id_usuario', user.id);
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ favoritos: (data ?? []).map((f) => f.id_mascota) });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = supabaseServer(cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return Response.json({ error: 'No autenticado — inicia sesión para guardar' }, { status: 401 });
  const parsed = z.object({ id_mascota: uuid }).safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json(
      { error: 'id_mascota debe ser UUID (los del mock se guardan local)' },
      { status: 400 },
    );
  const { error } = await supabase
    .from('favoritos')
    .upsert(
      { id_usuario: user.id, id_mascota: parsed.data.id_mascota },
      { onConflict: 'id_usuario,id_mascota' },
    );
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ ok: true });
};

export const DELETE: APIRoute = async ({ url, cookies }) => {
  const supabase = supabaseServer(cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });
  const parsed = uuid.safeParse(url.searchParams.get('id_mascota'));
  if (!parsed.success) return Response.json({ error: 'id_mascota debe ser UUID' }, { status: 400 });
  const { error } = await supabase
    .from('favoritos')
    .delete()
    .eq('id_usuario', user.id)
    .eq('id_mascota', parsed.data);
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ ok: true });
};
