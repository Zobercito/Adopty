import type { APIRoute } from 'astro';
import { supabaseServer } from '../../../lib/supabase';
import { getMisSolicitudes, getSolicitudesRecibidas } from '../../../lib/solicitudes';
import { solicitudSchema } from '../../../lib/validation/request';

export const prerender = false;

/**
 * GET /api/solicitudes?rol=adoptante|publicador — lista las mías.
 * Adoptante: mis solicitudes + mascota. Publicador: solicitudes sobre mis mascotas + nombre del adoptante.
 */
export const GET: APIRoute = async ({ url, cookies }) => {
  const supabase = supabaseServer(cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });
  const rol = url.searchParams.get('rol') ?? 'adoptante';
  if (rol !== 'adoptante' && rol !== 'publicador') {
    return Response.json({ error: 'rol debe ser adoptante o publicador' }, { status: 400 });
  }

  if (rol === 'adoptante') {
    try {
      return Response.json({ solicitudes: await getMisSolicitudes(supabase, user.id) });
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 400 });
    }
  }
  try {
    return Response.json({ solicitudes: await getSolicitudesRecibidas(supabase, user.id) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 400 });
  }
};

/**
 * POST /api/solicitudes {id_mascota, mensaje_inicial} — solo mascota disponible,
 * no propia, sin duplicado pendiente (índice único parcial + chequeo previo).
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = supabaseServer(cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return Response.json(
      { error: 'No autenticado — inicia sesión para solicitar' },
      { status: 401 },
    );
  const parsed = solicitudSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
      { status: 400 },
    );
  }
  const { id_mascota, mensaje_inicial } = parsed.data;
  const { data: mascota } = await supabase
    .from('mascotas')
    .select('id_publicador, estado')
    .eq('id', id_mascota)
    .is('deleted_at', null)
    .maybeSingle();
  if (!mascota || mascota.estado !== 'disponible') {
    return Response.json({ error: 'Esta mascota ya no está disponible' }, { status: 409 });
  }
  if (mascota.id_publicador === user.id) {
    return Response.json({ error: 'No puedes solicitar tu propia mascota' }, { status: 403 });
  }
  const { data: previa } = await supabase
    .from('solicitudes')
    .select('id')
    .eq('id_mascota', id_mascota)
    .eq('id_adoptante', user.id)
    .eq('estado', 'pendiente')
    .maybeSingle();
  if (previa)
    return Response.json(
      { error: 'Ya tienes una solicitud pendiente por esta mascota' },
      { status: 409 },
    );

  const { data, error } = await supabase
    .from('solicitudes')
    .insert({ id_mascota, id_adoptante: user.id, mensaje_inicial })
    .select('id')
    .single();
  if (error) {
    const dup = error.code === '23505';
    return Response.json(
      { error: dup ? 'Ya tienes una solicitud pendiente por esta mascota' : error.message },
      { status: dup ? 409 : 400 },
    );
  }
  return Response.json({ id: (data as { id: string }).id }, { status: 201 });
};
