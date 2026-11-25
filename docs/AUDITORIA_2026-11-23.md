---
title: Auditoría técnica y pendientes — Adopty (2026-11-23)
audit_date: 2026-11-23
last_update: 2026-11-23
branch_audited: develop
commit: c6074b7
production_commit: 2e2eeed (origin/main)
scope: adopty/
status: vigente — auditoría independiente; complementa docs/AUDITORIA_PENDIENTES.md
---

# Auditoría técnica y pendientes — Adopty (2026-11-23)

Este documento es una **auditoría independiente** del estado real del repositorio y de
producción. No sustituye a [`AUDITORIA_PENDIENTES.md`](AUDITORIA_PENDIENTES.md), que
conserva el histórico de cierre de P0/P1; lo complementa con lo verificado el
**2026-11-23** y con los huecos que siguen abiertos. Hay un resumen compacto en
[`SESION_2026-11-25.md`](SESION_2026-11-25.md).

## 1. Veredicto

**El producto está funcionalmente completo para el alcance académico, pero no está
cerrado al 100 %.** El código pasa lint, tipos, 186 tests unitarios y build; producción
responde y los workflows de CI, backup, uptime y rendimiento están en verde. No hay
stubs, endpoints sin implementar ni `TODO` en `src/`.

Queda **un bloqueante de entrega**: el **piloto real y acta firmada** (métricas y
firmas en blanco). **Google OAuth se retiró del alcance por decisión del equipo
(2026-11-25)** y los **avisos por email** ya tienen el secreto en Vault; la entrega
real no se probó. Persiste deuda operativa de credenciales.

## 2. Alcance y método

Revisado:

- `src/` completo (119 archivos): 21 páginas `.astro`, 29 archivos de rutas API,
  componentes, layouts, middleware y `src/lib/`.
- `supabase/migrations/` (35 migraciones), `supabase/seed.sql` y `config.toml`.
- `e2e/`, `scripts/`, `public/`, `vercel.json`, `.github/workflows/`, `postman/`.
- `README.md`, `AGENTS.md` y `docs/*.md`.
- Producción `https://adopty.lat` (solo lectura) y estado de los workflows en GitHub.

**No se ejecutó** el e2e de flujo (`E2E_FLUJO=1`): exige levantar el stack de Supabase
local (descarga de imágenes y aprovisionamiento de contenedores), que no se hizo en esta
revisión; el runner de CI sí lo ejecuta (job `e2e`). **No se re-ejecutó Lighthouse**;
se tomaron los resultados de `perf.yml` y de los informes de QA. **No se accedió al
dashboard de Supabase/Vercel** para verificar la allowlist de Redirect URLs ni la
rotación de la contraseña de Postgres.

## 3. Evidencia ejecutada el 2026-11-23

### 3.1 Cadena local

| Comando                     | Resultado                                                         |
| --------------------------- | ----------------------------------------------------------------- |
| `npm run lint`              | ✅ 0 errores                                                      |
| `npm run check`             | ✅ 0 errores, 17 hints (Zod 4: `.uuid()` deprecado)               |
| `npm test`                  | ✅ 186/186 en 33 archivos                                         |
| `npm run test:coverage`     | ✅ 68,34 % stmts · 59,86 % ramas · 66,66 % funcs · 72,06 % líneas |
| `npm run build`             | ✅ SSR Vercel + sitemap (1 m 47 s)                                |
| `npm run format:check`      | ✅ 0 diferencias (tras formatear `AGENTS.md` e ignorar `.qoder/`) |
| `node --check public/sw.js` | ✅ sin errores de sintaxis                                        |

`format:check` pasa en el árbol actual: `AGENTS.md` está formateado y `.qoder/` se
ignora en `.gitignore`/`.prettierignore`. Los cambios de skills (`.agents/`,
`.continue/`, `.kiro/`) siguen sin commitear, pero ya no afectan al CI.

### 3.2 Producción

| Comprobación                                    | Resultado                                                                |
| ----------------------------------------------- | ------------------------------------------------------------------------ |
| `GET /`                                         | ✅ 200 (0,65 s)                                                          |
| `www.adopty.lat`                                | ✅ 308 → `https://adopty.lat/`                                           |
| `GET /explorar`, `/robots.txt`                  | ✅ 200                                                                   |
| `GET /sitemap-mascotas.xml`                     | ✅ 200, 6 fichas                                                         |
| `GET /panel` sin sesión                         | ✅ 302 → `/login?next=%2Fpanel`                                          |
| Headers                                         | ✅ HSTS, `nosniff`, `X-Frame-Options: DENY`, referrer, permissions       |
| CSP                                             | ✅ enforcing en producción desde el 2026-11-25; 0 violaciones en 7 rutas |
| E2E público (`E2E_BASE_URL=https://adopty.lat`) | ✅ 32/32                                                                 |
| axe (`e2e/a11y.e2e.ts` contra producción)       | ✅ 10/10, 0 violaciones                                                  |
| Inventario público                              | 6 mascotas disponibles, 1 página                                         |

### 3.3 CI/CD y dependencias

