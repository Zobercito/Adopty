# Checklist pre-prod y aceptación §13 — Adopty

## Pre-prod (hacer en orden)

- [ ] `main` fusionado desde `develop`, CI verde (jobs `calidad` y `e2e`)
- [x] Vercel: env `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `SITE_URL=https://adopty.lat`
- [x] Supabase → Auth → URL Configuration: Site URL + Redirects (`/api/auth/callback` del dominio)
- [x] Supabase → Storage: buckets `mascotas` y `perfiles` públicos (500 KB, WebP); Database → Realtime activo en `mensajes`
- [x] Supabase → Auth: **Secure email change** activo (cambio de correo del perfil)
- [x] Migraciones aplicadas en cloud (las 21 de `supabase/migrations/`, hasta `20261027020000`) y anotadas en `supabase_migrations.schema_migrations`
- [x] Seed **limpio** en cloud: la clave `Adopty123!` ya no abre ninguna cuenta (P0-03)
- [x] Al menos un administrador dado de alta (`docs/ADMIN.md`)
- [ ] Google OAuth: crear credencial → Providers ON → redirects prod (**pendiente decidido**)
- [ ] `pg_dump`/CSV previo al piloto (`docs/QA.md` §4)
- [ ] Lighthouse (LCP < 2.5 s) + axe (0 críticos) en la URL prod
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
| Búsqueda p95 < 1 s (1k)        | ✅ local 28 filas; ⏳ repetir en prod                                                  |
| Imágenes ≤ 500 KB WebP         | ✅ enforced en app y en Storage (`file_size_limit` + MIME)                             |
| Headers de seguridad           | ✅ verificados en prod (HSTS, nosniff, XFO, referrer, permissions, CSP Report-Only)    |
| RLS tests 100%                 | ✅ E2E por rol + 12 pruebas de bypass REST (P1-10/P1-11 y transiciones en triggers)    |
| Sin secretos en git            | ✅ verificado                                                                          |
| Validación server total        | ✅ Zod en todas las mutaciones                                                         |
| Tipos TS/Astro                 | ✅ `npm run check` 0 errores, en el CI                                                 |
| axe 0 críticos / teclado / AA  | ⏳ manual en prod                                                                      |
| Piloto ≥5 / ≥3 / ≥1 + feedback | ⏳ `PILOTO.md` + `ACTA_ENTREGA.md`                                                     |
| Google OAuth                   | ⏳ pendiente decidido (F8)                                                             |

> Nota registro en cloud: **Confirm email está ON** (`mailer_autoconfirm=false`): el
> alta envía un enlace por Resend y no hay sesión hasta abrirlo. En local,
> `supabase/config.toml` lo mantiene OFF para que el e2e no dependa de correo.
>
> Nota correo: el SMTP integrado de Supabase queda sustituido por Resend
> (`smtp.resend.com:465`, `no-reply@adopty.lat`). Verificado el 2026-10-27: confirmación
> y recuperación llegan y Resend las marca _Delivered_; plantillas en español.
