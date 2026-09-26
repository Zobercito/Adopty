import type { APIRoute } from 'astro';
import { supabaseServer } from '../../../lib/supabase';
import { buscarMascotas, paramsFrom } from '../../../lib/mascotas';
import { petSchema } from '../../../lib/validation/pet';

export const prerender = false;

/**
 * GET /api/mascotas?especie=&tamano=&sexo=&q=&orden=&page= — Fase 3.
 * Filtros combinables + texto libre + orden + paginación (20/pg, cap 60).
 */
export const GET: APIRoute = async ({ url, cookies }) => {
  const supabase = supabaseServer(cookies);
  try {
    const resultado = await buscarMascotas(supabase, paramsFrom(url.searchParams));
    return Response.json(resultado);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'Error de búsqueda' },
      { status: 500 },
    );
  }
};

/** POST /api/mascotas — crea mascota + 1–5 fotos (Fase 2). RLS: dueño = auth.uid(). */
export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = supabaseServer(cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });
  const parsed = petSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
      { status: 400 },
    );
  }
  const { fotos, ...mascota } = parsed.data;
  const { data: creada, error } = await supabase
    .from('mascotas')
    .insert({ ...mascota, id_publicador: user.id })
    .select('id')
    .single();
  if (error || !creada) {
    return Response.json({ error: error?.message ?? 'No se pudo crear' }, { status: 400 });
  }
  const filas = fotos.map((url_foto, i) => ({
    id_mascota: creada.id,
    url_foto,
    es_principal: i === 0,
    orden: i,
  }));
  const { error: errFotos } = await supabase.from('fotos_mascota').insert(filas);
  if (errFotos) {
    // rollback lógico: no queda mascota sin fotos visibles
    await supabase.from('mascotas').delete().eq('id', creada.id);
    return Response.json({ error: errFotos.message }, { status: 400 });
  }
  return Response.json({ id: creada.id }, { status: 201 });
};
