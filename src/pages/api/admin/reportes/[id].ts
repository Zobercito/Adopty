import type { APIRoute } from 'astro';
import { z } from 'zod';
import { supabaseServer } from '../../../../lib/supabase';
import { esAdmin } from '../../../../lib/admin';
import { registrarAuditoria } from '../../../../lib/auditoria';
import { ipCliente } from '../../../../lib/ratelimit';

export const prerender = false;

const cuerpo = z.object({
  accion: z.enum(['ocultar', 'descartar'], { message: 'Acción inválida' }),
  notas: z.string().max(500).optional(),
});

/**
 * POST /api/admin/reportes/:id {accion, notas?}
 * `ocultar` → soft-delete de la mascota + descarta los demás pendientes de esa
 * mascota. `descartar` → el reporte era infundado. Ambos vía RPC atómica.
 */
export const POST: APIRoute = async ({ params, request, cookies }) => {
  const supabase = supabaseServer(cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });
  if (!(await esAdmin(supabase)))
    return Response.json({ error: 'Solo administradores' }, { status: 403 });

  const id = params.id ?? '';
  if (!z.string().uuid().safeParse(id).success)
    return Response.json({ error: 'ID inválido' }, { status: 400 });

  const parsed = cuerpo.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
      { status: 400 },
    );
  const { accion, notas } = parsed.data;

  // Datos previos para el log de auditoría.
  const { data: previo } = await supabase
    .from('reportes')
    .select('estado,id_mascota,motivo')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase.rpc('resolver_reporte', {
    p_reporte_id: id,
    p_accion: accion,
  });
  if (error) return Response.json({ error: error.message }, { status: 400 });

  await registrarAuditoria(supabase, {
    id_usuario: user.id,
    accion: `admin_reporte_${accion}`,
    tabla: 'reportes',
    id_registro: id,
    datos_anteriores: previo ? { estado: previo.estado } : undefined,
    datos_nuevos: {
      estado: accion === 'ocultar' ? 'resuelto' : 'descartado',
      notas: notas ?? null,
    },
    ip: ipCliente(request),
  });

  return Response.json({ ok: true });
};
