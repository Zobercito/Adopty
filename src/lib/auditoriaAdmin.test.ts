import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Guardia de AUD-11: el admin puede leer la auditoría y las acciones de
 * suspensión se atribuyen al admin, no al usuario sancionado.
 */
const sql = readFileSync(
  new URL('../../supabase/migrations/20261123020000_auditoria_admin.sql', import.meta.url),
  'utf8',
);
const admin = readFileSync(new URL('./admin.ts', import.meta.url), 'utf8');

describe('visor de auditoría (AUD-11)', () => {
  it('el admin puede leer todas las filas', () => {
    expect(sql).toMatch(/create policy auditoria_select_admin/i);
    expect(sql).toMatch(/using \(public\.soy_admin\(\)\)/i);
  });

  it('suspender/reactivar registra al admin como autor', () => {
    const fn =
      /create or replace function public\.estado_cuenta[\s\S]*?\$\$;/i.exec(sql)?.[0] ?? '';
    expect(fn).toMatch(/insert into auditoria/i);
    expect(fn).toMatch(/values \(\s*auth\.uid\(\)/i);
    expect(fn).toMatch(/'id_objetivo'/i);
    expect(fn).toMatch(/update public\.usuarios as u[\s\S]*where u\.id = p_usuario_id/i);
    expect(fn).not.toMatch(/values \(\s*p_usuario_id/i);
  });

  it('el panel consulta auditoría sin correos', () => {
    expect(admin).toMatch(/from\('auditoria'\)/);
    expect(admin).toMatch(/listarAuditoria/);
    expect(admin).not.toMatch(/select\([^)]*correo/i);
  });
});
