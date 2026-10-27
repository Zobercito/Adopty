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

| Dimensión     | Estado                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------- |
| Stack         | Astro v7 + TypeScript strict + Tailwind v4 + Supabase + Zod + Vercel                              |
| Persistencia  | Postgres/Supabase con 20 migraciones en `supabase/migrations/`                                    |
| Backend       | API routes de Astro + RPC SQL; sin service role                                                   |
| Auth          | Email/contraseña + recuperación; Google OAuth codificado pero apagado                             |
| Páginas       | Aproximadamente 20 vistas `.astro` (públicas, privadas, admin, legales)                           |
| API           | 28 archivos de rutas en `src/pages/api/`                                                          |
| Tests         | 86 unitarios (14 archivos, vitest) + 2 suites Playwright                                          |
| CI            | 2 jobs (`calidad`, `e2e`) + `npm audit`; Dependabot semanal                                       |
| Backups       | `pg_dump` diario por GitHub Actions, artefacto 30 días                                            |
| Estado global | Fases 0–7 completas; P1 de código/config cerrados; prod en `adopty.lat`; quedan P1-10/P1-11 (RLS) |

### 1.2 Veredicto

El producto es funcionalmente completo para el alcance académico y tiene una base de
calidad por encima de lo habitual: RLS, Zod en servidor, tests, CI, backups, legales y
documentación. **No está listo para producción sin cerrar P0**, y tiene **hallazgos
reales de seguridad/privacidad y reglas de negocio** que conviene corregir antes de un
piloto abierto.

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
8. **Dos policies siguen permitiendo saltarse reglas de negocio por REST**:
   `solicitudes` (P1-10) y `mensajes` (P1-11). La app las respeta, pero la capa RLS no.
9. **Sin notificaciones por email** propios de la app: una solicitud o aprobación puede
   pasar inadvertida (P2-01, pendiente). Supabase Auth ya usa SMTP de Resend.
10. **Sin monitoreo de errores/uptime**; el CI ya ejecuta `npm audit` y Dependabot está
    configurado, pero faltan axe/Lighthouse (P2-04, P2-05b, P3-05).

---

## 2. Panorama: qué se hizo

### 2.1 Funcionalidad implementada

