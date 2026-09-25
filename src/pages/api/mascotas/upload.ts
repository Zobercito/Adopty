import type { APIRoute } from 'astro';
import { supabaseServer } from '../../../lib/supabase';
import { subirFotos } from '../../../lib/storage';

export const prerender = false;

/** POST /api/mascotas/upload (multipart, campo `fotos`, 1–5) → { paths: string[] }. */
export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = supabaseServer(cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });
  const form = await request.formData().catch(() => null);
  if (!form) return Response.json({ error: 'FormData inválido' }, { status: 400 });
  const files = form.getAll('fotos').filter((f): f is File => f instanceof File);
  try {
    const paths = await subirFotos(supabase, user.id, files);
    return Response.json({ paths });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'Error al subir fotos' },
      { status: 400 },
    );
  }
};
