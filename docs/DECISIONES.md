# Decisiones de arquitectura — Adopty

Registro corto de las decisiones que explican el diseño actual. Cada entrada
indica el contexto, la decisión, sus consecuencias y cuándo conviene revisarla.
Las tareas pendientes derivadas viven en `docs/AUDITORIA_PENDIENTES.md`.

## ADR-001 — Astro v7 en lugar de Astro v4

- **Fecha:** 2026-09.
- **Estado:** aceptada.
- **Contexto:** el plan académico pedía Astro v4; al iniciar el proyecto v7 era la
  versión estable.
- **Decisión:** usar Astro v7 con SSR en Vercel y las mismas ideas de Islands.
- **Consecuencias:** se aprovechan mejoras de rendimiento y del adaptador; alguna
  guía antigua puede no coincidir. Antes de migrar de versión mayor, revisar el
  adaptador `@astrojs/vercel` y los cambios de rutas/SSR.

## ADR-002 — RLS como única frontera de seguridad, sin service role

- **Fecha:** 2026-09.
- **Estado:** aceptada.
- **Contexto:** una clave service role en el servidor permitiría saltarse RLS y
  concentraría un secreto de alto impacto.
- **Decisión:** todas las consultas usan la sesión del usuario y las policies/RPC
  de PostgreSQL. `SUPABASE_SERVICE_ROLE_KEY` queda reservada y sin uso.
- **Consecuencias:** la autorización es auditable en la base; no hay revocación
  instantánea de sesiones (el middleware corta en la petición siguiente); ciertas
  operaciones administrativas requieren RPC específicas. No introducir service
  role para atajos.

## ADR-003 — Borrado lógico y baja de cuenta con RPC

- **Fecha:** 2026-10.
- **Estado:** aceptada.
- **Contexto:** las adopciones, solicitudes y mensajes necesitan historial; un
  `DELETE` en cascada rompería la trazabilidad y la conversación de la otra parte.
- **Decisión:** mascotas y cuentas usan `deleted_at`/anonimización. La baja se
  ejecuta con `eliminar_mi_cuenta`: anonimiza nombre y textos, despublica mascotas
  disponibles, cancela solicitudes pendientes y conserva mensajes. Se bloquea si
  hay una adopción aprobada sin resolver.
- **Consecuencias:** la API guarda la ruta de la foto/logo antes del RPC y borra el
  objeto de `perfiles` antes de cerrar la sesión (la política de Storage exige seguir
  autenticado). Las fotos de mascotas se conservan por restauración/historial. Las
  sesiones abiertas se cortan en la siguiente petición.

## ADR-004 — Privacidad de perfiles mediante RPC

- **Fecha:** 2026-10.
- **Estado:** aceptada.
- **Contexto:** `personas` y `organizaciones` contienen datos que no deben ser
  legibles entre usuarios; a la vez, la ficha pública necesita nombre, foto,
  badge y redes de organizaciones verificadas.
- **Decisión:** las tablas quedan restringidas a su dueño (y organizaciones
  verificadas); lo público se obtiene de `perfil_publico`, que devuelve solo
  campos seguros y anonimiza cuentas dadas de baja.
- **Consecuencias:** cualquier campo nuevo que deba mostrarse públicamente exige
  actualizar la RPC. No relajar policies con `OR` sin revisar las existentes.

## ADR-005 — Chat interno en lugar de exponer contacto

- **Fecha:** 2026-09.
- **Estado:** aceptada.
- **Contexto:** publicar teléfono o correo facilita el acoso y la venta irregular.
- **Decisión:** mensajería por mascota con Realtime; el chat se habilita cuando la
  solicitud está aprobada. El publicador elige destinatario si hay varias
  solicitudes aprobadas.
- **Consecuencias:** no hay notificaciones por email (P2-01); el usuario debe
  volver a la plataforma para enterarse. La moderación es posterior (P2-02).

