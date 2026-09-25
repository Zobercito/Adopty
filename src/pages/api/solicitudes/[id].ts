import type { APIRoute } from 'astro';
import { supabaseServer } from '../../../lib/supabase';
import { solicitudAccionSchema } from '../../../lib/validation/request';

export const prerender = false;

/**
 * PATCH /api/solicitudes/:id {accion} — máquina de estados (solo desde pendiente):
 * - aprobar/rechazar: solo el publicador (aprobar usa RPC atómica: en_proceso + auto-rechaza resto).
 * - cancelar: solo el adoptante.
 */
export const PATCH: APIRoute = async ({ params, request, cookies }) => {
  const supabase = supabaseServer(cookies);
  const id = params.id ?? '';
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });
  const parsed = solicitudAccionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Acción inválida' }, { status: 400 });

  const { data: sol } = await supabase
    .from('solicitudes')
    .select('id, estado, id_adoptante, mascotas!inner(id_publicador)')
    .eq('id', id)
    .maybeSingle();
  if (!sol) return Response.json({ error: 'No encontrada' }, { status: 404 });
  if (sol.estado !== 'pendiente') {
    return Response.json({ error: `Ya está ${sol.estado}, no se puede cambiar` }, { status: 409 });
  }
  const publicador = (sol as { mascotas: { id_publicador: string } }).mascotas.id_publicador;
  const { accion } = parsed.data;

  if (accion === 'cancelar') {
    if (sol.id_adoptante !== user.id)
      return Response.json({ error: 'Solo el adoptante puede cancelar' }, { status: 403 });
    const { error } = await supabase
      .from('solicitudes')
      .update({ estado: 'cancelada' })
      .eq('id', id);
    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ ok: true });
  }

  if (publicador !== user.id) {
    return Response.json({ error: 'Solo el publicador puede aprobar o rechazar' }, { status: 403 });
  }
  if (accion === 'rechazar') {
    const { error } = await supabase
      .from('solicitudes')
      .update({ estado: 'rechazada' })
      .eq('id', id);
    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ ok: true });
  }
  // aprobar → transacción RPC
  const { error } = await supabase.rpc('aprobar_solicitud', { p_solicitud_id: id });
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ ok: true });
};
