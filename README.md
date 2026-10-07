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

| Script                                  | Qué hace                                                   |
| --------------------------------------- | ---------------------------------------------------------- |
| `npm run dev`                           | servidor desarrollo                                        |
| `npm run build`                         | build prod (Vercel)                                        |
| `npm test`                              | vitest, 78 tests (Zod + afinidad + transiciones + helpers) |
| `npm run lint` / `npm run format:check` | ESLint + Prettier                                          |
| `node scripts/perf.mjs [base]`          | perf smoke búsqueda (criterio p95 < 1 s)                   |

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

Las cuentas de demostración **existen, pero su contraseña no está en el repositorio**:
los credenciales de prueba viven fuera del control de versiones.

| Usuario                | Rol                     |
| ---------------------- | ----------------------- |
| `patitas@adopty.pa`    | Organización verificada |
| `rescatista@adopty.pa` | Persona                 |

Para poder entrar durante una demo o revisión, pídele la clave a quien administra el
proyecto, o crea tu propia cuenta desde `/register` (funciona sin confirmación de correo).

> 🔐 **Por qué no está la clave aquí.** Con la clave publicada, cualquiera que lea el repo
> entra como organización _verificada_. Si necesitas regenerar el seed para un entorno
> nuevo, `supabase/seed.sql` usa `Adopty123!` como clave inicial **solo para uso local**:
> cámbiala antes de subirlo a ningún sitio.

> ⚠️ El seed inserta filas en `auth.users` con **todos los tokens en `''`** (GoTrue falla con NULL:
> `500 Database error querying schema`). Si editas el seed, respeta esa regla.
> Ese mismo `500` aparece si creas usuarios a mano sin rellenar las columnas generadas.

## Perfil del adoptante y cuenta

El perfil es de **dos lados**: quien adopta también responde por su hogar.

- **Datos del perfil** — nombre, foto, "sobre mí", experiencia con mascotas y
  "¿por qué quieres adoptar?". Una barra y un punto pulsante marcan lo que falta.
- **Estilo de vida** — alimenta el algoritmo de afinidad (`src/lib/match.ts`):
  ambiente, niños, otras mascotas, energía, especie/edad y zona.
- **Cuenta** — cambiar correo, descargar una copia de tus datos (JSON) y
  **dar de baja la cuenta**.

**La ficha del adoptante solo se abre si le envió una solicitud** al publicador:
la autorización está en PostgreSQL (RPC `resumen_adoptantes`), no en la interfaz.

**Qué pasa al darse de baja** (RPC `eliminar_mi_cuenta`): el nombre pasa a
«Usuario no disponible», se borran foto y textos, se despublican las mascotas
`disponible`, se cancelan las solicitudes `pendiente` y **los mensajes se
conservan** (la otra parte los sigue viendo). Si hay una adopción **aprobada** sin
resolver, la baja se bloquea hasta cerrarla.

Endpoints nuevos: `GET|PUT /api/perfil` (el `PUT` va con `FormData`),
`PUT /api/auth/cambiar-email`, `POST /api/cuenta/borrar`, `GET /api/mis-datos`,
`GET|PUT /api/estilo-de-vida`, `PATCH /api/admin/cuentas`.

### Privacidad: por qué hay funciones SQL

`personas` y `organizaciones` **no** se leen entre usuarios: la policy es
`auth.uid() = id` (y las organizaciones, además, `verificada`). Los datos que sí
se muestran (nombre, foto, badge, redes de una organización verificada) salen del
RPC `perfil_publico`, que devuelve solo campos seguros y anonimiza las cuentas dadas
de baja. Es lo que hace `/privacidad` cierto en lugar de prometerlo.

⚠️ **Dos policies se combinan con OR.** Por eso al restringirlas hubo que tirar
también `org_select USING (true)`, que venía de la migración original.

## Límites conocidos

- **No hay service role key** (a propósito: todo pasa por RLS). Consecuencia: la
  baja de cuenta es lógica y **no se pueden revocar al instante** las sesiones
  abiertas; se cierran en la petición siguiente (el middleware comprueba
  `usuarios.activo`).
