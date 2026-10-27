# Informe QA — Adopty

## Actualización 2026-10-26 — producción en `adopty.lat`

Entorno: **https://adopty.lat** (Vercel) + Supabase cloud `dvebieysgnhmimmxjwjc`.

| Capa / prueba                         | Resultado                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------------ |
| Unitarios (vitest)                    | ✅ 86/86 en 14 archivos                                                                    |
| Tipos (`astro check`)                 | ✅ 0 errores                                                                               |
| Build (`npm run build`)               | ✅ completo (SSR Vercel + sitemap estático)                                                |
| E2E público contra prod               | ✅ 32/32 (`E2E_BASE_URL=https://adopty.lat npm run test:e2e`)                              |
| Headers de seguridad                  | ✅ HSTS, `nosniff`, `X-Frame-Options: DENY`, referrer, permissions y CSP Report-Only       |
| Canonical / `noindex` / sitemap       | ✅ canonical sin query, privadas `noindex`, fichas en `/sitemap-mascotas.xml`              |
| Dominio y TLS                         | ✅ apex y `www` con Let's Encrypt; `www` redirige 308 al apex                              |
| Storage                               | ✅ buckets 500 KB + `image/webp`; escritura limitada a `auth.uid()`                        |
| Correo Auth (Resend SMTP)             | ✅ confirmación y recuperación _Delivered_; plantillas en español; alta confirmada en 30 s |
| Logout                                | ✅ visible en navbar de escritorio, menú móvil y pestaña Cuenta del perfil                 |
| Búsqueda p95 < 1 s / Lighthouse / axe | ⏳ pendientes en prod (P0-05, P3-05)                                                       |
| E2E de flujo completo (escritura)     | ✅ en CI con Supabase local; ⏳ repetir en prod tras el piloto                             |

**Hallazgos abiertos detectados al verificar RLS en cloud:** P1-10 (un adoptante puede
insertar/actualizar solicitudes por REST saltándose disponibilidad y transiciones) y
P1-11 (mensajes directos sin solicitud aprobada y edición del contenido por el
receptor). La app respeta las reglas; la policy no. Ver
`docs/AUDITORIA_PENDIENTES.md` §3.2.

**Operación pendiente:** rotar las cuentas demo con clave conocida (P0-03), revisar el
buzón `rua` de DMARC y ejecutar un `pg_dump` antes del piloto. La entrega de correo de
confirmación y recuperación ya está verificada.

---

## Actualización 2026-10-14

Rama `develop`. Comandos: `npm run lint`, `npm run format:check`, `npm run check`,
`npm test`, `npm run build`, `npm run test:e2e`.

| Capa                            | Resultado                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------- |
| Unitarios (vitest)              | ✅ 78/78 en 12 archivos (validación Zod, afinidad, transiciones, panel, admin, perfil…)     |
| Tipos (`astro check`)           | ✅ 0 errores (antes no corría: había 230, dos de ellos bugs reales)                         |
| E2E público (Playwright)        | ✅ 28/28 contra el entorno de nube, en solo lectura: páginas, guards, 401 y validación      |
| E2E flujo completo (Playwright) | ⏳ 11 tests escritos; corren en el CI contra un Supabase local (aquí falta acceso a Docker) |

**Bugs que encontró `astro check` (corregidos):**

1. `POST /api/mascotas/upload` usaba `rateLimit` sin importarlo → con sesión, **toda subida
   de fotos respondía 500** (`ReferenceError`) desde el commit `ed3fc3c`. Sin fotos no se
   puede publicar.
2. El formulario **Reportar publicación** de la ficha usaba `petId`, que solo existe dentro
   de otro `<script define:vars>` → cada reporte terminaba en "petId is not defined".

Los dos tienen test de regresión en `e2e/flujo.e2e.ts`.

**Qué cubre el flujo e2e** (`npm run test:e2e:flujo`, solo con Supabase local porque crea
cuentas y mascotas): registro de 3 cuentas → subir foto y publicar → editar ajena (403) →
solicitar + duplicado (409) → solicitar lo propio (403) → chat cerrado antes de aprobar (403)
→ tercero no ve ni aprueba (RLS) → aprobar → `en_proceso` y terminales cerradas (409) → chat
en ambos sentidos con no-leídos → tercero fuera del hilo → reportar por la interfaz.

---

## Informe original — Fase 7 (2026-09-26)

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
