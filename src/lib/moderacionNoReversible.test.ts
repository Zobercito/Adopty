import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Guardia de regresión de C.1.
 *
 * `mascotas_update` permite al dueño escribir su fila, así que el único punto
 * que separa «ocultar mi publicación» de «des-ocultar la que ocultó
 * moderación» es `validar_mascota`. Este test falla si la migración desaparece
 * o si alguien vuelve a dejar el paso oculta → visible sin `soy_admin()`.
 */
const sql = readFileSync(
  new URL('../../supabase/migrations/20261028020000_moderacion_no_reversible.sql', import.meta.url),
  'utf8',
);

const funcion =
  /create or replace function public\.validar_mascota\(\)[\s\S]*?\$\$;/i.exec(sql)?.[0] ?? '';

describe('migración moderación no reversible (C.1)', () => {
  it('redefine el trigger como SECURITY DEFINER con search_path fijo', () => {
    expect(sql).toMatch(/create or replace function public\.validar_mascota\(\)/i);
    expect(funcion).toMatch(/security definer/i);
    expect(funcion).toMatch(/set search_path = public/i);
    expect(funcion).toMatch(/returns trigger/i);
  });

  it('bloquea oculta → visible solo para administradores', () => {
    const guardia =
      /if\s+OLD\.deleted_at IS NOT NULL AND NEW\.deleted_at IS NULL[\s\S]*?end if;/i.exec(
        funcion,
      )?.[0];
    expect(guardia).toBeDefined();
    expect(guardia).toMatch(/soy_admin\(\)/);
    expect(guardia).toMatch(/solo un administrador/i);
  });

  it('no impide que el dueño oculte su propia publicación', () => {
    // La condición exige OLD.deleted_at NOT NULL: el paso NULL → now() queda libre.
    expect(funcion).toMatch(/OLD\.deleted_at IS NOT NULL AND NEW\.deleted_at IS NULL/);
    expect(funcion).not.toMatch(
      /NEW\.deleted_at IS DISTINCT FROM OLD\.deleted_at[\s\S]{0,80}raise exception/i,
    );
  });

  it('conserva las protecciones anteriores', () => {
    expect(funcion).toMatch(/No puedes cambiar el publicador/);
    expect(funcion).toMatch(/Una mascota adoptada no puede cambiar de estado/);
    expect(funcion).toMatch(/Solo el publicador puede cambiar el estado/);
  });
});
