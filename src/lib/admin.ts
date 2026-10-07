import type { SupabaseClient } from '@supabase/supabase-js';
import { perfilesPublicos } from './perfil';

/** Estados posibles de un reporte de publicación. */
export type EstadoReporte = 'pendiente' | 'resuelto' | 'descartado';
/** Estados posibles de una solicitud de verificación. */
export type EstadoVerificacion = 'pendiente' | 'aprobada' | 'rechazada';

export interface ReporteAdmin {
  id: string;
  motivo: string;
  estado: EstadoReporte;
  notas_admin: string | null;
  fecha_reporte: string;
  fecha_resolucion: string | null;
  /** Nombre del reportador. Nunca se expone su correo (minimización de datos, Ley 81). */
  reportador: string;
  tipo_reportador: 'persona' | 'organizacion' | 'desconocido';
  mascota: {
    id: string;
    nombre: string;
    slug: string | null;
    estado: string;
    ubicacion: string;
    /** Si tiene fecha, la publicación está oculta y se puede restaurar. */
    deleted_at: string | null;
  };
}

export interface VerificacionAdmin {
  id: string;
  tipo_evidencia: string;
  url_evidencia: string;
  descripcion: string | null;
  estado: EstadoVerificacion;
  notas_admin: string | null;
  fecha_solicitud: string;
  fecha_resolucion: string | null;
  organizacion: {
    id: string;
    nombre_oficial: string;
    verificada: boolean;
    /** Lo que la organización declaró en su perfil: el admin lo contrasta con la evidencia. */
    sitio_web: string | null;
    redes: { instagram?: string; facebook?: string; whatsapp?: string } | null;
  };
}

/** ¿El usuario autenticado es administrador? Usa el RPC `soy_admin()` (idéntico a la RLS). */
export async function esAdmin(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.rpc('soy_admin');
  if (error) return false;
  return Boolean(data);
}