| Comprobación     | Resultado                                                         |
| ---------------- | ----------------------------------------------------------------- |
| CI de `main`     | ✅ último run 2026-10-29 (`2e2eeed`) en verde                     |
| CI de Dependabot | ✅ runs del 2026-11-23 en verde                                   |
| `backup.yml`     | ✅ 2026-11-23 en verde (copia diaria)                             |
| `uptime.yml`     | ✅ 2026-11-23 en verde                                            |
| `perf.yml`       | ✅ 2026-11-23 en verde                                            |
| `npm audit`      | ✅ 0 vulnerabilidades tras `npm update` (AUD-08)                  |
| `npm outdated`   | 2 paquetes por detrás: supabase CLI 2→3 y TypeScript 6→7 (majors) |

## 4. Estado funcional por módulo

| Módulo                                                         | Estado      | Evidencia principal                                                   |
| -------------------------------------------------------------- | ----------- | --------------------------------------------------------------------- |
| Registro, login, logout, recuperación y cambio de credenciales | `[HECHO]`   | `src/pages/api/auth/*`, `login.astro`, `register.astro`               |
| Perfiles persona/organización y edición                        | `[HECHO]`   | `perfil.astro`, `api/perfil.ts`, `lib/validation/user.ts`             |
| CRUD de mascotas con 1–5 fotos WebP ≤500 KB                    | `[HECHO]`   | `api/mascotas/*`, `lib/storage.ts`, `PetForm.astro`                   |
| Soft-delete, restauración y estado `adoptada` terminal         | `[HECHO]`   | `api/mascotas/[id].ts`, `lib/transiciones.ts`, triggers SQL           |
| Búsqueda, filtros, orden y paginación con URL compartible      | `[PARCIAL]` | `explorar.astro`, `api/mascotas/index.ts`, `lib/mascotas.ts`          |
| Solicitudes con estados y RPC/trigger atómico                  | `[HECHO]`   | `api/solicitudes/*`, `lib/solicitudes.ts`, migraciones                |
| Chat Realtime solo tras aprobación, no leídos                  | `[HECHO]`   | `ChatView.astro`, `MessageThread.astro`, `api/mensajes/*`             |
| Panel publicador y agregados                                   | `[HECHO]`   | `panel/index.astro`, `lib/panel.ts`                                   |
| Favoritos y migración desde localStorage                       | `[HECHO]`   | `FavButton.astro`, `favoritos.astro`, `api/favoritos.ts`              |
| Perfil de adoptante, estilo de vida y afinidad                 | `[HECHO]`   | `lib/match.ts`, `api/estilo-de-vida/index.ts`                         |
| Moderación: reportes, verificación, suspensión                 | `[HECHO]`   | `admin/index.astro`, `api/admin/*`, `lib/admin.ts`                    |
| Auditoría de acciones                                          | `[PARCIAL]` | `lib/auditoria.ts`, `registrar_auditoria`; sin visor para admin       |
| Cuenta: exportación, baja y anonimización                      | `[HECHO]`   | `api/mis-datos.ts`, `api/cuenta/borrar.ts`, RPC `eliminar_mi_cuenta`  |
| Legales, 404/500, PWA y offline                                | `[HECHO]`   | `terminos.astro`, `privacidad.astro`, `public/sw.js`, `offline.astro` |
| SEO: canonical, noindex, OG, JSON-LD, sitemaps                 | `[HECHO]`   | `lib/seo.ts`, `Layout.astro`, `sitemap-mascotas.xml`                  |
| Analytics de embudo                                            | `[HECHO]`   | `lib/analytics.ts`, `window.adoptyTrack`                              |
| Google OAuth                                                   | `[FALTA]`   | `lib/oauth.ts`, `api/auth/google.ts` (404 con provider apagado)       |
| Avisos por email de solicitudes/mensajes                       | `[FALTA]`   | Sin integración fuera de Supabase Auth                                |
| Imágenes responsivas (`srcset`/AVIF)                           | `[PARCIAL]` | WebP + dimensiones + lazy, sin variantes                              |
| Piloto real y acta firmada                                     | `[FALTA]`   | `docs/PILOTO.md`, `docs/ACTA_ENTREGA.md`                              |

## 5. Hallazgos y pendientes

### 5.1 Resumen

