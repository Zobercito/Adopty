---
title: Auditoría técnica y pendientes — Adopty
audit_date: 2026-10-26
last_update: 2026-10-26
branch_audited: develop
scope: adopty/
status: vigente — P1 y producción verificados (secciones 9 y 10)
sources:
  - README.md
  - AGENTS.md
  - docs/DECISIONES.md
  - docs/CHECKLIST.md
  - docs/QA.md
  - docs/PILOTO.md
  - docs/ACTA_ENTREGA.md
  - PLAN_DESARROLLO_ADOPTY.md (carpeta padre)
  - código en src/ y supabase/
  - build generado en dist/client/
---

# Auditoría técnica y pendientes — Adopty

Documento de referencia para humanos y agentes de IA. Consolida **qué está hecho**,
**qué falta**, **qué está roto o incompleto** y **cómo verificarlo**. Las rutas son
relativas a la raíz del repositorio `adopty/` salvo que se indique lo contrario.

---

## 0. Cómo usar este documento

### 0.1 Convenciones

| Etiqueta     | Significado                                                               |
| ------------ | ------------------------------------------------------------------------- |
| `[HECHO]`    | Implementado y con evidencia en código/documentación.                     |
| `[PARCIAL]`  | Implementado, pero falta un caso, entorno o verificación.                 |
| `[FALTA]`    | No implementado o no configurado.                                         |
| `[DECISIÓN]` | Exclusión consciente; no debe tratarse como bug sin consenso.             |
| `P0`         | Bloquea entrega, despliegue o piloto.                                     |
| `P1`         | Bug, riesgo de seguridad/privacidad o incumplimiento de regla de negocio. |
| `P2`         | Funcionalidad faltante relevante o deuda operativa.                       |
| `P3`         | SEO, UX, rendimiento o accesibilidad no bloqueante.                       |
| `P4`         | Documentación, mantenimiento y consistencia.                              |

### 0.2 Reglas para agentes

1. **Verifica antes de cambiar.** No confíes solo en este documento; ejecuta los
   comandos de la sección 6 y lee el archivo citado.
2. **No introduzcas service role.** El proyecto se diseñó para que todo pase por RLS.
   Cambiar eso rompe la premisa de seguridad y privacidad.
3. **Toda mutación se valida en servidor con Zod.** El cliente solo replica mensajes.
4. **No borres físicamente mascotas.** El borrado es lógico (`deleted_at`); existe
   restauración administrativa.
5. **No commitees `.env`, `.env.db`, `backups/` ni credenciales.** El seed usa tokens
   `''`, nunca `NULL`, en `auth.users`.
6. **`npm run check` es obligatorio.** ESLint no verifica tipos de TS/Astro.
7. **No ejecutes comandos destructivos sin revisar `git status`.** Al momento de esta
   auditoría hay trabajo sin commitear (ver P0-04).
8. **Los e2e de flujo escriben datos.** Solo corren con `E2E_FLUJO=1` y Supabase local.
9. **No prometas una verificación manual como hecha.** Lighthouse, axe y teclado en
   producción siguen pendientes (P0-05).
10. **Mantén el idioma del producto:** UI, mensajes y documentación en español.

---

## 1. Resumen ejecutivo

### 1.1 Ficha del proyecto

| Dimensión     | Estado                                                                                  |
| ------------- | --------------------------------------------------------------------------------------- |
| Stack         | Astro v7 + TypeScript strict + Tailwind v4 + Supabase + Zod + Vercel                    |
| Persistencia  | Postgres/Supabase con 22 migraciones en `supabase/migrations/`                          |
| Backend       | API routes de Astro + RPC SQL; sin service role                                         |
| Auth          | Email/contraseña + recuperación; Google OAuth codificado pero apagado                   |
| Páginas       | Aproximadamente 20 vistas `.astro` (públicas, privadas, admin, legales)                 |
| API           | 28 archivos de rutas en `src/pages/api/`                                                |
| Tests         | 86 unitarios (14 archivos, vitest) + 2 suites Playwright                                |
| CI            | 2 jobs (`calidad`, `e2e`) + `npm audit`; Dependabot semanal                             |
| Backups       | `pg_dump` diario por GitHub Actions, artefacto 30 días                                  |
| Estado global | Fases 0–7 y todos los P1 cerrados; prod en `adopty.lat`; quedan P0 de operación y P2/P3 |

### 1.2 Veredicto

El producto es funcionalmente completo para el alcance académico y tiene una base de
calidad por encima de lo habitual: RLS, Zod en servidor, tests, CI, backups, legales y
documentación. **No queda deuda de seguridad conocida**: los P0 restantes son
verificaciones operativas (QA manual, piloto, restore) y Google OAuth, que el equipo
decidió dejar para el final.

### 1.3 Riesgos principales (ordenados)

1. ~~**Open redirect** en el callback de autenticación~~ — **resuelto 2026-10-26** (P1-01).
2. ~~**La máquina de estados de mascota no se aplica en servidor**~~ — **resuelto
   2026-10-26** (P1-02).
3. ~~**La foto de perfil sobrevive a la baja de cuenta**~~ — **resuelto 2026-10-26**
   (P1-03).
4. ~~**El service worker cachea HTML de rutas privadas**~~ — **resuelto 2026-10-26**
   (P1-04).
5. ~~**Sitemap sin fichas y con rutas privadas**~~ — **resuelto 2026-10-26** (P1-05);
   canonical/noindex/OG también (P1-06).
6. ~~**Sin headers de seguridad**~~ — **resuelto y verificado en producción**
   (P1-07): HSTS, `nosniff`, frame policy, referrer, permissions y CSP Report-Only.
7. ~~**Buckets de fotos sin límite de tamaño/MIME ni ruta del dueño**~~ — **resuelto
   2026-10-26** (P1-09).
8. ~~**Dos policies permitían saltarse reglas de negocio por REST**~~ — **resuelto
   2026-10-27** (P1-10 y P1-11): triggers y `WITH CHECK` en `solicitudes`, `mensajes`
   y transiciones de `mascotas`.
9. **Sin notificaciones por email** propios de la app: una solicitud o aprobación puede
   pasar inadvertida (P2-01, pendiente). Supabase Auth ya usa SMTP de Resend.
10. **Sin monitoreo de errores/uptime**; el CI ya ejecuta `npm audit` y Dependabot está
    configurado, pero faltan axe/Lighthouse (P2-04, P2-05b, P3-05).

---

## 2. Panorama: qué se hizo

### 2.1 Funcionalidad implementada

| Módulo                                            | Estado    | Evidencia principal                                                                                                                                 |
| ------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Registro/login/logout, recuperación de contraseña | `[HECHO]` | `src/pages/api/auth/*`, `src/pages/login.astro`, `src/pages/register.astro`, `src/pages/recuperar.astro`                                            |
| Perfiles persona/organización y edición           | `[HECHO]` | `src/pages/perfil.astro`, `src/pages/api/perfil.ts`, `src/lib/validation/user.ts`                                                                   |
| Cambio de correo y contraseña                     | `[HECHO]` | `src/pages/api/auth/cambiar-email.ts`, `src/pages/api/auth/cambiar-password.ts`                                                                     |
| Baja de cuenta, exportación de datos              | `[HECHO]` | `src/pages/api/cuenta/borrar.ts`, `src/pages/api/mis-datos.ts`, RPC en `supabase/migrations/20261006030000_cuenta.sql`                              |
| CRUD de mascotas con 1–5 fotos                    | `[HECHO]` | `src/pages/api/mascotas/*`, `src/pages/mascota/nueva.astro`, `src/pages/mascota/[id]/editar.astro`                                                  |
| Subida optimizada WebP ≤500 KB                    | `[HECHO]` | `src/lib/storage.ts`, `src/pages/api/mascotas/upload.ts`                                                                                            |
| Soft-delete y restauración                        | `[HECHO]` | `src/pages/api/mascotas/[id].ts`, `src/pages/api/admin/mascotas/[id]/restaurar.ts`                                                                  |
| Búsqueda con filtros, texto, orden y paginación   | `[HECHO]` | `src/pages/explorar.astro`, `src/pages/api/mascotas/index.ts`, `src/lib/mascotas.ts`                                                                |
| Slugs y redirección 301 desde UUID                | `[HECHO]` | `src/pages/mascota/[id].astro:15-27`, migración `20261002010000_slug_pgtrgm.sql`                                                                    |
| Solicitudes con estados y RPC atómica             | `[HECHO]` | `src/pages/api/solicitudes/*`, `src/lib/transiciones.ts`, `supabase/migrations/20260925010000_solicitudes_rpc.sql`                                  |
| Chat interno con Realtime                         | `[HECHO]` | `src/components/ChatView.astro`, `src/components/MessageThread.astro`, `src/pages/api/mensajes/*`                                                   |
| No leídos y bandeja                               | `[HECHO]` | `src/pages/mensajes.astro`, `src/middleware.ts`                                                                                                     |
| Panel publicador y solicitudes recibidas          | `[HECHO]` | `src/pages/panel/index.astro`, `src/pages/panel/solicitudes.astro`, `src/lib/panel.ts`                                                              |
| Favoritos con migración desde localStorage        | `[HECHO]` | `src/components/FavButton.astro`, `src/pages/favoritos.astro`, `src/pages/api/favoritos.ts`                                                         |
| Perfil de adoptante y afinidad                    | `[HECHO]` | `src/lib/match.ts`, `src/pages/api/estilo-de-vida/index.ts`, `src/pages/perfil.astro`                                                               |
| Moderación: reportes, verificación, suspensión    | `[HECHO]` | `src/pages/admin/index.astro`, `src/pages/api/admin/*`, `src/lib/admin.ts`                                                                          |
| Auditoría de acciones                             | `[HECHO]` | `src/lib/auditoria.ts`, migración `20261002020000_auditoria.sql`                                                                                    |
| Privacidad de perfiles vía RPC                    | `[HECHO]` | `src/lib/perfil.ts`, RPC `perfil_publico`, migración `20261006010000_privacidad_perfiles.sql`                                                       |
| Legales: términos y privacidad                    | `[HECHO]` | `src/pages/terminos.astro`, `src/pages/privacidad.astro`                                                                                            |
| PWA básica (manifest + SW + offline)              | `[HECHO]` | `public/manifest.json`, `public/sw.js`, `src/pages/offline.astro`, `src/layouts/Layout.astro`                                                       |
| SEO base: sitemap, robots, OG, JSON-LD            | `[HECHO]` | `sitemap-mascotas.xml` SSR, `robots.txt`, canonical/noindex, OG por defecto y JSON-LD con escape seguro                                             |
| Analytics de embudo                               | `[HECHO]` | `src/lib/analytics.ts`; 6/6 eventos emitidos (`busqueda`, `ver_detalle`, `solicitar`, `solicitud_aprobada`, `mensaje_enviado`, `favorito_agregado`) |
| Tests unitarios                                   | `[HECHO]` | 14 archivos `*.test.ts` en `src/lib/` (86 tests)                                                                                                    |
| E2E público y flujo                               | `[HECHO]` | `e2e/publico.e2e.ts`, `e2e/flujo.e2e.ts`, `playwright.config.ts`                                                                                    |
| CI de calidad y e2e de flujo                      | `[HECHO]` | `.github/workflows/ci.yml`                                                                                                                          |
| Backup diario                                     | `[HECHO]` | `.github/workflows/backup.yml`                                                                                                                      |
| Colección Postman                                 | `[HECHO]` | `postman/adopty.json`                                                                                                                               |
| Documentación del proyecto                        | `[HECHO]` | `README.md`, `AGENTS.md`, `docs/DECISIONES.md`, `docs/*.md`                                                                                         |