- Sin **2FA** ni **cédula/documento** por decisión de privacidad.
- El **cambio de correo** depende de que en Supabase Auth esté activo _Secure
  email change_ y el dominio en la whitelist de _Redirect URLs_.
- Las fotos de mascota del entorno de nube son de muestra: muchas no tienen foto.

## Rutas

- Públicas: `/`, `/explorar?...` (filtros en URL + skeletons), `/mascota/[id]`,
  `/login`, `/register`, `/recuperar`, `/terminos`, `/privacidad`, `/404`, `/500`.
- Privadas (`?next=` al volver): `/perfil`, `/favoritos`, `/mis-solicitudes`,
  `/panel`, `/panel/solicitudes`, `/panel/adoptante/[id]`, `/mensajes`,
  `/mascota/nueva`, `/mascota/[id]/editar`.
- API: `/api/auth/*`, `/api/perfil`, `/api/favoritos`, `/api/mascotas*`,
  `/api/solicitudes*`, `/api/mensajes*` (colección en `postman/adopty.json`).

## Estructura

```
src/pages/{index,explorar,mascota/[id],mascota/nueva,mascota/[id]/editar,
  panel,panel/solicitudes,panel/adoptante/[id],mensajes,mis-solicitudes,favoritos,
  login,register,recuperar,perfil,terminos,privacidad,404,500}.astro
src/pages/api/{perfil,mis-datos,favoritos,mascotas/,solicitudes/,mensajes/,
  estilo-de-vida/,cuenta/,auth/,admin/}.ts
src/components/{Navbar,PetCard,Badge,FavButton,PetForm,MessageThread,ChatView}.astro
src/lib/{supabase,mascotas,solicitudes,panel,perfil,match,storage,transiciones,ratelimit,admin}.ts
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
   (`/api/auth/callback`); activa **Secure email change** (cambio de correo de la
   pestaña Cuenta); confirma buckets `mascotas` y `perfiles` públicos y Realtime en `mensajes`.
3. **Migraciones**: están en `supabase/migrations/` y ya aplicadas en la nube. Si
   añades una, aplícala (SQL Editor o `psql`) **y** anótala en
   `supabase_migrations.schema_migrations`, o el siguiente `db push` intentará
   reaplicarla.
4. **Pendiente decidido**: Google OAuth (crear credencial en Google Cloud → Providers →
   ON → redirects). Hasta entonces el botón muestra aviso y el correo funciona 100%.

## Equipo

Francisco Gonzalez · Eira Arrocha — Ing. Software II, Prof. Leovigildo Bosquez Barria.

## Operación

| Tarea                                | Cómo                                                                                                                                                                                            |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Backup de la BD**                  | Automático a las **3:00 a. m.** (workflow _Backup base de datos_). También a mano: pestaña _Actions → Run workflow_. Se guarda como artefacto 30 días. Alternativa local: `./scripts/backup.sh` |
| **Restaurar un backup**              | Descargar el artefacto → `gunzip -c adopty_*.sql.gz \| psql "$DATABASE_URL"`                                                                                                                    |
| **Regenerar iconos PWA**             | `node scripts/generar-iconos.mjs` (solo si cambia el logo)                                                                                                                                      |
| **Revisar decisiones de moderación** | Tabla `auditoria`, o la columna `accion` (`admin_reporte_ocultar`, `admin_verificacion_aprobar`, `suspender_cuenta`, `baja_cuenta`, `password_cambiada`…)                                       |
| **Suspender una cuenta**             | `/admin` → sección **Cuentas** → Suspender. Deja de entrar sin borrar nada (RPC `estado_cuenta`, deja rastro en `auditoria`).                                                                   |
| **Dar de alta un administrador**     | Ver [`docs/ADMIN.md`](docs/ADMIN.md)                                                                                                                                                            |

El backup usa el **connection pooler** de Supabase porque los runners de GitHub Actions
tienen IP dinámica y no llegan al host directo. El secreto `DATABASE_URL` ya está
configurado en el repositorio.
