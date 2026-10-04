import type { APIRoute } from 'astro';
import { z } from 'zod';
import { supabaseServer } from '../../../../lib/supabase';
import { esAdmin } from '../../../../lib/admin';
import { registrarAuditoria } from '../../../../lib/auditoria';
import { ipCliente, rateLimit, respuestaRateLimit } from '../../../../lib/ratelimit';

export const prerender = false;

const cuerpo = z.object({
  aprobar: z.boolean({ message: 'Indica aprobar: true/false' }),
  notas: z.string().max(500).optional(),
});

/**
 * POST /api/admin/verificaciones/:id {aprobar, notas?}
 * Aprobar marca `organizaciones.verificada = true` vía RPC atómica.
 */
export const POST: APIRoute = async ({ params, request, cookies }) => {
  const supabase = supabaseServer(cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });
  if (!(await esAdmin(supabase)))
    return Response.json({ error: 'Solo administradores' }, { status: 403 });

  // 60 decisiones por hora y admin.
  const rl = rateLimit(`admin:verificacion:${user.id}`, 60, 60 * 60_000);
  if (!rl.ok) return respuestaRateLimit(rl.reintentoEn ?? 3600);

  const id = params.id ?? '';
  if (!z.string().uuid().safeParse(id).success)
    return Response.json({ error: 'ID inválido' }, { status: 400 });

  const parsed = cuerpo.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
      { status: 400 },
    );
  const { aprobar, notas } = parsed.data;

  const { data: previo } = await supabase
    .from('verificaciones_org')
    .select('estado,id_organizacion')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase.rpc('resolver_verificacion', {
    p_verificacion_id: id,
    p_aprobada: aprobar,
    p_notas: notas ?? null,
  });
  if (error) return Response.json({ error: error.message }, { status: 400 });

  await registrarAuditoria(supabase, {
    id_usuario: user.id,
    accion: aprobar ? 'admin_verificacion_aprobar' : 'admin_verificacion_rechazar',
    tabla: 'verificaciones_org',
    id_registro: id,
    datos_anteriores: previo ? { estado: previo.estado } : undefined,
    datos_nuevos: {
      estado: aprobar ? 'aprobada' : 'rechazada',
      organizacion: previo?.id_organizacion,
      verificada: aprobar,
      notas: notas ?? null,
    },
    ip: ipCliente(request),
  });

  return Response.json({ ok: true });
};
