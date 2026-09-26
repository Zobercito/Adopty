# Adopty — Plataforma de adopción de mascotas en Panamá

Plataforma web centralizada de adopción: perfiles estructurados, búsqueda precisa y
comunicación directa sin exponer el número personal. Plan completo en
`../PLAN_DESARROLLO_ADOPTY.md` · Informes: `docs/` · QA: `docs/QA.md`.

**Stack:** Astro v7 + TypeScript strict + Tailwind CSS v4 + Supabase
(Postgres + Auth + Storage + Realtime) + Zod + Vercel + vitest.

> El plan pedía Astro v4; se usó la última estable (v7), misma arquitectura Islands.

## Instalación

```sh
cd adopty
cp .env.example .env   # ver tabla de variables abajo
npm install            # si el registry exige min-release-age: npm install --min-release-age=0
supabase start         # solo dev local: API 54321 · DB 54322 · Studio 54323 · Inbucket 54324
supabase db reset      # migraciones + seed (30 mascotas + 2 usuarios demo)
npm run dev            # http://localhost:4321
```

| Script                                  | Qué hace                                        |
| --------------------------------------- | ----------------------------------------------- |
| `npm run dev`                           | servidor desarrollo                             |
| `npm run build`                         | build prod (Vercel)                             |
| `npm test`                              | vitest, 36 tests (Zod + transiciones + helpers) |
| `npm run lint` / `npm run format:check` | ESLint + Prettier                               |
| `node scripts/perf.mjs [base]`          | perf smoke búsqueda (criterio p95 < 1 s)        |

## Variables de entorno

| Variable                          | Dónde                  | Descripción                                                    |
| --------------------------------- | ---------------------- | -------------------------------------------------------------- |
| `PUBLIC_SUPABASE_URL`             | cliente+server         | URL del proyecto Supabase                                      |
| `PUBLIC_SUPABASE_ANON_KEY`        | cliente+server         | anon key (RLS la protege)                                      |
| `SUPABASE_SERVICE_ROLE_KEY`       | **solo server/Vercel** | (reservada, hoy sin uso: todo pasa por RLS)                    |
| `SITE_URL`                        | build                  | dominio prod para el sitemap (Fase 8)                          |
| `SUPABASE_AUTH_EXTERNAL_GOOGLE_*` | Supabase               | **F8/pendiente**: credencial OAuth Google (ver `.env.example`) |

## Seed y cuentas demo (SOLO piloto — rotar antes de producción)

```sh
supabase db reset   # local · En cloud: pegar supabase/seed.sql en SQL Editor
```

| Usuario                | Clave        | Rol                     |
| ---------------------- | ------------ | ----------------------- |
| `patitas@adopty.pa`    | `Adopty123!` | Organización verificada |
| `rescatista@adopty.pa` | `Adopty123!` | Persona                 |

> ⚠️ El seed inserta filas en `auth.users` con **todos los tokens en `''`** (GoTrue falla con NULL:
> `500 Database error querying schema`). Si editas el seed, respeta esa regla.

## Rutas

- Públicas: `/`, `/explorar?...` (filtros en URL + skeletons), `/mascota/[id]`,
  `/login`, `/register`, `/recuperar`, `/terminos`, `/privacidad`, `/404`, `/500`.
- Privadas (`?next=` al volver): `/perfil`, `/favoritos`, `/mis-solicitudes`,
  `/panel`, `/panel/solicitudes`, `/mensajes`, `/mascota/nueva`, `/mascota/[id]/editar`.
- API: `/api/auth/*`, `/api/perfil`, `/api/favoritos`, `/api/mascotas*`,
  `/api/solicitudes*`, `/api/mensajes*` (colección en `postman/adopty.json`).

## Estructura

```
src/pages/{index,explorar,mascota/[id],mascota/nueva,mascota/[id]/editar,
  panel,panel/solicitudes,mensajes,mis-solicitudes,favoritos,
  login,register,recuperar,perfil,terminos,privacidad,404,500}.astro
src/pages/api/{perfil,favoritos,mascotas/,solicitudes/,mensajes/,auth/}.ts
src/components/{Navbar,PetCard,Badge,FavButton,PetForm,MessageThread,ChatView}.astro
src/lib/{supabase,mascotas,solicitudes,panel,storage,transiciones,ratelimit}.ts
src/lib/validation/{user,pet,request,message}.ts (+ *.test.ts)
src/data/mockPets.ts          # fallback del hero si la DB está vacía
supabase/migrations/*.sql     # 001 schema · 002 RLS · 003 storage · 004 RPC aprobar · 005 RLS aprobada
supabase/seed.sql             # 2 usuarios + 30 mascotas
postman/adopty.json · scripts/perf.mjs · docs/
```

## Contribución (Git Flow)

Ramas `main` (prod) · `develop` (integración) · `feature/*`. Commits
`feat:/fix:/docs:/chore:`. PR con checklist: `build`+`lint`+`format:check`+`test`
verdes (los corre el CI), RLS considerada, Zod en servidor, responsive 320–1440.

## Deploy (Fase 8)

1. Vercel → importa el repo, rama prod `main`; env vars `PUBLIC_SUPABASE_URL`,
   `PUBLIC_SUPABASE_ANON_KEY` (+ `SITE_URL` con el dominio final).
2. Supabase Dashboard → Auth → URL Configuration: Site URL + Redirects del dominio
   (`/api/auth/callback`); confirma bucket `mascotas` público y Realtime en `mensajes`.
3. **Pendiente decidido**: Google OAuth (crear credencial en Google Cloud → Providers →
   ON → redirects). Hasta entonces el botón muestra aviso y el correo funciona 100%.

## Equipo

Francisco Gonzalez · Eira Arrocha — Ing. Software II, Prof. Leovigildo Bosquez Barria.
