import type { APIRoute } from 'astro';
import { supabaseServer } from '../../../../lib/supabase';
import { esAdmin, listarReportes, type EstadoReporte } from '../../../../lib/admin';

export const prerender = false;

/**
 * GET /api/admin/reportes?estado=pendiente|resuelto|descartado
 * Solo administradores. Devuelve el nombre del reportador, nunca su correo.
 */
export const GET: APIRoute = async ({ url, cookies }) => {
  const supabase = supabaseServer(cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });
  if (!(await esAdmin(supabase)))
    return Response.json({ error: 'Solo administradores' }, { status: 403 });

  const raw = url.searchParams.get('estado') ?? 'pendiente';
  const estado: EstadoReporte = raw === 'resuelto' || raw === 'descartado' ? raw : 'pendiente';
  try {
    return Response.json({ reportes: await listarReportes(supabase, estado) });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'Error al cargar reportes' },
      { status: 400 },
    );
  }
};