| ID     | Prioridad | Estado       | Hallazgo                                                                     |
| ------ | --------- | ------------ | ---------------------------------------------------------------------------- |
| AUD-01 | P0        | `[DECISIÓN]` | Google OAuth fuera de alcance (2026-11-25); login por correo cubre el piloto |
| AUD-02 | P0        | `[FALTA]`    | Piloto real y acta de entrega sin ejecutar/firmar                            |
| AUD-03 | P1        | `[DECISIÓN]` | Riesgo aceptado: no se rota la contraseña (`.env.db` en MEGA)                |
| AUD-04 | P2        | `[HECHO]`    | Redirects de Auth usan `import.meta.env.SITE`, no el Host                    |
| AUD-05 | P2        | `[PARCIAL]`  | Migraciones y secreto en Vault; falta probar la entrega real                 |
| AUD-06 | P2        | `[HECHO]`    | Filtros de edad, raza y ubicación + tests                                    |
| AUD-07 | P2        | `[HECHO]`    | 1k local: p95 170 ms API y 57 ms `/explorar`                                 |
| AUD-08 | P2        | `[HECHO]`    | Dependencias actualizadas; `npm audit` sin vulnerabilidades                  |
| AUD-09 | P3        | `[HECHO]`    | `srcset` 640/1280 con fallback; no hay fotos en Storage que migrar           |
| AUD-10 | P3        | `[HECHO]`    | CSP enforcing con hashes de Astro; 7 páginas sin violaciones                 |
| AUD-11 | P3        | `[HECHO]`    | Visor de auditoría para admin y autor correcto                               |
| AUD-12 | P3        | `[HECHO]`    | Zod en `PATCH /api/admin/cuentas` + test                                     |
| AUD-13 | P3        | `[DECISIÓN]` | Paginación por offset, documentada en `ADR-024`                              |
| AUD-14 | P3        | `[HECHO]`    | `.env.example` alineado con el código y el diseño                            |
| AUD-15 | P3        | `[HECHO]`    | Node 24 en `.nvmrc`/engines/CI y build local con 24 verificado               |
| AUD-16 | P4        | `[HECHO]`    | Conteos y vulnerabilidades corregidos en la documentación                    |
| AUD-17 | P4        | `[HECHO]`    | `ADR-010` marcada como sustituida por `ADR-023`                              |
| AUD-18 | P4        | `[HECHO]`    | Skills consolidadas y commiteadas; `.env` y `.codegraph` ignorados           |
| AUD-19 | P4        | `[HECHO]`    | Alcance documentado + 3 tests de contratos de API                            |
| AUD-20 | P4        | `[HECHO]`    | Postman con 42 requests; 27/29 rutas (faltan 2 OAuth de navegador)           |

### 5.2 P0 — Bloqueantes de entrega

#### AUD-01 — Google OAuth sin activar

- **Estado:** `[DECISIÓN]` (2026-11-25). Fuera del alcance por tiempo: la entrega se
  sostiene con correo/contraseña. El código sigue en el repo y queda para el backlog.
- **Evidencia:** `src/lib/oauth.ts`, `src/pages/api/auth/google.ts:16-18` (404 si
  `googleActivo` es falso), botón condicionado en `src/pages/login.astro:44` y
  `src/pages/register.astro`, `docs/CHECKLIST.md:15`.
- **Impacto:** el criterio de Fase 8 “login con Google” no se puede demostrar; la UI
  oculta el botón para no ofrecer una opción incompleta.
- **Acción:** crear credencial OAuth 2.0 en Google Cloud; activar el provider en
  Supabase (Client ID/Secret); añadir el dominio y `/api/auth/callback` a Redirect
  URLs; definir `PUBLIC_GOOGLE_ENABLED=true` en Vercel; redeploy.
- **Criterio de aceptación:** login con Google crea sesión, redirige a `/perfil`, crea
  las filas `usuarios`/`personas` u `organizaciones` y una cuenta suspendida sigue
  bloqueada.

#### AUD-02 — Piloto real y acta sin ejecutar

- **Estado:** `[FALTA]`.
- **Evidencia:** `docs/ACTA_ENTREGA.md:6` (fecha y URL en blanco), `:24-30` (métricas
  vacías), `:43-48` (sin firmas); producción sirve **6 mascotas disponibles** de demo,
  no las ≥5 reales del piloto.
- **Impacto:** es el criterio de negocio del §13 y la evidencia de aceptación; sin acta
  no hay cierre formal aunque el software funcione.
- **Acción:** seguir `docs/PILOTO.md` con 1–2 refugios; publicar ≥5 mascotas reales,
  crear ≥3 solicitudes, aprobar ≥1 (`en_proceso`), registrar feedback y firmar.
- **Criterio de aceptación:** acta completa, métricas reales y feedback con al menos una
  mejora accionable.

### 5.3 P1 — Seguridad operativa

#### AUD-03 — Credenciales de producción sin rotar

- **Estado:** `[EN CURSO]` (hallazgo K de `.security/plan.md`).
- **Evidencia:** `.env.db` existe con `DB_PASSWORD`/`DB_URL_POOLER` (permisos `600`,
  sin fecha de rotación; `mtime` 2026-09-25); `docs/QA.md:46-48` lo deja pendiente;
  `.security/plan.md:6` registra una ruta MEGA del proyecto. Hoy no hay cliente MEGA en
  ejecución y `~/mega-staging/Laptop/Universidad/...` no contiene `.env*`, pero el
  fichero sigue en el árbol y la contraseña no consta rotada.
- **Impacto:** una credencial de Postgres de producción en claro; si se sincronizó o se
  copió, el riesgo persiste. `.env.local` conserva un `VERCEL_OIDC_TOKEN` caducado.
- **Acción:** rotar `DB_PASSWORD` en Supabase; actualizar `.env.db` y las variables de
  Vercel/GitHub; excluir `.env*` de cualquier sync; borrar el token caducado de
  `.env.local`.
- **Criterio de aceptación:** la clave vieja falla y la nueva conecta; `realpath .env.db`
  fuera de cualquier carpeta sincronizada; `git ls-files` solo muestra `.env.example`.

### 5.4 P2 — Funcionalidad y riesgos relevantes

#### AUD-04 — `url.origin` en los redirects de Auth

