import { describe, expect, it } from 'vitest';
import { fechaCorta, solBadge } from './solicitudes';

describe('solBadge', () => {
  it('clase + etiqueta por estado', () => {
    expect(solBadge('pendiente')[2]).toBe('Pendiente');
    expect(solBadge('aprobada')[2]).toBe('Aprobada');
    expect(solBadge('rechazada')[2]).toBe('Rechazada');
    expect(solBadge('cancelada')[2]).toBe('Cancelada');
  });
});

describe('fechaCorta', () => {
  it('formatea es-PA sin hora', () => {
    const s = fechaCorta('2026-09-25T12:00:00.000Z');
    expect(s).toMatch(/2026/);
    expect(s.length).toBeGreaterThan(6);
  });
});
