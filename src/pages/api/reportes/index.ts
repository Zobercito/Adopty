import type { APIRoute } from 'astro';
import { supabaseServer } from '../../../lib/supabase';
import { z } from 'zod';
import { rateLimit, respuestaRateLimit } from '../../../lib/ratelimit';

export const prerender = false;

const reporteSchema = z.object({
  id_mascota: z.string().uuid('Mascota inválida'),
  motivo: z
    .string()
    .trim()
    .min(10, 'Explica el motivo (mínimo 10 caracteres)')
    .max(500, 'Máximo 500 caracteres'),
});

/** POST /api/reportes — reportar una publicación */
export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = supabaseServer(cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

  // Un usuario no puede inundar la cola de moderación: 10 reportes por hora.
  const rl = rateLimit(`reporte:${user.id}`, 10, 60 * 60_000);
  if (!rl.ok) return respuestaRateLimit(rl.reintentoEn ?? 3600);

  const parsed = reporteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
      { status: 400 },
    );
  }

  const { id_mascota, motivo } = parsed.data;

  // Verificar que la mascota existe
  const { data: mascota } = await supabase
    .from('mascotas')
    .select('id')
    .eq('id', id_mascota)
    .is('deleted_at', null)
    .maybeSingle();

  if (!mascota) {
    return Response.json({ error: 'Mascota no encontrada' }, { status: 404 });
  }

  // No reportar tu propia mascota
  if (mascota.id === user.id) {
    return Response.json({ error: 'No puedes reportar tu propia publicación' }, { status: 403 });
  }

  const { error } = await supabase.from('reportes').insert({
    id_mascota,
    id_reportador: user.id,
    motivo,
  });

  if (error) {
    if (error.code === '23505') {
      return Response.json({ error: 'Ya reportaste esta publicación' }, { status: 409 });
    }
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true }, { status: 201 });
};
