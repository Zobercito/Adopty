import type { APIRoute } from 'astro';
import { supabaseServer } from '../../../../lib/supabase';

export const prerender = false;

/**
 * PATCH /api/admin/cuentas { id, activo } — suspende o reactiva una cuenta.
 *
 * Delega en el RPC `estado_cuenta`, que es el único que puede escribir sobre
 * `usuarios` de otra persona (la policy es `auth.uid() = id` y el proyecto no
 * usa service role). El RPC valida `soy_admin()` y deja rastro en `auditoria`.
 */
export const PATCH: APIRoute = async ({ request, cookies }) => {
  const supabase = supabaseServer(cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    id?: string;
    activo?: boolean;
  } | null;
  const id = body?.id;
  const activo = body?.activo;
  if (!id || typeof activo !== 'boolean') {
    return Response.json({ error: 'Datos inválidos' }, { status: 400 });
  }
  // Un admin no se puede suspender a sí mismo y quedar fuera de la plataforma.
  if (id === user.id && !activo) {
    return Response.json({ error: 'No puedes suspender tu propia cuenta' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('estado_cuenta', {
    p_usuario_id: id,
    p_activo: activo,
  });
  if (error) {
    if (error.code === '42501') return Response.json({ error: error.message }, { status: 403 });
    return Response.json({ error: error.message }, { status: 400 });
  }

  const fila = (data as { nombre?: string; activo?: boolean }[] | null)?.[0];
  return Response.json({
    ok: true,
    nombre: fila?.nombre ?? null,
    activo: fila?.activo ?? activo,
  });
};
