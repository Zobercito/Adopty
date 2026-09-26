import type { APIRoute } from 'astro';
import { supabaseServer } from '../../../lib/supabase';
import {
  transicionSolicitud,
  type EstadoSolicitud,
  type RolSolicitud,
} from '../../../lib/transiciones';
import { solicitudAccionSchema } from '../../../lib/validation/request';

export const prerender = false;

/**
 * PATCH /api/solicitudes/:id {accion} — máquina de estados vía `transicionSolicitud`
 * (fuente única, testeada en Fase 7). Aprobar usa RPC atómica.
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
  const publicador = (sol as { mascotas: { id_publicador: string } }).mascotas.id_publicador;
  const { accion } = parsed.data;
  // Rol estricto por identidad (un tercero no es ni adoptante ni publicador)
  let rol: RolSolicitud;
  if (sol.id_adoptante === user.id) rol = 'adoptante';
  else if (publicador === user.id) rol = 'publicador';
  else return Response.json({ error: 'No participas en esta solicitud' }, { status: 403 });

  const t = transicionSolicitud(sol.estado as EstadoSolicitud, accion, rol);
  if (!t.ok) {
    const status = t.error.includes('Solo el') ? 403 : 409;
    return Response.json({ error: t.error }, { status });
  }

  if (accion === 'aprobar') {
    // transacción RPC: aprobada + mascota en_proceso + auto-rechaza resto
    const { error } = await supabase.rpc('aprobar_solicitud', { p_solicitud_id: id });
    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ ok: true });
  }
  const { error } = await supabase.from('solicitudes').update({ estado: t.siguiente }).eq('id', id);
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ ok: true });
};