| Módulo                                            | Estado      | Evidencia principal                                                                                                                                 |
| ------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Registro/login/logout, recuperación de contraseña | `[HECHO]`   | `src/pages/api/auth/*`, `src/pages/login.astro`, `src/pages/register.astro`, `src/pages/recuperar.astro`                                            |
| Perfiles persona/organización y edición           | `[HECHO]`   | `src/pages/perfil.astro`, `src/pages/api/perfil.ts`, `src/lib/validation/user.ts`                                                                   |
| Cambio de correo y contraseña                     | `[HECHO]`   | `src/pages/api/auth/cambiar-email.ts`, `src/pages/api/auth/cambiar-password.ts`                                                                     |
| Baja de cuenta, exportación de datos              | `[HECHO]`   | `src/pages/api/cuenta/borrar.ts`, `src/pages/api/mis-datos.ts`, RPC en `supabase/migrations/20261006030000_cuenta.sql`                              |
| CRUD de mascotas con 1–5 fotos                    | `[HECHO]`   | `src/pages/api/mascotas/*`, `src/pages/mascota/nueva.astro`, `src/pages/mascota/[id]/editar.astro`                                                  |
| Subida optimizada WebP ≤500 KB                    | `[HECHO]`   | `src/lib/storage.ts`, `src/pages/api/mascotas/upload.ts`                                                                                            |
| Soft-delete y restauración                        | `[HECHO]`   | `src/pages/api/mascotas/[id].ts`, `src/pages/api/admin/mascotas/[id]/restaurar.ts`                                                                  |
| Búsqueda con filtros, texto, orden y paginación   | `[HECHO]`   | `src/pages/explorar.astro`, `src/pages/api/mascotas/index.ts`, `src/lib/mascotas.ts`                                                                |
| Slugs y redirección 301 desde UUID                | `[HECHO]`   | `src/pages/mascota/[id].astro:15-27`, migración `20261002010000_slug_pgtrgm.sql`                                                                    |
| Solicitudes con estados y RPC atómica             | `[HECHO]`   | `src/pages/api/solicitudes/*`, `src/lib/transiciones.ts`, `supabase/migrations/20260925010000_solicitudes_rpc.sql`                                  |
| Chat interno con Realtime                         | `[HECHO]`   | `src/components/ChatView.astro`, `src/components/MessageThread.astro`, `src/pages/api/mensajes/*`                                                   |
| No leídos y bandeja                               | `[HECHO]`   | `src/pages/mensajes.astro`, `src/middleware.ts`                                                                                                     |
| Panel publicador y solicitudes recibidas          | `[HECHO]`   | `src/pages/panel/index.astro`, `src/pages/panel/solicitudes.astro`, `src/lib/panel.ts`                                                              |
| Favoritos con migración desde localStorage        | `[HECHO]`   | `src/components/FavButton.astro`, `src/pages/favoritos.astro`, `src/pages/api/favoritos.ts`                                                         |
| Perfil de adoptante y afinidad                    | `[HECHO]`   | `src/lib/match.ts`, `src/pages/api/estilo-de-vida/index.ts`, `src/pages/perfil.astro`                                                               |
| Moderación: reportes, verificación, suspensión    | `[HECHO]`   | `src/pages/admin/index.astro`, `src/pages/api/admin/*`, `src/lib/admin.ts`                                                                          |
| Auditoría de acciones                             | `[HECHO]`   | `src/lib/auditoria.ts`, migración `20261002020000_auditoria.sql`                                                                                    |
| Privacidad de perfiles vía RPC                    | `[HECHO]`   | `src/lib/perfil.ts`, RPC `perfil_publico`, migración `20261006010000_privacidad_perfiles.sql`                                                       |
| Legales: términos y privacidad                    | `[HECHO]`   | `src/pages/terminos.astro`, `src/pages/privacidad.astro`                                                                                            |
| PWA básica (manifest + SW + offline)              | `[HECHO]`   | `public/manifest.json`, `public/sw.js`, `src/pages/offline.astro`, `src/layouts/Layout.astro`                                                       |
| SEO base: sitemap, robots, OG, JSON-LD            | `[PARCIAL]` | `astro.config.mjs`, `src/pages/robots.txt.ts`, `src/layouts/Layout.astro`, `src/lib/seo.ts`; falta sitemap de fichas (P1-05b)                       |
| Analytics de embudo                               | `[HECHO]`   | `src/lib/analytics.ts`; 6/6 eventos emitidos (`busqueda`, `ver_detalle`, `solicitar`, `solicitud_aprobada`, `mensaje_enviado`, `favorito_agregado`) |
| Tests unitarios                                   | `[HECHO]`   | 14 archivos `*.test.ts` en `src/lib/` (86 tests)                                                                                                    |
| E2E público y flujo                               | `[HECHO]`   | `e2e/publico.e2e.ts`, `e2e/flujo.e2e.ts`, `playwright.config.ts`                                                                                    |
| CI de calidad y e2e de flujo                      | `[HECHO]`   | `.github/workflows/ci.yml`                                                                                                                          |
| Backup diario                                     | `[HECHO]`   | `.github/workflows/backup.yml`                                                                                                                      |
| Colección Postman                                 | `[HECHO]`   | `postman/adopty.json`                                                                                                                               |
| Documentación del proyecto                        | `[HECHO]`   | `README.md`, `AGENTS.md`, `docs/DECISIONES.md`, `docs/*.md`                                                                                         |

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
    solo en `mensajes`; 20 migraciones registradas en
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

- **Estado:** `[PARCIAL]` (operativo; requiere acceso a Supabase cloud).
- **Evidencia:** `README.md:56-80`, `supabase/seed.sql`, `docs/CHECKLIST.md:11-12`.
- **Impacto:** la clave `Adopty123!` del seed local no debe servir en producción;
  publicar una organización `verificada` con clave conocida es un riesgo.
- **Acción:**
  - Rotar o eliminar las cuentas demo en la nube.
  - Confirmar que `patitas@adopty.pa` y `rescatista@adopty.pa` no usan la clave del seed.
  - Dar de alta al menos un administrador real (`docs/ADMIN.md`).
  - Mantener la regla del seed: tokens de `auth.users` en `''`, nunca `NULL`.
- **Criterio de aceptación:** ninguna credencial pública permite entrar a prod; existe
  al menos un admin; el seed local sigue funcionando.

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

- **Estado:** `[FALTA]`.
- **Evidencia:** `docs/QA.md:53-55`, `docs/CHECKLIST.md:15-17`.
- **Impacto:** los RNF de accesibilidad y rendimiento no están verificados en el entorno real.
- **Acción:**
  - Lighthouse mobile en `/`, `/explorar` y una ficha: LCP < 2.5 s.
  - axe DevTools: 0 errores críticos.
  - Navegación completa por teclado: skip link, filtros, carrusel, chat, formularios.
  - Contraste AA y targets táctiles ≥ 44 px.
  - Responsive 320 / 768 / 1024 / 1440.
  - `node scripts/perf.mjs <url>`: p95 < 1 s.
  - `E2E_BASE_URL=https://... npm run test:e2e` (suite pública, solo lectura).