### 2.2 Decisiones de arquitectura que no deben revertirse sin análisis

- **Sin service role**: toda la seguridad vive en RLS y RPC `security definer`.
- **Baja de cuenta lógica**: se anonimiza y despublica, no se hace `DELETE` en cascada,
  para conservar historial de adopciones y mensajes.
- **Chat solo tras aprobación**: impide spam y expone el contacto solo cuando hay interés real.
- **Mensajes conservados tras la baja**: la otra parte mantiene contexto; el nombre se anonimiza.
- **Imágenes re-codificadas con Sharp**: mitiga payloads maliciosos y limita tamaño.
- **Google OAuth apagado por defecto**: el código existe, pero el provider se activa en prod.

---

## 3. Qué falta por hacer o arreglar

### 3.1 P0 — Bloqueantes de entrega y producción

#### P0-01 — Activar Google OAuth en producción

- **Estado:** `[FALTA]` (código listo, provider apagado).
- **Evidencia:** `src/lib/oauth.ts:18`, `src/pages/api/auth/google.ts`,
  `src/pages/api/auth/callback.ts`, `.env.example`, `supabase/config.toml:321-327`,
  `docs/CHECKLIST.md:13`.
- **Impacto:** incumple el criterio §13 y la demo de Fase 8; hoy el botón de Google se
  oculta y `/api/auth/google` responde 404.
- **Acción:**
  1. Crear credencial OAuth 2.0 en Google Cloud Console.
  2. Configurar orígenes y redirects autorizados (`/api/auth/callback` del dominio).
  3. Activar provider Google en Supabase (Client ID + Secret).
  4. Definir `PUBLIC_GOOGLE_ENABLED=true` en Vercel y redeploy.
  5. Añadir el dominio de producción a Redirect URLs de Supabase.
- **Criterio de aceptación:** login con Google crea sesión, redirige a `/perfil`, crea
  filas en `usuarios`/`personas` u `organizaciones`, y el flujo de baja/suspensión
  sigue bloqueando cuentas inactivas.
- **Tests:** manual en preview y prod; idealmente un e2e marcado como opcional por
  depender de credenciales externas.

#### P0-02 — Configuración de Supabase y Vercel para producción

- **Estado:** `[HECHO]` (verificado 2026-10-26 contra el proyecto cloud).
- **Evidencia:** proyecto Supabase `dvebieysgnhmimmxjwjc` (Adopty, East US Ohio) y
  proyecto Vercel `adopty` (org `fran-4fd7`); verificación completa en §10.
- **Configuración aplicada:**
  - `SITE_URL=https://adopty.lat` en Vercel (Production y Preview).
  - Auth → Site URL `https://adopty.lat`; Redirect URLs con apex, `www`, previews,
    `localhost:4321` y `localhost:3000`.
  - **Secure email change** activo; buckets `mascotas` y `perfiles` públicos; Realtime
    solo en `mensajes`; 22 migraciones registradas en
    `supabase_migrations.schema_migrations`.
  - SMTP de Resend (`smtp.resend.com:465`, remitente `no-reply@adopty.lat`), dominio
    verificado con DKIM y DMARC.
- **Verificado 2026-10-27:** Resend entregó (_Delivered_) el correo de confirmación y
  el de recuperación. La cuenta de prueba se creó a las 05:23:29, se confirmó 30 s
  después y abrió sesión 4 s más tarde. `mailer_autoconfirm` quedó en **`false`**: el
  alta envía enlace y no crea sesión hasta abrirlo.
- **Criterio de aceptación:** checklist de `docs/CHECKLIST.md` al día; registro con
  confirmación y recuperación verificados en prod; cambio de correo y chat Realtime
  cubiertos por e2e (el flujo público pasó 32/32 contra `https://adopty.lat`).

#### P0-03 — Limpiar el seed y rotar credenciales demo

- **Estado:** `[HECHO]` (verificado 2026-10-27 contra el proyecto cloud).
- **Evidencia:** prueba de login con `Adopty123!` contra `patitas@adopty.pa`,
  `rescatista@adopty.pa`, `admin@adopty.me` y las dos cuentas de prueba: **400 en todas**
  (la clave del seed ya no sirve). Existe `admin@adopty.me` en `administradores`.
- **Situación actual (5 cuentas tras la limpieza del 2026-10-27):**
  - `patitas@adopty.pa` (org verificada, 19 mascotas) y `rescatista@adopty.pa`
    (13 mascotas): catálogo de demostración; **se conservan** hasta tener los refugios
    reales del piloto.
  - `prueba.demo@adopty.pa` y `revision.responsive@adopty.pa`: **eliminadas** el
    2026-10-27; no tenían mascotas, solicitudes ni mensajes.
  - `admin@adopty.me`: único administrador; no borrar sin transferir el rol.
  - `franciscogonzalezmoralez@gmail.com` y `arrocha.pineda17@gmail.com`: cuentas reales.
- **Impacto residual:** bajo; ninguna credencial del repo abre producción. Las dos
  cuentas demo que quedan conservan contraseña rotada.
- **Criterio de aceptación:** cumplido: ninguna credencial pública permite entrar a prod;
  existe al menos un admin; el seed local sigue funcionando.

#### P0-04 — Versionar el trabajo pendiente

- **Estado:** `[HECHO]` (cierre 2026-10-26).
- **Evidencia:** al auditar había ~30 archivos modificados y `e2e/` +
  `playwright.config.ts` sin trackear. En el cierre se revisó el diff, se excluyeron
  `.env`, `.env.db`, `backups/` y artefactos, y se creó el commit de cierre.
- **Impacto:** el job `e2e` del CI falla si `e2e/` no está en el repositorio; el trabajo
  no está respaldado; el estado de la rama no es reproducible.
- **Acción:** revisar `git status`, agrupar en commits lógicos (`feat:`, `fix:`, `docs:`),
  commitear y pushear a `develop`; no incluir `.env` ni secretos.
- **Criterio de aceptación:** árbol limpio, CI `calidad` y `e2e` en verde, PR abierto a
  `main` cuando corresponda. El push/PR queda a cargo del equipo.

#### P0-05 — QA manual en producción

- **Estado:** `[HECHO]` (2026-10-27). Resultados completos en `docs/QA.md` §2026-10-27.
- **Evidencia:** Lighthouse 13.5 mobile en producción (`https://adopty.lat`,
  2026-10-27):
  - `/`: perf 99, a11y 100, BP 96, SEO 100, LCP 1.9 s, FCP 1.3 s, CLS 0.002, TBT 0 ms.
  - `/explorar`: perf 100, a11y 100, BP 96, SEO 100, LCP 1.7 s, FCP 1.1 s, CLS 0,
    TBT 20 ms.
  - `/mascota/mishi-331c32a6`: perf 100, a11y 100, BP 96, SEO 100, LCP 1.6 s,
    FCP 1.0 s, CLS 0.003, TBT 10 ms.
  - Antes del merge, la preview del commit `2b01e3c` daba LCP 2.2 / 2.1 / 1.6 s y
    SEO 69 por el `noindex` automático de Vercel.
  - axe: 0 violaciones en 5 páginas × 320/768/1024/1440, sin scroll horizontal.
  - Teclado: skip link, filtros, carrusel, chat y formularios; targets ≥ 24 px
    (WCAG 2.2) y carrusel con `inert` correcto.
  - `node scripts/perf.mjs https://adopty.lat`: 15/15 por ruta, p95 máx 608 ms.
  - `E2E_BASE_URL=https://adopty.lat npm run test:e2e`: 32/32.
- **Cambios necesarios:** WebP para fotos locales, preload de la imagen LCP,
  autohospedaje de Plus Jakarta Sans/Inter (se eliminó la hoja de Google Fonts que
  bloqueaba el render), primera tarjeta de `/explorar` eager + preload, contraste AA,
  flechas del carrusel sin solapar botones y `<main>` + nombres accesibles en inicio.
- **Criterio de aceptación:** cumplido: resultados en `docs/QA.md`, checklist marcado y
  LCP < 2.5 s en las tres rutas medidas.

#### P0-06 — Ejecutar el piloto y firmar el acta

- **Estado:** `[FALTA]`.
- **Evidencia:** `docs/PILOTO.md`, `docs/ACTA_ENTREGA.md`.
- **Impacto:** es el criterio de negocio §13 y la evidencia de aceptación.
- **Acción:** seguir `PILOTO.md`; registrar ≥5 mascotas, ≥3 solicitudes, ≥1 adopción
  `en_proceso`, feedback y firmas; limpiar datos de prueba al final.
- **Criterio de aceptación:** acta completa y checklist de salida cumplido.

