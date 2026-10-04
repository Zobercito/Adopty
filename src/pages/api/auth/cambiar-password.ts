import type { APIRoute } from 'astro';
import { supabaseServer } from '../../../lib/supabase';
import { registrarAuditoria } from '../../../lib/auditoria';
import { ipCliente, rateLimit, respuestaRateLimit } from '../../../lib/ratelimit';
import { cambiarPasswordSchema } from '../../../lib/validation/user';

export const prerender = false;

/**
 * POST /api/auth/cambiar-password {actual, nueva, confirmar}
 *
 * Exigir la contraseña actual es lo que convierte esto en un cambio de contraseña
 * y no en una simple *set* de sesión: sin ella, un cookie robado bastaría para
 * dejar la cuenta inutilizable. Verificamos con `signInWithPassword` contra la
 * contraseña actual y luego aplicamos `updateUser`.
 *
 * No deslogueamos al usuario: Supabase invalida las otras sesiones por sí solo
 * cuando cambia la contraseña.
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = supabaseServer(cookies);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

  // 5 intentos por hora y usuario: suficiente para cambiar, poco para adivinar.
  const rl = rateLimit(`cambiar-password:${user.id}`, 5, 60 * 60_000);
  if (!rl.ok) return respuestaRateLimit(rl.reintentoEn ?? 3600);

  const parsed = cambiarPasswordSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
      { status: 400 },
    );
  }
  const { actual, nueva } = parsed.data;

  // 1) Confirmar que conoce la contraseña actual.
  const { error: errorActual } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: actual,
  });
  if (errorActual) {
    return Response.json({ error: 'La contraseña actual no es correcta' }, { status: 401 });
  }

  // 2) Aplicar el cambio.
  const { error } = await supabase.auth.updateUser({ password: nueva });
  if (error) {
    return Response.json(
      { error: error.message.includes('same') ? 'La nueva debe ser distinta' : error.message },
      { status: 400 },
    );
  }

  await registrarAuditoria(supabase, {
    id_usuario: user.id,
    accion: 'password_cambiada',
    tabla: 'usuarios',
    id_registro: user.id,
    datos_nuevos: { correo: user.email },
    ip: ipCliente(request),
  });

  return Response.json({ ok: true });
};
