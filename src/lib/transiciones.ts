/** Máquinas de estado (Fase 7) — fuente única usada por la API y los tests. */

export type EstadoSolicitud = 'pendiente' | 'aprobada' | 'rechazada' | 'cancelada';
export type AccionSolicitud = 'aprobar' | 'rechazar' | 'cancelar';
export type RolSolicitud = 'publicador' | 'adoptante';

export type ResultadoTransicion =
  { ok: true; siguiente: EstadoSolicitud } | { ok: false; error: string };

const ROL_POR_ACCION: Record<AccionSolicitud, RolSolicitud> = {
  aprobar: 'publicador',
  rechazar: 'publicador',
  cancelar: 'adoptante',
};

const SIGUIENTE: Record<AccionSolicitud, EstadoSolicitud> = {
  aprobar: 'aprobada',
  rechazar: 'rechazada',
  cancelar: 'cancelada',
};

/**
 * Valida una transición de solicitud. Reglas del plan §6:
 * solo desde `pendiente`, sin `aprobada↔rechazada`, con rol correcto.
 */
export function transicionSolicitud(
  actual: EstadoSolicitud,
  accion: AccionSolicitud,
  rol: RolSolicitud,
): ResultadoTransicion {
  if (actual !== 'pendiente') {
    return { ok: false, error: `Ya está ${actual}, no se puede cambiar` };
  }
  const rolEsperado = ROL_POR_ACCION[accion];
  if (rol !== rolEsperado) {
    return {
      ok: false,
      error:
        accion === 'cancelar'
          ? 'Solo el adoptante puede cancelar'
          : 'Solo el publicador puede aprobar o rechazar',
    };
  }
  return { ok: true, siguiente: SIGUIENTE[accion] };
}

export type EstadoMascota = 'disponible' | 'en_proceso' | 'adoptada';

/**
 * Transiciones de mascota. La única terminal es `adoptada` (entrega confirmada);
 * `en_proceso → disponible` cubre el "si falla, revierte" del plan §6 y el dueño
 * puede confirmar entrega directa (`disponible → adoptada`).
 */
export function transicionMascota(de: EstadoMascota, a: EstadoMascota): boolean {
  if (de === a) return true;
  if (de === 'adoptada') return false;
  return true;
}