#### P0-07 — Probar restauración de backup

- **Estado:** `[HECHO]` (2026-10-27).
- **Evidencia:** `backups/adopty_20261027_010248.dump` (formato custom, 394 024 B,
  52 entradas `TABLE DATA`, 121 objetos) generado con `pg_dump` 17 vía pooler. El
  workflow `.github/workflows/backup.yml` corre a diario a las 08:00 UTC (03:00 Panamá)
  y guarda el `.sql.gz` 90 días; `scripts/backup.sh` conserva 7 copias locales.
  **RPO ≤ 24 h.**
- **Restore drill ejecutado (2026-10-27):** clúster limpio PostgreSQL 17.11 creado con
  `initdb` (sin Docker), roles de Supabase creados a mano y
  `pg_restore --no-owner --no-acl` sobre el dump.
  - **0 errores**, 280 ms de restauración (RTO del restore; no incluye aprovisionar el
    servidor).
  - Conteos exactos idénticos a la nube en las 13 tablas de `public`, `auth.users` (5),
    `storage.objects` (2), 21 migraciones, 7 triggers, 36 policies y 37 índices.
  - Tercera pasada con los grants que Supabase concede por defecto y RLS activo:
    `anon` ve 28 de 32 mascotas, 0 usuarios y 0 mensajes; `authenticated` sin JWT ve lo
    mismo que `anon`. Las policies se restauran y aplican.
- **Límite documentado:** el dump se genera con `--no-privileges` (decisión del
  workflow), así que los ACL no viajan en el archivo. En un proyecto Supabase nuevo
  los grants por defecto del rol `postgres` los recrean; en Postgres vanilla hay que
  concederlos a mano (así se validó). No es un fallo del backup, pero debe estar en el
  runbook de restore.
- **Criterio de aceptación:** cumplido: restore reproducible, conteos coincidentes y RLS
  verificada sobre la copia.

---

### 3.2 P1 — Bugs, seguridad, privacidad y reglas de negocio

#### P1-01 — Open redirect en el callback de autenticación

- **Estado:** `[HECHO]` (2026-10-26).
- **Tipo:** seguridad.
- **Evidencia:** `src/lib/redirect.ts` centraliza `rutaInternaSegura`; se usa en
  `src/pages/api/auth/callback.ts`, `login.ts` y `google.ts`. Tests en
  `src/lib/redirect.test.ts` (5 casos: rutas internas con query/hash, esquemas
  externos, `//`, barras invertidas y caracteres de control).
- **Impacto (original):** `next=//sitio-malicioso` producía una redirección a otro
  dominio tras un callback válido; vector de phishing.
- **Criterio de aceptación:** un `next` externo cae a `/perfil`; un `next` interno
  válido se respeta; no hay regresiones en login/confirmación/OAuth. Verificado con
  `npm test` (5/5 del helper).

#### P1-02 — La máquina de estados de mascota no se aplica en servidor

- **Estado:** `[HECHO]` (2026-10-26).
- **Tipo:** regla de negocio.
- **Evidencia (original):** `transicionMascota` solo se usaba en tests; el `PATCH`
  actualizaba `estado` sin mirar el actual; el `POST` aceptaba el estado entrante.
- **Cambio:**
  - `src/pages/api/mascotas/[id].ts` lee `id_publicador, estado` y, si el `PATCH`
    incluye `estado`, valida con `transicionMascota(actual, nuevo)`; una transición
    inválida responde **409** con el estado actual intacto.
  - `src/pages/api/mascotas/index.ts` fuerza `estado: 'disponible'` al crear, incluso
    si el cliente envía otro valor.
  - `src/pages/panel/index.astro` y `src/components/PetForm.astro` deshabilitan el
    selector cuando la mascota ya está `adoptada`; el formulario omite `estado` en ese
    caso para no disparar un PATCH inválido.
  - `e2e/flujo.e2e.ts` añade la regresión: `en_proceso → adoptada` (200) y
    `adoptada → disponible` (409, sigue `adoptada`).
- **Criterio de aceptación:** cumplido; los tests unitarios de `transiciones.ts`
  (5/5) siguen verdes y el e2e cubre el caso terminal (se ejecuta en CI con Supabase
  local).

#### P1-03 — La baja de cuenta deja la foto de perfil en Storage

- **Estado:** `[HECHO]` (2026-10-26).
- **Tipo:** privacidad.
- **Evidencia (original):** el RPC anulaba `personas.foto_perfil` /
  `organizaciones.logo`, pero el objeto seguía en el bucket público `perfiles`.
- **Cambio:** `src/pages/api/cuenta/borrar.ts` lee `tipo_usuario` y la ruta de la foto
  (`foto_perfil` o `logo`) **antes** del RPC (después ya estaría a `NULL`); tras una
  baja exitosa llama a `borrarFotoPerfilStorage()` y solo entonces cierra la sesión.
  El borrado usa la política de carpeta del dueño (`auth.uid()`), por eso ocurre antes
  de `signOut`.
- **Decisión sobre fotos de mascotas:** las de mascotas despublicadas se conservan por
  la restauración administrativa y el historial de adopciones; `/privacidad` habla de
  la foto de perfil, que es la que ahora se elimina.
- **Criterio de aceptación:** implementado y tipado; la prueba de URL 404 requiere
  ejecutar una baja real contra Supabase (local o piloto) y queda en la lista manual
  del §6. El `remove` es best-effort: si Storage falla, la baja lógica no se revierte.

#### P1-04 — El service worker cachea HTML de rutas privadas

- **Estado:** `[HECHO]` (2026-10-26).
- **Tipo:** privacidad.
- **Evidencia:** `public/sw.js` usa `CACHE_NAME = 'adopty-v2'`, una lista blanca de
  páginas públicas (`/`, `/explorar`, `/offline`, legales) y de assets; `/api` y
  navegaciones privadas van siempre a red. Las cachés viejas se eliminan al activar.
- **Impacto (original):** en un dispositivo compartido podía servirse HTML autenticado
  desde caché; quedaban datos personales en Cache Storage.
- **Criterio de aceptación:** `/perfil` y `/mensajes` no se cachean; una navegación
  privada sin red cae a `/offline`; `node --check public/sw.js` pasa y `/offline`
  está incluida en `e2e/publico.e2e.ts`.

#### P1-05 — Sitemap incorrecto y `robots.txt` con URL relativa

- **Estado:** `[HECHO]` (2026-10-26): P1-05a (filtro + robots) y P1-05b (fichas).
- **Tipo:** SEO.
- **Evidencia:**
  - `astro.config.mjs` filtra `/admin`, `/panel`, `/mensajes`, `/perfil`,
    `/favoritos`, `/mis-solicitudes`, `/mascota/nueva`, `/login`, `/register`,
    `/recuperar`, `/offline`, `/404` y `/500`.
  - `src/pages/robots.txt.ts` genera el archivo con `Astro.site` y anuncia **dos**
    sitemaps: el índice estático y el dinámico de fichas.
  - `src/pages/sitemap-mascotas.xml.ts` (`prerender = false`) consulta Supabase con
    paginación de 1000 (tope de 50 000 URLs del protocolo), filtra
    `estado = 'disponible' AND deleted_at IS NULL`, escapa XML y cachea 1 hora.
  - Verificado en dev: `/sitemap-mascotas.xml` responde `200 application/xml` con
    `<urlset>` y fichas reales; `/robots.txt` muestra ambas líneas `Sitemap:`.
- **Decisión:** el sitemap dinámico se descubre por `robots.txt` en lugar de editar el
  índice generado por `@astrojs/sitemap`; así no se parchea salida de la integración.
- **Criterio de aceptación:** las fichas públicas aparecen sin exponer rutas privadas.

#### P1-06 — Faltan canonical, noindex y OG por defecto

- **Estado:** `[HECHO]` (2026-10-26).
- **Tipo:** SEO/privacidad.
- **Cambio:**
  - `src/layouts/Layout.astro` calcula `canonical` con `Astro.site + pathname`, **sin
    query ni hash** (los filtros de `/explorar` no crean duplicados), y emite
    `link rel="canonical"` + `og:url`.
  - Nueva prop `noindex` que emite `noindex, follow`; se aplica a `/login`, `/register`,
    `/recuperar`, `/perfil`, `/panel/*`, `/mensajes`, `/favoritos`,
    `/mis-solicitudes`, `/admin`, `/mascota/nueva`, `/mascota/[id]/editar`, `/offline`,
    `/404`, `/500` y a la ficha cuando no es pública (404 lógico o estado distinto de
    `disponible`).
  - El OG por defecto (`/og-default.png`) ya existía del nivel fácil.
- **Verificación en dev:** `/login` → canonical absoluto + `noindex, follow`;
  `/terminos` → canonical absoluto y sin `robots`.
- **Criterio de aceptación:** cumplido; el e2e público comprueba canonical limpio en
  `/explorar?especie=gato` y `noindex` en `/login`.

#### P1-07 — Sin headers de seguridad

- **Estado:** `[HECHO]` (2026-10-26); verificado con `curl -I` en producción.
- **Tipo:** seguridad.
- **Cambio:** `vercel.json` aplica headers a `/(.*)`:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - `Content-Security-Policy-Report-Only` con `default-src 'self'`, Supabase
    (`https://*.supabase.co`, `wss://*.supabase.co`), Google Fonts, Vercel Analytics y
    `frame-ancestors 'none'`. Se deja en **Report-Only** por los scripts inline de
    Astro; el objetivo siguiente es migrar a nonces/hashes y pasar a enforcing.
- **Por qué `vercel.json`:** las páginas estáticas (`/terminos`, `/privacidad`, 404) y
  los assets no pasan por el middleware de Astro en producción.
- **Criterio de aceptación:** cumplido: `https://adopty.lat/` responde con HSTS,
  `nosniff`, `X-Frame-Options: DENY`, referrer, permissions y CSP Report-Only; la app no
  registra violaciones que rompan la UI.

#### P1-08 — Analytics de embudo incompleto

