import type { SupabaseClient } from '@supabase/supabase-js';
import { fotoUrl, fotosOrdenadas, type FotoRow } from './mascotas';
import { completitudPerfil, resumenesAdoptantes, SIN_CUENTA } from './perfil';

export type EstadoSolicitud = 'pendiente' | 'aprobada' | 'rechazada' | 'cancelada';

export interface SolicitudPropia {
  id: string;
  estado: EstadoSolicitud;
  mensaje_inicial: string;
  fecha_solicitud: string;
  mascota: {
    id: string;
    nombre: string;
    raza: string;
    estado: string;
    ubicacion: string;
    foto: string;
  };
}

export interface SolicitudRecibida {
  id: string;
  estado: EstadoSolicitud;
  mensaje_inicial: string;
  fecha_solicitud: string;
  mascota: { id: string; nombre: string; estado: string };
  adoptante: {
    id: string;
    nombre: string;
    /** Fase B: resumen que el publicador puede ver del adoptante (solo si hay solicitud). */
    foto: string | null;
    zona: string | null;
    experiencia: string | null;
    motivacion: string | null;
    sobre_mi: string | null;
    eliminado: boolean;
    solicitudes: number;
    aprobada: boolean;
    /** % del perfil del adoptante que está completo (incentivo allenarlo). */
    completitud: number;
  };
}

/** Badge [clase, color dot, etiqueta] para estados de solicitud. */
export function solBadge(e: EstadoSolicitud | string): [string, string, string] {
  if (e === 'aprobada') return ['badge-disponible', '#10B981', 'Aprobada'];
  if (e === 'rechazada') return ['badge-adoptada', '#6366F1', 'Rechazada'];
  if (e === 'cancelada') return ['badge-adoptada', '#94A3B8', 'Cancelada'];
  return ['badge-proceso', '#F59E0B', 'Pendiente'];
}

/** Solicitudes hechas por el usuario (adoptante) + mascota. */
export async function getMisSolicitudes(
  supabase: SupabaseClient,
  userId: string,
): Promise<SolicitudPropia[]> {
  const { data, error } = await supabase
    .from('solicitudes')
    .select(
      'id,estado,mensaje_inicial,fecha_solicitud,mascotas(id,nombre,raza,estado,ubicacion,fotos_mascota(url_foto,es_principal,orden))',
    )
    .eq('id_adoptante', userId)
    .order('fecha_solicitud', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((s) => {
    const m = (s as { mascotas: Record<string, unknown> }).mascotas ?? {};
    const fotos = fotosOrdenadas((m.fotos_mascota ?? []) as FotoRow[]);
    return {
      id: s.id as string,
      estado: s.estado as EstadoSolicitud,
      mensaje_inicial: s.mensaje_inicial as string,
      fecha_solicitud: s.fecha_solicitud as string,
      mascota: {
        id: m.id as string,
        nombre: (m.nombre ?? 'Mascota') as string,
        raza: (m.raza ?? '') as string,
        estado: (m.estado ?? '') as string,
        ubicacion: (m.ubicacion ?? '') as string,
        foto: fotoUrl(fotos[0]?.url_foto),
      },
    };
  });
}

/** Solicitudes recibidas sobre las mascotas del usuario (publicador) + nombre del adoptante. */
export async function getSolicitudesRecibidas(
  supabase: SupabaseClient,
  userId: string,
): Promise<SolicitudRecibida[]> {
  const { data: mias } = await supabase
    .from('mascotas')
    .select('id')
    .eq('id_publicador', userId)
    .is('deleted_at', null);
  const ids = (mias ?? []).map((m) => m.id as string);
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from('solicitudes')
    .select('id,id_adoptante,estado,mensaje_inicial,fecha_solicitud,mascotas(id,nombre,estado)')
    .in('id_mascota', ids)
    .order('fecha_solicitud', { ascending: false });
  if (error) throw new Error(error.message);
  const adoptantes = [...new Set((data ?? []).map((s) => s.id_adoptante as string))];
  // El resumen del adoptante sale del RPC `resumen_adoptantes`, que en PostgreSQL
  // descarta a quien no le haya enviado una solicitud sobre nuestras mascotas.
  const resumenes = await resumenesAdoptantes(supabase, adoptantes);
  return (data ?? []).map((s) => {
    const adoptanteId = s.id_adoptante as string;
    const r = resumenes.get(adoptanteId);
    const completitud = completitudPerfil({
      nombre: r?.nombre,
      foto: r?.foto,
      descripcion: r?.sobre_mi,
      experiencia: r?.experiencia,
      motivacion: r?.motivacion,
    }).pct;
    return {
      id: s.id as string,
      estado: s.estado as EstadoSolicitud,
      mensaje_inicial: s.mensaje_inicial as string,
      fecha_solicitud: s.fecha_solicitud as string,
      mascota: (s as { mascotas: SolicitudRecibida['mascota'] }).mascotas,
      adoptante: {
        id: adoptanteId,
        nombre: r?.nombre ?? SIN_CUENTA,
        foto: r?.foto ?? null,
        zona: r?.zona ?? null,
        experiencia: r?.experiencia ?? null,
        motivacion: r?.motivacion ?? null,
        sobre_mi: r?.sobre_mi ?? null,
        eliminado: r?.eliminado ?? false,
        solicitudes: r?.solicitudes ?? 0,
        aprobada: r?.aprobada ?? false,
        completitud,
      },
    };
  });
}

export function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString('es-PA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
