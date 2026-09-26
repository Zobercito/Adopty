# Adopty — Fase 0–7 (base + Auth + CRUD + búsqueda + solicitudes + mensajería + panel + QA)

Plataforma web centralizada de adopción de mascotas en Panamá. Plan completo en `../PLAN_DESARROLLO_ADOPTY.md`.

## Stack

Astro v7 + TypeScript strict + Tailwind CSS v4 + Supabase (Postgres + Auth + Storage) + Vercel.

> Nota: el plan pedía Astro v4; se scaffoldó con la última estable (v7) — misma arquitectura Islands.

## Correr (Fase 0 + 1)

```sh
cd adopty
cp .env.example .env   # llena PUBLIC_SUPABASE_URL / ANON_KEY (supabase start → 127.0.0.1:54321)
npm install
npm run dev        # http://localhost:4321
npm run build      # verde = criterio Fase 0
npm run lint       # ESLint plano sin plugins (Fase 0)
npm run format:check
npm test           # vitest: Zod + transiciones + helpers (Fase 7, 36 tests)
```

Supabase local:

```sh
supabase start   # API 54321 · DB 54322 · Studio 54323 · Inbucket 54324
supabase db reset  # aplica migrations + seed.sql (30 mascotas, 2 usuarios demo: patitas@adopty.pa / rescatista@adopty.pa / Adopty123!)
```

Rutas: `/` (hero + destacadas desde DB con fallback demo), `/explorar?especie=gato&tamano=Pequeño&q=bethania&orden=recientes&page=1` (SSR + refetch con skeletons),
`/mascota/[id]` (carrusel accesible + publicador + disclaimer legal), `/mascota/nueva`, `/mascota/[id]/editar` (con soft-delete),
`/login`, `/register` (email + botón Google → `/api/auth/google`), `/recuperar`, `/perfil` (editable persona/org),
`/favoritos` (DB + migración `adopty_favs` localStorage), `/mensajes` (bandeja + chat Realtime por mascota, requiere solicitud aprobada), `/mis-solicitudes`, `/panel/solicitudes`, `/panel` (agregados + gestión: estado/editar/eliminar),
`/api/auth/*`, `/api/favoritos`, `/api/perfil`, `/api/mascotas*`, `/api/solicitudes*`, `/api/mensajes*`.

Google OAuth: **quedó decidido (24 sep) posponerlo al final (F8)** — el código ya existe (`/api/auth/google` + botones + `config.toml`), solo faltará activar credencial Google Cloud → Supabase → redirects de prod. Hasta entonces el botón muestra `/login?error=oauth` y el correo funciona 100%.

## Estructura

```
src/pages/{index,explorar,login,register,recuperar,perfil,favoritos,404}.astro
src/pages/api/{perfil,favoritos,auth/{login,register,logout,callback,recuperar,google}}.ts
src/components/{Navbar,PetCard,Badge,FavButton}.astro
src/lib/{supabase.ts,validation/user.ts}
src/data/mockPets.ts   # temporal, se reemplaza por Supabase en Fase 2/3
supabase/{migrations/001_schema+002_rls+003_storage.sql,seed.sql}
```

## Equipo

Francisco Gonzalez · Eira Arrocha — Ing. Software II, Prof. Leovigildo Bosquez Barria.
