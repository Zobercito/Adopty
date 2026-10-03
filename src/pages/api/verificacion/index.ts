import type { APIRoute } from 'astro';
import { supabaseServer } from '../../../lib/supabase';
import { z } from 'zod';

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
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true }, { status: 201 });
};
