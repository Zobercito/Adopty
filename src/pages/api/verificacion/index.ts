import type { APIRoute } from 'astro';
import { supabaseServer } from '../../../lib/supabase';
import { z } from 'zod';
import { rateLimit, respuestaRateLimit } from '../../../lib/ratelimit';

export const prerender = false;

const verificacionSchema = z.object({
  tipo_evidencia: z.enum(['redes_sociales', 'documento', 'sitio_web', 'otro']),
  url_evidencia: z.string().url('URL inválida').max(500),
  descripcion: z.string().max(1000).optional().or(z.literal('')),
});

/** POST /api/verificacion — solicitar verificación de organización */
export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = supabaseServer(cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

  // 5 solicitudes de verificación por hora: basta para el trámite y frena el envío en cadena.
  const rl = rateLimit(`verificacion:${user.id}`, 5, 60 * 60_000);
  if (!rl.ok) return respuestaRateLimit(rl.reintentoEn ?? 3600);

  // Verificar que es organización
  const { data: perfil } = await supabase
    .from('usuarios')
    .select('tipo_usuario')
    .eq('id', user.id)
    .single();

  if (perfil?.tipo_usuario !== 'organizacion') {
    return Response.json(
      { error: 'Solo las organizaciones pueden solicitar verificación' },
      { status: 403 },
    );
  }

  const parsed = verificacionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  const { tipo_evidencia, url_evidencia, descripcion } = parsed.data;

  const { error } = await supabase.from('verificaciones_org').insert({
    id_organizacion: user.id,
    tipo_evidencia,
    url_evidencia,
    descripcion: descripcion || null,
  });

  if (error) {
    // 23505: ya hay una solicitud pendiente (índice único parcial).
    if (error.code === '23505') {
      return Response.json(
        { error: 'Ya tienes una solicitud de verificación pendiente' },
        { status: 409 },
      );
    }
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true }, { status: 201 });
};