- **Estado:** `[HECHO]` (2026-11-23).
- **Evidencia:** `register.ts`, `recuperar.ts` y `google.ts` usan
  `import.meta.env.SITE` en `redirectTo`; ya no leen `url.origin`. Guardia en
  `src/lib/authRedirects.test.ts` (2 tests). `google.ts` y `callback.ts` siguen
  validando `next` con `rutaInternaSegura`.
- **Impacto (original):** un Host manipulado + comodín en Redirect URLs podía llevarse
  el `code` a un dominio ajeno.
- **Operativo (2026-11-25):** la allowlist de Redirect URLs ya estaba configurada con
  apex, `www`, `localhost` y previews concretos; sin comodines amplios.
- **Criterio de aceptación:** el `redirectTo` no varía al cambiar el Host; la allowlist
  no contiene comodines amplios.

#### AUD-05 — Sin notificaciones por email

- **Estado:** `[PARCIAL]` (2026-11-23): código, migración y tests listos; falta activar
  el secreto de Vault y aplicar la migración en cloud.
- **Diseño implementado:** `supabase/migrations/20261123010000_notificaciones_email.sql`.
  La RPC `encolar_notificacion(tipo, mascota, destinatario)` es `SECURITY DEFINER`,
  valida la relación real llamante→destinatario, el opt-out (`usuarios.notificaciones_email`)
  y un antispam por hora. `notificar_email` lee el correo dentro de la base y lo envía
  con `pg_net` + `vault.decrypted_secrets` (`resend_api_key`); el email nunca vuelve a
  la app y no se usa service role. La app solo llama a la RPC desde los endpoints de
  solicitudes y mensajes (`src/lib/notificaciones.ts`).
- **Opt-out:** columna en `usuarios` y casilla en `/perfil` (`PUT /api/notificaciones`).
- **Cobertura:** 7 tests nuevos (2 del esquema + 5 de contrato SQL) y prueba funcional
  de la migración en PostgreSQL 17 con stubs de `auth`, `vault` y `net`: alta, duplicado,
  tercero, opt-out, mensaje y dos mensajes sin leer dieron los resultados esperados;
  el payload de Resend llevaba `to`, `subject`, `text` y `Authorization` de Vault.
  No se probó entrega real: falta `select vault.create_secret(...)` con la clave
  y comprobar `net._http_response`.
- **Límite:** `pg_net` es asíncrono y no hay reintentos automáticos; los fallos quedan
  en `net._http_response`. El enlace usa `https://adopty.lat` fijo.
- **Criterio de aceptación:** el publicador recibe aviso al recibir una solicitud y el
  adoptante al ser aprobado; ningún email expone datos de terceros. Pendiente de la
  prueba de entrega real.

#### AUD-06 — Faltan filtros estructurados de edad, raza y ubicación

- **Estado:** `[HECHO]` (2026-11-23).
- **Evidencia:** `RangoEdad` y `Busqueda` en `src/lib/mascotas.ts`; `paramsFrom` normaliza
  `edad` (cachorro/joven/adulto/senior), `raza` y `ubicacion`; `buscarMascotas` aplica
  `lt/gte` sobre `edad_meses` e `ilike` sobre raza/ubicación. La UI
  (`src/pages/explorar.astro`) tiene los tres campos y los conserva en la URL.
- **Cobertura:** tests de `paramsFrom` (rangos válidos, inválidos y saneado).
- **Criterio de aceptación:** cumplido: los filtros viajan en la URL, se combinan y se
  reflejan en el conteo.

#### AUD-07 — El criterio de 1k no está validado

- **Estado:** `[HECHO]` (2026-11-25).
- **Evidencia:** Supabase local arrancó, las 35 migraciones se aplicaron y
  `scripts/seed-1k.sql` dejó 1.000 mascotas (998 disponibles). `scripts/perf.mjs`
  contra el dev server local:
  - `/api/mascotas`: p50 28 ms, **p95 170 ms**.
  - `/api/mascotas?especie=gato`: p50 22 ms, p95 24 ms.
  - filtros combinados: p50 22 ms, p95 23 ms.
  - `q=bethania`: p50 41 ms, p95 47 ms.
  - `/explorar?especie=perro`: p50 45 ms, **p95 57 ms**.
- **Criterio de aceptación:** cumplido: p95 < 1 s con 1k en local reproducible.

#### AUD-08 — Dependencias con vulnerabilidades moderadas

- **Estado:** `[HECHO]` (2026-11-24).
- **Evidencia:** `npm update` dejó `astro@7.4.12`, `@astrojs/vercel@11.0.22`,
  `@sentry/astro@11.13.0`, `@supabase/supabase-js@2.119.0`, `eslint@10.15.0` y
  `prettier@3.10.1`. `npm audit` y `npm audit --audit-level=high` reportan **0
  vulnerabilidades**; `check`, `test` y `build` siguen en verde.
- **Criterio de aceptación:** cumplido.

### 5.5 P3 — Deuda menor

#### AUD-09 — Imágenes sin `srcset`/AVIF

