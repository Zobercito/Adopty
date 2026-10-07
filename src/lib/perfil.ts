import type { SupabaseClient } from '@supabase/supabase-js';

/** Datos mínimos de una cuenta, tal y como se muestran en tarjetas y chats. */
export interface PerfilPublico {
  id: string;
  nombre: string;
  foto: string | null;
  tipo: 'persona' | 'organizacion';
  verificada: boolean;
  eliminado: boolean;
  /** Solo se rellenan para organizaciones verificadas (el RPC las filtra). */
  sitio_web: string | null;
  redes: { instagram?: string; facebook?: string; whatsapp?: string } | null;
}

/** Resumen del adoptante que un publicador puede ver (solo si hay solicitud). */
export interface ResumenAdoptante {
  id: string;
  nombre: string;
  foto: string | null;
  zona: string | null;
  experiencia: string | null;
  motivacion: string | null;
  sobre_mi: string | null;
  eliminado: boolean;
  solicitudes: number;
  aprobada: boolean;
}

/** Nombre que ve la otra parte cuando la cuenta se dio de baja. */
export const SIN_CUENTA = 'Usuario no disponible';

/**
 * Perfiles públicos de varios usuarios en una sola llamada.
 *
 * Ya no se puede leer `personas` con el cliente del usuario (Fase A: la policy es
 * `auth.uid() = id`), así que los nombres salen del RPC `perfil_publico`, que
 * devuelve solo campos seguros. Funciona también sin sesión, que es lo que
 * necesita la ficha de una mascota.
 */
export async function perfilesPublicos(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Map<string, PerfilPublico>> {
  const unicos = [...new Set(ids)].filter(Boolean);
  const out = new Map<string, PerfilPublico>();
  if (!unicos.length) return out;
  const { data, error } = await supabase.rpc('perfil_publico', { p_ids: unicos });
  if (error) return out;
  for (const fila of (data ?? []) as PerfilPublico[]) out.set(fila.id, fila);
  return out;
}

/** Atajo: solo `id -> nombre`, que es lo que pintan el chat y la bandeja. */
export async function nombresPublicos(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Map<string, string>> {
  const perfiles = await perfilesPublicos(supabase, ids);
  const nombres = new Map<string, string>();
  for (const [id, p] of perfiles) nombres.set(id, p.nombre);
  return nombres;
}

/**
 * Resumen de adoptantes para el publicador. El RPC `resumen_adoptantes` solo
 * devuelve los que le han enviado alguna solicitud sobre sus mascotas, así que
 * aquí no hay nada que autorizar: lo hace PostgreSQL.
 */
export async function resumenesAdoptantes(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Map<string, ResumenAdoptante>> {
  const unicos = [...new Set(ids)].filter(Boolean);
  const out = new Map<string, ResumenAdoptante>();
  if (!unicos.length) return out;
  const { data, error } = await supabase.rpc('resumen_adoptantes', { p_adoptantes: unicos });
  if (error) return out;
  for (const fila of (data ?? []) as ResumenAdoptante[]) out.set(fila.id, fila);
  return out;
}

export const EXPERIENCIAS: Record<string, string> = {
  primera_vez: 'Primera adopción',
  alguna_vez: 'He tenido mascotas antes',
  experimentada: 'Mucha experiencia',
};

/** Etiqueta legible de la experiencia, con fallback al valor crudo. */
export function etiquetaExperiencia(valor: string | null | undefined): string {
  if (!valor) return 'Sin indicar';
  return EXPERIENCIAS[valor] ?? valor;
}

/** Campos que compara la completitud del perfil. */
export interface CamposCompletitud {
  nombre?: string | null;
  foto?: string | null;
  descripcion?: string | null;
  experiencia?: string | null;
  motivacion?: string | null;
}

const PESOS: { campo: keyof CamposCompletitud; peso: number; etiqueta: string }[] = [
  { campo: 'nombre', peso: 15, etiqueta: 'nombre' },
  { campo: 'foto', peso: 20, etiqueta: 'foto de perfil' },
  { campo: 'descripcion', peso: 25, etiqueta: 'sobre mí' },
  { campo: 'experiencia', peso: 15, etiqueta: 'experiencia con mascotas' },
  { campo: 'motivacion', peso: 25, etiqueta: 'motivación para adoptar' },
];

/**
 * Porcentaje de completitud del perfil (0–100) y qué falta por llenar.
 * Lógica pura para poder testearla: los pesos reflejan lo que un refugio mira
 * primero (quién eres y por qué quieres adoptar).
 *
 * `faltan` son etiquetas para el usuario; `faltanCampos` son las claves de campo,
 * que es lo que necesita la UI para poner un marcador al lado de cada campo vacío.
 */
export function completitudPerfil(campos: CamposCompletitud): {
  pct: number;
  faltan: string[];
  faltanCampos: (keyof CamposCompletitud)[];
} {
  const faltan: string[] = [];
  const faltanCampos: (keyof CamposCompletitud)[] = [];
  let suma = 0;
  for (const { campo, peso, etiqueta } of PESOS) {
    const v = campos[campo];
    if (v && String(v).trim().length > 0) suma += peso;
    else {
      faltan.push(etiqueta);
      faltanCampos.push(campo);
    }
  }
  return { pct: suma, faltan, faltanCampos };
}
