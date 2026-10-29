import type { APIRoute } from 'astro';
import { supabaseServer } from '../../../lib/supabase';
import { rateLimitDistribuido, respuestaRateLimit } from '../../../lib/ratelimit';
import {
  avisoCorreoDuplicado,
  esCorreoYaRegistrado,
  respuestaEnvioCorreo,
} from '../../../lib/correo';
import { cambiarCorreoSchema } from '../../../lib/validation/user';

export const prerender = false;

/**
 * PUT /api/auth/cambiar-email { correo } — cambia el correo de la cuenta.
 *
 * `updateUser({ email })` funciona con la sesión del propio usuario (no hace falta
 * service role). Si en Supabase está activo "Secure email change", Supabase manda
 * un correo de confirmación al nuevo y un aviso al anterior: la respuesta dice
 * "pendiente" para que la UI no prometa un cambio que aún no ocurrió.
 * Un trigger en `auth.users` mantiene `usuarios.correo` sincronizado.
 */
export const PUT: APIRoute = async ({ request, cookies }) => {
  const supabase = supabaseServer(cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

  // 5 intentos por hora: un usuario que recibe correos de confirmación no debe
  // poder usarlos para spamming.
  const rl = await rateLimitDistribuido(supabase, `cambiar-email:${user.id}`, 5, 60 * 60_000);
  if (!rl.ok) return respuestaRateLimit(rl.reintentoEn ?? 3600);

  const body = await request.json().catch(() => null);
  const parsed = cambiarCorreoSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Datos inválidos' }, { status: 400 });

  const correo = parsed.data.correo.toLowerCase();
  const actual = (user.email ?? '').toLowerCase();
  if (correo === actual) {
    return Response.json({ error: 'Escribe un correo distinto al actual' }, { status: 400 });
  }

  // Sin consultar `usuarios`: esa comprobación previa revelaba qué correos tienen
  // cuenta (hallazgo I). La respuesta es deliberadamente indistinguible.
  const { error } = await supabase.auth.updateUser({ email: correo });
  if (error) {
    // El correo ya registrado se trata como éxito: el aviso real va a la bandeja
    // del titular actual y el detalle queda solo en el log, sin PII.
    if (esCorreoYaRegistrado(error)) {
      avisoCorreoDuplicado('cambiar-email');
      return Response.json(respuestaEnvioCorreo());
    }
    console.error(`[auth] cambiar-email: updateUser falló (${error.code ?? 'sin-código'})`);
    return Response.json({ error: 'No se pudo enviar el correo de confirmación' }, { status: 400 });
  }

  // No podemos saber desde la app si el cambio quedó pendiente de confirmación o
  // se aplicó ya (depende del ajuste "Secure email change" de Supabase), así que la
  // respuesta pide revisar el correo en ambos casos.
  return Response.json(respuestaEnvioCorreo());
};
