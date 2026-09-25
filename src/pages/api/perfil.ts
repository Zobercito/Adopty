import type { APIRoute } from 'astro';
import { supabaseServer } from '../../lib/supabase';
import { personaSchema, organizacionSchema } from '../../lib/validation/user';

export const prerender = false;

/** PUT /api/perfil — actualiza persona u organización del usuario autenticado. */
export const PUT: APIRoute = async ({ request, cookies }) => {
  const supabase = supabaseServer(cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

  const { data: perfil } = await supabase
    .from('usuarios')
    .select('tipo_usuario')
    .eq('id', user.id)
    .single();
  if (!perfil) return Response.json({ error: 'Perfil no encontrado' }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (perfil.tipo_usuario === 'persona') {
    const parsed = personaSchema.safeParse(body);
    if (!parsed.success) return Response.json({ error: 'Datos inválidos' }, { status: 400 });
    const { error } = await supabase
      .from('personas')
      .update({
        nombre: parsed.data.nombre,
        telefono: parsed.data.telefono || null,
        descripcion: parsed.data.descripcion || null,
      })
      .eq('id', user.id);
    if (error) return Response.json({ error: error.message }, { status: 400 });
  } else {
    const parsed = organizacionSchema.safeParse(body);
    if (!parsed.success) return Response.json({ error: 'Datos inválidos' }, { status: 400 });
    const { error } = await supabase
      .from('organizaciones')
      .update({
        nombre_oficial: parsed.data.nombre_oficial,
        direccion: parsed.data.direccion,
        descripcion: parsed.data.descripcion || null,
        sitio_web: parsed.data.sitio_web || null,
      })
      .eq('id', user.id);
    if (error) return Response.json({ error: error.message }, { status: 400 });
  }
  return Response.json({ ok: true });
};
