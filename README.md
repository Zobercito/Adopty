# Adopty — Fase 0 (Astro base + mock)

Plataforma web centralizada de adopción de mascotas en Panamá. Plan completo en `../PLAN_DESARROLLO_ADOPTY.md`.

## Stack
Astro v7 + TypeScript strict + Tailwind CSS v4 + (Fase 1: Supabase) + Vercel.

> Nota: el plan pedía Astro v4; se scaffoldó con la última estable (v7) — misma arquitectura Islands.

## Correr (Fase 0)
```sh
cd adopty
npm install --min-release-age=0   # el registry del entorno exige este flag por min-release-age=7
npm run dev        # http://localhost:4321
npm run build      # build estático verde = criterio de aceptación Fase 0
```

Rutas: `/` (hero + destacadas), `/explorar?especie=perro&q=luna&tamano=Pequeño` (filtros por URL, datos de `src/data/mockPets.ts`).

## Estructura
```
src/pages/{index,explorar}.astro
src/components/{Navbar,PetCard,Badge}.astro
src/layouts/Layout.astro
src/data/mockPets.ts   # temporal, se reemplaza por Supabase en Fase 1
src/styles/global.css  # tokens portados de adopty-mockup/css/extras.css
public/assets/         # fotos + logo copiados del mockup
supabase/migrations/   # (Fase 1: 001_schema.sql, 002_rls.sql, 003_storage.sql)
```

## Equipo
Francisco Gonzalez · Eira Arrocha — Ing. Software II, Prof. Leovigildo Bosquez Barria.
