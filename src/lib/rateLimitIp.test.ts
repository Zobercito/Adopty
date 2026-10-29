import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { rateLimitDistribuido } from './ratelimit';

/**
 * Guardia de regresión de C (307rld).
 *
 * Los endpoints sin sesión (`login`, `register`, `recuperar`) no pueden usar
 * `consumir_rate_limit` (exige `auth.uid()`), así que necesitan una RPC anónima
 * por IP con el tope fijado en servidor y la IP hasheada. Si alguien la borra o
 * permite `p_max` arbitrario, el límite de fuerza bruta vuelve a quedar solo en
 * el contador en memoria de cada instancia serverless.
 */
const sql = readFileSync(
  new URL('../../supabase/migrations/20261028060000_rate_limit_ip.sql', import.meta.url),
  'utf8',
);

const clienteConRpc = (rpc: ReturnType<typeof vi.fn>) => ({ rpc }) as unknown as SupabaseClient;

describe('migración del rate limit anónimo por IP (C)', () => {
  it('define la RPC SECURITY DEFINER para cubos anónimos', () => {
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.consumir_rate_limit_ip\(\s*p_clave text,\s*p_max integer,\s*p_ventana_ms bigint\s*\)/i,
    );
    expect(sql).toMatch(/SECURITY DEFINER/i);
    expect(sql).toMatch(/SET search_path = public/i);
  });

  it('fija el tope de p_max y de la ventana en servidor', () => {
    expect(sql).toMatch(/c_max integer := 10/i);
    expect(sql).toMatch(/c_ventana_ms bigint := 60000/i);
    expect(sql).toMatch(/v_max := LEAST\(.*\bc_max\)/i);
    expect(sql).toMatch(/v_ventana_ms := LEAST\(.*\bc_ventana_ms\)/i);
    expect(sql).toMatch(/'ok', v_contador <= v_max/i);
  });

  it('solo acepta claves opacas con sha256 de la IP', () => {
    expect(sql).toMatch(/'\^\(login\|register\|recuperar\):\[0-9a-f\]\{64\}\$'/);
  });

  it('purga cubos expirados y no se concede a PUBLIC', () => {
    expect(sql).toMatch(/DELETE FROM public\.rate_limits WHERE expira_en <= now\(\)/i);
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.consumir_rate_limit_ip\([^)]*\) FROM PUBLIC/i,
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.consumir_rate_limit_ip\([^)]*\) TO anon, authenticated/i,
    );
    expect(sql).not.toMatch(
      /GRANT EXECUTE ON FUNCTION public\.consumir_rate_limit_ip\([^)]*\) TO[^;]*PUBLIC/i,
    );
  });

  it('no relaja la RPC con sesión', () => {
    expect(sql).not.toMatch(/CREATE OR REPLACE FUNCTION public\.consumir_rate_limit\(/i);
  });
});

describe('rateLimitDistribuido con claves sin sesión (C)', () => {
  it('usa la RPC anónima con sha256 de la IP y no la envía en claro', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { ok: true, reintento_en: 0 }, error: null });
    const r = await rateLimitDistribuido(clienteConRpc(rpc), 'login:203.0.113.7', 10, 60_000);
    expect(r).toEqual({ ok: true });

    const [nombre, args] = rpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(nombre).toBe('consumir_rate_limit_ip');
    expect(args.p_clave).toBe(`login:${createHash('sha256').update('203.0.113.7').digest('hex')}`);
    expect(String(args.p_clave)).not.toContain('203.0.113.7');
    expect(args.p_max).toBe(10);
    expect(args.p_ventana_ms).toBe(60_000);
  });

  it('aplica a register y recuperar, y mantiene la RPC con sesión para el resto', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { ok: true, reintento_en: 0 }, error: null });
    const cliente = clienteConRpc(rpc);

    await rateLimitDistribuido(cliente, 'register:198.51.100.1', 10, 60_000);
    await rateLimitDistribuido(cliente, 'recuperar:198.51.100.1', 5, 60_000);
    await rateLimitDistribuido(cliente, 'perfil:9f1c2b7e-0000-4000-8000-000000000000', 30, 60_000);

    const nombres = rpc.mock.calls.map((c) => c[0]);
    expect(nombres).toEqual([
      'consumir_rate_limit_ip',
      'consumir_rate_limit_ip',
      'consumir_rate_limit',
    ]);
    expect(rpc.mock.calls[2][1]).toMatchObject({
      p_clave: 'perfil:9f1c2b7e-0000-4000-8000-000000000000',
    });
  });
});