- **Estado:** `[PARCIAL]` (2026-11-24).
- **Hecho:** el upload genera variantes `-640.webp` y `-1280.webp`; `fotoSrcset` las
  expone y se usan en tarjetas, hero, ficha, favoritos, panel, chat y formulario. Las
  subidas antiguas caen al `src` original si la variante 404 (listener global). Las
  fotos `/assets` siguen sin variantes.
- **Backfill:** `scripts/backfill-srcset.mjs` recorre las fotos del publicador con su
  propia sesión (email/contraseña, sin service role) y sube las variantes que falten;
  acepta `--dry-run`.
- **Pendiente:** ejecutar el backfill por cuenta y evaluar AVIF; medir transferencia real
  en móvil.
- **Criterio de aceptación:** menor transferencia en móvil sin CLS y LCP estable.

#### AUD-10 — CSP en `Report-Only` (ahora enforcing)

- **Estado:** `[HECHO]` (2026-11-23).
- **Evidencia:** `astro.config.mjs` activa `security.csp` (SHA-256, `script-src` sin
  `'unsafe-inline'`, `style-src` con `'unsafe-inline'` por atributos dinámicos,
  `frame-ancestors 'none'`). `vercel.json` ya no emite CSP: la genera Astro como header
  en SSR y como `<meta>` en prerenderizadas. Se eliminaron los 10 `onerror` inline
  (listener global en `Layout.astro`) y los `is:inline`/`define:vars`; los datos pasan
  por `data-*`.
- **Verificación:** build + servidor local del output: 7 rutas públicas con **0
  `securitypolicyviolation`**; carrusel funcionando (transform cambia), estilos inline
  aplicados y `img` rota retirada por el listener global. Las páginas autenticadas
  (chat, formulario de mascota) compilan y usan el mismo patrón, pero no se probaron sin
  sesión.
- **Pendiente:** confirmar en el preview/producción de Vercel tras el deploy; `dev` no
  aplica CSP.
- **Criterio de aceptación:** CSP enforcing sin errores en consola en las rutas clave.

#### AUD-11 — Auditoría sin visor y con autor incorrecto

- **Estado:** `[HECHO]` (2026-11-25); migración aplicada en cloud con `supabase db push`.
- **Evidencia:** `supabase/migrations/20261123020000_auditoria_admin.sql` crea la policy
  `auditoria_select_admin` (`soy_admin()`), reemplaza `estado_cuenta` para registrar
  `auth.uid()` como autor y `datos_nuevos.id_objetivo` como afectado. `lib/admin.ts`
  expone `listarAuditoria` y el panel `/admin` muestra las últimas 50 acciones.
- **Cobertura:** 3 tests en `src/lib/auditoriaAdmin.test.ts` (policy, autor y consulta
  sin correos).
- **Cloud:** aplicada el 2026-11-25; `supabase migration list --linked` muestra las dos
  migraciones con su `remote`.
- **Criterio de aceptación:** el admin ve las acciones de moderación con el actor
  correcto y el usuario solo ve las suyas.

#### AUD-12 — `admin/cuentas` sin Zod

- **Estado:** `[HECHO]` (2026-11-23).
- **Evidencia:** `src/lib/validation/admin.ts` define `cuentaEstadoSchema`;
  `src/pages/api/admin/cuentas/index.ts:26-33` usa `safeParse`; hay 3 tests en
  `src/lib/validation/admin.test.ts`.
- **Impacto (original):** no era explotable (el RPC revalida), pero rompía la regla
  escrita y el mensaje de error era distinto.
- **Criterio de aceptación:** cumplido: cuerpo inválido → 400 con mensaje de Zod y
  código alineado con el resto de endpoints.

#### AUD-13 — Paginación por offset

- **Estado:** `[DECISIÓN]` (desviación del plan, sin impacto actual).
- **Evidencia:** `src/lib/mascotas.ts:185-196` usa `.range()` con `page`; el plan (Fase 3) pedía cursor. Decisión documentada en `docs/DECISIONES.md` (ADR-024).
- **Impacto:** `OFFSET` profundo se degrada con muchos registros; con 6–30 no se nota.
- **Acción:** mantener si el volumen sigue bajo; si crece, pasar a cursor por
  `(fecha_publicacion, id)`.

#### AUD-14 — `.env.example` desalineado

- **Estado:** `[HECHO]` (2026-11-23).
- **Evidencia:** `.env.example` ya no incluye `SUPABASE_SERVICE_ROLE_KEY` (avisa de que
  el proyecto no la usa), documenta `SITE_URL` y las variables de e2e
  (`E2E_BASE_URL`, `E2E_FLUJO`).
- **Criterio de aceptación:** cumplido: un clon nuevo puede configurarse solo con
  `.env.example`.

#### AUD-15 — Deriva de versión de Node

- **Estado:** `[HECHO]` (2026-11-23). Build local con Node 24.13.0 sin el aviso de Vercel.
- **Evidencia:** `.nvmrc` fija `24`; `package.json` exige `node >=24`; `.github/workflows/ci.yml`
  usa `node-version: 24` en los dos jobs; `README.md` documenta `>=24`. `PATH=.../v24.13.0/bin npm run build`
  terminó con `NODE24_BUILD_EXIT=0` y sin “not supported by Vercel”.
- **Impacto (original):** diferencias de runtime entre local (26), CI (22.23.4) y
  producción (Vercel 24).
