import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { rateLimit, rateLimitDistribuido } from './ratelimit';

const clienteConRpc = (rpc: ReturnType<typeof vi.fn>) => ({ rpc }) as unknown as SupabaseClient;

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

describe('rateLimitDistribuido', () => {
  it('delega en la RPC y respeta el bloqueo con reintento', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { ok: false, reintento_en: 42 }, error: null });
    const r = await rateLimitDistribuido(clienteConRpc(rpc), 'k-bloqueo', 5, 60_000);
    expect(rpc).toHaveBeenCalledWith('consumir_rate_limit', {
      p_clave: 'k-bloqueo',
      p_max: 5,
      p_ventana_ms: 60_000,
    });
    expect(r).toEqual({ ok: false, reintentoEn: 42 });
  });

  it('deja pasar cuando la RPC responde ok', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { ok: true, reintento_en: 0 }, error: null });
    const r = await rateLimitDistribuido(clienteConRpc(rpc), 'k-ok', 5, 60_000);
    expect(r).toEqual({ ok: true });
  });

  it('cae al contador en memoria si la RPC devuelve error', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'sin migración' } });
    const cliente = clienteConRpc(rpc);
    const clave = `fallback-${Date.now()}`;
    expect((await rateLimitDistribuido(cliente, clave, 1, 60_000)).ok).toBe(true);
    expect((await rateLimitDistribuido(cliente, clave, 1, 60_000)).ok).toBe(false);
  });

  it('cae al contador en memoria si la RPC lanza o devuelve datos inválidos', async () => {
    const lanza = vi.fn().mockRejectedValue(new Error('red'));
    const clave = `fallback-lanza-${Date.now()}`;
    expect((await rateLimitDistribuido(clienteConRpc(lanza), clave, 1, 60_000)).ok).toBe(true);
    expect((await rateLimitDistribuido(clienteConRpc(lanza), clave, 1, 60_000)).ok).toBe(false);

    const raro = vi.fn().mockResolvedValue({ data: 'no-es-objeto', error: null });
    expect((await rateLimitDistribuido(clienteConRpc(raro), `${clave}-2`, 1, 60_000)).ok).toBe(
      true,
    );
  });
});