- **Criterio de aceptación:** resultados registrados en `docs/QA.md` y checklist marcado.

#### P0-06 — Ejecutar el piloto y firmar el acta

- **Estado:** `[FALTA]`.
- **Evidencia:** `docs/PILOTO.md`, `docs/ACTA_ENTREGA.md`.
- **Impacto:** es el criterio de negocio §13 y la evidencia de aceptación.
- **Acción:** seguir `PILOTO.md`; registrar ≥5 mascotas, ≥3 solicitudes, ≥1 adopción
  `en_proceso`, feedback y firmas; limpiar datos de prueba al final.
- **Criterio de aceptación:** acta completa y checklist de salida cumplido.

#### P0-07 — Probar restauración de backup

- **Estado:** `[PARCIAL]`.
- **Evidencia:** `.github/workflows/backup.yml` (genera y verifica el dump),
  `README.md:186-197`.
- **Impacto:** hay backup, pero no evidencia de que el restore funcione; un dump
  corrupto o incompleto se descubre tarde.
- **Acción:** descargar el artefacto, restaurar en una base local/staging y verificar
  tablas, filas y RLS; documentar RPO/RTO.
- **Criterio de aceptación:** restore reproducible con conteos coincidentes y app
  funcionando contra la base restaurada.

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

- **Estado:** `[FALTA]` (detectado en la verificación cloud del 2026-10-26).
- **Tipo:** seguridad/regla de negocio.
- **Evidencia:** políticas actuales `sol_insert` (`auth.uid() = id_adoptante`) y
  `sol_update` (`adoptante` o `soy_publicador`). Con la anon key y una sesión, un
  adoptante puede insertar una solicitud sobre una mascota `adoptada/en_proceso` o
  duplicada (la UI/API lo impiden, pero la policy no) y puede cambiar `estado` a
  `aprobada` sin pasar por la RPC `aprobar_solicitud`.
- **Impacto:** se pueden crear estados imposibles y saltarse la transacción que
  auto-rechaza al resto.
- **Acción sugerida:** retirar INSERT/UPDATE directos y mover altas y transiciones a
  RPC `SECURITY DEFINER` (o triggers) que validen disponibilidad, duplicado y
  transición; conservar SELECT. Añadir e2e negativos por REST.
- **Criterio de aceptación:** un intento directo de insertar/actualizar fuera de las
  reglas falla; el flujo de la app sigue verde.

#### P1-11 — RLS de `mensajes` permite DMs no solicitados y edición del destinatario

- **Estado:** `[FALTA]` (detectado en la verificación cloud del 2026-10-26).
- **Tipo:** privacidad/seguridad.
- **Evidencia:** `msg_insert` solo comprueba `auth.uid() = id_emisor`; no exige una
  solicitud aprobada ni un hilo previo. `msg_update` permite al receptor modificar
  cualquier columna (incluido `contenido`), no solo `leido`.
- **Impacto:** spam directo a cualquier usuario vía REST y alteración del historial por
  la otra parte.
- **Acción sugerida:** INSERT con `EXISTS` de solicitud `aprobada` entre emisor,
  receptor y mascota (o hilo previo); UPDATE solo para marcar `leido` (trigger o RPC).
  Mantener SELECT actual.
- **Criterio de aceptación:** un tercero sin solicitud aprobada recibe 403 al insertar;
  el receptor no puede cambiar el texto; chat y contador de no leídos siguen verdes.

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

- **Estado:** `[FALTA]` respecto al plan §7.
- **Evidencia:** `src/pages/api/mascotas/index.ts:49` inserta la mascota directamente;
  `mascotas` no tiene un campo de aprobación previa; el admin solo gestiona reportes y
  verificación de organizaciones.
- **Impacto:** una organización no verificada puede publicar de inmediato; el plan pedía
  revisión manual para mitigar spam/publicaciones falsas.
- **Acción:** decidir y documentar:
  - Opción A: añadir `estado_revision` (`pendiente|aprobada|rechazada`) y ocultar las
    pendientes de la lectura pública; cola en `/admin`; auto-aprobar a organizaciones
    verificadas.
  - Opción B: aceptar el modelo actual basado en reportes y verificación posterior, y
    actualizar el plan/README para que no prometa una cola que no existe.