- **Criterio de aceptación:** local, CI y Vercel reportan la misma major. El próximo
  push a `develop`/`main` confirma el job de CI.

### 5.6 P4 — Documentación y mantenimiento

#### AUD-16 — Conteos obsoletos

- **Estado:** `[HECHO]` (2026-11-23).
- **Evidencia corregida:** `docs/AUDITORIA_PENDIENTES.md` ya dice 35 migraciones,
  186 tests/33 archivos y “hoy 9 moderadas” corregido a 0; `docs/CHECKLIST.md` apunta a
  `20261029110000`; `docs/ACTA_ENTREGA.md` dice 186 tests unitarios. Los registros
  históricos fechados de `docs/QA.md` y de las secciones 8–12 se conservan como
  instantáneas.
- **Criterio de aceptación:** los resúmenes y checklist coinciden con el repo actual.

#### AUD-17 — `ADR-010` sustituida

- **Estado:** `[HECHO]` (2026-11-23).
- **Evidencia:** `docs/DECISIONES.md:118-126` marca `ADR-010` como sustituida por
  `ADR-023` y aclara que el contador en memoria queda solo como fallback.
- **Criterio de aceptación:** cumplido: no hay dos ADR vigentes que se contradigan.

#### AUD-18 — Árbol de trabajo sucio y `format:check`

- **Estado:** `[PARCIAL]` (2026-11-23). `format:check` en verde; los skills no se tocan.
- **Evidencia:** se añadió `.qoder/` a `.gitignore` y `.prettierignore` y se formateó
  `AGENTS.md`; `npm run format:check` pasa. `git status` sigue mostrando los cambios de
  `.agents/`, `.continue/`, `.kiro/` y `skills-lock.json`, que son mantenimiento de
  herramientas y deben ir en su propio commit.
- **Impacto (original):** si se commiteaba tal cual, el job `calidad` fallaba.
- **Acción pendiente:** separar el mantenimiento de skills del trabajo del proyecto y
  decidir si se conservan los symlinks de `.continue/`/`.kiro/`.

#### AUD-19 — Cobertura acotada a `src/lib`

- **Estado:** `[HECHO]` (2026-11-23): alcance documentado; tests de API quedan opcionales.
- **Evidencia:** `README.md` §Tests aclara que la cobertura mide solo `src/lib/**` y no
  debe leerse como cobertura de toda la aplicación; `vitest.config.ts:10` sigue igual.
- **Impacto (original):** `storage.ts` 0 %, `solicitudes.ts` 25,8 %, `perfil.ts` 58,5 %,
  y las rutas API/páginas fuera de la métrica.
- **AUD-19b:** añadidos 3 tests de contratos (`apiContratos.test.ts`) para preferencia de
  avisos, hooks de notificación y variantes de imagen; la cobertura de líneas no cambia
  porque leen los archivos, no ejecutan los endpoints.

#### AUD-20 — Colección Postman parcial

- **Estado:** `[HECHO]` (2026-11-23).
- **Evidencia:** `postman/adopty.json` pasa de 23 a **42 requests** y cubre **26 de las
  29 rutas**; solo quedan fuera `GET /api/auth/google` y `GET /api/auth/callback`, que
  son redirects de navegador y no se prueban desde Postman. Se añadieron las carpetas
  “Perfil y cuenta”, “Moderación (admin)” y “Reportes, verificación y subida”.
- **Criterio de aceptación:** cumplido: JSON válido y cada ruta de API de dominio tiene
  al menos una request.

## 6. Matriz de aceptación §13

| Criterio del plan              | Estado      | Evidencia / qué falta                                         |
| ------------------------------ | ----------- | ------------------------------------------------------------- |
| CU-01…CU-08 e2e                | `[PARCIAL]` | CI ejecuta el flujo; repetir a mano en prod (AUD-02)          |
| Preview deploy verificado      | `[HECHO]`   | `docs/CHECKLIST.md:23`; revalidar tras cambios                |
| Register con `emailRedirectTo` | `[HECHO]`   | `api/auth/register.ts`; e2e completo sujeto a cuota de correo |
| Búsqueda p95 < 1 s             | `[HECHO]`   | 1k local: p95 170 ms API / 57 ms página (AUD-07)              |
| Imágenes ≤ 500 KB WebP         | `[HECHO]`   | `lib/storage.ts` + límites de Storage                         |
| RLS 100 %                      | `[HECHO]`   | 14 tablas con RLS + tests de contrato + e2e por rol           |
| Sin secretos en git            | `[HECHO]`   | `git ls-files` solo `.env.example`; ver AUD-03 en el host     |
| Validación server total        | `[PARCIAL]` | Zod en las mutaciones JSON; `upload` valida MIME real y 5 MB  |
| Tipos TS/Astro                 | `[HECHO]`   | `npm run check` 0 errores                                     |
| axe 0 críticos / teclado / AA  | `[HECHO]`   | 10/10 contra prod; informe manual de QA                       |
| Piloto ≥5 / ≥3 / ≥1 + feedback | `[FALTA]`   | AUD-02 (único bloqueante restante)                            |
| Google OAuth                   | `[N/A]`     | Fuera de alcance por decisión del 2026-11-25 (AUD-01)         |
| Backup y restore               | `[HECHO]`   | Dump diario, copia R2, restore drill documentado              |

