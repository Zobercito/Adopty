import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Guardia de regresión de J.
 *
 * Storage se alcanza con la `anon key` y el JWT del usuario sin pasar por Astro:
 * el prefijo `{uid}/` no distingue una cuenta suspendida, así que las policies
 * de escritura tienen que exigir `cuenta_activa()`. El test recorre TODAS las
 * migraciones en orden y reconstruye qué policies de `storage.objects` siguen
 * vivas, para que una migración posterior no pueda reintroducir una escritura
 * sin la guardia (ni dejarla sumada por `OR`).
 *
 * No sustituye a una prueba contra Postgres (`supabase start`): comprueba el
 * texto de las migraciones, igual que `cuentaActiva.test.ts`.
 */
const dir = new URL('../../supabase/migrations/', import.meta.url);
const migraciones = readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

const nueva = readFileSync(new URL('20261028090000_storage_cuenta_activa.sql', dir), 'utf8');

type Politica = { nombre: string; operacion: string; sql: string };

/** Aplica `create policy`/`drop policy` en orden y devuelve las policies vivas. */
function politicasStorageVivas(): Map<string, Politica> {
  const vivas = new Map<string, Politica>();
  for (const fichero of migraciones) {
    const sql = readFileSync(new URL(fichero, dir), 'utf8');
    const eventos = [
      ...sql.matchAll(
        /(create\s+policy\s+"?([a-z0-9_]+)"?\s+on\s+storage\.objects(?:\s+for\s+(select|insert|update|delete|all))?[\s\S]*?;)|(drop\s+policy\s+if\s+exists\s+"?([a-z0-9_]+)"?\s+on\s+storage\.objects)/gi,
      ),
    ];
    for (const evento of eventos) {
      if (evento[2]) {
        vivas.set(evento[2].toLowerCase(), {
          nombre: evento[2].toLowerCase(),
          operacion: (evento[3] ?? 'all').toLowerCase(),
          sql: evento[1],
        });
      } else if (evento[4]) {
        vivas.delete(evento[4].toLowerCase());
      }
    }
  }
  return vivas;
}

const vivas = politicasStorageVivas();
const escrituras = [...vivas.values()].filter((p) => p.operacion !== 'select');

describe('migración Storage con cuenta activa (J)', () => {
  it('define la excepción de baja como SECURITY DEFINER y acotada a la baja', () => {
    expect(nueva).toMatch(/function public\.cuenta_dada_de_baja\(\)/i);
    expect(nueva).toMatch(/security definer/i);
    expect(nueva).toMatch(/set search_path = public/i);
    expect(nueva).toMatch(/not u\.activo/i);
    expect(nueva).toMatch(/u\.borrado_en is not null/i);
    expect(nueva).toMatch(
      /revoke\s+all\s+on\s+function\s+public\.cuenta_dada_de_baja\(\)\s+from\s+public/i,
    );
    expect(nueva).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.cuenta_dada_de_baja\(\)\s+to\s+authenticated/i,
    );
    expect(nueva).not.toMatch(
      /grant\s+execute\s+on\s+function\s+public\.cuenta_dada_de_baja\(\)\s+to[^;]*anon/i,
    );
  });

  it('cubre insert, update y delete en los dos buckets', () => {
    const esperadas = [
      'storage_mascotas_insert',
      'storage_mascotas_update',
      'storage_mascotas_delete',
      'storage_perfiles_insert',
      'storage_perfiles_update',
      'storage_perfiles_delete',
    ];
    expect(escrituras.map((p) => p.nombre).sort()).toEqual(esperadas.sort());
  });

  it('ninguna policy de escritura viva se queda sin cuenta_activa()', () => {
    expect(
      escrituras.filter((p) => !p.sql.includes('cuenta_activa()')).map((p) => p.nombre),
    ).toEqual([]);
  });

  it('la suspensión no puede borrar: la excepción es solo para la baja', () => {
    const borrados = escrituras.filter((p) => p.operacion === 'delete');
    expect(borrados).toHaveLength(2);
    for (const p of borrados) {
      expect(p.sql).toContain('cuenta_dada_de_baja()');
    }
    const sinBaja = escrituras.filter(
      (p) => p.operacion !== 'delete' && p.sql.includes('cuenta_dada_de_baja()'),
    );
    expect(sinBaja.map((p) => p.nombre)).toEqual([]);
  });

  it('conserva el confinamiento por carpeta del dueño', () => {
    for (const p of escrituras) {
      expect(p.sql).toMatch(/\(storage\.foldername\(name\)\)\[1\]\s*=\s*auth\.uid\(\)::text/i);
    }
  });
});
