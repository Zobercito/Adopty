# Checklist pre-prod y aceptación §13 — Adopty

## Pre-prod (hacer en orden)

- [ ] `main` fusionado desde `develop`, CI verde
- [ ] Vercel: env `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `SITE_URL` (dominio final)
- [ ] Supabase → Auth → URL Configuration: Site URL + Redirects (`/api/auth/callback` del dominio)
- [ ] Supabase → Storage: bucket `mascotas` público; Database → Realtime activo en `mensajes`
- [ ] Migraciones aplicadas en cloud (001–005) + seed **limpio** (sin usuarios `Adopty123!`)
- [ ] Google OAuth: crear credencial → Providers ON → redirects prod (**pendiente decidido**)
- [ ] `pg_dump`/CSV previo al piloto (`docs/QA.md` §4)
- [ ] Lighthouse (LCP < 2.5 s) + axe (0 críticos) en la URL prod
- [ ] `/terminos`, `/privacidad`, `/404`, `/500`, sitemap, robots

## Aceptación global §13

| Criterio                       | Estado                                                 |
| ------------------------------ | ------------------------------------------------------ |
| CU-01…CU-08 e2e en prod        | ⏳ verificar en prod (verificados en dev/turnos F0–F6) |
| Búsqueda p95 < 1 s (1k)        | ✅ local 28 filas; ⏳ repetir en prod                  |
| Imágenes ≤ 500 KB WebP         | ✅ enforced                                            |
| RLS tests 100%                 | ✅ E2E por rol (turnos F1/F4/F5)                       |
| Sin secretos en git            | ✅ verificado                                          |
| Validación server total        | ✅ Zod en todas las mutaciones                         |
| axe 0 críticos / teclado / AA  | ⏳ manual en prod                                      |
| Piloto ≥5 / ≥3 / ≥1 + feedback | ⏳ `PILOTO.md` + `ACTA_ENTREGA.md`                     |
| Google OAuth                   | ⏳ pendiente decidido (F8)                             |