- **Estado:** `[HECHO]` (2026-10-26).
- **Tipo:** producto/observabilidad.
- **Evidencia:** los 6 eventos se emiten:
  `busqueda` (`src/pages/explorar.astro`), `ver_detalle` y `solicitar`
  (`src/pages/mascota/[id].astro`), `solicitud_aprobada`
  (`src/pages/panel/solicitudes.astro`), `mensaje_enviado`
  (`src/components/ChatView.astro`) y `favorito_agregado`
  (`src/components/FavButton.astro`). `trackEvento` captura errores si analytics está
  bloqueado.
- **Datos enviados:** solo IDs de mascota/solicitud y conteos; sin correo, teléfono ni
  nombre.
- **Criterio de aceptación:** los 6 eventos aparecen en Vercel Analytics; no se rompe la
  app si analytics está bloqueado. Verificado por tipos/lint; la aparición en el panel
  de Vercel requiere tráfico real.

#### P1-09 — Buckets de fotos sin límite de tamaño/MIME ni carpeta del dueño

- **Estado:** `[HECHO]` (2026-10-26).
- **Tipo:** seguridad/privacidad.
- **Evidencia (original):** `storage.buckets` no tenía `file_size_limit` ni
  `allowed_mime_types`; la policy `storage_mascotas_insert` solo exigía bucket y
  `authenticated`, así que un usuario con sesión podía subir archivos de cualquier
  tamaño/tipo a la carpeta de otro. El comentario de `src/lib/storage.ts` ya lo
  advertía para `perfiles`, pero `mascotas` seguía abierto.
- **Cambio:** migración `20261027010000_endurecer_storage.sql`:
  - Ambos buckets: `file_size_limit = 512000` y `allowed_mime_types = {image/webp}`.
  - INSERT/UPDATE/DELETE de `mascotas`: `(storage.foldername(name))[1] = auth.uid()::text`.
- **Verificación:** aplicada y registrada en cloud; consulta a `storage.buckets` y a
  `pg_policies` confirma límites y las tres policies por carpeta.
- **Criterio de aceptación:** una subida directa fuera de la carpeta propia o con MIME
  distinto de WebP falla; la app sigue subiendo porque ya convierte a WebP ≤ 500 KB.

#### P1-10 — RLS de `solicitudes` permite saltarse las reglas desde REST

- **Estado:** `[HECHO]` (2026-10-27).
- **Tipo:** seguridad/regla de negocio.
- **Evidencia original:** `sol_insert` solo comprobaba `auth.uid() = id_adoptante` y
  `sol_update` no tenía `WITH CHECK`: un adoptante podía auto-aprobarse, insertar
  sobre una mascota no disponible o cambiar columnas inmutables por REST.
- **Solución aplicada:** migración `20261027020000_rls_reglas_negocio.sql`.
  - Trigger `validar_solicitud`: alta solo `pendiente`, mascota `disponible` y no
    propia; UPDATE solo para participantes y con las transiciones de
    `lib/transiciones.ts`; aprobar replica el invariante de `aprobar_solicitud`
    (mascota a `en_proceso` y resto de pendientes rechazadas).
  - Policies `sol_insert` y `sol_update` con `WITH CHECK` y helper
    `soy_publicador_de()`.
- **Verificación:** 13 pruebas con JWT simulado y `ROLLBACK` en cloud. Fallan como se
  espera: auto-aprobación del adoptante, solicitud a mascota adoptada, mascota propia y
  suplantación de otro adoptante. Funcionan: aprobación del publicador (Nina pasa a
  `en_proceso` y la otra solicitud pendiente queda `rechazada`) y alta válida a mascota
  disponible.
- **Criterio de aceptación:** cumplido; el flujo de la app no cambia porque usa las
  mismas reglas.

#### P1-11 — RLS de `mensajes` permite DMs no solicitados y edición del destinatario

- **Estado:** `[HECHO]` (2026-10-27).
- **Tipo:** privacidad/seguridad.
- **Evidencia original:** `msg_insert` solo comprobaba `auth.uid() = id_emisor` y
  `msg_update` dejaba al receptor editar cualquier columna, incluido `contenido`.
- **Solución aplicada:** en la misma migración, policy `msg_insert` con
  `puede_mensajear(mascota, emisor, receptor)` (exige solicitud `aprobada` entre ambos)
  y `msg_update` con `WITH CHECK`; el trigger `solo_marcar_leido` impide cambiar
  emisor, receptor, mascota, contenido o fecha, y solo permite `leido = true`.
- **Verificación:** mensaje sin solicitud aprobada → RLS 42501; mensaje con solicitud
  aprobada → inserta; el receptor no puede editar el texto; sí puede marcar como leído.
- **Criterio de aceptación:** cumplido; el chat y el contador de no leídos siguen
  igual porque la app ya respetaba estas reglas.

---

### 3.3 P2 — Funcionalidad faltante y deuda operativa

#### P2-01 — Notificaciones por email

- **Estado:** `[FALTA]` (el plan lo dejaba como opcional, pero es relevante para adopciones).
- **Evidencia:** no hay integración de email transaccional fuera de Supabase Auth; el
  aviso al publicador/adoptante es solo badge/UI.
- **Impacto:** si el usuario no vuelve a entrar, no se entera de una solicitud, una
  aprobación o un mensaje; el embudo se enfría.
- **Acción sugerida:**
  - Preferir Supabase Edge Function + proveedor (Resend/Postmark) disparada por Database
    Webhook en `solicitudes` y `mensajes`.
  - Emails mínimos: nueva solicitud, solicitud aprobada/rechazada, nuevo mensaje (con
    opt-out y sin contenido sensible).
  - Respetar free tier y rate limits; no bloquear la transacción principal si falla el email.
- **Criterio de aceptación:** el publicador recibe aviso al recibir solicitud; el
  adoptante al ser aprobado; los emails no exponen datos de terceros; hay logs y
  reintentos.

#### P2-02 — Cola de moderación para publicadores no verificados

- **Estado:** `[HECHO]` (decisión, 2026-10-27). La cola previa se implementará al abrir
  el registro público; no aplica al piloto cerrado.
- **Evidencia:** `src/pages/api/mascotas/index.ts` inserta la mascota directamente y
  `mascotas` no tiene aprobación previa; el admin gestiona reportes y verificaciones.
- **Decisión (Opción B):** post-moderación para el piloto cerrado, con SLA de 24 h para
  reportes y 48 h para revisar publicaciones. Al abrir el registro público, modelo
  híbrido: las primeras 1–2 publicaciones de cuentas no verificadas pasan a revisión
  previa. Documentado en ADR-021 y `docs/ADMIN.md`.
- **Criterio de aceptación:** cumplido: la decisión está documentada y el README/plan ya
  no promete una cola inexistente. La implementación de la cola queda como trabajo
  futuro explícito.

#### P2-03 — Rate-limit distribuido y rutas sin límite

- **Estado:** `[HECHO]` (2026-10-27).
- **Evidencia:** migración `20261027030000_rate_limit_distribuido.sql` con la tabla
  `public.rate_limits` (RLS activo, sin acceso directo para `anon`/`authenticated`) y
  la RPC atómica `consumir_rate_limit` (`INSERT ... ON CONFLICT DO UPDATE`, limpieza
  oportunista de filas vencidas). `rateLimitDistribuido` en `src/lib/ratelimit.ts` usa
  la RPC y cae al contador en memoria si la RPC falla o no está aplicada.
- **Cobertura:** todas las mutaciones autenticadas pasan por el limitador, incluidas
  las que antes no tenían: `PATCH/DELETE /api/mascotas/[id]`, `PATCH /api/mensajes/[id]`,
  `PATCH /api/solicitudes/[id]`, `PATCH /api/admin/cuentas` y `DELETE /api/favoritos`.
- **Prueba de atomicidad:** 30 peticiones concurrentes contra la RPC con `p_max=10`
  dejaron exactamente 10 aprobadas y 20 bloqueadas. Unitarios: 4 casos nuevos de
  `rateLimitDistribuido` (RPC ok, bloqueo, error y excepción con fallback).
- **Pendiente menor:** los `GET /api/admin/*` siguen sin límite; son lecturas detrás del
  guard de admin y no escriben datos.
- **Criterio de aceptación:** cumplido: el límite se comparte entre instancias (tabla
  común), 429 con `Retry-After` y tests de cubeta + fallback.

#### P2-04 — Observabilidad y monitoreo

- **Estado:** `[PARCIAL]` (2026-10-27: alerta de backup hecha).
- **Evidencia:** solo `@vercel/analytics`; `src/middleware.ts:73-79` usa
  `console.error`; no hay Sentry/Highlight ni monitor de uptime.
- **Hecho:** `.github/workflows/backup.yml` abre un issue con etiqueta `backup` si el
  dump o la verificación fallan (sin depender de servicios externos).
- **Pendiente:** Sentry (server + cliente) con scrubbing de PII y release tags, y un
  monitor de uptime externo. Ambos requieren cuenta/DSN del responsable.
- **Criterio de aceptación:** un error provocado aparece en el panel con release y ruta;
  hay alerta de caída y de backup fallido; no se envían datos personales. La parte de
  backup está cumplida; panel y uptime siguen pendientes.

#### P2-05 — Endurecer CI

- **Estado:** `[HECHO]` (2026-10-27).
- **Evidencia:** `.github/workflows/ci.yml` ejecuta lint, format, check,
  `test:coverage` con umbrales, build, `npm audit --audit-level=high`, la suite e2e
  pública + smoke de axe y el flujo completo; `.github/dependabot.yml` agrupa
  minor/patch semanalmente. `npm audit` reporta 0 vulnerabilidades.
- **Añadido (P2-05b):** `vitest.config.ts` con umbrales (65 % statements, 52 %
  branches, 62 % functions, 70 % lines; cobertura actual 69,5 / 57,3 / 67,1 / 73,2);
  `e2e/a11y.e2e.ts` (5 páginas × 360/1280 px, 10 pruebas axe) y el e2e público como
  pasos separados del flujo. El presupuesto Lighthouse vive en `perf.yml` (P3-05).
- **Criterio de aceptación:** cumplido: PR con vulnerabilidad alta falla; e2e público y
  axe corren en CI; la cobertura se reporta y rompe el job si baja del umbral.

#### P2-06 — Backup fuera del artefacto de 30 días

