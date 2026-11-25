import { describe, expect, it } from 'vitest';
import { notificacionesSchema } from './notificaciones';

describe('notificacionesSchema', () => {
  it('acepta los dos booleanos', () => {
    expect(notificacionesSchema.safeParse({ notificaciones_email: true }).success).toBe(true);
    expect(notificacionesSchema.safeParse({ notificaciones_email: false }).success).toBe(true);
  });

  it('rechaza ausente, cadena y número', () => {
    expect(notificacionesSchema.safeParse({}).success).toBe(false);
    expect(notificacionesSchema.safeParse({ notificaciones_email: 'true' }).success).toBe(false);
    expect(notificacionesSchema.safeParse({ notificaciones_email: 1 }).success).toBe(false);
  });
});
