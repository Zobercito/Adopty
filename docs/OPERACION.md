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
   curl -I https://adopty.lat/        # 200 + CSP Report-Only + HSTS
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

## 3. Migraciones

Están en `supabase/migrations/` y se aplican con `supabase db push` o desde el SQL
Editor. Si aplicas una a mano en la nube, **regístrala** en
`supabase_migrations.schema_migrations`; si no, el siguiente `db push` intentará
reaplicarla.

Antes de desplegar:

```sh
npm run format:check && npm run lint && npm run check && npm test && npm run build
```

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

| Tarea                        | Cómo                                                                                                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Regenerar iconos PWA         | `node scripts/generar-iconos.mjs` (solo si cambia el logo)                                                                                            |
| Revisar moderación           | Tabla `auditoria` o columna `accion` (`admin_reporte_ocultar`, `admin_verificacion_aprobar`, `suspender_cuenta`, `baja_cuenta`, `password_cambiada`…) |
| Suspender una cuenta         | `/admin` → **Cuentas** → Suspender. Deja de entrar sin borrar nada (RPC `estado_cuenta`, con rastro en `auditoria`)                                   |
| Dar de alta un administrador | [`ADMIN.md`](ADMIN.md)                                                                                                                                |
| Comprobar uptime             | Workflow _Uptime de producción_                                                                                                                       |
| Presupuesto de rendimiento   | Workflow _Rendimiento — presupuesto Lighthouse_                                                                                                       |

## 6. Cabeceras y CSP

Los headers viven en `vercel.json` para cubrir también estáticos y assets: HSTS,
`nosniff`, frame policy, referrer, permissions y CSP. La CSP está en
**Report-Only** por los scripts inline de Astro. Pasar a enforcing requiere
nonces/hashes y validarlo primero en un preview.

## 7. Respuesta ante incidentes

1. Confirmar el alcance en Sentry y en los logs de Vercel/Supabase.
2. Si hay exposición de datos o credenciales: rotar la clave afectada, invalidar
   sesiones y revisar `auditoria`.
3. Si el problema es de datos: restaurar el backup más reciente y documentar la
   pérdida (RPO ≤ 24 h).
4. Registrar el incidente en `docs/AUDITORIA_PENDIENTES.md` con fecha, causa y
   acción correctiva.