- **Criterio de aceptación:** la decisión está documentada; si se implementa, una
  mascota de cuenta no verificada no es pública hasta aprobación.

#### P2-03 — Rate-limit distribuido y rutas sin límite

- **Estado:** `[PARCIAL]`.
- **Evidencia:** `src/lib/ratelimit.ts:12-31` usa un `Map` en memoria; el comentario
  reconoce que cada instancia serverless lleva su contador. Rutas como
  `PATCH/DELETE /api/mascotas/[id]`, `PATCH /api/mensajes/[id]`,
  `PATCH /api/solicitudes/[id]` y algunos `GET /api/admin/*` no aplican `rateLimit`.
- **Impacto:** los límites no son consistentes en Vercel ni tras un cold start; abuso
  autenticado en mutaciones no queda frenado.
- **Acción:** migrar a Upstash Redis/KV o a una tabla/RPC atómica de Supabase; mantener
  fallback en memoria para desarrollo. Añadir límites a mutaciones autenticadas.
- **Criterio de aceptación:** el límite se comparte entre instancias; 429 con
  `Retry-After`; tests de cubeta y de integración.

#### P2-04 — Observabilidad y monitoreo

- **Estado:** `[FALTA]`.
- **Evidencia:** solo `@vercel/analytics`; `src/middleware.ts:73-79` usa
  `console.error`; no hay Sentry/Highlight ni monitor de uptime.
- **Impacto:** los errores en producción no se ven con stack/release; no hay alertas de
  caída ni de fallo de backup.
- **Acción:** integrar Sentry (server + cliente) con scrubbing de PII, release tags y
  alertas; monitorizar `/` o `/api/mascotas` con un servicio de uptime; añadir
  notificación de fallo al workflow de backup.
- **Criterio de aceptación:** un error provocado aparece en el panel con release y ruta;
  hay alerta de caída y de backup fallido; no se envían datos personales.

#### P2-05 — Endurecer CI

- **Estado:** `[PARCIAL]` (P2-05a hecho el 2026-10-26).
- **Evidencia:** `.github/workflows/ci.yml` ejecuta lint, format, check, test, build,
  `test:e2e:flujo` y ahora `npm audit --audit-level=high`; `.github/dependabot.yml`
  agrupa minor/patch semanalmente. `npm audit` reporta 0 vulnerabilidades tras
  actualizar dependencias y fijar `zod@4.6.7`/`path-to-regexp@6.3.0` con overrides.
- **Pendiente (P2-05b):** job de `test:e2e` público, smoke de axe/Lighthouse, cobertura
  con umbral y `vitest.config`.
- **Criterio de aceptación:** PR con vulnerabilidad alta falla; el e2e público corre en
  CI; la cobertura se reporta. La parte de audit/Dependabot está cubierta.

#### P2-06 — Backup fuera del artefacto de 30 días

- **Estado:** `[PARCIAL]`.
- **Evidencia:** `.github/workflows/backup.yml:77-81` sube un artefacto con retención
  de 30 días; no hay copia off-site de largo plazo.
- **Impacto:** un incidente detectado después de 30 días no tiene respaldo recuperable.
- **Acción:** subir el `.sql.gz` a S3/R2/Drive con lifecycle; documentar retención,
  cifrado y procedimiento de restore; alertar si el job falla.
- **Criterio de aceptación:** existe copia off-site >30 días; restore probado; alerta
  de fallo configurada.

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

- **Estado:** `[FALTA]`.
- **Evidencia:** `scripts/perf.mjs` es un smoke manual; no hay Lighthouse CI.
- **Acción:** definir presupuesto (LCP, CLS, INP, peso de JS) y ejecutarlo en CI o en un
  job programado.
- **Criterio de aceptación:** una regresión de LCP/peso rompe el job o genera alerta.

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
- **Evidencia:** `docs/DECISIONES.md` con 20 ADR (contexto, decisión y consecuencias),
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