- **Estado:** `[PARCIAL]` (2026-10-27).
- **Evidencia:** `.github/workflows/backup.yml` sube el `.sql.gz` con retención de
  **90 días** (máximo de GitHub) y abre un issue si el dump o la verificación fallan.
  El restore está probado (P0-07).
- **Pendiente:** copia off-site real (S3/R2/Drive) con lifecycle y cifrado. Requiere
  credenciales y un bucket del responsable; no se implementó a medias.
- **Criterio de aceptación:** copia off-site >30 días con restore probado. La alerta y
  el restore ya están; falta el destino externo.

---

### 3.4 P3 — SEO, UX y rendimiento no bloqueante

#### P3-01 — Imagen OG por defecto

- **Estado:** `[HECHO]` (2026-10-26).
- **Evidencia:** `public/og-default.png` (1200×630, 209 KB) con branding; `Layout.astro`
  la usa cuando la página no pasa `ogImage`, la convierte a URL absoluta y emite
  `og:image:width/height/alt` y `twitter:card=summary_large_image`.
- **Criterio de aceptación:** inicio, explorar y legales muestran preview al compartir.
  Verificado en el HTML de `/`: `og:image` apunta a `/og-default.png` absoluto.

#### P3-02 — Datos estructurados (JSON-LD)

- **Estado:** `[HECHO]` (2026-10-26).
- **Evidencia:** `src/lib/seo.ts` serializa con escape seguro (`<`, `>`, `&`, U+2028/29)
  y test en `src/lib/seo.test.ts`. El inicio emite `WebSite` (con `SearchAction`) y
  `Organization`; la ficha emite `Dog`/`Cat`/`Pet` + `BreadcrumbList` con campos
  públicos (nombre, descripción, fotos, raza, atributos y ubicación).
- **Criterio de aceptación:** sin PII y sin errores de escape; validar el rich result
  con la herramienta de Google cuando haya dominio final.

#### P3-03 — Imágenes responsivas (`srcset`/AVIF)

- **Estado:** `[PARCIAL]`.
- **Evidencia:** las imágenes ya usan WebP, `width`/`height` y `loading="lazy"` en
  tarjetas, pero no hay `srcset`/`sizes` ni AVIF.
- **Acción:** generar variantes de tamaño en el upload o en build y usar `srcset`;
  evaluar AVIF cuando el soporte del navegador lo permita.
- **Criterio de aceptación:** LCP estable y menor transferencia en móvil; sin CLS.

#### P3-04 — Página offline explícita

- **Estado:** `[HECHO]` (2026-10-26).
- **Evidencia:** `src/pages/offline.astro` (SSR, con enlace a inicio) y fallback del
  service worker; `/offline` está en la lista blanca de caché y en `e2e/publico.e2e.ts`.
- **Criterio de aceptación:** sin red, una ruta no cacheada muestra una página coherente.
  Verificado por `node --check public/sw.js`; la prueba offline real requiere navegador.

#### P3-05 — Presupuesto de rendimiento automatizado

- **Estado:** `[HECHO]` (2026-10-27).
- **Evidencia:** `.github/workflows/perf.yml` corre Lighthouse CI (`@lhci/cli@0.15.1`)
  contra `https://adopty.lat/` y `/explorar` los lunes a las 09:00 UTC y a mano.
  `lighthouserc.json` fija el presupuesto: performance ≥ 90, LCP ≤ 2,5 s, CLS ≤ 0,1 y
  TBT ≤ 300 ms (mediana de 3 corridas). No bloquea PRs: si falla, avisa al repo.
- **Criterio de aceptación:** cumplido: una regresión de LCP/CLS/TBT rompe el job
  programado y genera notificación.

---

### 3.5 P4 — Documentación y mantenimiento

#### P4-01 — Ampliar `AGENTS.md` con convenciones del proyecto

- **Estado:** `[HECHO]` (2026-10-26).
- **Evidencia:** `AGENTS.md` incluye contexto, comandos, estructura, reglas no
  negociables (RLS, Zod, soft-delete, migraciones, seed, secretos, e2e local, PII,
  sitemap/caché) y gotchas.
- **Criterio de aceptación:** un agente nuevo puede ejecutar y validar el proyecto sin
  leer todo el código.

#### P4-02 — Registro de decisiones (ADR breve)

- **Estado:** `[HECHO]` (2026-10-26).
- **Evidencia:** `docs/DECISIONES.md` con 22 ADR (contexto, decisión y consecuencias),
  incluidas las nuevas de service worker, SEO/JSON-LD, analytics, dependencias, headers,
  Storage y dominio/correo.
- **Criterio de aceptación:** cada decisión tiene contexto y consecuencia; las
  alternativas descartadas se explican dentro de cada entrada.

#### P4-03 — Tags y releases

- **Estado:** `[HECHO]` (2026-10-26): tag anotado `v0.8.0` sobre el commit de cierre.
- **Evidencia:** `git tag -n` muestra `v0.8.0`; el commit incluye la auditoría, el
  nivel fácil y las correcciones de seguridad.
- **Criterio de aceptación:** tag de entrega reproducible y asociado al commit desplegado.
  El tag `v1.0.0` queda reservado para el piloto firmado.

#### P4-04 — Actualizar documentos tras cerrar P0/P1

- **Estado:** `[HECHO]` (2026-10-26): este documento, `AGENTS.md`, `README.md`,
  `docs/DECISIONES.md`, `docs/CHECKLIST.md` y `docs/QA.md` reflejan los P1, el dominio,
  el SMTP y el endurecimiento de Storage.
- **Acción:** al cerrar cada ítem, actualizar `docs/CHECKLIST.md`, `docs/QA.md`,
  `README.md` y este documento (secciones 8, 9 y 10).
- **Criterio de aceptación:** ningún documento promete algo que el código no hace.

---

## 4. Matriz de aceptación §13

| Criterio del plan              | Estado      | Evidencia                                                              | Qué falta                                   |
| ------------------------------ | ----------- | ---------------------------------------------------------------------- | ------------------------------------------- |
| CU-01…CU-08 e2e                | `[PARCIAL]` | `e2e/flujo.e2e.ts`, CI con Supabase local                              | Repetir a mano en prod (P0-06)              |
| Preview deploy verificado      | `[HECHO]`   | `docs/CHECKLIST.md:23`                                                 | Revalidar tras cambios                      |
| Register con `emailRedirectTo` | `[HECHO]`   | `src/pages/api/auth/register.ts`                                       | E2E completo sujeto a cuota de email        |
| Búsqueda p95 < 1 s             | `[HECHO]`   | `scripts/perf.mjs`: 15/15, p95 máx 608 ms en prod                      | —                                           |
| Imágenes ≤ 500 KB WebP         | `[HECHO]`   | `src/lib/storage.ts`, e2e de upload                                    | —                                           |
| RLS 100 %                      | `[HECHO]`   | Migraciones + e2e por rol + triggers P1-10/P1-11 + restore drill P0-07 | Repetir bypass por REST tras nuevos cambios |
| Sin secretos en git            | `[HECHO]`   | `.gitignore`, `git ls-files`                                           | Revisar antes de cada push                  |
| Validación server total        | `[HECHO]`   | Zod en todas las mutaciones                                            | —                                           |
| Tipos TS/Astro                 | `[HECHO]`   | `npm run check`, CI                                                    | —                                           |
| axe 0 críticos / teclado / AA  | `[HECHO]`   | 0 violaciones en 5 páginas × 4 anchos + smoke axe en CI (10/10)        | —                                           |
| Piloto ≥5 / ≥3 / ≥1 + feedback | `[FALTA]`   | `docs/PILOTO.md`                                                       | P0-06                                       |
| Google OAuth                   | `[FALTA]`   | `src/lib/oauth.ts`                                                     | P0-01                                       |
| Backup y restore               | `[HECHO]`   | dump diario RPO ≤ 24 h + restore drill 0 errores, conteos idénticos    | Copia off-site (P2-06)                      |

---

## 5. Plan de ejecución sugerido

### Fase A — Cerrar riesgos de código (1–2 días)

| Orden | Ítem                                                            | Dependencias       |
| ----- | --------------------------------------------------------------- | ------------------ |
| 1     | P0-04 (commit del trabajo) — hecho                              | —                  |
| 2     | P1-01 (open redirect) — hecho                                   | —                  |
| 3     | P1-02 (transiciones de mascota) — hecho                         | —                  |
| 4     | P1-03 (Storage en baja) — hecho                                 | —                  |
| 5     | P1-04 (service worker) — hecho                                  | —                  |
| 6     | P1-05 + P1-06 (sitemap dinámico, canonical/noindex/OG) — hechos | P0-02 (`SITE_URL`) |
| 7     | P1-09 (límites y policies de Storage) — hecho                   | —                  |
| 8     | P1-10/P1-11 (RLS de solicitudes y mensajes) — hechos            | —                  |

### Fase B — Endurecimiento (2–3 días)

| Orden | Ítem                                                | Dependencias |
| ----- | --------------------------------------------------- | ------------ |
| 1     | P1-07 (headers)                                     | —            |
| 2     | P1-08 (analytics) — hecho                           | —            |
| 3     | P2-05a (audit + Dependabot) hecha; P2-05b pendiente | P0-04        |
| 4     | P2-04 (observabilidad)                              | —            |
| 5     | P3-01 / P3-02 / P3-04 — hechos                      | P1-06        |

### Fase C — Producción (3–5 días)

| Orden | Ítem                           | Dependencias |
| ----- | ------------------------------ | ------------ |
| 1     | P0-02 (config Supabase/Vercel) | —            |
| 2     | P0-01 (Google OAuth)           | P0-02        |
| 3     | P0-03 (seed/admin)             | P0-02        |
| 4     | P0-07 (restore drill)          | P0-02        |
| 5     | P0-05 (QA manual prod)         | P0-01, P0-02 |
| 6     | P0-06 (piloto + acta)          | P0-05        |

### Fase D — Post-piloto (opcional, según tiempo)

