import type { MascotaRow } from './mascotas';

/** Perfil de estilo de vida (Fase 1) que alimenta el match. */
export interface PerfilEstilo {
  ambiente: 'apartamento' | 'casa_chica' | 'casa_grande';
  ninos: boolean;
  especie_pref: 'perro' | 'gato' | 'otro' | 'indiferente';
  ubicacion: string;
  energia_pref: 'tranquila' | 'moderada' | 'activa';
  otras_mascotas: boolean;
  edad_pref: 'cachorro' | 'adulto' | 'indiferente';
}

/** Pesos por criterio (suman 100). */
const P = {
  especie: 30,
  tamano: 20,
  ubicacion: 15,
  energia: 15,
  convivencia: 10,
  edad: 10,
} as const;

/** Factor de compatibilidad tamaño ↔ ambiente (1 = ideal). */
const TAMANO_POR_AMBIENTE: Record<string, Record<string, number>> = {
  apartamento: { Pequeño: 1, Mediano: 0.6, Grande: 0 },
  casa_chica: { Mediano: 1, Pequeño: 0.6, Grande: 0.3 },
  casa_grande: { Grande: 1, Mediano: 0.6, Pequeño: 0.3 },
};

const ORDEN_ENERGIA = ['tranquila', 'moderada', 'activa'];

/** Normaliza texto para comparar ubicaciones (minúsculas, sin acentos). */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

type MascotaMatch = Pick<
  MascotaRow,
  'especie' | 'tamano' | 'ubicacion' | 'nivel_energia' | 'apto_ninos' | 'apto_otros' | 'edad_meses'
>;

/**
 * Afinidad 0–100 entre el perfil de estilo de vida y una mascota.
 * Heurística transparente (no es una garantía): prioriza especie, luego
 * tamaño/ambiente, ubicación, energía, convivencia y edad.
 */
export function afinidad(perfil: PerfilEstilo, m: MascotaMatch): number {
  let score = 0;

  // Especie preferida
  if (perfil.especie_pref === 'indiferente' || perfil.especie_pref === m.especie) {
    score += P.especie;
  }

  // Tamaño según el ambiente
  const factor = TAMANO_POR_AMBIENTE[perfil.ambiente]?.[m.tamano] ?? 0.5;
  score += P.tamano * factor;

  // Ubicación
  const a = norm(perfil.ubicacion);
  const b = norm(m.ubicacion);
  if (a && b) {
    if (a === b) score += P.ubicacion;
    else if (a.includes(b) || b.includes(a)) score += P.ubicacion * 0.6;
  }

  // Energía (adyacente = media puntuación)
  const ip = ORDEN_ENERGIA.indexOf(perfil.energia_pref);
  const im = ORDEN_ENERGIA.indexOf(m.nivel_energia);
  if (ip >= 0 && im >= 0) {
    const diff = Math.abs(ip - im);
    if (diff === 0) score += P.energia;
    else if (diff === 1) score += P.energia * 0.5;
  }

  // Convivencia: niños y otras mascotas (si no hay conflicto, puntúa completo)
  const conflictoNinos = perfil.ninos && !m.apto_ninos;
  const conflictoOtros = perfil.otras_mascotas && !m.apto_otros;
  if (!conflictoNinos && !conflictoOtros) score += P.convivencia;

  // Edad
  const esCachorro = m.edad_meses < 12;
  if (
    perfil.edad_pref === 'indiferente' ||
    (perfil.edad_pref === 'cachorro' && esCachorro) ||
    (perfil.edad_pref === 'adulto' && !esCachorro)
  ) {
    score += P.edad;
  }

  return Math.round(score);
}
