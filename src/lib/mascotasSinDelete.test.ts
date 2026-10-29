import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Guardia de regresión de B.
 *
 * Las FK de `reportes`, `solicitudes`, `fotos_mascota` y `mensajes` son
 * ON DELETE CASCADE, así que un DELETE del dueño por PostgREST destruye la cola
 * de moderación sin dejar auditoría. Este test falla si la migración desaparece
 * o si alguien vuelve a abrir el DELETE directo.
 */
const sql = readFileSync(
  new URL('../../supabase/migrations/20261028050000_mascotas_sin_delete.sql', import.meta.url),
  'utf8',
);

const api = readFileSync(new URL('../pages/api/mascotas/index.ts', import.meta.url), 'utf8');

describe('migración sin borrado físico de mascotas (B)', () => {
  it('elimina la policy mascotas_delete', () => {
    expect(sql).toMatch(/drop policy\s+(if exists\s+)?mascotas_delete\s+on\s+public\.mascotas/i);
  });

  it('no recrea ninguna policy ni grant de DELETE', () => {
    expect(sql).not.toMatch(/create policy/i);
    expect(sql).not.toMatch(/grant\s+delete/i);
  });

  it('revoca el DELETE directo a authenticated y anon', () => {
    expect(sql).toMatch(/revoke\s+delete\s+on\s+public\.mascotas\s+from\s+authenticated/i);
    expect(sql).toMatch(/revoke\s+delete\s+on\s+public\.mascotas\s+from\s+anon/i);
  });

  it('el rollback de la API usa borrado lógico, no DELETE', () => {
    expect(api).not.toMatch(/from\('mascotas'\)\s*\.delete\(\)/);
    expect(api).toMatch(/from\('mascotas'\)\s*\.update\(\{\s*deleted_at/);
  });
});