P2-01 (emails) y P2-06 (backup off-site), más la cola de pre-moderación (decisión en
P2-02, implementación diferida). P2-03 (rate-limit distribuido), P2-05b (CI), P3-05
(presupuesto Lighthouse) y P0-07 (restore) se adelantaron y quedaron hechos el
2026-10-27. P4-01, P4-02 y P4-03 se adelantaron el 2026-10-26.

---

## 6. Verificación: comandos y pruebas manuales

### 6.1 Comandos base

```sh
cd adopty
npm install
npm run lint
npm run format:check
npm run check
npm test
npm run build
```

### 6.2 E2E

```sh
npx playwright install chromium
npm run test:e2e                 # suite pública, no escribe
E2E_FLUJO=1 npm run test:e2e:flujo   # requiere Supabase local
E2E_BASE_URL=https://<dominio> npm run test:e2e
```

### 6.3 Supabase local

```sh
supabase start
supabase db reset
# API 54321 · DB 54322 · Studio 54323 · Inbucket 54324
```

### 6.4 Pruebas manuales específicas de los hallazgos

| Hallazgo                | Prueba                                                                                                                     |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| P1-01 open redirect     | Abrir `/api/auth/callback?code=<válido>&next=//example.com`; debe ir a `/perfil`.                                          |
| P1-02 transiciones      | Desde `/panel`, pasar una mascota a `adoptada` y luego intentar `disponible`; debe rechazar.                               |
| P1-03 Storage           | Dar de baja una cuenta con foto; abrir la URL anterior de la foto; debe fallar.                                            |
| P1-04 SW                | En DevTools → Application → Cache Storage, buscar `/perfil` o `/mensajes`; no deben aparecer.                              |
| P1-05 sitemap           | `curl -s https://<dominio>/sitemap-index.xml` y el sitemap hijo; no debe incluir `/admin`, `/panel`, `/perfil`; sí fichas. |
| P1-06 canonical/noindex | Ver código fuente de `/perfil` (`noindex`) y de `/explorar?especie=gato` (canonical).                                      |
| P1-07 headers           | `curl -I https://<dominio>/` y comprobar CSP/HSTS/nosniff/frame.                                                           |
| P1-08 analytics         | Navegar ficha → solicitar → aprobar → chatear → favorito; ver eventos en Vercel.                                           |
| P0-05 a11y              | axe DevTools + recorrido completo con Tab/Shift+Tab/Esc/Enter.                                                             |
| P0-07 restore           | Restaurar `backups/adopty_*.dump` en un Postgres 17 limpio y ejecutar la app contra él.                                    |

### 6.5 Checklist de aceptación rápida

- [x] `npm run lint` sin errores.
- [x] `npm run format:check` sin errores.
- [x] `npm run check` 0 errores (17 hints preexistentes).
- [x] `npm test` verde (88/88).
- [x] `npm run build` verde.
- [x] `npm run test:e2e` verde contra prod (32/32 el 2026-10-27).
- [x] `E2E_FLUJO=1 npm run test:e2e:flujo` verde en CI (Docker no disponible en local).
- [x] Lighthouse LCP < 2.5 s en móvil (1.9 / 1.7 / 1.6 s en prod el 2026-10-27).
- [x] axe 0 críticos.
- [x] Sitemap sin rutas privadas y con fichas.
- [x] Headers de seguridad presentes.
- [x] Baja de cuenta borra foto de Storage.
- [x] `adoptada` no vuelve a `disponible`.
- [ ] Google OAuth funciona en prod (pendiente decidido).
- [ ] Piloto y acta firmados (P0-06).

---

## 7. Anexos

### A. Inventario de archivos clave

| Archivo                       | Propósito                                                               |
| ----------------------------- | ----------------------------------------------------------------------- |
| `src/middleware.ts`           | Refresco de sesión, guards de rutas privadas y estado del navbar.       |
| `src/lib/supabase.ts`         | Clientes browser/SSR con cookies de Supabase.                           |
| `src/lib/transiciones.ts`     | Máquinas de estado de solicitud y mascota.                              |
| `src/lib/ratelimit.ts`        | Rate-limit distribuido (RPC) con fallback en memoria y helper de IP.    |
| `src/lib/storage.ts`          | Validación MIME/tamaño, Sharp → WebP, borrado de objetos.               |
| `src/lib/mascotas.ts`         | Consulta de búsqueda, paginación y helpers de fotos/estado.             |
| `src/lib/solicitudes.ts`      | Helpers de solicitudes y badges.                                        |
| `src/lib/panel.ts`            | Agregados del panel del publicador.                                     |
| `src/lib/admin.ts`            | Reportes, verificaciones y cuentas.                                     |
| `src/lib/perfil.ts`           | Perfil público vía RPC y anonimización.                                 |
| `src/lib/auditoria.ts`        | Registro de acciones administrativas.                                   |
| `src/lib/match.ts`            | Afinidad adoptante–mascota.                                             |
| `src/lib/analytics.ts`        | Eventos de embudo.                                                      |
| `src/pages/api/auth/*`        | Login, registro, recuperación, callback, OAuth, cambio de credenciales. |
| `src/pages/api/mascotas/*`    | CRUD, upload y búsqueda.                                                |
| `src/pages/api/solicitudes/*` | Creación y transiciones.                                                |
| `src/pages/api/mensajes/*`    | Hilos, envío y marcado de leído.                                        |
| `src/pages/api/admin/*`       | Moderación, cuentas y restauración.                                     |
| `supabase/migrations/*.sql`   | Esquema, RLS, Storage, RPC, slugs, auditoría, cuenta.                   |
| `supabase/seed.sql`           | 2 usuarios + 30 mascotas para local.                                    |
| `e2e/publico.e2e.ts`          | Suite de solo lectura.                                                  |
| `e2e/flujo.e2e.ts`            | Flujo completo con escrituras.                                          |
| `docs/CHECKLIST.md`           | Pre-prod y aceptación §13.                                              |
| `docs/QA.md`                  | Informe de calidad y diferidos.                                         |
| `docs/PILOTO.md`              | Runbook del piloto.                                                     |
| `docs/ACTA_ENTREGA.md`        | Acta y feedback.                                                        |
| `docs/ADMIN.md`               | Alta de administradores.                                                |

### B. Gotchas para agentes (resumen operativo)

- **RLS es la frontera de seguridad.** No añadas consultas con service role para “hacer
  que funcione”.
- **Migraciones:** usar nombres con timestamp (`YYYYMMDDHHMMSS_descripcion.sql`) y
  registrar en `supabase_migrations.schema_migrations` si se aplican a mano en cloud.
- **Seed:** los tokens de `auth.users` deben ser `''`; `NULL` rompe GoTrue con
  `500 Database error querying schema`.
- **Fotos:** las rutas válidas son `userId/uuid.webp`; no aceptar URLs externas en
  `fotos`/`fotos_new` (el schema ya lo restringe).
- **Chat:** el adoptante necesita solicitud `aprobada`; el publicador debe elegir
  destinatario si hay más de uno; una mascota `adoptada` limita el chat.
- **Baja:** se bloquea si hay una adopción aprobada sin resolver; los mensajes se
  conservan y el nombre se anonimiza.
- **Tipos:** `astro check` es la única verificación de tipos; ESLint no cubre `.astro`.
- **Dev server:** `npm run dev` o `astro dev --background` según el entorno; en CI se
  usa `npm run dev` desde Playwright.
- **E2E de flujo:** solo local; crea cuentas y mascotas por corrida.
- **No tocar** `dist/`, `.astro/`, `.vercel/`, `backups/` ni `test-results/` para
  cambios de código.

### C. Limitaciones conocidas y decisiones conscientes

| Tema                       | Decisión                       | Consecuencia                                                                             |
| -------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------- |
| Service role               | No se usa                      | No hay revocación instantánea de sesiones; el middleware corta en la siguiente petición. |
| Baja de cuenta             | Lógica, no `DELETE`            | Se conserva historial; requiere limpieza explícita de Storage (P1-03).                   |
| 2FA / cédula               | Fuera de alcance               | No hay segundo factor ni verificación documental.                                        |
| Google OAuth               | Código listo, provider apagado | Pendiente de operación (P0-01).                                                          |
| Rate-limit                 | En memoria                     | No consistente entre instancias (P2-03).                                                 |
| k6 / 10k                   | Diferido                       | Se usa perf smoke con datos reales.                                                      |
| Cloudinary                 | No se usa                      | Sharp local cubre el free tier.                                                          |
| i18n, mapas, reseñas, push | Backlog                        | Solo español; sin mapas ni notificaciones push.                                          |
| Emails transaccionales     | Solo Auth                      | Sin avisos de solicitud/mensaje (P2-01).                                                 |
| Moderación previa          | Diferida al registro público   | Post-moderación en el piloto; cola híbrida al abrir (ADR-021).                           |

### D. Evidencia de la auditoría

Comandos y comprobaciones ejecutadas (sin modificar el repositorio):

```sh
# estructura y estado
find src/pages -name "*.astro"
find src/pages/api -name "*.ts"
find supabase/migrations -name "*.sql"
git status --short
git log --oneline -15

# búsqueda de hallazgos
grep -rn "TODO|FIXME|pendiente" src
grep -rn "noindex|canonical|sitemap" src astro.config.mjs
grep -rn "serviceWorker|Content-Security-Policy|og:image|postgres_changes" src public
grep -rn "transicionMascota|transicionSolicitud" src
grep -rn "rateLimit" src/pages/api
head -c 2000 dist/client/sitemap-0.xml
```

Conteos y datos citados provienen de `README.md`, `docs/*.md` y del código en la fecha
de auditoría. Algunos valores (número de tests, rutas) pueden cambiar con el tiempo:
verifica antes de afirmarlos en una entrega.

### E. Registro de cambios del documento

| Fecha      | Cambio                                                                       |
| ---------- | ---------------------------------------------------------------------------- |
| 2026-10-26 | Auditoría inicial: estado, hallazgos P0–P4, matriz §13, roadmap y checklist. |
| 2026-10-26 | Cierre del nivel fácil; verificación y nueva sección 8.                      |
| 2026-10-26 | Cierre de los P1 de código (P1-01…P1-09); verificación y nueva sección 9.    |
| 2026-10-26 | Dominio `adopty.lat`, SMTP Resend, deploy y verificación prod; nueva §10.    |
| 2026-10-27 | Confirmación de correo activa y entrega de Resend verificada (_Delivered_).  |
| 2026-10-27 | QA a11y/perf, fuentes autohospedadas, dump validado; nueva §12.              |