/** Nombres de usuarios para mostrar quién reportó / qué organización.verify. Solo nombre, sin correo. */
async function nombresDe(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Map<string, { nombre: string; tipo: 'persona' | 'organizacion' }>> {
  const out = new Map<string, { nombre: string; tipo: 'persona' | 'organizacion' }>();
  const unicos = [...new Set(ids)].filter(Boolean);
  if (!unicos.length) return out;
  // Fase A: `personas` ya no es legible entre usuarios, así que los nombres públicos
  // salen del RPC `perfil_publico` (que además anonimiza cuentas dadas de baja).
  for (const [id, p] of await perfilesPublicos(supabase, unicos)) {
    out.set(id, { nombre: p.nombre, tipo: p.tipo });
  }
  return out;
}

/** Cuántos registros trae cada listado del panel (evita pintar 500 tarjetas). */
export const LIMITE_PANEL = 50;

/** Reportes con datos de la mascota y nombre del reportador (solo para admins). */
export async function listarReportes(
  supabase: SupabaseClient,
  estado: EstadoReporte = 'pendiente',
): Promise<ReporteAdmin[]> {
  const { data, error } = await supabase
    .from('reportes')
    .select(
      'id,id_reportador,motivo,estado,notas_admin,fecha_reporte,fecha_resolucion,' +
        'mascotas(id,nombre,slug,estado,ubicacion,deleted_at)',
    )
    .eq('estado', estado)
    .order('fecha_reporte', { ascending: false })
    .limit(LIMITE_PANEL);
  if (error) throw new Error(error.message);

  const filas = (data ?? []) as unknown as {
    id: string;
    id_reportador: string;
    motivo: string;
    estado: EstadoReporte;
    notas_admin: string | null;
    fecha_reporte: string;
    fecha_resolucion: string | null;
    mascotas: ReporteAdmin['mascota'] | null;
  }[];

  const nombres = await nombresDe(
    supabase,
    filas.map((f) => f.id_reportador),
  );
  return filas
    .filter((f) => f.mascotas)
    .map((f) => {
      const n = nombres.get(f.id_reportador);
      return {
        id: f.id,
        motivo: f.motivo,
        estado: f.estado,
        notas_admin: f.notas_admin,
        fecha_reporte: f.fecha_reporte,
        fecha_resolucion: f.fecha_resolucion,
        reportador: n?.nombre ?? 'Usuario',
        tipo_reportador: n?.tipo ?? 'desconocido',
        mascota: f.mascotas!,
      };
    });
}

/** Solicitudes de verificación con datos de la organización. */
export async function listarVerificaciones(
  supabase: SupabaseClient,
  estado: EstadoVerificacion = 'pendiente',
): Promise<VerificacionAdmin[]> {
  const { data, error } = await supabase
    .from('verificaciones_org')
    .select(
      'id,tipo_evidencia,url_evidencia,descripcion,estado,notas_admin,fecha_solicitud,fecha_resolucion,' +
        'organizaciones!inner(id,nombre_oficial,verificada,sitio_web,redes)',
    )
    .eq('estado', estado)
    .order('fecha_solicitud', { ascending: false })
    .limit(LIMITE_PANEL);
  if (error) throw new Error(error.message);
  const filas = (data ?? []) as unknown as {
    id: string;
    tipo_evidencia: string;
    url_evidencia: string;
    descripcion: string | null;
    estado: EstadoVerificacion;
    notas_admin: string | null;
    fecha_solicitud: string;
    fecha_resolucion: string | null;
    organizaciones: VerificacionAdmin['organizaciones'];
  }[];
  return filas.map((f) => ({
    id: f.id,
    tipo_evidencia: f.tipo_evidencia,
    url_evidencia: f.url_evidencia,
    descripcion: f.descripcion,
    estado: f.estado,
    notas_admin: f.notas_admin,
    fecha_solicitud: f.fecha_solicitud,
    fecha_resolucion: f.fecha_resolucion,
    organizacion: f.organizaciones,
  }));
}

/** Cuenta del panel de cuentas: sin correo, por la regla del panel. */
export interface CuentaAdmin {
  id: string;
  nombre: string;
  tipo: 'persona' | 'organizacion';
  activo: boolean;
  fecha_registro: string;
  borrado_en: string | null;
  mascotas: number;
}

/**
 * Cuentas registradas (máx. 100, de más reciente a más antigua).
 * El RPC `listar_cuentas` es el que autoriza: un usuario normal recibe un error.
 */
export async function listarCuentas(
  supabase: SupabaseClient,
  busqueda = '',
): Promise<CuentaAdmin[]> {
  const { data, error } = await supabase.rpc('listar_cuentas', { p_busqueda: busqueda });
  if (error) throw new Error(error.message);
  return (data ?? []) as CuentaAdmin[];
}

/** Suspende o reactiva una cuenta. El RPC `estado_cuenta` valida `soy_admin()`. */
export async function cambiarEstadoCuenta(
  supabase: SupabaseClient,
  id: string,
  activo: boolean,
): Promise<void> {
  const { error } = await supabase.rpc('estado_cuenta', { p_usuario_id: id, p_activo: activo });
  if (error) throw new Error(error.message);
}

/** Badge [clase, color, etiqueta] para el estado de una cuenta. */
export function cuentaBadge(a: boolean): [string, string, string] {
  return a
    ? ['badge-disponible', '#10B981', 'Activa']
    : ['badge-adoptada', '#94A3B8', 'Suspendida'];
}

/** Badge [clase, color, etiqueta] para estados de reporte. */
export function reporteBadge(e: EstadoReporte): [string, string, string] {
  if (e === 'resuelto') return ['badge-disponible', '#10B981', 'Resuelto'];
  if (e === 'descartado') return ['badge-adoptada', '#94A3B8', 'Descartado'];
  return ['badge-proceso', '#F59E0B', 'Pendiente'];
}

/** Badge [clase, color, etiqueta] para estados de verificación. */
export function verifBadge(e: EstadoVerificacion): [string, string, string] {
  if (e === 'aprobada') return ['badge-disponible', '#10B981', 'Aprobada'];
  if (e === 'rechazada') return ['badge-adoptada', '#94A3B8', 'Rechazada'];
  return ['badge-proceso', '#F59E0B', 'Pendiente'];
}

/** Fecha corta en español. */
export function fechaCorta(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-PA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
