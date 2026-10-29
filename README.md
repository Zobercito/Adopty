# Adopty

**Plataforma web de adopción de mascotas en Panamá.**

Adopty conecta a personas que quieren adoptar con organizaciones y rescatistas.
Reúne perfiles, búsqueda con filtros, afinidad por estilo de vida, solicitudes y
mensajería en un solo lugar, sin exponer el número personal de nadie.

[**Ver la aplicación →**](https://adopty.lat) · [Guion de demo](docs/GUION_DEMO.md) · [Arquitectura](#arquitectura)

[![CI](https://github.com/Zobercito/Adopty/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Zobercito/Adopty/actions/workflows/ci.yml)
[![Licencia: MIT](https://img.shields.io/badge/licencia-MIT-green.svg)](LICENSE)

![Búsqueda de mascotas en Adopty](docs/screenshots/explorar.png)

![Recorrido: portada, explorar, filtro por especie y ficha de la mascota](docs/screenshots/demo.gif)

## Estado del proyecto

|                    |                                                                                   |
| ------------------ | --------------------------------------------------------------------------------- |
| **Producción**     | <https://adopty.lat> — Vercel + Supabase cloud                                    |
| **Estado**         | Piloto académico. No es un servicio oficial y no tiene SLA ni soporte 24/7        |
| **Datos**          | Las mascotas visibles son datos de demostración; no representan adopciones reales |
| **Google OAuth**   | Pendiente. El registro y el acceso por correo funcionan al 100 %                  |
| **Observabilidad** | Sentry, Vercel Analytics y workflow de uptime                                     |
| **Limitaciones**   | [Ver sección](#limitaciones-conocidas)                                            |

## Funcionalidades

- **Búsqueda y filtros** por especie, tamaño, sexo, ubicación y edad, con la búsqueda
  guardada en la URL para compartirla.
- **Perfiles de los dos lados**: adoptantes, rescatistas y organizaciones verificadas.
- **Afinidad 0–100** calculada con el estilo de vida del adoptante (ambiente, niños,
  otras mascotas, energía, especie, edad y zona).
- **Publicación y gestión de mascotas** con fotos optimizadas a WebP.
- **Solicitudes de adopción** con estados y transiciones controladas.
- **Mensajería interna**; el chat solo se abre cuando una solicitud está aprobada.
- **Favoritos** para volver a una mascota más tarde.
- **Verificación de organizaciones, reportes, moderación y administración.**
- **Privacidad por diseño**: RLS en PostgreSQL y RPC para los datos sensibles.
- **Control de la cuenta**: exportar los datos en JSON y darse de baja con anonimización.

## Recorrido de demo (2–3 minutos)

1. Abre `/explorar` y filtra por especie, tamaño o zona; la URL guarda la búsqueda.
2. Entra en una ficha y revisa la compatibilidad con el estilo de vida.
3. Crea una cuenta desde `/register` y confirma el correo.
4. Completa el perfil y el estilo de vida en `/perfil`.
5. Envía una solicitud desde la ficha de una mascota.
6. Revisa `/mis-solicitudes` y el panel del publicador en `/panel`.
7. Abre el chat cuando la solicitud esté aprobada.
8. Entra como organización para ver la gestión de mascotas o como admin en `/admin`.

El guion completo de sustentación está en [`docs/GUION_DEMO.md`](docs/GUION_DEMO.md).
El GIF del README se regenera con `node scripts/grabar-demo.mjs` contra el servidor local.

## Cómo probarlo

### En producción

Entra en <https://adopty.lat>, crea una cuenta desde `/register` y confirma el correo.
Puedes explorar y filtrar sin cuenta; para solicitar, guardar favoritos o escribir
mensajes hace falta iniciar sesión.

### En local

**Requisitos**

| Herramienta  | Versión o requisito                               |
| ------------ | ------------------------------------------------- |
| Node.js      | `>=22.23.4` (definido en `engines`)               |
| npm          | 10+ (lockfile v3)                                 |
| Supabase CLI | 2.x (`supabase@^2.122.0` en `devDependencies`)    |
| Docker       | Necesario para `supabase start`                   |
| Git          | Versión reciente                                  |
| Chromium     | `npx playwright install chromium` (solo para e2e) |

```sh
git clone https://github.com/Zobercito/Adopty.git
cd Adopty
cp .env.example .env
npm install
supabase start        # API 54321 · DB 54322 · Studio 54323 · Inbucket 54324
supabase db reset     # aplica las migraciones
npm run dev           # http://localhost:4321
```

> **El seed no corre por defecto.** `[db.seed] enabled = false` en
> `supabase/config.toml` para que un `db push` contra la nube no cree usuarios demo.
> Para cargar las 30 mascotas y los 2 publicadores en local, elige una opción:
>
> ```sh
> # A) habilitar el seed solo en local y resetear
> #    [db.seed] enabled = true  ·  sql_paths = ["./seed.sql"]
> supabase db reset
>
> # B) ejecutarlo a mano contra la base local
> psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/seed.sql
> ```

**Variables de entorno**

| Variable                          | Dónde              | Descripción                                                           |
| --------------------------------- | ------------------ | --------------------------------------------------------------------- |
| `PUBLIC_SUPABASE_URL`             | cliente + servidor | URL del proyecto Supabase                                             |
| `PUBLIC_SUPABASE_ANON_KEY`        | cliente + servidor | anon key (RLS la protege)                                             |
| `SUPABASE_SERVICE_ROLE_KEY`       | solo servidor      | Reservada y sin uso: todo pasa por RLS                                |
| `SITE_URL`                        | build              | Dominio de producción para sitemap y metadatos (`https://adopty.lat`) |
| `SENTRY_DSN`                      | solo servidor      | Errores SSR/API. Sin valor, Sentry queda apagado                      |
| `PUBLIC_SENTRY_DSN`               | cliente + servidor | Errores del navegador; el DSN es público por diseño                   |
| `PUBLIC_GOOGLE_ENABLED`           | cliente            | `true` solo si el provider de Google está configurado                 |
| `SUPABASE_AUTH_EXTERNAL_GOOGLE_*` | Supabase           | Credencial OAuth de Google (pendiente)                                |

### Cuentas demo

El seed crea dos publicadores de demostración, pero **sus contraseñas no están en el
repositorio**: se generan aleatorias y no sirven para entrar. Si necesitas usarlas en
local, fija una clave a mano:

```sql
UPDATE auth.users
SET encrypted_password = crypt('<nueva-clave>', gen_salt('bf'))
WHERE email = 'patitas@adopty.pa';
```

| Usuario                | Rol                     |
| ---------------------- | ----------------------- |
| `patitas@adopty.pa`    | Organización verificada |
| `rescatista@adopty.pa` | Persona / rescatista    |

> No publiques credenciales reales ni secretos de servicios. Cualquier clave que haya
> estado en un entorno compartido debe rotarse.

### Comandos frecuentes

| Propósito                                   | Comando                                                   |
| ------------------------------------------- | --------------------------------------------------------- |
| Desarrollo                                  | `npm run dev`                                             |
| Validación                                  | `npm run format:check` · `npm run lint` · `npm run check` |
| Tests unitarios                             | `npm test` · `npm run test:coverage`                      |
| E2E públicos (solo lectura)                 | `npm run test:e2e`                                        |
| E2E de flujo (escribe; solo Supabase local) | `npm run test:e2e:flujo`                                  |
| Build de producción                         | `npm run build`                                           |
| Reset de base local                         | `supabase db reset`                                       |
| Rendimiento de búsqueda                     | `node scripts/perf.mjs [base]`                            |

## Arquitectura

```mermaid
flowchart TD
  U[Usuario / navegador] --> A[Astro v7 · SSR en Vercel]
  A --> P[Páginas y componentes]
  A --> E[Endpoints /api]
  A --> Z[Validación Zod en servidor]
  A --> S[Cliente Supabase SSR]
  S --> AU[Supabase Auth]
  S --> DB[(PostgreSQL + RLS + RPC)]
  S --> ST[Storage · mascotas y perfiles]
  S --> RT[Realtime · mensajes]
  A --> SE[Sentry]
  GH[GitHub Actions] --> CI[CI · backups · uptime]
  GH --> R2[Cloudflare R2]
```

### Decisiones técnicas

1. **RLS como única frontera de seguridad.** La autorización vive en PostgreSQL, no en
   la interfaz. No se usa `service role`: todas las consultas llevan la sesión del
   usuario y las policies deciden qué puede leer o escribir. Así, un fallo de UI no
   abre datos por sí solo.
2. **RPC para datos sensibles.** `perfil_publico` devuelve solo los campos que pueden
   mostrarse y `resumen_adoptantes` exige que exista una solicitud previa. La ficha del
   adoptante no se abre por ocultar un botón, sino porque la función SQL no devuelve
   nada si no hay permiso.
3. **Astro con SSR y endpoints server-side.** Las páginas públicas se renderizan en el
   servidor y las operaciones autenticadas pasan por `/api/*`, donde se valida con Zod
   antes de tocar la base. Todo se despliega como una sola aplicación en Vercel.
4. **Reglas de negocio en dos capas.** Las transiciones de solicitudes, mensajes y
   mascotas se validan en la API **y** en triggers/policies de PostgreSQL. Si se cambia
   una regla, hay que actualizar ambas o el bypass por REST queda abierto.

Más detalle en [`docs/DECISIONES.md`](docs/DECISIONES.md) y
[`docs/DFD.md`](docs/DFD.md).

## Stack

| Capa           | Tecnología                                     |
| -------------- | ---------------------------------------------- |
| Frontend       | Astro v7, TypeScript strict, Tailwind CSS v4   |
| Backend        | Endpoints de Astro (SSR), Zod                  |
| Datos y auth   | Supabase: PostgreSQL, Auth, Storage y Realtime |
| Tests          | vitest (unitarios) y Playwright (e2e)          |
| Despliegue     | Vercel                                         |
| Observabilidad | Sentry, Vercel Analytics y GitHub Actions      |

## Tests

Medido el **2026-10-29**:

| Suite                                   | Resultado                                                          |
| --------------------------------------- | ------------------------------------------------------------------ |
| Unitarios (`npm test`)                  | vitest: dominio, validación Zod, transiciones, RLS y contratos SQL |
| E2E públicos (`npm run test:e2e`)       | 32 tests, solo lectura                                             |
| E2E de flujo (`npm run test:e2e:flujo`) | Registro → publicar → solicitar → aprobar → chat → reportar        |

La suite pública se puede correr contra producción:

```sh
E2E_BASE_URL=https://adopty.lat npm run test:e2e
```

La suite de flujo **escribe datos** y solo debe apuntar a Supabase local con
`E2E_FLUJO=1`. El CI la ejecuta en el job `e2e`.

## Rutas

- **Públicas:** `/`, `/explorar?...` (filtros en URL y skeletons), `/mascota/[id]`,
  `/login`, `/register`, `/recuperar`, `/terminos`, `/privacidad`, `/offline`, `/404`,
  `/500`.
- **Privadas** (`?next=` al volver): `/perfil`, `/favoritos`, `/mis-solicitudes`,
  `/panel`, `/panel/solicitudes`, `/panel/adoptante/[id]`, `/mensajes`,
  `/mascota/nueva`, `/mascota/[id]/editar`, `/admin` (solo administradores).
- **API:** `/api/auth/*`, `/api/perfil`, `/api/mis-datos`, `/api/cuenta/*`,
  `/api/estilo-de-vida`, `/api/favoritos`, `/api/mascotas*`, `/api/solicitudes*`,
  `/api/mensajes*`, `/api/reportes`, `/api/verificacion`, `/api/admin/*`
  (colección en `postman/adopty.json`).
- **SEO:** `/robots.txt`, `/sitemap-index.xml` (estático) y `/sitemap-mascotas.xml`
  (SSR, solo fichas `disponible` no borradas).

## Estructura

```text
src/pages/*.astro             # páginas públicas y privadas (SSR)
src/pages/api/**/*.ts         # endpoints; validan con Zod y responden JSON
src/components/               # Navbar, PetCard, Badge, FavButton, PetForm, chat…
src/lib/                      # dominio y helpers (mascotas, solicitudes, match,
                              # storage, ratelimit, admin, auditoría, seo…)
src/lib/validation/           # esquemas Zod compartidos
src/data/mockPets.ts          # fallback del hero si la base está vacía
e2e/{publico,flujo}.e2e.ts    # Playwright
supabase/migrations/*.sql     # migraciones: schema, RLS, storage, RPC,
                              # auditoría, moderación, admin, cuenta y triggers
supabase/seed.sql             # 2 publicadores + 30 mascotas (solo local)
vercel.json                   # headers de seguridad (HSTS, CSP Report-Only…)
docs/                         # arquitectura, operación, QA y runbooks
postman/adopty.json           # colección de la API
scripts/                      # backup, rendimiento y generación de iconos
```

## Seguridad y privacidad

- **RLS activa en las 14 tablas** y sin `service role` en el servidor.
- **Validación Zod en servidor** para toda mutación; el cliente solo replica mensajes.
- **Borrado lógico** (`deleted_at`) en mascotas; las cuentas se suspenden o anonimizan
  y los mensajes se conservan para la otra parte.
- **Rate limiting distribuido** con la RPC `consumir_rate_limit`, con fallback en memoria.
- **Storage endurecido**: rutas `userId/uuid.webp`, límite de tamaño y carpeta del dueño.
- **Sin PII en analytics, JSON-LD ni logs.**
- **Baja de cuenta** con anonimización, borrado de la foto de perfil y conservación de
  los mensajes para la otra parte.

Si encuentras una vulnerabilidad, no abras un issue público: escribe a los responsables
del repositorio.

## Limitaciones conocidas

- **No hay 2FA** ni verificación con cédula/documento por decisión de privacidad.
- **Google OAuth está pendiente**; el acceso por correo funciona.
- **La revocación de sesiones no es inmediata**: el middleware corta en la petición
  siguiente al detectar `usuarios.activo = false`.
- **La CSP está en Report-Only** por los scripts inline de Astro. Pasar a enforcing
  requiere nonces/hashes y validarlo en un preview.
- **Las fotos de producción pueden ser de muestra**: muchas mascotas del piloto no
  tienen foto propia.
- **El estado `adoptada` es terminal**: la API responde 409 y la UI deshabilita el
  selector.
- **El proyecto no tiene SLA**: es un piloto académico, no un servicio oficial.

Estas limitaciones están documentadas a propósito: un proyecto de portafolio gana más
mostrando lo que falta que escondiéndolo.

## Qué demuestra este proyecto

- Diseño y despliegue de una aplicación **fullstack real**, no un mockup.
- **Autorización en la base de datos** con RLS, RPC y triggers, no solo en la UI.
- **Modelado de flujos de negocio**: solicitudes, transiciones, chat y moderación.
- **Pruebas en tres niveles**: unitarias, de contrato SQL/RLS y e2e.
- **Observabilidad y operación**: Sentry, backups verificados, uptime y presupuesto de
  rendimiento.
- **Mantenimiento de un servicio en producción** con datos de demostración.

## Contribución

Ramas `main` (producción), `develop` (integración) y `feature/*`. Commits
`feat:/fix:/docs:/chore:`. Un PR debe pasar `lint`, `format:check`, `check`, `test` y
`build`, además del flujo e2e que corre el CI. Revisa también que no haya
vulnerabilidades altas (`npm audit`), que la RLS esté considerada y que toda mutación
valide con Zod en el servidor.

Antes de dar un cambio por terminado:

```sh
npm run format:check && npm run lint && npm run check && npm test && npm run build
```

## Documentación

| Documento                                                       | Contenido                                           |
| --------------------------------------------------------------- | --------------------------------------------------- |
| [`docs/OPERACION.md`](docs/OPERACION.md)                        | Despliegue, backups, restauración, CSP e incidentes |
| [`docs/ADMIN.md`](docs/ADMIN.md)                                | Alta de administradores y moderación                |
| [`docs/DECISIONES.md`](docs/DECISIONES.md)                      | ADRs y consecuencias                                |
| [`docs/AUDITORIA_PENDIENTES.md`](docs/AUDITORIA_PENDIENTES.md)  | Hallazgos, prioridades y roadmap                    |
| [`docs/QA.md`](docs/QA.md)                                      | Último informe de calidad y diferidos               |
| [`docs/DFD.md`](docs/DFD.md) · [`docs/DER.dbml`](docs/DER.dbml) | Diagramas de flujo y modelo de datos                |
| [`docs/DICCIONARIO.md`](docs/DICCIONARIO.md)                    | Diccionario de datos                                |
| [`docs/GUION_DEMO.md`](docs/GUION_DEMO.md)                      | Recorrido de demo de 7 minutos                      |
| [`docs/PILOTO.md`](docs/PILOTO.md)                              | Runbook del piloto con refugios                     |
| [`docs/CHECKLIST.md`](docs/CHECKLIST.md)                        | Checklist pre-producción                            |
| [`docs/ACTA_ENTREGA.md`](docs/ACTA_ENTREGA.md)                  | Alcance y aceptación del piloto                     |

## Equipo

Francisco Gonzalez · Eira Arrocha — Ingeniería de Software II, Prof. Leovigildo Bosquez
Barria.

## Licencia

[MIT](LICENSE). El nombre «Adopty», el logotipo y la identidad visual no están
cubiertos por la licencia.
