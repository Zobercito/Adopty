import { describe, expect, it } from 'vitest';
import { transicionMascota, transicionSolicitud } from './transiciones';

describe('transicionSolicitud (máquina §6)', () => {
  it('camino feliz por rol', () => {
    expect(transicionSolicitud('pendiente', 'aprobar', 'publicador')).toEqual({
      ok: true,
      siguiente: 'aprobada',
    });
    expect(transicionSolicitud('pendiente', 'rechazar', 'publicador')).toEqual({
      ok: true,
      siguiente: 'rechazada',
    });
    expect(transicionSolicitud('pendiente', 'cancelar', 'adoptante')).toEqual({
      ok: true,
      siguiente: 'cancelada',
    });
  });
  it('rechaza rol incorrecto', () => {
    const r1 = transicionSolicitud('pendiente', 'aprobar', 'adoptante');
    expect(r1.ok).toBe(false);
    const r2 = transicionSolicitud('pendiente', 'cancelar', 'publicador');
    expect(r2.ok).toBe(false);
  });
  it('nada sale de un estado final (sin aprobada↔rechazada)', () => {
    for (const e of ['aprobada', 'rechazada', 'cancelada'] as const) {
      for (const a of ['aprobar', 'rechazar', 'cancelar'] as const) {
        const r = transicionSolicitud(e, a, a === 'cancelar' ? 'adoptante' : 'publicador');
        expect(r.ok).toBe(false);
      }
    }
  });
});

describe('transicionMascota', () => {
  it('permite disponible↔en_proceso y confirmación de entrega', () => {
    expect(transicionMascota('disponible', 'en_proceso')).toBe(true);
    expect(transicionMascota('en_proceso', 'disponible')).toBe(true);
    expect(transicionMascota('disponible', 'adoptada')).toBe(true);
    expect(transicionMascota('en_proceso', 'adoptada')).toBe(true);
  });
  it('adoptada es terminal', () => {
    expect(transicionMascota('adoptada', 'disponible')).toBe(false);
    expect(transicionMascota('adoptada', 'en_proceso')).toBe(false);
  });
});