## 7. Riesgos y notas de seguridad

- **La frontera real es RLS + RPC**, no el middleware. Las policies y triggers están
  revisados y cubiertos por tests de contrato; no hay service role en el servidor.
- **La anon key es pública**: PostgREST/Storage se alcanzan sin pasar por Astro. Los
  triggers de `solicitudes`, `mascotas` y `mensajes`, los `CHECK` de rutas de foto y
  las policies con `cuenta_activa()` son la defensa efectiva. No los reemplaces por
  validación solo de UI.
- **No hay PII en analytics, JSON-LD ni logs** en el código revisado; los mensajes de
  PostgREST se filtran con `mensajeError`.
- **Riesgo residual aceptado:** una cuenta con `borrado_en` puede reactivarse por el
  PATCH de admin; una suspendida puede autodarse de baja por RPC. Documentado en
  `.security/plan.md`; no permite escritura fuera del propio prefijo.
- **Dependencias:** actualizar Astro es la acción de seguridad más barata de esta lista.

## 8. Plan de cierre sugerido

| Orden | Acción                                                     | Depende de      | Criterio                             |
| ----- | ---------------------------------------------------------- | --------------- | ------------------------------------ |
| 1     | Rotar `DB_PASSWORD` y sacar `.env.db` de cualquier sync    | Cuentas         | Clave vieja falla (AUD-03)           |
| 2     | Activar Google OAuth y verificar login real                | Google/Supabase | Sesión creada y perfil (AUD-01)      |
| 3     | Ejecutar piloto y firmar acta                              | Refugio         | §13 completo (AUD-02)                |
| 4     | `supabase db push` de las 2 migraciones + secreto de Vault | Supabase        | Emails y visor activos (AUD-05/11)   |
| 5     | Validar CSP y entrega de email en preview/producción       | Deploy          | Sin violaciones y correo _Delivered_ |
| 6     | Ejecutar `scripts/backfill-srcset.mjs` por publicador      | Cuentas         | Variantes de fotos antiguas (AUD-09) |
| 7     | Push y run de CI con Node 24                               | GitHub          | Jobs `calidad` y `e2e` verdes        |

El bloque fácil, el medio y los difíciles se ejecutaron el 2026-11-23/25; el detalle y
la verificación están en la sección 11.

## 9. Inventario verificado

- **Páginas:** 21 `.astro` (públicas, privadas, admin y legales).
- **API:** 29 archivos de rutas; las mutaciones de dominio (mascotas, solicitudes,
  mensajes, favoritos, perfil, cuenta y moderación) exigen sesión y validan con Zod,
  salvo `upload` (tipo real con Sharp + 5 MB).
- **Base de datos:** 35 migraciones; 14 tablas con RLS; RPC y triggers usados por el
  código existen en SQL (verificado con un cruce automático).
- **Tests:** 186 unitarios en 33 archivos; 32 e2e públicos, 11 de flujo y 10 de axe.
- **Cobertura:** 68,34 / 59,86 / 66,66 / 72,06 sobre `src/lib` únicamente.
- **Sin stubs:** 0 `TODO`/`FIXME`/`not implemented` en `src/`.
- **Enlaces:** 0 enlaces o `fetch` internos rotos (52 rutas).
- **Producción:** 6 mascotas disponibles, sitemap de fichas con 6 URLs.

## 10. Cómo reproducir esta auditoría

```sh
npm run lint
npm run check
npm test
npm run test:coverage
npm run build
npm run format:check

E2E_BASE_URL=https://adopty.lat npx playwright test e2e/publico.e2e.ts
E2E_BASE_URL=https://adopty.lat npx playwright test e2e/a11y.e2e.ts

npm audit
npm outdated
git show HEAD:AGENTS.md | npx prettier --check --stdin-filepath AGENTS.md
```

Para el flujo completo y el benchmark, en una máquina con Docker:

```sh
npx supabase start
npx supabase db reset
# seed (config.toml tiene [db.seed] enabled=false)
docker exec -i supabase_db_adopty psql -U postgres -d postgres < supabase/seed.sql
docker exec -i supabase_db_adopty psql -U postgres -d postgres < scripts/seed-1k.sql

# dev server con las claves locales de `npx supabase status -o env`
PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
PUBLIC_SUPABASE_ANON_KEY=<anon-local> \
npm run dev -- --port 4321

node scripts/perf.mjs 'http://[::1]:4321'
E2E_FLUJO=1 PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
  E2E_BASE_URL='http://[::1]:4321' npx playwright test e2e/flujo.e2e.ts
```

## 11. Registro de ejecución — 2026-11-23/25 (fácil, medio y difíciles)

Se ejecutaron los nueve ítems de bajo esfuerzo, los difíciles **AUD-10 (CSP)** y
**AUD-05 (emails, activación pendiente)** y todo el bloque medio (**AUD-04, 06, 07,
08, 11, 19b** y **AUD-09** con reservas), sin commit ni push:

