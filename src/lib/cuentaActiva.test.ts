import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Guardia de regresión de B.1/B.2.
 *
 * La suspensión y la baja lógica viven en `usuarios.activo`, y la única barrera
 * real es RLS: la `anon key` permite hablar con PostgREST sin pasar por la app.
 * Este test no sustituye a una prueba contra Postgres (haría falta `supabase
 * start`), pero falla si alguien vuelve a crear una policy de escritura sin
 * `cuenta_activa()` en esta migración.
 */
const sql = readFileSync(
  new URL('../../supabase/migrations/20261028010000_cuenta_activa.sql', import.meta.url),
  'utf8',
);

/** Trozos que empiezan en cada `CREATE POLICY`. */
const politicas = sql
  .split(/create policy/i)
  .slice(1)
  .map((trozo) => trozo.split(';')[0]);

const nombreDe = (trozo: string) =>
  /^\s+"?([a-z_]+)"?\s+on\s+(?:public\.)?([a-z_]+)/i.exec(trozo)?.slice(1) ?? ['?', '?'];

describe('migración cuenta_activa (B.1/B.2)', () => {
  it('define la guardia como SECURITY DEFINER con search_path fijo', () => {
    expect(sql).toMatch(/function public\.cuenta_activa\(\)/i);
    expect(sql).toMatch(/security definer/i);
    expect(sql).toMatch(/set search_path = public/i);
    expect(sql).toMatch(/select u\.activo from public\.usuarios u where u\.id = auth\.uid\(\)/i);
  });

  it('cubre todas las policies de escritura de contenido de usuario', () => {
    expect(politicas).toHaveLength(18);
    const nombres = politicas.map((p) => nombreDe(p)[0]);
    expect(nombres.sort()).toEqual(
      [
        'auditoria_insert',
        'fav_all',
        'fotos_write',
        'mascotas_delete',
        'mascotas_insert',
        'mascotas_update',
        'msg_insert',
        'msg_update',
        'org_insert',
        'org_update',
        'personas_insert',
        'personas_update',
        'pev_insert',
        'pev_update',
        'reportes_insert',
        'sol_insert',
        'sol_update',
        'verificaciones_insert',
      ].sort(),
    );
  });

  it('ninguna policy de escritura se queda sin la guardia', () => {
    const sinGuardia = politicas.filter((p) => !p.includes('cuenta_activa()'));
    expect(sinGuardia.map((p) => nombreDe(p)[0])).toEqual([]);
  });

  it('la RPC SECURITY DEFINER también la comprueba', () => {
    const rpc = /create or replace function public\.aprobar_solicitud[\s\S]*?\$\$;/i.exec(sql)?.[0];
    expect(rpc).toBeDefined();
    expect(rpc).toContain('cuenta_activa()');
  });

  it('un admin suspendido deja de ser admin', () => {
    const soyAdmin = /create or replace function public\.soy_admin\(\)[\s\S]*?\$\$;/i.exec(
      sql,
    )?.[0];
    expect(soyAdmin).toBeDefined();
    expect(soyAdmin).toContain('cuenta_activa()');
  });
});
