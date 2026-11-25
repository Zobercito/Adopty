# Estado actual

> Método: inspección del repositorio y de la base local · Fuente: código existente
> (auditoría del 2026-11-25 y verificación en Supabase local)

## Qué hay

- **Stack:** Astro 7 (SSR en Vercel) + TypeScript strict + Tailwind 4 + Supabase
  (Postgres, Auth, Storage, Realtime) + Zod + vitest + Playwright.
- **Arranque local:** `npx supabase start`, `npx supabase db reset`,
  `docker exec -i supabase_db_adopty psql -U postgres -d postgres < supabase/seed.sql`,
  `npm run dev` con las claves de `npx supabase status -o env`.
- **Base:** 35 migraciones; 14 tablas con RLS; RPC y triggers de negocio. El seed
  crea dos publicadores demo y 30 mascotas, pero **no crea ningún administrador**.
- **API:** 29 rutas en `src/pages/api/`; las mutaciones exigen sesión y validan con
  Zod. Existen endpoints para perfil, estilo de vida, favoritos, solicitudes,
  mensajes, reportes, verificación, administración, notificaciones, exportación de
  datos y baja de cuenta.
- **E2E existentes:** `e2e/publico.e2e.ts` (solo lectura, 32 casos) y
  `e2e/flujo.e2e.ts` (escrituras, 11 casos: persona publicador, adoptante y
  tercero). No cubren organización, admin, favoritos, baja, cambio de correo,
  exportación ni verificación.
- **Auth local:** `mailer_autoconfirm` está activo, así que el registro deja sesión
  al instante. En cloud está desactivado.

## Convenciones que se heredan

- Los e2e que escriben se activan con `E2E_FLUJO=1` y se niegan a correr si
  `PUBLIC_SUPABASE_URL` no es local.
- Cada contexto de `APIRequestContext` conserva su propia cookie de sesión.
- Los textos y nombres de dominio están en español.
- Prettier, ESLint y `astro check` son la verificación previa a cualquier commit.

## Deuda que condiciona el plan

- No hay administrador en el seed: hará falta un fixture local para probar admin.
- `pg_net` en local apunta a `api.resend.com` con una clave falsa y devuelve 401;
  las pruebas no deben depender de esa llamada.
- La confirmación de cambio de correo exige abrir un enlace; Inbucket/Mailpit local
  puede leerlo, pero no es obligatorio para el alcance.
- La batería escribe cuentas, mascotas y mensajes: solo puede correr contra local.

## Qué se conserva y qué se reescribe

Se conserva todo el código y los e2e actuales; se añade una suite nueva por roles
sin modificar los existentes. No se toca producción ni las migraciones.
