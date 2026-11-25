# Plan — Verificación funcional por roles

> Método: Mom Test + Example Mapping · Fuente: Fitzpatrick, Wynne

## Propósito

Comprobar en local, entrando como cada rol y con efectos cruzados entre cuentas,
que Adopty permite todo lo que cada rol debe poder hacer y nada de lo que no.

## Alcance

- **Entorno:** Supabase local + `astro dev`; datos sintéticos; reset al final.
- **Roles:** persona adoptante, persona publicador, organización y administrador.
- **Foco:** que la acción de una cuenta se refleje (o no) en la otra: reportar →
  bandeja del admin, suspender → usuario bloqueado, verificar → badge público,
  aprobar → chat abierto para ambos.

## Requisitos

### REQ-001 · Sesión y cuentas por rol

- **Prioridad:** debe
- **Origen:** usuario (local, todos los roles)
- **Tipo:** funcional
- **AC-001-a** — Dado un registro de persona, cuando se envía, entonces responde 302, la cookie deja sesión y `/api/perfil` devuelve 200 con la fila de `personas`.
- **AC-001-b** — Dado un registro de organización, cuando se envía, entonces responde 302 y existe una fila en `organizaciones` con su `nombre_oficial`.
- **AC-001-c** — Dada una sesión activa, cuando se llama a `/api/auth/logout`, entonces la siguiente petición privada responde 401 o redirige a login.
- **AC-001-d** — Dada una cuenta suspendida, cuando intenta iniciar sesión con su contraseña correcta, entonces recibe error y no obtiene sesión.

### REQ-002 · Flujos del adoptante

- **Prioridad:** debe
- **Origen:** usuario (todos los flujos)
- **Tipo:** funcional
- **AC-002-a** — Dado un adoptante con sesión, cuando hace GET y PATCH a `/api/perfil`, entonces lee y actualiza solo su propio perfil.
- **AC-002-b** — Dado un adoptante, cuando guarda su estilo de vida, entonces el GET posterior devuelve los mismos valores.
- **AC-002-c** — Dado un adoptante que marca un favorito, cuando consulta `/api/favoritos`, entonces aparece; al borrarlo desaparece; otra cuenta no lo ve.
- **AC-002-d** — Dado un adoptante, cuando solicita una mascota disponible, entonces recibe 201; una segunda solicitud igual recibe 409; sobre su propia mascota recibe 403.
- **AC-002-e** — Dado un adoptante, cuando pide `/api/mis-datos`, entonces recibe solo su información y ninguna credencial ni dato de otra cuenta.
- **AC-002-f** — Dado un adoptante, cuando cambia su contraseña con la actual incorrecta recibe 401 con el mensaje de contraseña incorrecta; con la correcta recibe 200 y puede iniciar sesión con la nueva.
- **AC-002-g** — Dado un adoptante, cuando cambia su preferencia de avisos, entonces `/api/perfil` la refleja al releer.
- **AC-002-h** — Dada una adopción aprobada sin resolver, cuando pide la baja recibe 409; resuelta la adopción, la baja responde 200 y la cuenta ya no puede iniciar sesión.

### REQ-003 · Flujos del publicador

- **Prioridad:** debe
- **Origen:** usuario (todos los flujos)
- **Tipo:** funcional
- **AC-003-a** — Dado un publicador, cuando sube una foto y publica una mascota, entonces recibe 201 y la ficha aparece en el listado público.
- **AC-003-b** — Dado un publicador, cuando edita su mascota recibe 200; cuando edita una ajena recibe 403.
- **AC-003-c** — Dado un publicador con mascotas y solicitudes, cuando carga su panel, entonces los agregados cuadran con las filas reales.
- **AC-003-d** — Dado un publicador, cuando borra lógicamente una mascota, entonces deja de aparecer en público y la fila conserva `deleted_at`.
- **AC-003-e** — Dada una mascota adoptada, cuando se intenta volver a `disponible`, entonces responde 409 y el estado no cambia.

### REQ-004 · Organización y verificación

- **Prioridad:** debe
- **Origen:** usuario (todos los roles)
- **Tipo:** funcional
- **AC-004-a** — Dada una organización con sesión, cuando envía su solicitud de verificación con los datos que exige el esquema, entonces queda en estado pendiente.
- **AC-004-b** — Dado un admin, cuando aprueba esa verificación, entonces el perfil de la organización pasa a verificada y su ficha pública muestra el distintivo.
- **AC-004-c** — Dado un admin, cuando rechaza la verificación, entonces la organización sigue sin distintivo.

### REQ-005 · Panel de administración

- **Prioridad:** debe
- **Origen:** usuario (todos los roles)
- **Tipo:** funcional
- **AC-005-a** — Dado un usuario sin rol admin, cuando abre `/admin` recibe 404 y cuando llama a las APIs de admin recibe 403 o 404.
- **AC-005-b** — Dado un admin, cuando lista reportes, oculta uno y lo restaura, entonces el listado refleja cada cambio de estado.
- **AC-005-c** — Dado un admin, cuando suspende y reactiva una cuenta, entonces el estado de la cuenta cambia en cada operación.
- **AC-005-d** — Dado un admin, cuando consulta la auditoría, entonces ve las acciones con el actor y el objetivo correctos.