| Criterio del plan              | Estado      | Evidencia                                           | Qué falta                                    |
| ------------------------------ | ----------- | --------------------------------------------------- | -------------------------------------------- |
| CU-01…CU-08 e2e                | `[PARCIAL]` | `e2e/flujo.e2e.ts`, CI con Supabase local           | Repetir en prod (P0-05)                      |
| Preview deploy verificado      | `[HECHO]`   | `docs/CHECKLIST.md:23`                              | Revalidar tras cambios                       |
| Register con `emailRedirectTo` | `[HECHO]`   | `src/pages/api/auth/register.ts`                    | E2E completo sujeto a cuota de email         |
| Búsqueda p95 < 1 s             | `[PARCIAL]` | `scripts/perf.mjs`, `docs/QA.md`                    | Medir en prod con datos reales               |
| Imágenes ≤ 500 KB WebP         | `[HECHO]`   | `src/lib/storage.ts`, e2e de upload                 | —                                            |
| RLS 100 %                      | `[PARCIAL]` | Migraciones + e2e por rol; todas las tablas con RLS | P1-10/P1-11 (reglas en solicitudes/mensajes) |
| Sin secretos en git            | `[HECHO]`   | `.gitignore`, `git ls-files`                        | Revisar antes de cada push                   |
| Validación server total        | `[HECHO]`   | Zod en todas las mutaciones                         | —                                            |
| Tipos TS/Astro                 | `[HECHO]`   | `npm run check`, CI                                 | —                                            |
| axe 0 críticos / teclado / AA  | `[FALTA]`   | `docs/QA.md:53-55`                                  | P0-05                                        |
| Piloto ≥5 / ≥3 / ≥1 + feedback | `[FALTA]`   | `docs/PILOTO.md`                                    | P0-06                                        |
| Google OAuth                   | `[FALTA]`   | `src/lib/oauth.ts`                                  | P0-01                                        |
| Backup y restore               | `[PARCIAL]` | `.github/workflows/backup.yml`                      | P0-07 / P2-06                                |

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
| 8     | P1-10/P1-11 (RLS de solicitudes y mensajes) — pendientes        | —                  |

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

P2-01 (emails), P2-02 (moderación previa), P2-03 (rate-limit distribuido),
P2-06 (backup off-site). P4-01, P4-02 y P4-03 se adelantaron y quedaron hechos el
2026-10-26.

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
| P0-07 restore           | Restaurar el `.sql.gz` en una base limpia y ejecutar la app contra ella.                                                   |

### 6.5 Checklist de aceptación rápida

- [ ] `npm run lint` sin errores.
- [ ] `npm run format:check` sin errores.
- [ ] `npm run check` 0 errores.
- [ ] `npm test` verde.
- [ ] `npm run build` verde.
- [ ] `npm run test:e2e` verde contra prod.
- [ ] `E2E_FLUJO=1 npm run test:e2e:flujo` verde en local.
- [ ] Lighthouse LCP < 2.5 s en móvil.
- [ ] axe 0 críticos.
- [ ] Sitemap sin rutas privadas y con fichas.
- [ ] Headers de seguridad presentes.
- [ ] Baja de cuenta borra foto de Storage.
- [ ] `adoptada` no vuelve a `disponible`.
- [ ] Google OAuth funciona en prod.
- [ ] Piloto y acta firmados.

---

## 7. Anexos

### A. Inventario de archivos clave

| Archivo                       | Propósito                                                               |
| ----------------------------- | ----------------------------------------------------------------------- |
| `src/middleware.ts`           | Refresco de sesión, guards de rutas privadas y estado del navbar.       |
| `src/lib/supabase.ts`         | Clientes browser/SSR con cookies de Supabase.                           |
| `src/lib/transiciones.ts`     | Máquinas de estado de solicitud y mascota.                              |
| `src/lib/ratelimit.ts`        | Rate-limit en memoria y helper de IP.                                   |
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
| Moderación previa          | No implementada                | Solo reportes/verificación posterior (P2-02).                                            |

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
| P4-02  | `[HECHO]`    | `docs/DECISIONES.md` con 16 ADR (hoy 20; ver §9/§10).                             |
| P4-03  | `[HECHO]`    | Tag anotado `v0.8.0`.                                                             |

No se ejecutó P0-03 (rotar seed/administrador cloud) porque requiere acceso al
proyecto Supabase de producción; queda documentado como tarea operativa.

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
(P1-01…P1-09). En la verificación cloud aparecieron dos huecos de RLS que se
documentan como P1-10 y P1-11, **pendientes**. Los cambios se commitearon y se
desplegaron en `https://adopty.lat` (ver §10).

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
| Supabase    | `dvebieysgnhmimmxjwjc` (Ohio); 20 migraciones registradas; RLS en las 13 tablas          |
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
- **Modelo de moderación P2-02** y revisión del buzón `rua` de DMARC (hoy Gmail
  personal).
- **P0-03**: las cuentas demo con clave conocida siguen en cloud; rotarlas antes del
  piloto abierto.
- Repetir Lighthouse/axe y la búsqueda p95 con datos de producción (P0-05, P3-05).
