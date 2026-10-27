# AGENTS.md — Adopty

Guía operativa para agentes de IA que trabajen en este repositorio. El contexto
funcional completo está en `README.md`; el estado y la deuda técnica, en
`docs/AUDITORIA_PENDIENTES.md`; las decisiones de arquitectura, en
`docs/DECISIONES.md`.

## Contexto

Plataforma de adopción de mascotas en Panamá. Astro v7 (SSR en Vercel) +
TypeScript strict + Tailwind v4 + Supabase (Postgres, Auth, Storage, Realtime) +
Zod + vitest + Playwright.

## Comandos

```sh
npm run dev              # http://localhost:4321
npm run build            # build de producción
npm run lint             # ESLint
npm run format:check     # Prettier
npm run check            # tipos TS/Astro (astro check)
npm test                 # vitest
npm run test:e2e         # Playwright público, solo lectura
npm run test:e2e:flujo   # flujo completo; escribe datos
```

Antes de dar por terminado un cambio, ejecuta como mínimo:

```sh
npm run format:check && npm run lint && npm run check && npm test && npm run build
```

Si tocaste PWA, revisa también `node --check public/sw.js`.

## Estructura

- `src/pages/*.astro` — páginas (la mayoría `prerender = false`).
- `src/pages/api/**/*.ts` — endpoints; validan con Zod y responden JSON.
- `src/lib/` — lógica de dominio y helpers (`supabase`, `mascotas`,
  `solicitudes`, `match`, `storage`, `ratelimit`, `redirect`, `seo`…).
- `src/lib/validation/` — esquemas Zod compartidos.
- `src/components/` — UI Astro; scripts inline cuando la interacción es local.
- `supabase/migrations/*.sql` — esquema, RLS, RPC, Storage y triggers.
- `supabase/seed.sql` — datos demo (solo local/piloto).
- `e2e/` — Playwright; `publico.e2e.ts` no escribe, `flujo.e2e.ts` sí.
- `public/sw.js` — service worker; nunca cachear rutas privadas ni API.

## Reglas no negociables

1. **RLS es la frontera de seguridad.** No uses `SUPABASE_SERVICE_ROLE_KEY` para
   “hacer que funcione”. Las policies y RPC son la autorización real.
2. **Toda mutación valida en servidor con Zod.** No confíes en la validación del
   formulario ni en tipos del cliente.
3. **Borrado lógico.** Usa `deleted_at`; no hagas `DELETE` de mascotas, cuentas ni
   mensajes salvo que una RPC documentada lo haga.
4. **Migraciones con timestamp** (`YYYYMMDDHHMMSS_descripcion.sql`). Si aplicas
   una a mano en la nube, regístrala en `supabase_migrations.schema_migrations`.
5. **Seed:** los tokens de `auth.users` deben ser `''`, nunca `NULL` (GoTrue
   responde `500 Database error querying schema`).
6. **Nunca commitees** `.env`, `.env.db`, `backups/`, credenciales ni claves.
7. **E2E de flujo solo contra Supabase local** y con `E2E_FLUJO=1`; crea cuentas
   y mascotas por corrida. No lo apuntes a la nube.
8. **No publiques PII** en analytics, JSON-LD ni logs. Para analytics usa solo IDs
   de mascota/evento, no correos, teléfonos ni nombres.
9. **No dejes rutas privadas en el sitemap ni en la caché del service worker.**

## Convenciones

- UI y textos de dominio en español; identificadores y tipos en español cuando
  ya siguen esa convención (`MascotaRow`, `id_mascota`).
- TypeScript estricto: evita `any`; usa `unknown` y estrecha con Zod.
- Tailwind para estilos; reutiliza clases y componentes existentes antes de
  crear utilidades nuevas.
- Comentarios solo para explicar el “por qué” (invariantes, workarounds, límites).
- No agregues dependencias ni abstracciones si la tarea no las requiere.
- Mantén el formato de Prettier; no reformatees archivos ajenos al cambio.
- Los scripts inline de Astro no pueden importar; usa `define:vars` o expón
  helpers en `window` (p. ej. `window.adoptyTrack`).

## Flujo de trabajo

1. Lee `docs/AUDITORIA_PENDIENTES.md` y el código afectado antes de editar.
2. Verifica el estado de Git; no descartes cambios ajenos sin revisarlos.
3. Haz cambios pequeños y enfocados; añade o ajusta tests unitarios/e2e.
4. Ejecuta la verificación completa del apartado anterior.
5. Actualiza la documentación afectada (`README.md`, `docs/…`, este archivo).
6. No hagas commit, push, deploy ni tag sin que el usuario lo pida.

## Gotchas

- `astro check` es la única verificación de tipos; ESLint no analiza `.astro`.
- Las rutas de fotos válidas son `userId/uuid.webp`; no aceptes URLs externas en
  `fotos`/`fotos_new`.
- El chat exige solicitud `aprobada`; el publicador elige destinatario si hay más
  de uno.
- La baja de cuenta se bloquea con una adopción aprobada sin resolver; los
  mensajes se conservan y el nombre se anonimiza. La foto/logo del bucket
  `perfiles` se borra antes de cerrar la sesión (la policy exige `auth.uid()`).
- El estado `adoptada` de una mascota es terminal: la API devuelve 409 y la UI
  deshabilita el selector. No añadir atajos que lo reabran.
- El rate-limit actual es en memoria y no se comparte entre instancias.
- El service worker debe ignorar `/api`, `/panel`, `/admin`, `/perfil`,
  `/mensajes`, `/favoritos`, `/mis-solicitudes` y cualquier navegación privada.
- `SITE_URL` define el dominio del sitemap y de los metadatos absolutos; en local
  se usa el fallback de `astro.config.mjs`. El sitemap de fichas es SSR
  (`/sitemap-mascotas.xml`) y se descubre por `robots.txt`.
- Los headers de seguridad viven en `vercel.json` para cubrir también estáticos y
  assets; no los muevas al middleware. La CSP está en Report-Only.
- Producción es `https://adopty.lat`; `www` redirige 308 al apex. El correo de Auth
  sale por Resend (`no-reply@adopty.lat`), no por el SMTP integrado de Supabase.
- La app valida disponibilidad/transiciones, pero las policies de `solicitudes`
  (P1-10) y `mensajes` (P1-11) todavía permiten saltárselas con REST directo. No
  asumas que RLS cubre esas reglas hasta que se cierren.

## Documentos de referencia

| Archivo                        | Contenido                                       |
| ------------------------------ | ----------------------------------------------- |
| `README.md`                    | Instalación, variables, rutas, operación.       |
| `docs/AUDITORIA_PENDIENTES.md` | Hallazgos, prioridades, roadmap y verificación. |
| `docs/DECISIONES.md`           | ADR resumidas y consecuencias.                  |
| `docs/QA.md`                   | Último informe de calidad y diferidos.          |
| `docs/ADMIN.md`                | Alta de administradores y moderación.           |
| `docs/ACTA_ENTREGA.md`         | Alcance y aceptación del piloto.                |
| `docs/CHECKLIST.md`            | Checklist pre-producción.                       |