## ADR-006 — Autenticación por correo; Google OAuth diferido

- **Fecha:** 2026-10.
- **Estado:** código listo, proveedor apagado.
- **Contexto:** el flujo por correo funciona sin dependencias externas; Google
  requiere credenciales y configuración de redirects.
- **Decisión:** login/registro/recuperación por correo; `/api/auth/google` y el
  botón existen, pero se activan con `PUBLIC_GOOGLE_ENABLED=true` y el provider
  configurado en Supabase.
- **Consecuencias:** hasta activarlo, el botón se oculta o avisa. Ver P0-01.

## ADR-007 — Sin 2FA ni verificación documental

- **Fecha:** 2026-10.
- **Estado:** aceptada.
- **Contexto:** el piloto académico prioriza privacidad y baja fricción; pedir
  cédula o documento eleva el riesgo de datos sensibles.
- **Decisión:** no se implementa segundo factor ni verificación de identidad
  documental. La verificación de organizaciones es una revisión administrativa.
- **Consecuencias:** menor garantía contra cuentas falsas; se compensa con
  moderación, reportes y verificación de organizaciones. Revisar antes de un
  despliegue con adopciones reales a escala.

## ADR-008 — Matching por estilo de vida, explicable

- **Fecha:** 2026-10.
- **Estado:** aceptada.
- **Contexto:** el plan pedía priorizar mascotas compatibles sin convertirlo en una
  caja negra.
- **Decisión:** `src/lib/match.ts` calcula afinidad con reglas deterministas sobre
  ambiente, niños, otras mascotas, energía, especie, edad y zona; el porcentaje se
  muestra al usuario.
- **Consecuencias:** es fácil de testear y explicar, pero no aprende de resultados
  históricos. No usar el porcentaje como criterio único de adopción.

## ADR-009 — Fotos con Sharp y Storage de Supabase

- **Fecha:** 2026-09.
- **Estado:** aceptada.
- **Contexto:** el free tier de Supabase Storage es limitado y se quería evitar un
  servicio externo (Cloudinary).
- **Decisión:** subir a `/api/mascotas/upload`, validar MIME/tamaño, convertir a
  WebP con Sharp y guardar en el bucket con ruta `userId/uuid.webp`.
- **Consecuencias:** el servidor hace trabajo de CPU; las rutas externas no se
  aceptan. Si se necesita AVIF/srcset, evaluar variantes (P3-03).

## ADR-010 — Rate limit en memoria (limitación conocida)

- **Fecha:** 2026-09.
- **Estado:** aceptada temporalmente.
- **Contexto:** el piloto corre en pocas instancias y no se quería añadir Redis/KV.
- **Decisión:** cubetas en un `Map` por proceso (`src/lib/ratelimit.ts`).
- **Consecuencias:** no es consistente entre instancias serverless; sirve como
  freno básico. Migrar a Upstash/KV o RPC atómica en Supabase si el tráfico crece
  (P2-03).

## ADR-011 — Service worker con lista blanca de rutas públicas

- **Fecha:** 2026-10-26.
- **Estado:** aceptada.
- **Contexto:** la versión anterior cacheaba HTML de navegaciones, incluidas rutas
  privadas, y podía mostrar datos de otra sesión en un dispositivo compartido.
- **Decisión:** `public/sw.js` solo cachea páginas públicas y assets; `/api` y
  rutas privadas van siempre a red. Si falla una navegación privada, se muestra
  `/offline`; las páginas públicas usan red primero con respaldo en caché.
- **Consecuencias:** se pierde algo de velocidad offline en rutas privadas a cambio
  de privacidad. Al añadir una ruta pública nueva, incluirla en la lista blanca si
  debe funcionar sin red.

## ADR-012 — SEO: OG por defecto, JSON-LD y sitemap filtrado

