# Operación y despliegue — Adopty

Runbook del entorno de producción. El README mantiene solo el resumen; aquí están
los pasos completos. Rutas relativas a la raíz del repositorio `adopty/`.

- **Producción:** <https://adopty.lat> (Vercel, proyecto `adopty` + Supabase cloud).
- **Rama de producción:** `main`. `develop` es la rama de integración.
- **Naturaleza:** piloto académico. No hay SLA ni guardia 24/7; ver
  [limitaciones](../README.md#limitaciones-conocidas).

## 1. Despliegue en Vercel

1. Proyecto `adopty`, rama de producción `main`.
2. Variables de entorno:
   - `PUBLIC_SUPABASE_URL`
   - `PUBLIC_SUPABASE_ANON_KEY`
   - `SITE_URL=https://adopty.lat`
   - `SENTRY_DSN` y `PUBLIC_SENTRY_DSN` (opcionales; sin valor, Sentry queda apagado)
3. `vercel.json` aplica los headers de seguridad y el redirect `www → apex`.
4. Verificación:

   ```sh
   curl -I https://adopty.lat/        # 200 + CSP (header/meta) + HSTS
   curl -I https://www.adopty.lat/    # 308 → https://adopty.lat/
   ```

## 2. Configuración de Supabase Auth

- **Site URL:** `https://adopty.lat`.
- **Redirect URLs:** dominio principal, `/api/auth/callback` y previews de Vercel.
- **Secure email change:** activo (el cambio de correo envía confirmación a ambas
  direcciones).
- **Confirm email:** activo en cloud (`mailer_autoconfirm=false`). El registro no
  crea sesión hasta abrir el enlace. En local sigue desactivado para el e2e.
- **Buckets:** `mascotas` y `perfiles` públicos, WebP ≤ 500 KB y carpeta del dueño
  (`userId/uuid.webp`).
- **Realtime:** habilitado solo en `mensajes`.

### Correo transaccional

Supabase Auth usa SMTP de Resend (`smtp.resend.com:465`, usuario `resend`,
remitente `no-reply@adopty.lat`) con el dominio verificado (DKIM + DMARC). Sustituye
el límite de 2 correos/hora del SMTP integrado. Si el correo falla, revisar primero
el estado del dominio en Resend y los logs de Auth en Supabase.

### Avisos de la app (solicitudes y mensajes)

La migración `20261123010000_notificaciones_email.sql` añade los avisos de solicitud
nueva, aprobada/rechazada y mensaje nuevo. El correo se envía desde Postgres con
`pg_net` y el secreto de Vault; **no** se usa service role en la app.

Activación (una vez):

```sql
-- En el SQL Editor de Supabase, como owner del proyecto.
select vault.create_secret('<re_...>', 'resend_api_key');
```

Comprobaciones:

1. `supabase db push` (o aplicar la migración y registrarla).
2. `select * from net._http_response order by created desc limit 5;` tras crear una
   solicitud de prueba; debe haber un `200` de `api.resend.com`.
3. Sin el secreto o sin `pg_net`, la RPC no hace nada y la app sigue funcionando.
4. La preferencia se controla en `/perfil` → “Avisos por email” (opt-out).
5. No hay reintentos automáticos: si Resend falla, el detalle queda en
   `net._http_response`. Reenviar es volver a llamar a la RPC con la misma solicitud
   dentro de la hora (el antispam es por hora).

## 3. Migraciones

Están en `supabase/migrations/` y se aplican con `supabase db push` o desde el SQL
Editor. Si aplicas una a mano en la nube, **regístrala** en
`supabase_migrations.schema_migrations`; si no, el siguiente `db push` intentará
reaplicarla.

Antes de desplegar:

```sh
npm run format:check && npm run lint && npm run check && npm test && npm run build
```

> Las migraciones `20261123010000_notificaciones_email.sql` y
> `20261123020000_auditoria_admin.sql` ya están aplicadas en cloud (2026-11-25). El
> código que usa `usuarios.notificaciones_email` y el visor de auditoría puede
> desplegarse. Falta crear `resend_api_key` en Vault para que se envíen los correos.

## 4. Backups y restauración

| Tarea                     | Cómo                                                                                                                                    |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Backup automático         | Workflow _Backup base de datos_, diario a las 08:00 UTC (03:00 Panamá). Artefacto 90 días + copia en Cloudflare R2 180 días.            |
| Backup manual             | _Actions → Backup base de datos → Run workflow_, o `./scripts/backup.sh`.                                                               |
| Restaurar desde artefacto | `gunzip -c adopty_*.sql.gz \| psql "$DATABASE_URL"`                                                                                     |
| Restaurar desde R2        | `npx wrangler r2 object get adopty-backups/db/<archivo> --file=backup.sql.gz` y luego `gunzip -c backup.sql.gz \| psql "$DATABASE_URL"` |
| Verificar la copia        | El workflow compara el objeto de R2 con el artefacto mediante `cmp`.                                                                    |

El backup usa el **connection pooler** de Supabase porque los runners de GitHub
Actions tienen IP dinámica y no llegan al host directo. El secreto `DATABASE_URL`
vive en el repositorio (GitHub Secrets), nunca en el código.

La copia off-site usa Cloudflare R2 (`adopty-backups`, retención 180 días).
Secrets: `CLOUDFLARE_API_TOKEN` (permiso _Workers R2 Storage: Edit_) y
`CLOUDFLARE_ACCOUNT_ID`. Si faltan, el backup local sigue funcionando y solo se
omite la copia externa.

**RPO:** ≤ 24 h. **RTO:** el tiempo de descarga + `psql`. El último ensayo de
restauración está documentado en [`QA.md`](QA.md).

## 5. Tareas de mantenimiento

| Tarea                        | Cómo                                                                                                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Regenerar iconos PWA         | `node scripts/generar-iconos.mjs` (solo si cambia el logo)                                                                                                                           |
| Revisar moderación           | `/admin` → **Auditoría reciente**; o tabla `auditoria` con `accion` (`admin_reporte_ocultar`, `admin_verificacion_aprobar`, `suspender_cuenta`, `baja_cuenta`, `password_cambiada`…) |
| Backfill de imágenes         | `SUPABASE_URL=... SUPABASE_ANON_KEY=... ADOPTY_EMAIL=... ADOPTY_PASSWORD=... node scripts/backfill-srcset.mjs` (por publicador; `--dry-run` para listar)                             |
| Dataset 1k (local)           | `npx supabase db reset` → `npx supabase db execute --file scripts/seed-1k.sql` → `node scripts/perf.mjs`                                                                             |
| Suspender una cuenta         | `/admin` → **Cuentas** → Suspender. Deja de entrar sin borrar nada (RPC `estado_cuenta`, con rastro en `auditoria`)                                                                  |
| Dar de alta un administrador | [`ADMIN.md`](ADMIN.md)                                                                                                                                                               |
| Comprobar uptime             | Workflow _Uptime de producción_                                                                                                                                                      |
| Presupuesto de rendimiento   | Workflow _Rendimiento — presupuesto Lighthouse_                                                                                                                                      |

## 6. Cabeceras y CSP

Los headers que no son CSP viven en `vercel.json` para cubrir también estáticos y
assets: HSTS, `nosniff`, frame policy, referrer y permissions.

La CSP la emite **Astro** (`security.csp` en `astro.config.mjs`):

- Páginas SSR: header `Content-Security-Policy` con hashes SHA-256 de los scripts y
  `frame-ancestors 'none'`.
- Páginas prerenderizadas: `<meta http-equiv="content-security-policy">` con los
  mismos hashes; `frame-ancestors` no aplica en meta y lo cubre `X-Frame-Options`.
- `script-src` **no** lleva `'unsafe-inline'`; `style-src` sí lo mantiene porque la UI
  usa atributos `style` dinámicos (badges, `object-position`).
- **No pongas CSP en `vercel.json`**: sobrescribiría el header con hashes de Astro.
- Los scripts deben ser procesados por Astro: no uses `is:inline` ni `define:vars`.
  Pasa los datos con `data-*` y léelos con `dataset`; los `onerror` inline se
  sustituyeron por un listener global en `Layout.astro`.

Para validar un cambio de CSP: `npm run build`, servir el output y comprobar que no
hay `securitypolicyviolation` en las rutas públicas. En `dev` Astro no aplica CSP.

## 7. Respuesta ante incidentes

1. Confirmar el alcance en Sentry y en los logs de Vercel/Supabase.
2. Si hay exposición de datos o credenciales: rotar la clave afectada, invalidar
   sesiones y revisar `auditoria`.
3. Si el problema es de datos: restaurar el backup más reciente y documentar la
   pérdida (RPO ≤ 24 h).
4. Registrar el incidente en `docs/AUDITORIA_PENDIENTES.md` con fecha, causa y
   acción correctiva.
