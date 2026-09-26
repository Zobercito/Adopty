import { describe, expect, it } from 'vitest';
import { mensajeSchema } from './message';

describe('mensajeSchema (Fase 5)', () => {
  const id = '6fd9b291-df45-4ccc-b8b4-cfb83a41bb52';
  it('acepta 1-2000 caracteres con UUID y receptor opcional', () => {
    expect(mensajeSchema.safeParse({ id_mascota: id, contenido: 'Hola' }).success).toBe(true);
    expect(
      mensajeSchema.safeParse({ id_mascota: id, contenido: 'Hola', id_receptor: id }).success,
    ).toBe(true);
  });
  it('rechaza vacío, >2000 y UUID inválidos', () => {
    expect(mensajeSchema.safeParse({ id_mascota: id, contenido: '   ' }).success).toBe(false);
    expect(mensajeSchema.safeParse({ id_mascota: id, contenido: 'x'.repeat(2001) }).success).toBe(
      false,
    );
    expect(
      mensajeSchema.safeParse({ id_mascota: id, contenido: 'Hola', id_receptor: 'zzz' }).success,
    ).toBe(false);
  });
});