- **Fecha:** 2026-10-26.
- **Estado:** aceptada.
- **Contexto:** compartir el inicio no mostraba imagen, no había datos
  estructurados, el sitemap incluía rutas privadas y las fichas SSR no aparecían.
- **Decisión:** `Layout.astro` usa `/og-default.png` (1200×630) cuando la página no
  pasa una imagen; acepta JSON-LD serializado con escape seguro; el inicio declara
  `WebSite`/`Organization` y la ficha `Pet`/`BreadcrumbList`. El sitemap estático
  excluye rutas privadas y `robots.txt` anuncia el índice más
  `/sitemap-mascotas.xml`, un endpoint SSR paginado que lista solo mascotas
  `disponible` no borradas. `Layout.astro` emite canonical sin query/hash y `noindex,
follow` en páginas privadas o fichas no públicas.
- **Consecuencias:** el sitemap dinámico se descubre por `robots.txt` y no se parchea
  la salida de `@astrojs/sitemap`; se cachea 1 hora. Los campos JSON-LD deben ser
  públicos y no incluir PII.

## ADR-013 — Analytics de embudo con Vercel Analytics

- **Fecha:** 2026-10-26.
- **Estado:** aceptada.
- **Contexto:** solo se medían búsqueda y solicitud; faltaba el resto del embudo.
- **Decisión:** seis eventos (`busqueda`, `ver_detalle`, `solicitar`,
  `solicitud_aprobada`, `mensaje_enviado`, `favorito_agregado`) con IDs de mascota,
  nunca datos personales. El tracker falla en silencio si analytics está bloqueado.
- **Consecuencias:** no hay medición de conversión por usuario ni atribución
  detallada; si se necesita, usar un proveedor con consentimiento explícito.

## ADR-014 — Dependencias: actualización dentro de rango + overrides puntuales

- **Fecha:** 2026-10-26.
- **Estado:** aceptada.
- **Contexto:** `npm audit` reportaba vulnerabilidades altas transitivas en
  `@astrojs/vercel`; la corrección automática proponía un downgrade mayor (8.0.4).
- **Decisión:** actualizar dentro de los rangos existentes y forzar dos
  transitivas seguras (`zod` a 4.6.7 y `path-to-regexp` a 6.3.0) mediante
  `overrides`; CI ejecuta `npm audit --audit-level=high` y Dependabot agrupa
  minor/patch semanalmente.
- **Consecuencias:** el lockfile queda con 0 vulnerabilidades conocidas. Revisar
  los overrides al actualizar `@astrojs/vercel`; si upstream deja de necesitarlos,
  eliminarlos.

## ADR-015 — E2E separados por efecto secundario

- **Fecha:** 2026-10.
- **Estado:** aceptada.
- **Contexto:** el flujo completo crea cuentas, mascotas y mensajes; ejecutarlo
  contra la nube contamina datos reales.
- **Decisión:** `publico.e2e.ts` es de solo lectura y puede correr contra cualquier
  entorno; `flujo.e2e.ts` exige `E2E_FLUJO=1` y Supabase local, y en CI levanta
  Supabase con migraciones y seed.
- **Consecuencias:** el flujo completo no se valida contra producción; el CI es la
  garantía principal. No ejecutar `test:e2e:flujo` apuntando a la nube.

## ADR-016 — Respaldo diario como artefacto de GitHub Actions

- **Fecha:** 2026-10.
- **Estado:** aceptada.
- **Contexto:** el free tier de Supabase no garantiza retención suficiente y se
  quería una copia operable sin costo adicional.
- **Decisión:** workflow diario con `pg_dump` vía connection pooler, comprimido,
  con verificación de integridad y retención de 30 días en Actions.
- **Consecuencias:** la retención es limitada y depende de GitHub; para producción
  real, mover a almacenamiento off-site con cifrado y alertas (P2-06).

## ADR-017 — Headers de seguridad en Vercel con CSP en Report-Only

