import type { APIRoute } from 'astro';
import { z } from 'zod';
import { supabaseServer } from '../../../../../lib/supabase';
import { esAdmin } from '../../../../../lib/admin';
import { registrarAuditoria } from '../../../../../lib/auditoria';
import { ipCliente, rateLimit, respuestaRateLimit } from '../../../../../lib/ratelimit';

export const prerender = false;

/**
 * POST /api/admin/mascotas/:id/restaurar
 *
 * Operación inversa de "ocultar publicación": deja la mascota visible otra vez
 * (`deleted_at = NULL`) y anota en sus reportes que se restauró. Existe porque
 * el propio mensaje de ocultar promete que la acción es reversible.
 */
export const POST: APIRoute = async ({ params, request, cookies }) => {
  const supabase = supabaseServer(cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });
  if (!(await esAdmin(supabase)))
    return Response.json({ error: 'Solo administradores' }, { status: 403 });

  // Acción sensible y poco frecuente: 30 por hora y admin.
  const rl = rateLimit(`admin:restaurar:${user.id}`, 30, 60 * 60_000);
  if (!rl.ok) return respuestaRateLimit(rl.reintentoEn ?? 3600);

  const id = params.id ?? '';
  if (!z.string().uuid().safeParse(id).success)
    return Response.json({ error: 'ID inválido' }, { status: 400 });

  const { data: previo } = await supabase
    .from('mascotas')
    .select('nombre,deleted_at')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase.rpc('restaurar_publicacion', { p_mascota_id: id });
  if (error) return Response.json({ error: error.message }, { status: 400 });

  await registrarAuditoria(supabase, {
    id_usuario: user.id,
    accion: 'admin_mascota_restaurar',
    tabla: 'mascotas',
    id_registro: id,
    datos_anteriores: { oculta: true, deleted_at: previo?.deleted_at ?? null },
    datos_nuevos: { oculta: false, nombre: previo?.nombre ?? null },
    ip: ipCliente(request),
  });

  return Response.json({ ok: true });
};
