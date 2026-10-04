import type { APIRoute } from 'astro';
import { supabaseServer } from '../../../../lib/supabase';
import { esAdmin, listarVerificaciones, type EstadoVerificacion } from '../../../../lib/admin';

export const prerender = false;

/** GET /api/admin/verificaciones?estado=pendiente|aprobada|rechazada — solo administradores. */
export const GET: APIRoute = async ({ url, cookies }) => {
  const supabase = supabaseServer(cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });
  if (!(await esAdmin(supabase)))
    return Response.json({ error: 'Solo administradores' }, { status: 403 });

  const raw = url.searchParams.get('estado') ?? 'pendiente';
  const estado: EstadoVerificacion = raw === 'aprobada' || raw === 'rechazada' ? raw : 'pendiente';
  try {
    return Response.json({ verificaciones: await listarVerificaciones(supabase, estado) });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'Error al cargar verificaciones' },
      { status: 400 },
    );
  }
};
