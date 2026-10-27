# Checklist pre-prod y aceptación §13 — Adopty

## Pre-prod (hacer en orden)

- [x] `main` fusionado desde `develop`, CI verde (jobs `calidad` y `e2e`)
- [x] Vercel: env `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `SITE_URL=https://adopty.lat`
- [x] Supabase → Auth → URL Configuration: Site URL + Redirects (`/api/auth/callback` del dominio)
- [x] Supabase → Storage: buckets `mascotas` y `perfiles` públicos (500 KB, WebP); Database → Realtime activo en `mensajes`
- [x] Supabase → Auth: **Secure email change** activo (cambio de correo del perfil)
- [x] Migraciones aplicadas en cloud (las 22 de `supabase/migrations/`, hasta `20261027030000`) y anotadas en `supabase_migrations.schema_migrations`
- [x] Rate-limit distribuido (tabla + RPC `consumir_rate_limit`) aplicado a las mutaciones autenticadas
- [x] CI: cobertura con umbral, e2e público, smoke de axe y presupuesto Lighthouse semanal
- [x] Seed **limpio** en cloud: la clave `Adopty123!` ya no abre ninguna cuenta (P0-03)
- [x] Al menos un administrador dado de alta (`docs/ADMIN.md`)
- [ ] Google OAuth: crear credencial → Providers ON → redirects prod (**pendiente decidido**)
- [x] `pg_dump` previo al piloto: `backups/adopty_20261027_010248.dump` (385 KB, 52 tablas) validado con `pg_restore -l`; workflow diario (RPO ≤ 24 h) con retención de 90 días y alerta por issue
- [x] Restore drill en PostgreSQL 17 limpio: 0 errores, conteos idénticos y RLS activa sobre la copia (RTO del restore 0,28 s)
- [x] Lighthouse (LCP < 2.5 s) + axe (0 críticos): 2026-10-27 en prod → LCP 1.9 / 1.7 / 1.6 s móvil; escritorio Perf 100 y CLS 0; a11y 100 y axe 0
- [x] `/terminos`, `/privacidad`, `/404`, `/500`, sitemap, robots
- [x] `E2E_BASE_URL=<url prod> npm run test:e2e` en verde (32/32 contra `https://adopty.lat`)
- [x] Dominio `adopty.lat` + `www` con redirect 308 y TLS
- [x] SMTP de Resend configurado y dominio verificado (DKIM + DMARC `p=none` con `rua`)
- [x] `mailer_autoconfirm=false`: el registro exige confirmar el correo antes de entrar
- [x] Correo real de confirmación y recuperación entregado (_Delivered_ en Resend)

## Aceptación global §13

| Criterio                       | Estado                                                                                 |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| CU-01…CU-08 e2e                | ✅ automatizados en `e2e/flujo.e2e.ts` (CI, Supabase local); ⏳ repetir a mano en prod |
| Preview deploy verificado      | ✅ 2026-10-26: prod `adopty.lat` con páginas/API/DB/login/guards/sitemap               |
| Redirects preview en Supabase  | ✅ signup con `emailRedirectTo` al preview aceptado                                    |
| Register con `emailRedirectTo` | ✅ fix deployado; E2E completo pendiente de cuota email/hora                           |
| Búsqueda p95 < 1 s (1k)        | ✅ 15/15 por ruta, p95 máx 608 ms en producción (2026-10-27)                           |
| Lighthouse LCP < 2.5 s móvil   | ✅ 1.9 s `/`, 1.7 s `/explorar`, 1.6 s ficha (Lighthouse 13.5, 2026-10-27)             |
| Imágenes ≤ 500 KB WebP         | ✅ enforced en app y en Storage (`file_size_limit` + MIME)                             |
| Headers de seguridad           | ✅ verificados en prod (HSTS, nosniff, XFO, referrer, permissions, CSP Report-Only)    |
| RLS tests 100%                 | ✅ E2E por rol + 13 pruebas de bypass REST + RLS validada en el restore drill          |
| Sin secretos en git            | ✅ verificado                                                                          |
| Validación server total        | ✅ Zod en todas las mutaciones                                                         |
| Tipos TS/Astro                 | ✅ `npm run check` 0 errores, en el CI                                                 |
| Cobertura y CI                 | ✅ Umbrales en `vitest.config.ts`, e2e público y axe en CI; Lighthouse semanal         |
| Monitor de caída y backup      | ✅ `uptime.yml` horario con issue automático; alerta de backup por issue               |
| Errores en producción          | ✅ Sentry en cliente y servidor, sin PII; prueba local entregada                       |
| axe 0 críticos / teclado / AA  | ✅ axe 0 en 5 páginas × 4 anchos; teclado y targets ≥ 24 px verificados (2026-10-27)   |
| Piloto ≥5 / ≥3 / ≥1 + feedback | ⏳ `PILOTO.md` + `ACTA_ENTREGA.md`                                                     |
| Google OAuth                   | ⏳ pendiente decidido (F8)                                                             |

> Nota registro en cloud: **Confirm email está ON** (`mailer_autoconfirm=false`): el
> alta envía un enlace por Resend y no hay sesión hasta abrirlo. En local,
> `supabase/config.toml` lo mantiene OFF para que el e2e no dependa de correo.
>
> Nota correo: el SMTP integrado de Supabase queda sustituido por Resend
> (`smtp.resend.com:465`, `no-reply@adopty.lat`). Verificado el 2026-10-27: confirmación
> y recuperación llegan y Resend las marca _Delivered_; plantillas en español.
