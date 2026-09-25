import type { SupabaseClient } from '@supabase/supabase-js';

export type Estado = 'disponible' | 'en_proceso' | 'adoptada';
export type Especie = 'perro' | 'gato' | 'otro';
export type Tamano = 'Pequeño' | 'Mediano' | 'Grande';

export interface MascotaRow {
  id: string;
  id_publicador: string;
  nombre: string;
  especie: Especie;
  raza: string;
  edad_meses: number;
  sexo: 'Macho' | 'Hembra';
  tamano: Tamano;
  descripcion: string;
  estado_salud: string;
  ubicacion: string;
  estado: Estado;
  fecha_publicacion: string;
  deleted_at: string | null;
}

export interface FotoRow {
  id_mascota: string;
  url_foto: string;
  es_principal: boolean;
  orden: number;
}

export interface Busqueda {
  especie?: Especie;
  tamano?: Tamano;
  sexo?: 'Macho' | 'Hembra';
  q?: string;
  estado?: Estado;
  orden?: 'recientes' | 'antiguos';
  page?: number;
  pageSize?: number;
}

export interface ResultadoBusqueda {
  items: (MascotaRow & { fotos: FotoRow[] })[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Ruta de storage → URL pública; '/assets/…' se sirve tal cual desde el sitio. */
export function fotoUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (path.startsWith('/') || path.startsWith('http')) return path;
  const base = import.meta.env.PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/mascotas/${path}`;
}

export function estadoLabel(estado: Estado | string): 'Disponible' | 'En proceso' | 'Adoptada' {
  return estado === 'en_proceso' ? 'En proceso' : estado === 'adoptada' ? 'Adoptada' : 'Disponible';
}

/** 0–360 meses → "6 meses" / "1 año" / "1 año, 6 meses". */
export function edadLabel(meses: number): string {
  if (meses <= 0) return 'Recién nacido';
  const y = Math.floor(meses / 12);
  const m = meses % 12;
  if (y === 0) return `${m} ${m === 1 ? 'mes' : 'meses'}`;
  if (m === 0) return `${y} ${y === 1 ? 'año' : 'años'}`;
  return `${y} ${y === 1 ? 'año' : 'años'}, ${m} ${m === 1 ? 'mes' : 'meses'}`;
}

/** Gradiente decorativo determinista por id (herencia del mockup). */
export function gradFor(id: string): string {
  let n = 0;
  for (let i = 0; i < id.length; i++) n = (n + id.charCodeAt(i)) % 6;
  return `pet-grad-${n + 1}`;
}

/** Fotos ordenadas: principal primero, luego por orden. */
export function fotosOrdenadas(fotos: FotoRow[] | undefined): FotoRow[] {
  return [...(fotos ?? [])].sort((a, b) => {
    if (a.es_principal !== b.es_principal) return a.es_principal ? -1 : 1;
    return a.orden - b.orden;
  });
}

/** Normaliza params de URL/API → criterios de búsqueda. */
export function paramsFrom(sp: URLSearchParams): Busqueda {
  const especie = sp.get('especie');
  const tamanoRaw = sp.get('tamano');
  const sexo = sp.get('sexo');
  const orden = sp.get('orden');
  const tamanoMap: Record<string, Tamano> = {
    pequeno: 'Pequeño',
    pequeño: 'Pequeño',
    mediano: 'Mediano',
    grande: 'Grande',
  };
  const tamano = tamanoRaw ? (tamanoMap[tamanoRaw.toLowerCase()] ?? undefined) : undefined;
  const page = Number(sp.get('page') ?? '1');
  return {
    especie: especie === 'perro' || especie === 'gato' || especie === 'otro' ? especie : undefined,
    tamano,
    sexo: sexo === 'Macho' || sexo === 'Hembra' ? sexo : undefined,
    q:
      (sp.get('q') ?? '')
        .replace(/[,()%*]/g, ' ')
        .trim()
        .slice(0, 80) || undefined,
    estado: (sp.get('estado') as Estado) ?? 'disponible',
    orden: orden === 'antiguos' ? 'antiguos' : 'recientes',
    page: Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1,
  };
}

/**
 * Búsqueda pública (Fase 3): filtros combinables + texto libre (ILIKE sobre
 * nombre/raza/ubicacion, sirve el índice GIN trgm) + orden + paginación de 20.
 * La RLS de `mascotas` se aplica encima (anónimo solo ve `disponible`).
 */
export async function buscarMascotas(
  supabase: SupabaseClient,
  b: Busqueda,
): Promise<ResultadoBusqueda> {
  const pageSize = Math.min(Math.max(b.pageSize ?? 20, 1), 60);
  const page = Math.max(b.page ?? 1, 1);
  let q = supabase
    .from('mascotas')
    .select('*, fotos_mascota(*)', { count: 'exact' })
    .is('deleted_at', null)
    .eq('estado', b.estado ?? 'disponible');
  if (b.especie) q = q.eq('especie', b.especie);
  if (b.tamano) q = q.eq('tamano', b.tamano);
  if (b.sexo) q = q.eq('sexo', b.sexo);
  if (b.q) q = q.or(`nombre.ilike.%${b.q}%,raza.ilike.%${b.q}%,ubicacion.ilike.%${b.q}%`);
  const from = (page - 1) * pageSize;
  const { data, error, count } = await q
    .order('fecha_publicacion', { ascending: b.orden === 'antiguos' })
    .range(from, from + pageSize - 1);
  if (error) throw new Error(error.message);
  const total = count ?? 0;
  return {
    items: (data ?? []).map((r) => ({
      ...(r as MascotaRow),
      fotos: (r.fotos_mascota ?? []) as FotoRow[],
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