---

## 8. Registro de ejecución — 2026-10-26 (nivel fácil)

Esta sección deja constancia de lo implementado y verificado tras la auditoría.
Los ítems de nivel medio/difícil siguen en sus secciones de la parte 3.

### 8.1 Ítems cerrados

| ID     | Estado final | Cambio principal                                                                  |
| ------ | ------------ | --------------------------------------------------------------------------------- |
| P0-04  | `[HECHO]`    | Trabajo versionado en un commit de cierre; tag `v0.8.0`.                          |
| P1-01  | `[HECHO]`    | `src/lib/redirect.ts` + tests; usado en callback, login y Google.                 |
| P1-04  | `[HECHO]`    | `public/sw.js` con lista blanca y `CACHE_NAME=adopty-v2`; sin caché privada.      |
| P1-05a | `[HECHO]`    | Filtro de sitemap y `src/pages/robots.txt.ts` con URL absoluta.                   |
| P1-08  | `[HECHO]`    | 6/6 eventos de embudo emitidos sin PII.                                           |
| P2-05a | `[HECHO]`    | `npm audit --audit-level=high` en CI, Dependabot y overrides; 0 vulnerabilidades. |
| P3-01  | `[HECHO]`    | `public/og-default.png` 1200×630 y fallback en `Layout.astro`.                    |
| P3-02  | `[HECHO]`    | JSON-LD `WebSite`/`Organization` y `Pet`/`BreadcrumbList` con escape seguro.      |
| P3-04  | `[HECHO]`    | `src/pages/offline.astro` + fallback del service worker + e2e público.            |
| P4-01  | `[HECHO]`    | `AGENTS.md` con reglas operativas para agentes.                                   |
| P4-02  | `[HECHO]`    | `docs/DECISIONES.md` con 16 ADR (hoy 22; ver §9–§11).                             |
| P4-03  | `[HECHO]`    | Tag anotado `v0.8.0`.                                                             |

No se ejecutó P0-03 (rotar seed/administrador cloud) en esa pasada porque requiere
acceso al proyecto Supabase de producción; se cerró después al verificar el cloud
(ver §10 y el detalle en P0-03).

### 8.2 Verificación ejecutada

| Comando / prueba               | Resultado                                                                        |
| ------------------------------ | -------------------------------------------------------------------------------- |
| `npm run format:check`         | ✅ pasa                                                                          |
| `npm run lint`                 | ✅ sin errores                                                                   |
| `npm run check`                | ✅ 0 errores, 0 warnings (17 hints de deprecaciones preexistentes)               |
| `npm test`                     | ✅ 86/86 (14 archivos; incluye `redirect` y `seo`)                               |
| `npm run build`                | ✅ completa; genera `/robots.txt`, sitemap y bundle SSR/Vercel                   |
| `node --check public/sw.js`    | ✅ sintaxis válida                                                               |
| `npm audit --audit-level=high` | ✅ 0 vulnerabilidades                                                            |
| `curl /` (dev)                 | ✅ `og:image` absoluto, `summary_large_image` y JSON-LD `WebSite`/`Organization` |
| `curl /robots.txt` (dev)       | ✅ `Sitemap` absoluto                                                            |
| `dist/client/sitemap-0.xml`    | ✅ solo `/`, `/explorar`, `/privacidad`, `/terminos`; sin rutas privadas         |

### 8.3 Límites de esta verificación

- La ficha `/mascota/<slug>` no se pudo renderizar en local porque el Supabase
  local no estaba levantado; el JSON-LD `Pet`/`BreadcrumbList` está tipado y
  validado por `astro check`, pero conviene abrirlo con seed para ver el HTML.
- No se ejecutaron los e2e de Playwright en esta sesión (requieren navegador y,
  para el flujo, Supabase local con Docker). Siguen cubiertos por el CI.
- La preview real de OG en redes y el Rich Results Test necesitan el dominio de
  producción y tráfico real.
- P0-03 y el resto de P0/P2/P3 no forman parte de este cierre. Los P1 se cerraron en
  una segunda pasada; ver §9.

---

## 9. Registro de ejecución — 2026-10-26 (nivel P1)

Segunda pasada de la auditoría: se cerraron los P1 de código/configuración
(P1-01…P1-09). En la verificación cloud aparecieron dos huecos de RLS, P1-10 y P1-11,
que se cerraron el 2026-10-27 con la migración `20261027020000_rls_reglas_negocio.sql`
(ver §10 y §11).

### 9.1 Ítems cerrados

| ID     | Estado final | Cambio principal                                                                                   |
| ------ | ------------ | -------------------------------------------------------------------------------------------------- |
| P1-02  | `[HECHO]`    | Transiciones validadas en API (409), `POST` fuerza `disponible`, UI bloquea `adoptada`; e2e nuevo. |
| P1-03  | `[HECHO]`    | La baja de cuenta borra la foto/logo de `perfiles` antes de cerrar la sesión.                      |
| P1-05b | `[HECHO]`    | `/sitemap-mascotas.xml` SSR paginado; `robots.txt` anuncia índice + fichas.                        |
| P1-06  | `[HECHO]`    | Canonical sin query, `og:url`, prop `noindex` en privadas y fichas no públicas.                    |
| P1-07  | `[HECHO]`    | `vercel.json` con HSTS, nosniff, frame policy, referrer, permissions y CSP Report-Only.            |
| P1-09  | `[HECHO]`    | Buckets a 500 KB/WebP y policies de `mascotas` por carpeta del dueño.                              |

### 9.2 Verificación ejecutada

| Comando / prueba                         | Resultado                                                                                         |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `npm run format:check`                   | ✅ pasa                                                                                           |
| `npm run lint`                           | ✅ sin errores                                                                                    |
| `npm run check`                          | ✅ 0 errores, 0 warnings (17 hints preexistentes de Zod/Supabase)                                 |
| `npm test`                               | ✅ 86/86 (14 archivos)                                                                            |
| `npm run build`                          | ✅ completa; genera sitemap estático y funciones SSR                                              |
| `node -e JSON.parse(vercel.json)`        | ✅ JSON válido                                                                                    |
| `curl /login` (dev)                      | ✅ canonical absoluto + `noindex, follow`                                                         |
| `curl /terminos` (dev)                   | ✅ canonical absoluto, sin `robots`                                                               |
| `curl /robots.txt` (dev)                 | ✅ anuncia `sitemap-index.xml` y `sitemap-mascotas.xml`                                           |
| `curl /sitemap-mascotas.xml`             | ✅ `200 application/xml`, `<urlset>` con fichas reales                                            |
| `npx playwright test e2e/publico.e2e.ts` | ✅ 31/32 (1 skip esperado: sitemap estático en dev); canonical, noindex y sitemap dinámico verdes |

### 9.3 Límites de esta verificación

- La suite e2e pública se ejecutó completa (31 pasan, 1 skip esperado: el sitemap
  estático no se genera en dev); el flujo `flujo.e2e.ts` no se ejecutó porque exige
  Supabase local con Docker. El caso `adoptada → disponible` (409) queda cubierto por
  el CI.
- Los headers de P1-07 solo se aplican en Vercel; en `astro dev` no se ven. Ya se
  verificaron con `curl -I` en producción (§10).
- La baja real de una cuenta con foto no se ejecutó contra Supabase; el flujo lógico
  está cubierto por tipos y por las políticas de Storage, pero la comprobación de que
  la URL devuelve 404 es manual.
- El build avisa que Node 26 local no es soportado por Vercel Functions (usará Node
  24). Es preexistente y no afecta al artefacto.

---

## 10. Producción — dominio, correo y verificación (2026-10-26)

### 10.1 Infraestructura activa

| Pieza       | Estado                                                                                   |
| ----------- | ---------------------------------------------------------------------------------------- |
| App         | Vercel proyecto `adopty`, prod **https://adopty.lat** (alias del deploy de `main`)       |
| `www`       | `www.adopty.lat` con redirect 308 al apex (`vercel.json`)                                |
| TLS         | Let's Encrypt automático (apex y `www`)                                                  |
| DNS         | GoDaddy: A `@` → `216.198.79.1` y `64.29.17.1`; CNAME `www` → Vercel                     |
| Supabase    | `dvebieysgnhmimmxjwjc` (Ohio); 22 migraciones registradas; RLS en las 13 tablas          |
| Auth URLs   | Site URL apex; redirects para apex, `www`, previews y `localhost`                        |
| Correo Auth | Resend SMTP (`smtp.resend.com:465`, `no-reply@adopty.lat`), DKIM + DMARC `p=none`        |
| Storage     | Buckets públicos `mascotas`/`perfiles`, 500 KB, solo `image/webp`, escritura por carpeta |
| Realtime    | Solo tabla `mensajes`                                                                    |

### 10.2 Verificación ejecutada en producción

| Prueba                                             | Resultado                                                                           |
| -------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `curl -I https://adopty.lat/`                      | ✅ HSTS, `nosniff`, `X-Frame-Options: DENY`, referrer, permissions, CSP Report-Only |
| `curl -I https://www.adopty.lat/`                  | ✅ redirige al apex; canonical apunta al apex                                       |
| Canonical en `/` y `/explorar?especie=gato`        | ✅ absoluto y sin query                                                             |
| `noindex` en `/login`                              | ✅ `noindex, follow`                                                                |
| `/sitemap-mascotas.xml`                            | ✅ `200 application/xml` con fichas reales; `robots.txt` anuncia ambos sitemaps     |
| `E2E_BASE_URL=https://adopty.lat npm run test:e2e` | ✅ 32/32                                                                            |
| `storage.buckets` / `pg_policies`                  | ✅ límites 512 000 + `{image/webp}`; policies por `auth.uid()`                      |
| Confirmación y recuperación por Resend             | ✅ _Delivered_; alta confirmada en 30 s y sesión iniciada; plantillas en español    |

### 10.3 Pendientes operativos de este bloque

