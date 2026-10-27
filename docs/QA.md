# Informe QA — Adopty

## Actualización 2026-10-27 — accesibilidad y rendimiento

Entorno: **https://adopty.lat** (producción, merge `e6169b5`) con Supabase cloud.
Lighthouse 13.5 mobile (slow 4G simulado, CPU 4×):

| Ruta                      | Perf | A11y | BP  | SEO | LCP   | FCP   | CLS   | TBT   |
| ------------------------- | ---- | ---- | --- | --- | ----- | ----- | ----- | ----- |
| `/`                       | 99   | 100  | 96  | 100 | 1.9 s | 1.3 s | 0.002 | 0 ms  |
| `/explorar`               | 100  | 100  | 96  | 100 | 1.7 s | 1.1 s | 0     | 20 ms |
| `/mascota/mishi-331c32a6` | 100  | 100  | 96  | 100 | 1.6 s | 1.0 s | 0.003 | 10 ms |

La preview previa al merge (commit `2b01e3c`) dio LCP 2.2 / 2.1 / 1.6 s y SEO 69 por
el `noindex` automático de Vercel.

- **axe:** 0 violaciones en `/`, `/explorar`, `/login`, `/register` y una ficha ×
  320/768/1024/1440; sin scroll horizontal.
- **Teclado:** skip link, filtros, carrusel, chat y formularios; targets ≥ 24 px
  (WCAG 2.2) y tarjetas fuera de pantalla con `inert`.
- **Búsqueda:** `node scripts/perf.mjs https://adopty.lat` 15/15 por ruta, p95 máx
  608 ms.
- **E2E público contra producción:** 32/32.
- **Unitarios:** 92/92 en 14 archivos (incluye los 4 del rate-limit distribuido).
- **Cambios:** fuentes autohospedadas (se eliminó la hoja de Google Fonts que bloqueaba
  el render), WebP + preload del LCP, primera tarjeta de `/explorar` eager, contraste
  AA, `<main>` en inicio y nombres accesibles de tarjetas.

**Backup:** `backups/adopty_20261027_010248.dump` (custom, 394 024 B, 52 entradas
`TABLE DATA`) validado con `pg_restore -l`. El workflow diario corre a las 08:00 UTC
(03:00 Panamá), así que el RPO es ≤ 24 h. El restore real se ejecutó el 2026-10-27
(ver la sección siguiente).

## Actualización 2026-10-27 — cierre autónomo (restore, rate-limit y CI)

| Prueba                           | Resultado                                                                  |
| -------------------------------- | -------------------------------------------------------------------------- |
| Restore drill (PostgreSQL 17.11) | ✅ 0 errores, 280 ms, conteos idénticos y RLS activa sobre la copia        |
| Rate-limit distribuido           | ✅ RPC atómica en cloud; 30 concurrentes con `p_max=10` → 10/20            |
| Migración cloud                  | ✅ 22 migraciones; `rate_limits` con RLS y sin ACL para anon/authenticated |
| Cobertura                        | ✅ 69,5 % statements / 57,3 % branches / 67,1 % functions / 73,2 % lines   |
| axe automatizado                 | ✅ 10/10 (5 páginas × 360/1280 px)                                         |
| `format:check`/`lint`/`check`    | ✅ 0 errores                                                               |
| `npm run build`                  | ✅ SSR Vercel + sitemap                                                    |

- El smoke de axe y el e2e público quedaron como pasos separados del CI; el flujo con
  escrituras sigue corriendo contra Supabase local.
- `perf.yml` mide Lighthouse cada lunes contra producción con presupuesto (perf ≥ 90,
  LCP ≤ 2,5 s, CLS ≤ 0,1, TBT ≤ 300 ms).

**Primer run del presupuesto (2026-10-27):** falló con CLS 0,1205 en `/` (escritorio)
porque Plus Jakarta Sans llegaba después del primer pintado y el `swap` reacomodaba
`section#inicio`. Se añadió `rel="preload"` de `/fonts/plus-jakarta-sans-latin.woff2`
en `Layout.astro`; el rerun (run 40553322986) quedó verde con estos valores (mediana
de 3 runs, preset escritorio):

