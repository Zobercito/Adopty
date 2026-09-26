import { describe, expect, it } from 'vitest';
import { solicitudAccionSchema, solicitudSchema } from './request';

describe('solicitudSchema (Fase 4)', () => {
  const id = '6fd9b291-df45-4ccc-b8b4-cfb83a41bb52';
  it('acepta mensaje 10-1000 con UUID', () => {
    expect(
      solicitudSchema.safeParse({
        id_mascota: id,
        mensaje_inicial: 'Quiero adoptarla, tengo patio.',
      }).success,
    ).toBe(true);
  });
  it('rechaza mensaje corto, largo y UUID inválido', () => {
    expect(solicitudSchema.safeParse({ id_mascota: id, mensaje_inicial: 'corto' }).success).toBe(
      false,
    );
    expect(
      solicitudSchema.safeParse({
        id_mascota: 'no-uuid',
        mensaje_inicial: 'Mensaje suficientemente largo.',
      }).success,
    ).toBe(false);
    expect(
      solicitudSchema.safeParse({ id_mascota: id, mensaje_inicial: 'x'.repeat(1001) }).success,
    ).toBe(false);
  });
});

describe('solicitudAccionSchema', () => {
  it('solo aprobar/rechazar/cancelar', () => {
    expect(solicitudAccionSchema.safeParse({ accion: 'aprobar' }).success).toBe(true);
    expect(solicitudAccionSchema.safeParse({ accion: 'archivar' }).success).toBe(false);
  });
});