- **Fecha:** 2026-10-26.
- **Estado:** aceptada.
- **Contexto:** faltaban HSTS, `nosniff`, frame policy, referrer y CSP. Las páginas
  estáticas y los assets no pasan por el middleware de Astro en producción.
- **Decisión:** `vercel.json` aplica los headers a `/(.*)`. La CSP se emite como
  `Content-Security-Policy-Report-Only` con orígenes explícitos para Supabase,
  Google Fonts y Vercel Analytics; Astro usa scripts inline, así que endurecerla
  exige nonces/hashes.
- **Consecuencias:** la protección contra clickjacking/MIME sniffing/referrer es
  efectiva desde el deploy; la CSP solo reporta en consola por ahora. Pasar a
  enforcing cuando se migre a nonces y se valide en un preview. No mover estos
  headers al middleware: dejaría sin cobertura los archivos estáticos.

## ADR-018 — Límites de Storage y escritura por carpeta del dueño

- **Fecha:** 2026-10-26.
- **Estado:** aceptada.
- **Contexto:** la conversión a WebP ≤ 500 KB ocurre en el servidor, pero el bucket
  `mascotas` aceptaba subidas directas: sin `file_size_limit`, sin
  `allowed_mime_types` y con una policy que no comprobaba la carpeta del usuario.
- **Decisión:** migración `20261027010000_endurecer_storage.sql`: ambos buckets de
  fotos limitados a 512 000 bytes y `image/webp`; INSERT/UPDATE/DELETE de
  `mascotas` exigen `(storage.foldername(name))[1] = auth.uid()::text`. La app no
  cambia porque `src/lib/storage.ts` ya sube WebP y usa `userId/uuid.webp`.
- **Consecuencias:** la defensa en profundidad no depende de la UI ni de la API.
  Queda una defensa en Storage para `perfiles` ya existente desde su creación; si se
  añade otro bucket de usuario, replicar el patrón de carpeta y límites.

## ADR-019 — Dominio propio y correo transaccional con Resend

- **Fecha:** 2026-10-26.
- **Estado:** aceptada.
- **Contexto:** el SMTP integrado de Supabase limita a 2 correos/hora, insuficiente
  para registro y recuperación, y `SITE_URL` apuntaba a la URL de Vercel.
- **Decisión:** dominio `adopty.lat` en Vercel (apex + `www` con redirect 308 al
  apex, TLS de Let's Encrypt) y DNS en GoDaddy (A/CNAME de Vercel; registros de
  Resend intactos). Supabase Auth usa SMTP de Resend con remitente
  `no-reply@adopty.lat`; DKIM y DMARC (`p=none`) quedan configurados en GoDaddy.
- **Consecuencias:** `SITE_URL=https://adopty.lat` fija canónicas, sitemap y enlaces
  de Auth. El DNS sigue en GoDaddy (no se delega a Vercel) para no tocar los
  registros de Resend. Revisar el `rua` de DMARC y endurecer la política cuando haya
  buzón de operación.

## ADR-020 — Confirmación de correo obligatoria en producción

- **Fecha:** 2026-10-27.
- **Estado:** aceptada.
- **Contexto:** con `mailer_autoconfirm=true` no se enviaba ningún correo al registrarse,
  así que no se verificaba la dirección y no había forma de probar Resend en el alta.
  El e2e local usa `enable_confirmations=false` para no depender de una bandeja.
- **Decisión:** en cloud, `mailer_autoconfirm=false`. El registro devuelve
  `confirmaEmail` y la UI pide revisar la bandeja y el spam. El login traduce
  `email_not_confirmed` a un mensaje en español y responde 403. El enlace vuelve a
  `/api/auth/callback?next=/perfil`, que canjea el código por sesión.
- **Consecuencias:** el alta depende de Resend y de que el usuario abra el enlace en el
  mismo navegador donde se registró (flujo PKCE). Los usuarios existentes ya están
  confirmados. Si se necesita soportar otro dispositivo, habrá que añadir una ruta de
  verificación por `token_hash`.