| Ruta        | Perf | A11y | BP  | SEO | LCP   | FCP   | CLS | TBT  |
| ----------- | ---- | ---- | --- | --- | ----- | ----- | --- | ---- |
| `/`         | 100  | 100  | 96  | 100 | 0,4 s | 0,2 s | 0   | 0 ms |
| `/explorar` | 100  | 100  | 96  | 100 | 0,5 s | 0,3 s | 0   | 0 ms |

- El backup ahora retiene 90 días y abre un issue si falla el dump o la verificación.

---

## Actualización 2026-10-26 — producción en `adopty.lat`

Entorno: **https://adopty.lat** (Vercel) + Supabase cloud `dvebieysgnhmimmxjwjc`.

| Capa / prueba                     | Resultado                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------ |
| Unitarios (vitest)                | ✅ 86/86 en 14 archivos                                                                    |
| Tipos (`astro check`)             | ✅ 0 errores                                                                               |
| Build (`npm run build`)           | ✅ completo (SSR Vercel + sitemap estático)                                                |
| E2E público contra prod           | ✅ 32/32 (`E2E_BASE_URL=https://adopty.lat npm run test:e2e`)                              |
| Headers de seguridad              | ✅ HSTS, `nosniff`, `X-Frame-Options: DENY`, referrer, permissions y CSP Report-Only       |
| Canonical / `noindex` / sitemap   | ✅ canonical sin query, privadas `noindex`, fichas en `/sitemap-mascotas.xml`              |
| Dominio y TLS                     | ✅ apex y `www` con Let's Encrypt; `www` redirige 308 al apex                              |
| Storage                           | ✅ buckets 500 KB + `image/webp`; escritura limitada a `auth.uid()`                        |
| Correo Auth (Resend SMTP)         | ✅ confirmación y recuperación _Delivered_; plantillas en español; alta confirmada en 30 s |
| Logout                            | ✅ visible en navbar de escritorio, menú móvil y pestaña Cuenta del perfil                 |
| Búsqueda p95 / Lighthouse / axe   | ✅ 2026-10-27 en prod: p95 608 ms máx; LCP 1.9/1.7/1.6 s; axe 0 (ver arriba)               |
| E2E de flujo completo (escritura) | ✅ en CI con Supabase local; ⏳ repetir en prod tras el piloto                             |

**RLS cerrado el 2026-10-27:** P1-10 y P1-11 se corrigieron con la migración
`20261027020000_rls_reglas_negocio.sql` (triggers y `WITH CHECK` en solicitudes,
mensajes y transiciones de mascotas). Se probaron 13 casos con JWT simulado y
`ROLLBACK`: auto-aprobación, mascota no disponible, suplantación, mensaje sin
solicitud aprobada y edición de contenido fallan; los flujos válidos funcionan
(incluido el auto-rechazo de otras solicitudes al aprobar). Ver
`docs/AUDITORIA_PENDIENTES.md` §11.

**P0-03 verificado el 2026-10-27:** la clave `Adopty123!` devuelve 400 en las cinco
cuentas del seed y las dos cuentas de prueba vacías se eliminaron. Quedan 5 cuentas:
`patitas`, `rescatista`, el admin y dos cuentas reales.

**DMARC:** el registro actual es `v=DMARC1; p=none; rua=mailto:...; fo=1`. Es el valor
correcto para un dominio joven: solo reporta. Plan:

1. Mantener `p=none` 4 semanas y revisar los XML del buzón `rua` (crear un filtro en
   Gmail por `Report domain: adopty.lat`).
2. Si todos los envíos legítimos salen por Resend, pasar a `p=quarantine; pct=25` y
   luego `pct=100`.
3. Pasar a `p=reject` solo con varias semanas de reportes limpios. No tocar los
   registros DKIM/SPF de Resend.

