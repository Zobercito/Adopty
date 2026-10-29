import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Guardia de regresión de A.
 *
 * El badge `verificada` es lo que separa a una organización real de una cuenta
 * cualquiera: `perfil_publico()` lo devuelve y `organizaciones_select` hace
 * pública la ficha. `admin.sql` solo cerró el UPDATE; el INSERT por PostgREST
 * (con la anon key) seguía aceptando `verificada: true`. Este test falla si la
 * migración desaparece o si alguien vuelve a conceder el INSERT sin impedir el
 * badge.
 */
const sql = readFileSync(
  new URL('../../supabase/migrations/20261028040000_org_verificada_insert.sql', import.meta.url),
  'utf8',
);

const politica =
  /create policy\s+org_insert\s+on\s+public\.organizaciones[\s\S]*?;/i.exec(sql)?.[0] ?? '';

describe('migración org verificada en INSERT (A)', () => {
  it('revoca el INSERT directo a authenticated y anon', () => {
    expect(sql).toMatch(/revoke\s+insert\s+on\s+public\.organizaciones\s+from\s+authenticated/i);
    expect(sql).toMatch(/revoke\s+insert\s+on\s+public\.organizaciones\s+from\s+anon/i);
  });

  it('no vuelve a conceder el INSERT', () => {
    expect(sql).not.toMatch(/grant\s+insert/i);
  });

  it('conserva la policy con la guardia de cuenta activa y el dueño', () => {
    expect(politica).toMatch(/for\s+insert/i);
    expect(politica).toMatch(/auth\.uid\(\)\s*=\s*id/);
    expect(politica).toMatch(/cuenta_activa\(\)/);
  });

  it('rechaza `verificada = true` aunque se reabra el INSERT', () => {
    expect(politica).toMatch(/verificada\s*=\s*false/);
    expect(politica).not.toMatch(/verificada\s+is\s+not\s+false/i);
  });
});
