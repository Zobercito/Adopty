import { describe, expect, it } from 'vitest';
import { cuentaEstadoSchema } from './admin';

describe('cuentaEstadoSchema (moderación)', () => {
  const id = '6fd9b291-df45-4ccc-b8b4-cfb83a41bb52';

  it('acepta un UUID y un booleano', () => {
    expect(cuentaEstadoSchema.safeParse({ id, activo: true }).success).toBe(true);
    expect(cuentaEstadoSchema.safeParse({ id, activo: false }).success).toBe(true);
  });

  it('rechaza id ausente o inválido', () => {
    expect(cuentaEstadoSchema.safeParse({ activo: true }).success).toBe(false);
    expect(cuentaEstadoSchema.safeParse({ id: 'zzz', activo: true }).success).toBe(false);
  });

  it('rechaza activo ausente o de otro tipo', () => {
    expect(cuentaEstadoSchema.safeParse({ id }).success).toBe(false);
    expect(cuentaEstadoSchema.safeParse({ id, activo: 'true' }).success).toBe(false);
    expect(cuentaEstadoSchema.safeParse({ id, activo: 1 }).success).toBe(false);
  });
});
