import { describe, expect, it } from 'vitest';
import { rateLimit } from './ratelimit';

describe('rateLimit', () => {
  it('permite N y bloquea la N+1 con reintento', () => {
    const clave = `test-${Date.now()}`;
    expect(rateLimit(clave, 3, 60_000).ok).toBe(true);
    expect(rateLimit(clave, 3, 60_000).ok).toBe(true);
    expect(rateLimit(clave, 3, 60_000).ok).toBe(true);
    const r = rateLimit(clave, 3, 60_000);
    expect(r.ok).toBe(false);
    expect(r.reintentoEn).toBeGreaterThan(0);
  });
  it('claves distintas no comparten cubeta', () => {
    const a = `a-${Date.now()}`;
    const b = `b-${Date.now()}`;
    rateLimit(a, 1, 60_000);
    expect(rateLimit(a, 1, 60_000).ok).toBe(false);
    expect(rateLimit(b, 1, 60_000).ok).toBe(true);
  });
  it('la ventana expira (tiempo simulado)', () => {
    const clave = `w-${Date.now()}`;
    const t0 = Date.now();
    expect(rateLimit(clave, 1, 1000, t0).ok).toBe(true);
    expect(rateLimit(clave, 1, 1000, t0 + 500).ok).toBe(false);
    expect(rateLimit(clave, 1, 1000, t0 + 1001).ok).toBe(true);
  });
});
