import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Guardia de regresión de F.
 *
 * `auditoria_insert` permitía a cualquier usuario autenticado insertar por
 * PostgREST filas con cualquier `accion`/`tabla`/`id_registro`, y el panel admin
 * lee esa tabla como fuente de verdad. Este test falla si la migración
 * desaparece, si se vuelve a abrir el INSERT directo o si la RPC deja de
 * derivar el autor de la sesión o de validar la allowlist y el rol de admin.
 */
const sql = readFileSync(
  new URL(
    '../../supabase/migrations/20261028080000_auditoria_no_falsificable.sql',
    import.meta.url,
  ),
  'utf8',
);

const rpc =
  /create or replace function public\.registrar_auditoria[\s\S]*?\$\$;/i.exec(sql)?.[0] ?? '';

const cliente = readFileSync(new URL('./auditoria.ts', import.meta.url), 'utf8');

describe('migración auditoría no falsificable (F)', () => {
  it('elimina la policy de INSERT y revoca el INSERT directo', () => {
    expect(sql).toMatch(/drop policy if exists auditoria_insert on public\.auditoria/i);
    expect(sql).not.toMatch(/create policy\s+auditoria_insert/i);
    expect(sql).toMatch(/revoke insert on public\.auditoria from authenticated/i);
    expect(sql).toMatch(/revoke insert on public\.auditoria from anon/i);
    expect(sql).not.toMatch(/grant insert/i);
  });

  it('define la RPC como SECURITY DEFINER con search_path fijo', () => {
    expect(rpc).toMatch(/security definer/i);
    expect(rpc).toMatch(/set search_path = public/i);
  });

  it('usa siempre auth.uid() como autor, sin parámetro de usuario', () => {
    expect(rpc).toMatch(/if auth\.uid\(\) is null/i);
    expect(rpc).toMatch(/values\s*\(\s*auth\.uid\(\)/i);
    expect(rpc).not.toMatch(/p_id_usuario/i);
    expect(rpc).not.toMatch(/p_usuario/i);
  });

  it('valida acción y tabla contra una allowlist', () => {
    expect(rpc).toMatch(/v_valido/i);
    for (const accion of [
      'password_cambiada',
      'mascota_crear',
      'mascota_eliminar',
      'solicitud_aprobar',
      'solicitud_rechazar',
      'solicitud_cancelar',
      'admin_reporte_ocultar',
      'admin_reporte_descartar',
      'admin_verificacion_aprobar',
      'admin_verificacion_rechazar',
      'admin_mascota_restaurar',
    ]) {
      expect(rpc).toContain(`'${accion}'`);
    }
    expect(rpc).toMatch(/if not coalesce\(v_valido, false\) then[\s\S]*?raise exception/i);
  });

  it('exige admin para las acciones admin_* y acota el tamaño de los JSONB', () => {
    expect(rpc).toMatch(/p_accion like 'admin\\_%' and not public\.soy_admin\(\)/i);
    expect(rpc).toMatch(/pg_column_size\(/i);
  });

  it('solo concede la ejecución a authenticated', () => {
    expect(sql).toMatch(
      /revoke all on function public\.registrar_auditoria\(text, text, uuid, jsonb, jsonb\) from public/i,
    );
    expect(sql).toMatch(
      /grant execute on function public\.registrar_auditoria[\s\S]*?to authenticated/i,
    );
    expect(sql).not.toMatch(/grant execute[\s\S]*?to (anon|public)\b/i);
  });

  it('el cliente escribe por la RPC y no por PostgREST', () => {
    expect(cliente).toMatch(/\.rpc\('registrar_auditoria'/);
    expect(cliente).not.toMatch(/\.from\('auditoria'\)/);
  });
});
