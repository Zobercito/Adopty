import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Guardia de regresión de D.1/D.2.
 *
 * `consumir_rate_limit` es SECURITY DEFINER: la única barrera es a quién se le
 * concede y qué claves acepta. Este test falla si vuelve a concederse a `anon`
 * o si desaparece la comprobación de que la clave es del llamador.
 */
const sql = readFileSync(
  new URL('../../supabase/migrations/20261028030000_rate_limit_scope.sql', import.meta.url),
  'utf8',
);

describe('migración de alcance del rate limit (D.1/D.2)', () => {
  it('no concede la RPC a anon', () => {
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.consumir_rate_limit\([^)]*\) FROM anon/i);
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.consumir_rate_limit\([^)]*\) TO authenticated/i,
    );
    expect(sql).not.toMatch(
      /GRANT EXECUTE ON FUNCTION public\.consumir_rate_limit\([^)]*\) TO[^;]*anon/i,
    );
  });

  it('exige sesión dentro de la función', () => {
    expect(sql).toMatch(/v_uid uuid := auth\.uid\(\)/i);
    expect(sql).toMatch(/IF v_uid IS NULL THEN/i);
    expect(sql).toMatch(/rate limit requiere sesión/i);
  });

  it('solo acepta claves que terminen en el id del llamador', () => {
    expect(sql).toMatch(/p_clave NOT LIKE '%:' \|\| v_uid::text/i);
    expect(sql).toMatch(/clave de rate limit ajena/i);
  });

  it('mantiene la validación de parámetros y limpia cubos expirados', () => {
    expect(sql).toMatch(/p_max < 1/);
    expect(sql).toMatch(/p_ventana_ms > 86400000/);
    expect(sql).toMatch(/DELETE FROM public\.rate_limits WHERE expira_en <= now\(\)/i);
  });
});
