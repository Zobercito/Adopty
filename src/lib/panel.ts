import type { SupabaseClient } from '@supabase/supabase-js';
import { fotoUrl, fotosOrdenadas, type FotoRow } from './mascotas';

export interface PanelMascota {
  id: string;
  nombre: string;
  raza: string;
  estado: string;
  fecha_publicacion: string;
  foto: string;
  solicitudes: number;
  pendientes: number;
  aprobadas: number;
  noLeidos: number;
  /** Plan §4.1: interesados = solicitantes + conversantes distintos (sin contarme a mí) */
  interesados: number;
}

export interface PanelResumen {
  publicadas: number;
  pendientes: number;
  noLeidos: number;
  interesados: number;
  mascotas: PanelMascota[];
}

/**
 * Agregados del publicador (Fase 6). Todo pasa por RLS: solo ve sus mascotas,
 * sus solicitudes recibidas y sus hilos. Sin RPC: 3 queries + cómputo en JS.
 */
export async function getPanelResumen(
  supabase: SupabaseClient,
  userId: string,
): Promise<PanelResumen> {
  const { data: mias, error } = await supabase
    .from('mascotas')
    .select('id,nombre,raza,estado,fecha_publicacion,fotos_mascota(url_foto,es_principal,orden)')
    .eq('id_publicador', userId)
    .is('deleted_at', null)
    .order('fecha_publicacion', { ascending: false });
  if (error) throw new Error(error.message);
  const pets = (mias ?? []) as unknown as {
    id: string;
    nombre: string;
    raza: string;
    estado: string;
    fecha_publicacion: string;
    fotos_mascota: FotoRow[];
  }[];
  const ids = pets.map((p) => p.id);

  type Sol = { id_mascota: string; estado: string; id_adoptante: string };
  type Msg = { id_mascota: string; id_emisor: string; id_receptor: string; leido: boolean };
  let sols: Sol[] = [];
  let msgs: Msg[] = [];
  if (ids.length) {
    const [s, m] = await Promise.all([
      supabase.from('solicitudes').select('id_mascota,estado,id_adoptante').in('id_mascota', ids),
      supabase
        .from('mensajes')
        .select('id_mascota,id_emisor,id_receptor,leido')
        .in('id_mascota', ids),
    ]);
    if (s.error) throw new Error(s.error.message);
    if (m.error) throw new Error(m.error.message);
    sols = (s.data ?? []) as Sol[];
    msgs = (m.data ?? []) as Msg[];
  }

  const porMascota = new Map<string, { sol: Sol[]; msg: Msg[] }>();
  for (const id of ids) porMascota.set(id, { sol: [], msg: [] });
  for (const s of sols) porMascota.get(s.id_mascota)?.sol.push(s);
  for (const m of msgs) porMascota.get(m.id_mascota)?.msg.push(m);

  const interesadosGlobal = new Set<string>();
  const mascotas: PanelMascota[] = pets.map((p) => {
    const { sol, msg } = porMascota.get(p.id)!;
    const interesados = new Set<string>();
    for (const s of sol) if (s.id_adoptante !== userId) interesados.add(s.id_adoptante);
    for (const m of msg) {
      if (m.id_emisor !== userId) interesados.add(m.id_emisor);
      if (m.id_receptor !== userId) interesados.add(m.id_receptor);
    }
    for (const i of interesados) interesadosGlobal.add(i);
    const fotos = fotosOrdenadas(p.fotos_mascota);
    return {
      id: p.id,
      nombre: p.nombre,
      raza: p.raza,
      estado: p.estado,
      fecha_publicacion: p.fecha_publicacion,
      foto: fotoUrl(fotos[0]?.url_foto),
      solicitudes: sol.length,
      pendientes: sol.filter((s) => s.estado === 'pendiente').length,
      aprobadas: sol.filter((s) => s.estado === 'aprobada').length,
      noLeidos: msg.filter((m) => m.id_receptor === userId && !m.leido).length,
      interesados: interesados.size,
    };
  });

  return {
    publicadas: pets.length,
    pendientes: mascotas.reduce((n, m) => n + m.pendientes, 0),
    noLeidos: mascotas.reduce((n, m) => n + m.noLeidos, 0),
    interesados: interesadosGlobal.size,
    mascotas,
  };
}
