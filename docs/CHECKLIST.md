# Checklist pre-prod y aceptación §13 — Adopty

## Pre-prod (hacer en orden)

- [ ] `main` fusionado desde `develop`, CI verde (jobs `calidad` y `e2e`)
- [ ] Vercel: env `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `SITE_URL` (dominio final)
- [ ] Supabase → Auth → URL Configuration: Site URL + Redirects (`/api/auth/callback` del dominio)
- [ ] Supabase → Storage: buckets `mascotas` y `perfiles` públicos; Database → Realtime activo en `mensajes`
- [ ] Supabase → Auth: **Secure email change** activo (cambio de correo del perfil)
- [ ] Migraciones aplicadas en cloud (las 19 de `supabase/migrations/`, hasta `20261006060000`) y anotadas en `supabase_migrations.schema_migrations`
- [ ] Seed **limpio** en cloud: sin las cuentas demo con la clave `Adopty123!` (o con la clave rotada)
- [ ] Al menos un administrador dado de alta (`docs/ADMIN.md`)
- [ ] Google OAuth: crear credencial → Providers ON → redirects prod (**pendiente decidido**)
- [ ] `pg_dump`/CSV previo al piloto (`docs/QA.md` §4)
- [ ] Lighthouse (LCP < 2.5 s) + axe (0 críticos) en la URL prod
- [ ] `/terminos`, `/privacidad`, `/404`, `/500`, sitemap, robots
- [ ] `E2E_BASE_URL=<url prod> npm run test:e2e` en verde (suite pública, solo lectura)

## Aceptación global §13

| Criterio                       | Estado                                                                                 |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| CU-01…CU-08 e2e                | ✅ automatizados en `e2e/flujo.e2e.ts` (CI, Supabase local); ⏳ repetir a mano en prod |
| Preview deploy verificado      | ✅ 2026-09-26: páginas/API/DB/login/guards/sitemap en preview                          |
| Redirects preview en Supabase  | ✅ signup con `emailRedirectTo` al preview aceptado                                    |
| Register con `emailRedirectTo` | ✅ fix deployado; E2E completo pendiente de cuota email/hora                           |
| Búsqueda p95 < 1 s (1k)        | ✅ local 28 filas; ⏳ repetir en prod                                                  |
| Imágenes ≤ 500 KB WebP         | ✅ enforced                                                                            |
| RLS tests 100%                 | ✅ E2E por rol (F1/F4/F5) + automatizado: tercero sin acceso a solicitud/chat/edición  |
| Sin secretos en git            | ✅ verificado                                                                          |
| Validación server total        | ✅ Zod en todas las mutaciones                                                         |
| Tipos TS/Astro                 | ✅ `npm run check` 0 errores, en el CI                                                 |
| axe 0 críticos / teclado / AA  | ⏳ manual en prod                                                                      |
| Piloto ≥5 / ≥3 / ≥1 + feedback | ⏳ `PILOTO.md` + `ACTA_ENTREGA.md`                                                     |
| Google OAuth                   | ⏳ pendiente decidido (F8)                                                             |

> Nota registro en cloud: con "Confirm email" ON, el alta depende del email de
> Supabase (cuota horaria del free tier). Para el piloto se recomienda OFF
> (Dashboard → Auth → Providers → Email) = sesión inmediata como en local,
> o confirmar manual: `UPDATE auth.users SET email_confirmed_at = now() WHERE email = '...'`.