| ID      | Cambio                                                          | Archivos                                                                     |
| ------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| AUD-12  | Zod en `PATCH /api/admin/cuentas` + 3 tests                     | `src/lib/validation/admin.ts`, `admin.test.ts`, `api/admin/cuentas/index.ts` |
| AUD-13  | Decisión de paginación por offset documentada                   | `docs/DECISIONES.md` (ADR-024)                                               |
| AUD-14  | `.env.example` sin service role, con `SITE_URL` y variables e2e | `.env.example`                                                               |
| AUD-15  | Node 24 alineado y build local con 24 verificado                | `.nvmrc`, `package.json`, `.github/workflows/ci.yml`, `README.md`            |
| AUD-16  | Conteos a 35 migraciones / 186 tests / 0 moderadas              | `AUDITORIA_PENDIENTES.md`, `CHECKLIST.md`, `ACTA_ENTREGA.md`, `README.md`    |
| AUD-17  | `ADR-010` marcada como sustituida por `ADR-023`                 | `docs/DECISIONES.md`                                                         |
| AUD-18  | `.qoder/` ignorado y `AGENTS.md` formateado                     | `.gitignore`, `.prettierignore`, `AGENTS.md`                                 |
| AUD-19  | Alcance de la cobertura documentado                             | `README.md`                                                                  |
| AUD-20  | Postman ampliado a 42 requests (27/29 rutas)                    | `postman/adopty.json`                                                        |
| AUD-10  | CSP enforcing con Astro; sin `is:inline`/`define:vars`          | `astro.config.mjs`, `vercel.json`, `Layout.astro`, 6 páginas/componentes     |
| AUD-05  | Avisos por email desde Postgres con `pg_net` + Vault            | migración, `lib/notificaciones.ts`, 3 endpoints, `/perfil`                   |
| AUD-04  | Redirects de Auth con `import.meta.env.SITE` + test             | 3 endpoints, `src/lib/authRedirects.test.ts`                                 |
| AUD-06  | Filtros de edad/raza/ubicación + tests                          | `lib/mascotas.ts`, `explorar.astro`, `mascotas.test.ts`                      |
| AUD-08  | `npm update`; Astro 7.4.12 y 0 vulnerabilidades                 | `package-lock.json`                                                          |
| AUD-09  | Variantes 640/1280 y `srcset` (con fallback)                    | `storage.ts`, `mascotas.ts`, 8 componentes/páginas                           |
| AUD-11  | Visor de auditoría y autor correcto                             | migración, `lib/admin.ts`, `admin/index.astro`, test                         |
| AUD-19b | 3 tests de contratos de API                                     | `src/lib/apiContratos.test.ts`                                               |
| AUD-07  | Benchmark 1k local: p95 170 ms API / 57 ms página               | `scripts/seed-1k.sql`, `scripts/perf.mjs`                                    |

Verificación ejecutada tras los cambios:

| Comando                         | Resultado                                                         |
| ------------------------------- | ----------------------------------------------------------------- |
| `npm run format:check`          | ✅ 0 diferencias                                                  |
| `npm run lint`                  | ✅ 0 errores                                                      |
| `npm run check`                 | ✅ 0 errores, 18 hints                                            |
| `npm test`                      | ✅ 186/186 en 33 archivos                                         |
| `npm run test:coverage`         | ✅ 68,34 / 59,86 / 66,66 / 72,06 (stmts / ramas / funcs / líneas) |
| `npm run build`                 | ✅ SSR Vercel + sitemap                                           |
| Build con Node 24.13.0          | ✅ sin el aviso de Vercel sobre la versión local                  |
| CSP en build local              | ✅ 7 rutas públicas sin `securitypolicyviolation`                 |
| SQL de avisos (PostgreSQL 17)   | ✅ 6 escenarios con stubs de auth/vault/net                       |
| E2E público contra producción   | ✅ 32/32 tras actualizar Playwright                               |
| E2E de flujo (Supabase local)   | ✅ 11/11 con 1k; incluye chat, aprobación y reporte               |
| Suspender/reactivar + auditoría | ✅ 200; actor = admin y objetivo en `datos_nuevos`                |
| `pg_net` contra Resend          | ✅ 7 intentos, 401 de clave falsa (plumbing verificado)           |
| Benchmark 1k                    | ✅ p95 170 ms API / 57 ms `/explorar`                             |

**Correcciones encontradas al probar contra Supabase local:** `estado_cuenta` usaba
`WHERE id` (ambiguo con el OUT `id`) y el aviso de aprobación comparaba el enum
`estado_solicitud` con texto. Ambos bugs se corrigieron en las migraciones y se
volvieron a aplicar; el flujo 11/11 y la suspensión con auditoría pasaron después.
| `npm audit --audit-level=high` | ✅ 0 vulnerabilidades |

Queda pendiente el run real de CI (AUD-15), el backfill de variantes de fotos antiguas
(AUD-09) y los archivos de skills sin commitear (AUD-18).

---

**Conclusión:** el proyecto está listo para demostrar el producto y sostener el piloto,
pero no para declarar la entrega cerrada: falta el piloto y el acta. El bloque fácil, todo
el medio y los difíciles están cerrados; OAuth quedó fuera de alcance por decisión del
equipo, las migraciones están aplicadas en cloud, el secreto de Resend existe y solo
quedan el piloto, el backfill de fotos antiguas y la rotación de credenciales.
