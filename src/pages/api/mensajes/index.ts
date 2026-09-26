import type { APIRoute } from 'astro';
import { supabaseServer } from '../../../lib/supabase';
import { mensajeSchema } from '../../../lib/validation/message';

export const prerender = false;

/**
 * GET /api/mensajes?mascota=&limit=50&offset=0 — hilos del usuario.
 * Devuelve últimas N por hilo (mascota + contraparte), ordenados por último mensaje.
 */
export const GET: APIRoute = async ({ url, cookies }) => {
  const supabase = supabaseServer(cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

  const mascotaId = url.searchParams.get('mascota');
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') ?? '50', 10), 1), 100);
  const offset = Math.max(parseInt(url.searchParams.get('offset') ?? '0', 10), 0);

  // Hilos donde el usuario participa (emisor o receptor)
  let query = supabase
    .from('mensajes')
    .select(
      'id, id_emisor, id_receptor, id_mascota, contenido, leido, fecha_envio, mascotas!inner(id, nombre, estado, fotos_mascota(url_foto, es_principal, orden))',
    )
    .or(`id_emisor.eq.${user.id},id_receptor.eq.${user.id}`)
    .order('fecha_envio', { ascending: false })
    .range(offset, offset + limit - 1);

  if (mascotaId) query = query.eq('id_mascota', mascotaId);

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 400 });

  // Agrupar por hilo: key = mascota_id + otra_parte_id
  const hilos = new Map<
    string,
    { id_mascota: string; otra_parte: string; ultimo: string; no_leidos: number; mascota: any }
  >();
  for (const m of data ?? []) {
    const otra = m.id_emisor === user.id ? m.id_receptor : m.id_emisor;
    const key = `${m.id_mascota}:${otra}`;
    const hilo = hilos.get(key);
    const no_leido_extra = !m.leido && m.id_receptor === user.id ? 1 : 0;
    if (!hilo) {
      hilos.set(key, {
        id_mascota: m.id_mascota,
        otra_parte: otra,
        ultimo: m.fecha_envio,
        no_leidos: no_leido_extra,
        mascota: m.mascotas,
      });
    } else {
      hilo.no_leidos += no_leido_extra;
      if (m.fecha_envio > hilo.ultimo) hilo.ultimo = m.fecha_envio;
    }
  }

  // Nombres de la otra parte (personas/orgs)
  const otrasIds = [...hilos.values()].map((h) => h.otra_parte);
  const [personas, orgs] = await Promise.all([
    supabase
      .from('personas')
      .select('id,nombre')
      .in('id', otrasIds.length ? otrasIds : ['00000000-0000-0000-0000-000000000000']),
    supabase
      .from('organizaciones')
      .select('id,nombre_oficial')
      .in('id', otrasIds.length ? otrasIds : ['00000000-0000-0000-0000-000000000000']),
  ]);
  const nombres = new Map<string, string>();
  for (const p of (personas.data ?? []) as { id: string; nombre: string }[])
    nombres.set(p.id, p.nombre);
  for (const o of (orgs.data ?? []) as { id: string; nombre_oficial: string }[])
    nombres.set(o.id, o.nombre_oficial);

  const items = [...hilos.entries()].map(([key, h]) => ({
    key,
    id_mascota: h.id_mascota,
    otra_parte: h.otra_parte,
    nombre_otra: nombres.get(h.otra_parte) ?? 'Usuario',
    ultima: h.ultimo,
    no_leidos: h.no_leidos,
    mascota: h.mascota ? { ...h.mascota, foto: h.mascota.fotos_mascota?.[0]?.url_foto } : null,
  }));

  return Response.json({ items });
};

/**
 * POST /api/mensajes {id_mascota, contenido, id_receptor?} — enviar mensaje.
 * Reglas (Fase 5):
 * - Adoptante: requiere solicitud APROBADA (el approve "habilita el chat"); receptor = publicador.
 * - Publicador: receptor = adoptante con solicitud aprobada (obligatorio si hay >1).
 * - Bloqueo anti-spam: si la mascota está adoptada, solo hablan publicador y adoptante aprobado.
 * El contenido se guarda tal cual (trim); la protección XSS vive en el render
 * (Astro escapa `{m.contenido}` + `escapeHtml()` en el JS del chat).
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = supabaseServer(cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

  const parsed = mensajeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
      { status: 400 },
    );
  }
  const { id_mascota, contenido, id_receptor } = parsed.data;

  const { data: mascota } = await supabase
    .from('mascotas')
    .select('id, id_publicador, estado')
    .eq('id', id_mascota)
    .is('deleted_at', null)
    .maybeSingle();
  if (!mascota) return Response.json({ error: 'Mascota no encontrada' }, { status: 404 });
  const esPublicador = mascota.id_publicador === user.id;

  let receptor: string | null = null;
  if (esPublicador) {
    const { data: aprobadas } = await supabase
      .from('solicitudes')
      .select('id_adoptante')
      .eq('id_mascota', id_mascota)
      .eq('estado', 'aprobada');
    const candidatos = [...new Set((aprobadas ?? []).map((s) => s.id_adoptante as string))].filter(
      (id) => id !== user.id,
    );
    if (id_receptor) {
      if (!candidatos.includes(id_receptor)) {
        return Response.json({ error: 'Destinatario inválido para este chat' }, { status: 403 });
      }
      receptor = id_receptor;
    } else if (candidatos.length === 1) {
      receptor = candidatos[0];
    } else {
      return Response.json({ error: 'Especifica el destinatario del mensaje' }, { status: 400 });
    }
  } else {
    const { data: mia } = await supabase
      .from('solicitudes')
      .select('id')
      .eq('id_mascota', id_mascota)
      .eq('id_adoptante', user.id)
      .eq('estado', 'aprobada')
      .maybeSingle();
    if (!mia) {
      return Response.json(
        { error: 'El chat se habilita al aprobar tu solicitud' },
        { status: 403 },
      );
    }
    receptor = mascota.id_publicador;
  }

  const { data, error } = await supabase
    .from('mensajes')
    .insert({
      id_emisor: user.id,
      id_receptor: receptor,
      id_mascota,
      contenido,
    })
    .select('id, id_emisor, id_receptor, id_mascota, contenido, leido, fecha_envio')
    .single();
  if (error) return Response.json({ error: error.message }, { status: 400 });

  return Response.json({ mensaje: data }, { status: 201 });
};