## ADR-021 — Moderación posterior a la publicación para el piloto

- **Fecha:** 2026-10-27.
- **Estado:** aceptada.
- **Contexto:** el piloto es cerrado, con refugios conocidos y un solo administrador.
  Ya existen reportes, ocultar/restaurar, verificación de organizaciones, suspensión
  de cuentas, auditoría y límites de publicación (5 mascotas/hora). Faltaba decidir
  si las publicaciones se revisan antes o después de salir.
- **Decisión:** **post-moderación** durante el piloto cerrado. Toda publicación se
  revisa en un máximo de 48 h y todo reporte se atiende en 24 h. Se oculta una
  publicación por maltrato, venta, datos falsos, duplicados/spam, datos personales o
  discriminación. Cuando se abra el registro público, pasar a **modelo híbrido**: las
  primeras 1–2 publicaciones de cuentas no verificadas pasan a revisión previa; las
  organizaciones verificadas conservan la post-moderación.
- **Consecuencias:** publicar no se bloquea y el catálogo del piloto no depende de la
  disponibilidad del admin, pero exige revisar el panel a diario. La regla operativa
  queda en `docs/ADMIN.md` y el cambio a pre-moderación no requiere rediseño: es un
  estado `pendiente` en el alta de mascotas.

## ADR-022 — Reglas de negocio en triggers, no solo en la API

- **Fecha:** 2026-10-27.
- **Estado:** aceptada.
- **Contexto:** la anon key es pública y cualquier usuario autenticado puede llamar a
  PostgREST sin pasar por las API de Astro. Las policies de lectura ya impedían ver
  filas ajenas, pero las de escritura no replicaban las reglas de solicitudes,
  mensajes y transiciones de mascotas (P1-10/P1-11).
- **Decisión:** migración `20261027020000_rls_reglas_negocio.sql`. Triggers
  `validar_solicitud`, `solo_marcar_leido` y `validar_mascota` replican las reglas de
  negocio; `sol_update`, `sol_insert`, `msg_insert`, `msg_update` y `mascotas_update`
  llevan `WITH CHECK`; helpers `soy_publicador_de()` y `puede_mensajear()` son
  `SECURITY DEFINER` para no depender de la visibilidad RLS del llamador.
- **Consecuencias:** la regla vive en dos capas (API + base). Es duplicación
  intencional: la API da mensajes claros y la base garantiza que no haya bypass. Toda
  mutación nueva debe revisar si necesita trigger o policy con `WITH CHECK`. El coste
  es que los errores de Postgres llegan al cliente como texto si se llama por REST;
  la app no cambia porque ya validaba lo mismo.

## ADR-023 — Rate-limit distribuido en Postgres, sin servicio extra

- **Fecha:** 2026-10-27.
- **Estado:** aceptada.
- **Contexto:** el contador en memoria no se comparte entre instancias serverless y
  varias mutaciones autenticadas no tenían límite. Upstash/KV añade una cuenta y una
  dependencia externa que el piloto no necesita.
- **Decisión:** migración `20261027030000_rate_limit_distribuido.sql` con la tabla
  `public.rate_limits` y la RPC `consumir_rate_limit`. La RPC es `SECURITY DEFINER`,
  atómica (`INSERT ... ON CONFLICT DO UPDATE`) y no expone la tabla a `anon` ni a
  `authenticated`. `rateLimitDistribuido` cae al contador en memoria si la RPC falla
  (fail-open) para no tumbar la API por un problema del limitador.
- **Consecuencias:** el límite se comparte entre instancias y el coste es una escritura
  por petición limitada; las filas vencidas se limpian dentro de la propia RPC. Los
  límites siguen siendo por clave (IP o usuario), no globales. Un cliente podría inflar
  la cuota de otra clave si conoce su valor, pero no leer ni borrar la tabla.