### REQ-006 · Interacciones entre cuentas

- **Prioridad:** debe
- **Origen:** usuario (comprobar que una acción afecta a la otra)
- **Tipo:** funcional
- **AC-006-a** — Dado B, cuando reporta una mascota de A, entonces el reporte aparece en la bandeja del admin y no en la de A.
- **AC-006-b** — Dado ese reporte, cuando el admin oculta la publicación, entonces la ficha deja de ser pública; al restaurarla vuelve a estarlo.
- **AC-006-c** — Dado A con sesión, cuando el admin lo suspende, entonces las mutaciones de A responden 401/403 y su mascota disponible desaparece del listado público.
- **AC-006-d** — Dado A suspendido, cuando el admin lo reactiva, entonces A vuelve a operar con su misma cuenta.
- **AC-006-e** — Dado B que solicita una mascota de A, cuando A aprueba, entonces B puede abrir el chat y escribir; C ni lo ve ni puede escribir.
- **AC-006-f** — Dado B que escribe a A, cuando A consulta su bandeja, entonces `no_leidos` es 1; tras responder, B ve 1; C ve 0.
- **AC-006-g** — Dado B que crea una solicitud, cuando se consulta `notificaciones_log`, entonces hay una fila nueva para A; repetir el mismo tipo/mascota/destinatario dentro de la hora no añade otra.
- **AC-006-h** — Dado el admin que suspende y reactiva, cuando se lee la auditoría, entonces hay dos filas con `id_usuario` = admin e `id_objetivo` = A.

### REQ-007 · Aislamiento y negativos

- **Prioridad:** debe
- **Origen:** estado actual (reglas RLS) y usuario
- **Tipo:** funcional
- **AC-007-a** — Dado C, cuando edita una mascota de A recibe 403 y cuando consulta una solicitud ajena recibe 403 o 404.
- **AC-007-b** — Dado un adoptante, cuando intenta aprobar su propia solicitud, entonces recibe 403.
- **AC-007-c** — Dado un adoptante sin aprobación, cuando intenta escribir en el chat, entonces recibe 403.
- **AC-007-d** — Dadas las rutas de admin sin sesión, cuando se invocan, entonces responden 401 o 404.
- **AC-007-e** — Dado un usuario autenticado, cuando intenta leer `notificaciones_log` por REST, entonces recibe 401/403.

### REQ-008 · Evidencia y limpieza

- **Prioridad:** debe
- **Origen:** usuario (quiere ver el resultado)
- **Tipo:** funcional
- **AC-008-a** — Al terminar una corrida, cada AC ejecutado deja una línea `AC-00n-x · PASS/FAIL` en la salida y un resumen con totales.
- **AC-008-b** — Tras `supabase db reset`, la base queda sin cuentas, mascotas ni solicitudes de la batería.
- **AC-008-c** — La batería no usa la service role, ni claves reales, ni escribe en producción; como máximo llama a Resend con una clave falsa y lo trata como informativo.

### REQ-009 · Repetibilidad

- **Prioridad:** debe
- **Origen:** propuesta (calidad de la suite)
- **Tipo:** no funcional
- **Métrica:** suite completa < 10 minutos; 3 corridas consecutivas sin fallos intermitentes en local.
- **AC-009-a** — Dadas 3 corridas consecutivas desde `db reset`, entonces las 3 terminan con 0 fallos.
- **AC-009-b** — Dada una corrida completa, entonces el tiempo total es menor a 10 minutos.
- **AC-009-c** — Dada una máquina sin salida a internet, entonces todos los AC funcionales se ejecutan igual, salvo los que solo inspeccionan `net._http_response`.

## Fuera del alcance

- Producción y cuentas reales.
- Google OAuth (retirado del proyecto el 2026-11-25).
- Entrega real de correo por Resend (solo se verifica el encolado y el antispam).
- Backfill de imágenes, AVIF, rendimiento y Lighthouse (ya medidos).
- Accesibilidad axe y pruebas en dispositivos móviles reales.
- Pentest o revisión de seguridad formal.

## Decisiones

- **ADR-001** — Perfil ligero, por ser una verificación interna, reversible y sin
  datos reales.
- **ADR-002** — Solo Supabase local; producción nunca.
- **ADR-003** — El admin se crea con un fixture SQL local, sin service role.
- **ADR-004** — Pruebas por API con sesión real y smoke de UI solo donde aporta.
- **ADR-005** — El correo se verifica hasta `notificaciones_log`; Resend es
  best-effort y no puede hacer fallar la suite.
- **ADR-006** — Limpieza con `supabase db reset`; no se dejan datos de prueba.
- **ADR-007** — La suite se versiona como `e2e/roles.e2e.ts`, guardada por
  `E2E_FLUJO=1` y por la comprobación de que Supabase es local.
