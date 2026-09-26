import type { APIRoute } from 'astro';
import { supabaseServer } from '../../../lib/supabase';
import { fotosOrdenadas, type FotoRow, type MascotaRow } from '../../../lib/mascotas';
import { petUpdateSchema } from '../../../lib/validation/pet';
import { borrarFotosStorage } from '../../../lib/storage';

export const prerender = false;

/** GET /api/mascotas/:id — detalle (público si disponible y no borrada; dueño ve las suyas). */
export const GET: APIRoute = async ({ params, cookies }) => {
  const supabase = supabaseServer(cookies);
  const id = params.id ?? '';
  const { data, error } = await supabase
    .from('mascotas')
    .select('*, fotos_mascota(*)')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 400 });
  if (!data) return Response.json({ error: 'No encontrada' }, { status: 404 });
  const { fotos_mascota, ...pet } = data as MascotaRow & { fotos_mascota: FotoRow[] };
  return Response.json({ ...pet, fotos: fotosOrdenadas(fotos_mascota) });
};

/** PATCH /api/mascotas/:id — edita campos + fotos (keep/new), soft-delete de fotos quitadas. */
export const PATCH: APIRoute = async ({ params, request, cookies }) => {
  const supabase = supabaseServer(cookies);
  const id = params.id ?? '';
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

  const { data: actual } = await supabase
    .from('mascotas')
    .select('id_publicador')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!actual) return Response.json({ error: 'No encontrada' }, { status: 404 });
  if (actual.id_publicador !== user.id)
    return Response.json({ error: 'No eres el publicador' }, { status: 403 });

  const parsed = petUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
      { status: 400 },
    );
  }
  const { fotos_keep, fotos_new, ...campos } = parsed.data;
  const updates = Object.fromEntries(Object.entries(campos).filter(([, v]) => v !== undefined));
  if (Object.keys(updates).length) {
    const { error } = await supabase.from('mascotas').update(updates).eq('id', id);
    if (error) return Response.json({ error: error.message }, { status: 400 });
  }

  if (fotos_keep || fotos_new) {
    const { data: previas } = await supabase
      .from('fotos_mascota')
      .select('id, url_foto')
      .eq('id_mascota', id)
      .order('orden');
    const previasList = (previas ?? []) as { id: string; url_foto: string }[];
    const keep = fotos_keep ?? previasList.map((f) => f.url_foto);
    const nuevas = fotos_new ?? [];
    if (keep.length + nuevas.length < 1 || keep.length + nuevas.length > 5) {
      return Response.json({ error: 'Debe quedar entre 1 y 5 fotos' }, { status: 400 });
    }
    const quitar = previasList.filter((f) => !keep.includes(f.url_foto));
    if (quitar.length) {
      const { error } = await supabase
        .from('fotos_mascota')
        .delete()
        .in(
          'id',
          quitar.map((f) => f.id),
        );
      if (error) return Response.json({ error: error.message }, { status: 400 });
      await borrarFotosStorage(
        supabase,
        quitar.map((f) => f.url_foto),
      );
    }
    if (nuevas.length) {
      const { error } = await supabase.from('fotos_mascota').insert(
        nuevas.map((url_foto, i) => ({
          id_mascota: id,
          url_foto,
          es_principal: false,
          orden: keep.length + i,
        })),
      );
      if (error) return Response.json({ error: error.message }, { status: 400 });
    }
    // una sola principal: la de menor orden
    const { data: todas } = await supabase
      .from('fotos_mascota')
      .select('id')
      .eq('id_mascota', id)
      .order('orden');
    const ids = (todas ?? []).map((f) => f.id as string);
    if (ids.length) {
      await supabase.from('fotos_mascota').update({ es_principal: false }).eq('id_mascota', id);
      await supabase.from('fotos_mascota').update({ es_principal: true }).eq('id', ids[0]);
    }
  }
  return Response.json({ ok: true });
};

/** DELETE /api/mascotas/:id — soft-delete (deleted_at = now). Solo dueño. */
export const DELETE: APIRoute = async ({ params, cookies }) => {
  const supabase = supabaseServer(cookies);
  const id = params.id ?? '';
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });
  const { data: actual } = await supabase
    .from('mascotas')
    .select('id_publicador')
    .eq('id', id)
    .maybeSingle();
  if (!actual) return Response.json({ error: 'No encontrada' }, { status: 404 });
  if (actual.id_publicador !== user.id)
    return Response.json({ error: 'No eres el publicador' }, { status: 403 });
  const { error } = await supabase
    .from('mascotas')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ ok: true });
};
