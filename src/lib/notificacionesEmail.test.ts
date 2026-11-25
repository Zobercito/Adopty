import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Guardia de AUD-05 (avisos por email).
 *
 * El diseño es deliberadamente DB-side: la RPC comprueba la relación
 * llamante→destinatario, lee el correo dentro de la base y lo manda con pg_net
 * usando un secreto de Vault. Este test falla si se abre la función de envío al
 * cliente, si se pierde la comprobación de relación/opt-out o si alguien
 * introduce service role.
 */
const sql = readFileSync(
  new URL('../../supabase/migrations/20261123010000_notificaciones_email.sql', import.meta.url),
  'utf8',
);

const encolar =
  /create or replace function public\.encolar_notificacion[\s\S]*?\$\$;/i.exec(sql)?.[0] ?? '';
const enviar =
  /create or replace function public\.notificar_email[\s\S]*?\$\$;/i.exec(sql)?.[0] ?? '';
const cliente = readFileSync(new URL('./notificaciones.ts', import.meta.url), 'utf8');

describe('migración de avisos por email (AUD-05)', () => {
  it('añade la preferencia con default true y solo permite editar esa columna', () => {
    expect(sql).toMatch(
      /add column if not exists notificaciones_email boolean not null default true/i,
    );
    expect(sql).toMatch(/create policy usuarios_update_notificaciones/i);
    expect(sql).toMatch(
      /grant update \(notificaciones_email\) on public\.usuarios to authenticated/i,
    );
    expect(sql).toMatch(/revoke update on public\.usuarios from authenticated/i);
  });

  it('el envío es SECURITY DEFINER, lee Vault y no se concede a clientes', () => {
    expect(enviar).toMatch(/security definer/i);
    expect(enviar).toMatch(/set search_path = public/i);
    expect(enviar).toMatch(/vault\.decrypted_secrets/i);
    expect(enviar).toMatch(/resend_api_key/i);
    expect(enviar).toMatch(/net\.http_post/i);
    expect(sql).toMatch(
      /revoke all on function public\.notificar_email\(uuid, text, text\) from public/i,
    );
    expect(sql).not.toMatch(/grant execute on function public\.notificar_email/i);
  });

  it('el encolado valida la relación y el opt-out antes de enviar', () => {
    expect(encolar).toMatch(/auth\.uid\(\)/i);
    expect(encolar).toMatch(/cuenta_activa\(\)/i);
    expect(encolar).toMatch(/p_destinatario = auth\.uid\(\)/i);
    expect(enviar).toMatch(/notificaciones_email/i);
    expect(encolar).toMatch(/m\.id_publicador = p_destinatario/i);
    expect(encolar).toMatch(/s\.id_adoptante = p_destinatario/i);
    expect(encolar).toMatch(/s\.estado = 'aprobada'/i);
    expect(encolar).toMatch(/::public\.estado_solicitud/i);
    expect(encolar).toMatch(/count\(\*\)/i);
    expect(encolar).toMatch(/notificaciones_log/i);
    expect(encolar).toMatch(/on conflict do nothing/i);
    expect(encolar).toMatch(/fecha_envio > now\(\) - interval '2 minutes'/i);
    expect(encolar).toMatch(/perform public\.notificar_email/i);
  });

  it('solo authenticated puede encolar; anon y service role quedan fuera', () => {
    expect(sql).toMatch(
      /grant execute on function public\.encolar_notificacion\(text, uuid, uuid\) to authenticated/i,
    );
    expect(sql).not.toMatch(/to anon/i);
    expect(sql).not.toMatch(/service_role/i);
  });

  it('el cliente llama a la RPC y no lee correos de otros', () => {
    expect(cliente).toMatch(/\.rpc\('encolar_notificacion'/);
    expect(cliente).not.toMatch(/from\('usuarios'\)/);
    expect(cliente).not.toMatch(/\.select\([^)]*correo/i);
  });
});
