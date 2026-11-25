import type { APIRoute } from 'astro';
import { supabaseServer } from '../../lib/supabase';
import { rateLimitDistribuido, respuestaRateLimit } from '../../lib/ratelimit';
import { mensajeError } from '../../lib/errores';
import { notificacionesSchema } from '../../lib/validation/notificaciones';

export const prerender = false;

/**
 * PUT /api/notificaciones { notificaciones_email } — preferencia del usuario.
 *
 * La RLS de `usuarios` solo permite tocar esta columna (ver migración
 * `20261123010000_notificaciones_email.sql`); el resto de la fila sigue cerrado.
 */
export const PUT: APIRoute = async ({ request, cookies }) => {
  const supabase = supabaseServer(cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

  const rl = await rateLimitDistribuido(supabase, `notificaciones:${user.id}`, 30, 60 * 60_000);
  if (!rl.ok) return respuestaRateLimit(rl.reintentoEn ?? 3600);

  const parsed = notificacionesSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from('usuarios')
    .update({ notificaciones_email: parsed.data.notificaciones_email })
    .eq('id', user.id);
  if (error) {
    return Response.json(
      { error: mensajeError(error, 'PUT /api/notificaciones', 'No se pudo guardar') },
      { status: 400 },
    );
  }

  return Response.json({
    ok: true,
    notificaciones_email: parsed.data.notificaciones_email,
  });
};