**Operación:** `pg_dump` ejecutado el 2026-10-27 y validado (ver sección anterior); el
restore real sigue pendiente. La entrega de correo de confirmación y recuperación ya
está verificada.

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

| RNF (plan §13)                       | Estado | Evidencia                                                                                                |
| ------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------- |
| Búsqueda p95 < 1s                    | ✅     | `node scripts/perf.mjs`: 5 rutas, 15/15 ok, p95 máx 836 ms (frío) / ~210 ms estable                      |
| Imágenes ≤ 500 KB WebP               | ✅     | `src/lib/storage.ts` (sharp + reintentos) + E2E (6 MB y MIME falso → 400)                                |
| RLS tests (A no ve datos de B)       | ✅     | E2E F1/F4/F5: favs, solicitudes y mensajes aislados; edición ajena 403; anon 404 en no-disponibles       |
| Sin secretos en git                  | ✅     | `git grep` de URLs/keys/passwords en trackeados: vacío; `.env`, `.env.db`, `backups/` ignorados          |
| Validación server en todos los forms | ✅     | Zod en login/register/recuperar/perfil/mascotas/solicitudes/mensajes/favoritos                           |
| Rate-limit login/API                 | ✅     | `src/lib/ratelimit.ts` en login/register/recuperar (10/10/5 por min); live: 10×401 → 429 + `Retry-After` |
| LCP < 2.5 s (4G)                     | ✅     | Lighthouse 13.5 mobile 2026-10-27: 2.2 s en `/`, 2.1 s en `/explorar`, 1.6 s en ficha                    |
| axe 0 errores críticos               | ✅     | axe 2026-10-27: 0 violaciones en 5 páginas × 320/768/1024/1440; a11y 100 en Lighthouse                   |
| Uptime prod                          | ⏭️ F8  | Requiere deploy + dominio                                                                                |

## 3. Diferido con justificación

- **k6 200 concurrentes + seed 10k**: contaminaría la DB cloud compartida del piloto y el tier free; sustituido por perf smoke sobre dataset real (criterio cumplido).
- **LHCI/axe en CI**: cerrado el 2026-10-27: axe corre en el job e2e (10/10) y
  `perf.yml` mide Lighthouse contra producción con presupuesto semanal.
- **Analytics de embudo y emails transaccionales**: requieren proyecto Vercel prod + SMTP (F8).
- **Google OAuth**: pospuesto a F8 por decisión (código listo, provider apagado).

## 4. Backups

- Fuente de verdad en git: `supabase/migrations/*.sql` + `supabase/seed.sql`.
- Respaldo 2026-09-26 en `backups/` (CSV por tabla, gitignorado).
- **2026-10-27:** `backups/adopty_20261027_010248.dump` (formato custom, 394 024 B,
  52 entradas `TABLE DATA`) generado con `pg_dump` 17 por el pooler y validado con
  `pg_restore -l`. `scripts/backup.sh` conserva 7 copias locales.
- **Automático:** `.github/workflows/backup.yml` corre a diario (08:00 UTC), guarda el
  `.sql.gz` 90 días y abre un issue si el dump o la verificación fallan. **RPO ≤ 24 h.**
- **Restore probado (2026-10-27):** PostgreSQL 17.11 limpio, `pg_restore` en 280 ms,
  0 errores; conteos idénticos en las 13 tablas de `public`, `auth.users`,
  `storage.objects`, migraciones, triggers, policies e índices. **RTO del restore:
  0,28 s** (sin aprovisionar el servidor). RLS sobre la copia: `anon` ve 28/32
  mascotas y 0 usuarios/mensajes.

## 5. Artefactos

`postman/adopty.json` (Auth/Mascotas/Solicitudes/Mensajes/Favoritos), `.github/workflows/ci.yml`,
`scripts/perf.mjs`, `/terminos`, `/privacidad`, `/500`, `robots.txt`, sitemap (`SITE_URL` se fija en F8).
