# Informe QA — Fase 7 (Adopty)

Fecha: 2026-09-26 · Rama: `develop` · Comandos: `npm run lint`, `npm run format:check`, `npm test`, `npm run build`.

## 1. Tests automatizados — ✅ 36/36

`npm test` (vitest): `user` (8), `pet` (5), `request` (3), `message` (2),
`transiciones` (máquina §6: roles + terminales), `mascotas` (helpers + `paramsFrom`),
`solicitudes` (`solBadge`), `ratelimit` (cubeta, claves, ventana), `panel` (agregados con cliente falso).

## 2. RNF verificados

| RNF (plan §13)                       | Estado    | Evidencia                                                                                                  |
| ------------------------------------ | --------- | ---------------------------------------------------------------------------------------------------------- |
| Búsqueda p95 < 1s                    | ✅        | `node scripts/perf.mjs`: 5 rutas, 15/15 ok, p95 máx 836 ms (frío) / ~210 ms estable                        |
| Imágenes ≤ 500 KB WebP               | ✅        | `src/lib/storage.ts` (sharp + reintentos) + E2E (6 MB y MIME falso → 400)                                  |
| RLS tests (A no ve datos de B)       | ✅        | E2E F1/F4/F5: favs, solicitudes y mensajes aislados; edición ajena 403; anon 404 en no-disponibles         |
| Sin secretos en git                  | ✅        | `git grep` de URLs/keys/passwords en trackeados: vacío; `.env`, `.env.db`, `backups/` ignorados            |
| Validación server en todos los forms | ✅        | Zod en login/register/recuperar/perfil/mascotas/solicitudes/mensajes/favoritos                             |
| Rate-limit login/API                 | ✅        | `src/lib/ratelimit.ts` en login/register/recuperar (10/10/5 por min); live: 10×401 → 429 + `Retry-After`   |
| LCP < 2.5 s (4G)                     | ⚠️ manual | Sin tooling de navegador en este entorno. Cómo: DevTools → Lighthouse en preview Vercel                    |
| axe 0 errores críticos               | ⚠️ manual | Código con labels/ARIA/`aria-live`/foco visible/teclado en carrusel-chat-filtros; pasar axe DevTools en F8 |
| Uptime prod                          | ⏭️ F8     | Requiere deploy + dominio                                                                                  |

## 3. Diferido con justificación

- **k6 200 concurrentes + seed 10k**: contaminaría la DB cloud compartida del piloto y el tier free; sustituido por perf smoke sobre dataset real (criterio cumplido).
- **LHCI/axe en CI**: el workflow corre lint + format + tests + build; Lighthouse/axe quedan como paso manual en preview (F8).
- **Analytics de embudo y emails transaccionales**: requieren proyecto Vercel prod + SMTP (F8).
- **Google OAuth**: pospuesto a F8 por decisión (código listo, provider apagado).

## 4. Backups

- Fuente de verdad en git: `supabase/migrations/*.sql` + `supabase/seed.sql`.
- Respaldo manual 2026-09-26 en `backups/` (CSV por tabla, gitignorado; `pg_dump` local v14 incompatible con servidor v17).
- Límite free tier documentado en plan §11; re-respaldar semanal en F8.

## 5. Artefactos

`postman/adopty.json` (Auth/Mascotas/Solicitudes/Mensajes/Favoritos), `.github/workflows/ci.yml`,
`scripts/perf.mjs`, `/terminos`, `/privacidad`, `/500`, `robots.txt`, sitemap (`SITE_URL` se fija en F8).