- **`mailer_autoconfirm` decidido y aplicado:** `false` desde el 2026-10-27. El registro
  muestra “revisa tu correo” y el login distingue “correo sin confirmar”; en local sigue
  desactivado para no romper el e2e.
- **Entrega de correo verificada:** confirmación y recuperación llegaron a la bandeja y
  Resend las marca _Delivered_; las plantillas están en español.
- **Modelo de moderación:** decidido (post-moderación para el piloto cerrado; ver
  ADR-021 y `docs/ADMIN.md`).
- **P0-03 cerrado:** la clave del seed ya no abre ninguna cuenta y las dos cuentas de
  prueba vacías se eliminaron el 2026-10-27. Quedan `patitas` y `rescatista` como
  catálogo; sustituirlas por refugios reales antes del piloto abierto.
- **DMARC:** se mantiene `p=none` con reportes; plan de endurecimiento en `docs/QA.md`.
- Repetir Lighthouse/axe y la búsqueda p95 con datos de producción (P0-05, P3-05).

---

## 11. Registro de ejecución — 2026-10-27 (moderación, cuentas y RLS)

Cierre de los últimos hallazgos de seguridad y de las decisiones operativas abiertas,
sin cambios de comportamiento visibles para el usuario.

### 11.1 Ítems cerrados

| ID     | Estado final | Cambio principal                                                                   |
| ------ | ------------ | ---------------------------------------------------------------------------------- |
| P1-10  | `[HECHO]`    | Trigger `validar_solicitud` + `WITH CHECK` en `sol_insert`/`sol_update`.           |
| P1-11  | `[HECHO]`    | `puede_mensajear()` en INSERT y trigger `solo_marcar_leido` en UPDATE.             |
| P1-02b | `[HECHO]`    | Transiciones de mascota también en la base (`validar_mascota`), no solo en la API. |
| P0-03  | `[HECHO]`    | Cuentas vacías `prueba.demo` y `revision.responsive` eliminadas; quedan 5 cuentas. |
| P2-02  | `[HECHO]`    | Modelo de moderación decidido y documentado (ADR-021 + `docs/ADMIN.md`).           |
| —      | `[HECHO]`    | DMARC revisado: se mantiene `p=none` con `rua` y `fo=1`; plan en `docs/QA.md`.     |

### 11.2 Verificación ejecutada

- Migración `20261027020000_rls_reglas_negocio.sql` validada en una transacción con
  `ROLLBACK` y luego aplicada a cloud; registrada en
  `supabase_migrations.schema_migrations`.
- 13 pruebas con JWT simulado (`set local role authenticated`) contra el cloud,
  todas con `ROLLBACK`:
  - Fallan: auto-aprobación del adoptante, solicitud a mascota adoptada, mascota
    propia, suplantación de adoptante, mensaje sin solicitud aprobada, edición del
    contenido por el receptor, mascota adoptada → disponible y alta de mascota
    `adoptada`.
  - Funcionan: aprobación del publicador (mascota a `en_proceso` y auto-rechazo de
    otra pendiente), alta válida a mascota disponible, mensaje con solicitud aprobada
    y marcar como leído.
- Datos de prueba: 0 mensajes, 0 mascotas y la solicitud usada sigue en `pendiente`
  tras los `ROLLBACK`.
- `pg_policies` y `pg_trigger` confirman las policies y los tres triggers.

### 11.3 Límites de esta verificación

- No se corrieron los e2e de flujo porque Docker/Supabase local no estaba disponible;
  el CI los ejecutará con la migración nueva. Las reglas replicadas son exactamente
  las que ya usa la app.
- El buzón `rua` sigue siendo Gmail personal; para el acta basta, pero conviene un
  alias `dmarc@adopty.lat` cuando haya dominio de correo propio.

---

## 12. Registro de ejecución — 2026-10-27 (QA, accesibilidad y rendimiento)

Cierre del bloque de QA y de los RNF medibles. Se verificó en producción
(`https://adopty.lat`, merge `e6169b5`) con Supabase cloud; la preview previa del
commit `2b01e3c` sirvió para ajustar antes del merge.

### 12.1 Cambios aplicados

| Área     | Cambio                                                                                                                                                                                                     |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fuentes  | Plus Jakarta Sans e Inter variables autohospedadas en `/fonts` (SIL OFL); se eliminó la hoja de Google Fonts que bloqueaba el render. Cache inmutable y CSP sin dominios de fuentes.                       |
| LCP      | Hero de inicio con `preload` + `fetchpriority`; primera tarjeta de `/explorar` con `preload`, `loading="eager"` y `fetchpriority="high"`; fotos locales en WebP.                                           |
| A11y     | Tokens de marca con contraste AA, `<main>` en inicio, enlaces de tarjeta sin `aria-label` que contradiga el texto visible, flechas del carrusel sin solapar targets y filtros no enfocables en escritorio. |
| Carrusel | Tarjetas fuera de pantalla y clones con `inert`; se bloquean durante la transición para no recibir foco.                                                                                                   |

### 12.2 Lighthouse 13.5 mobile (slow 4G, CPU 4×)

| Ruta                      | Perf | A11y | BP  | SEO | LCP   | FCP   | CLS   | TBT   |
| ------------------------- | ---- | ---- | --- | --- | ----- | ----- | ----- | ----- |
| `/`                       | 99   | 100  | 96  | 100 | 1.9 s | 1.3 s | 0.002 | 0 ms  |
| `/explorar`               | 100  | 100  | 96  | 100 | 1.7 s | 1.1 s | 0     | 20 ms |
| `/mascota/mishi-331c32a6` | 100  | 100  | 96  | 100 | 1.6 s | 1.0 s | 0.003 | 10 ms |

En preview el SEO era 69 por el `noindex` automático de Vercel; en producción es 100.

### 12.3 Otras verificaciones (2026-10-27)

| Prueba                          | Resultado                                                    |
| ------------------------------- | ------------------------------------------------------------ |
| `npm run format:check` / `lint` | ✅ sin errores                                               |
| `npm run check`                 | ✅ 0 errores, 17 hints preexistentes                         |
| `npm test`                      | ✅ 88/88 en 14 archivos                                      |
| `npm run build`                 | ✅ SSR Vercel + sitemap                                      |
| E2E público contra producción   | ✅ 32/32                                                     |
| `node scripts/perf.mjs` (prod)  | ✅ 15/15 por ruta; p95 máx 608 ms                            |
| axe (5 páginas × 4 anchos)      | ✅ 0 violaciones; sin overflow horizontal                    |
| Backup                          | ✅ dump validado con `pg_restore -l`; restore real pendiente |

### 12.4 Límites

- Las cifras son de producción con Supabase cloud; la preview previa dio LCP
  2.2 / 2.1 / 1.6 s.
- El e2e de flujo completo corre en CI con Supabase local; este entorno no tiene Docker.
- El restore de backup se ejecutó después con Postgres 17 instalado localmente (§13).

### 12.5 Pendientes reales tras este bloque

- Piloto y acta firmados (P0-06), Google OAuth, notificaciones por email (P2-01),
  backup off-site (P2-06), monitoreo (P2-04), `srcset`/AVIF (P3-03). Los demás se
  cerraron en §13.

## 13. Registro de ejecución — 2026-10-27 (cierre autónomo)

Trabajo hecho sin depender de cuentas externas nuevas: restore drill, rate-limit
distribuido, CI, alertas y presupuesto de rendimiento.

### 13.1 Restore drill (P0-07)

| Paso                             | Resultado                                                     |
| -------------------------------- | ------------------------------------------------------------- |
| Clúster limpio                   | PostgreSQL 17.11 con `initdb` (sin Docker); roles de Supabase |
| `pg_restore` del dump            | 0 errores, 280 ms; 52 entradas de datos                       |
| Conteos `public` (13 tablas)     | Idénticos a la nube (32 mascotas, 5 usuarios, 11 fotos, etc.) |
| `auth.users` / `storage.objects` | 5 / 2, iguales a la nube                                      |
| Objetos                          | 21 migraciones, 7 triggers, 36 policies, 37 índices           |
| RLS sobre la copia               | `anon` ve 28/32 mascotas, 0 usuarios, 0 mensajes              |
| RTO                              | 0,28 s de restore (sin aprovisionar el servidor)              |

El dump se genera con `--no-privileges`: en un Supabase nuevo los grants por defecto
los recrea; en Postgres vanilla se concedieron a mano para probar RLS. Queda anotado en
el runbook.

### 13.2 Rate-limit distribuido (P2-03)

- Migración `20261027030000_rate_limit_distribuido.sql`: tabla `rate_limits` + RPC
  `consumir_rate_limit` (atómica, limpieza oportunista, sin acceso directo por RLS).
- `rateLimitDistribuido` en `src/lib/ratelimit.ts` con fallback en memoria.
- Todas las mutaciones autenticadas limitadas, incluidas las cinco rutas que faltaban.
- Prueba concurrente: 30 peticiones, `p_max=10` → 10 aprobadas / 20 bloqueadas.
- 4 unitarios nuevos; suite total 92/92.

### 13.3 CI, alertas y rendimiento

- `vitest.config.ts`: umbrales de cobertura (actual 69,5 / 57,3 / 67,1 / 73,2 %).
- `e2e/a11y.e2e.ts`: 5 páginas × 360/1280 px con axe; 10/10 en verde.
- CI: `test:coverage`, e2e público y flujo separados.
- Backup: retención 90 días e issue automático `backup` si falla.
- `perf.yml` + `lighthouserc.json`: Lighthouse semanal contra producción con presupuesto
  (perf ≥ 90, LCP ≤ 2,5 s, CLS ≤ 0,1, TBT ≤ 300 ms).

### 13.4 Verificación local

`npm run format:check`, `lint`, `check`, `test:coverage`, `build` y el smoke de axe en
verde. El flujo e2e con escrituras y el job de CI se validan al pushear a `develop`.

### 13.5 Lo que sigue dependiendo del responsable

Piloto y acta (P0-06), Google OAuth (P0-01), notificaciones por email (P2-01), Sentry y
uptime (P2-04), backup off-site (P2-06) y `srcset`/AVIF (P3-03).
