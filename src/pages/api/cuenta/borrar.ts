import type { APIRoute } from 'astro';
import { supabaseServer } from '../../../lib/supabase';
import { rateLimit, respuestaRateLimit } from '../../../lib/ratelimit';
import { borrarCuentaSchema } from '../../../lib/validation/user';

export const prerender = false;

/**
 * POST /api/cuenta/borrar { password, confirmacion } — da de baja la cuenta.
 *
 * Exige la contraseña (para confirmar que eres tú) y la palabra ELIMINAR. Todo el
 * trabajo lo hace el RPC `eliminar_mi_cuenta()`: baja lógica (`usuarios.activo =
 * false`), anonimiza lo personal, despublica las mascotas `disponible` y cancela las
 * solicitudes `pendiente`. No se puede hacer con service role porque el proyecto no
 * lo usa, y además un DELETE en cascada borraría las mascotas ya adoptadas, que
 * /privacidad declara que conservan registro mínimo histórico.
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = supabaseServer(cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

  // 3 intentos por hora: es una acción irreversible.
  const rl = rateLimit(`borrar-cuenta:${user.id}`, 3, 60 * 60_000);
  if (!rl.ok) return respuestaRateLimit(rl.reintentoEn ?? 3600);

  const body = await request.json().catch(() => null);
  const parsed = borrarCuentaSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
      { status: 400 },
    );
  }

  const { error: passErr } = await supabase.auth.signInWithPassword({
    email: user.email ?? '',
    password: parsed.data.password,
  });
  if (passErr) return Response.json({ error: 'Tu contraseña no es correcta' }, { status: 401 });

  const { data, error } = await supabase.rpc('eliminar_mi_cuenta');
  if (error) {
    // P0001 = regla de negocio (adopción en curso); 28000 = sesión inválida.
    if (error.code === 'P0001') return Response.json({ error: error.message }, { status: 409 });
    if (error.code === '28000') return Response.json({ error: 'No autenticado' }, { status: 401 });
    return Response.json({ error: error.message }, { status: 400 });
  }

  await supabase.auth.signOut();
  const resumen = (data ?? {}) as {
    mascotas_despublicadas?: number;
    solicitudes_canceladas?: number;
    mensajes_conservados?: number;
  };
  return Response.json({
    ok: true,
    ...resumen,
    mensaje:
      'Tu cuenta quedó dada de baja. Los mensajes que compartiste siguen visibles para la otra parte.',
  });
};
