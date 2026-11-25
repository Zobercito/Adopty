# Tareas

> Método: vertical slicing + walking skeleton

La suite vive en `e2e/roles.e2e.ts` y se ejecuta solo en local:

```sh
npx supabase start
npx supabase db reset
docker exec -i supabase_db_adopty psql -U postgres -d postgres < supabase/seed.sql
E2E_FLUJO=1 PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
  E2E_BASE_URL='http://[::1]:4321' npx playwright test e2e/roles.e2e.ts
```

Cada tarea añade casos a ese archivo (o a su helper), no crea suites paralelas.

### TASK-001 · Arnés y sesión por rol

- estado: [x]
- cubre: REQ-001 · AC-001-a, AC-001-b, AC-001-c
- depende: —
- test: —
- archivos: e2e/roles.e2e.ts
- hecho cuando: la suite registra una persona, una organización y un tercero; cada contexto lee `/api/perfil` con 200, y tras `logout` la petición privada deja de autenticar. Sin prueba unitaria: el AC se ejecuta en la propia suite.

### TASK-002 · Fixture de administrador

- estado: [x]
- cubre: REQ-005 · AC-005-a
- depende: TASK-001
- test: —
- archivos: e2e/roles.e2e.ts
- hecho cuando: el helper `psql()` inserta el UUID del admin en `administradores` y ese contexto abre `/admin` con 200, mientras una cuenta normal recibe 404. Sin prueba unitaria: requiere la base local.

### TASK-003 · Adoptante: perfil, estilo de vida, favoritos y avisos

- estado: [x]
- cubre: REQ-002 · AC-002-a, AC-002-b, AC-002-c, AC-002-e, AC-002-g
- depende: TASK-001
- test: —
- archivos: e2e/roles.e2e.ts
- hecho cuando: el adoptante lee y edita su perfil, guarda estilo de vida, marca y borra un favorito (y otra cuenta no lo ve), exporta sus datos sin datos ajenos y persiste su preferencia de avisos.

### TASK-004 · Adoptante: contraseña, correo y baja

- estado: [x]
- cubre: REQ-002 · AC-002-f, AC-002-h
- depende: TASK-001
- test: —
- archivos: e2e/roles.e2e.ts
- hecho cuando: el cambio de contraseña rechaza la actual incorrecta y acepta la correcta, la baja responde 409 con adopción aprobada y 200 sin ella, y la cuenta dada de baja ya no inicia sesión. El cambio de correo se valida hasta la petición (ver SUP-002).

### TASK-005 · Publicador: publicar, editar, panel y borrado lógico

- estado: [x]
- cubre: REQ-003 · AC-003-a, AC-003-b, AC-003-c, AC-003-d, AC-003-e
- depende: TASK-001
- test: —
- archivos: e2e/roles.e2e.ts
- hecho cuando: el publicador crea una mascota con foto, la edita, el panel cuadra con sus filas, el borrado lógico la saca del listado y una mascota adoptada no vuelve a disponible.

### TASK-006 · Solicitud y chat entre dos cuentas

- estado: [x]
- cubre: REQ-006 · AC-006-e, AC-006-f · REQ-002 · AC-002-d · REQ-007 · AC-007-b, AC-007-c
- depende: TASK-005
- test: —
- archivos: e2e/roles.e2e.ts
- hecho cuando: B solicita (201), duplica (409) y no puede solicitar lo suyo (403); A ve la solicitud y aprueba; B y A chatean con `no_leidos` 1/1; C no la ve, no escribe y no puede aprobar.

### TASK-007 · Reporte de B visible en el admin

- estado: [x]
- cubre: REQ-006 · AC-006-a, AC-006-b · REQ-005 · AC-005-b
- depende: TASK-002, TASK-005
- test: —
- archivos: e2e/roles.e2e.ts
- hecho cuando: el reporte de B aparece en `/api/admin/reportes` y no en la bandeja de A; ocultar deja la ficha fuera de público y restaurar la devuelve.

### TASK-008 · Organización verificada y badge

- estado: [x]
- cubre: REQ-004 · AC-004-a, AC-004-b, AC-004-c
- depende: TASK-001, TASK-002
- test: —
- archivos: e2e/roles.e2e.ts
- hecho cuando: la organización envía su verificación, el admin la aprueba y su perfil público muestra el distintivo; con otra organización rechazada no aparece.

### TASK-009 · Suspensión, reactivación y auditoría

- estado: [x]
- cubre: REQ-006 · AC-006-c, AC-006-d, AC-006-h · REQ-005 · AC-005-c, AC-005-d · REQ-001 · AC-001-d
- depende: TASK-002, TASK-005
- test: —
- archivos: e2e/roles.e2e.ts
- hecho cuando: suspender a A bloquea sus mutaciones y oculta su mascota pública, reactivar lo devuelve, el login de suspendido falla y la auditoría deja dos filas con actor admin y objetivo A.

### TASK-010 · Encolado de avisos y antispam

- estado: [ ]
- cubre: REQ-006 · AC-006-g · REQ-008 · AC-008-c
- depende: TASK-006
- test: —
- archivos: e2e/roles.e2e.ts
- hecho cuando: una solicitud crea una fila en `notificaciones_log` y repetirla en la misma hora no añade otra; la aserción no depende de `net._http_response`.

### TASK-011 · Negativos de acceso y RLS

- estado: [ ]
- cubre: REQ-007 · AC-007-a, AC-007-d, AC-007-e · REQ-005 · AC-005-a
- depende: TASK-001, TASK-002
- test: —
- archivos: e2e/roles.e2e.ts
- hecho cuando: sin sesión las rutas de admin responden 401/404, un usuario normal no lee `notificaciones_log` por REST y C no edita la mascota de A ni ve su solicitud.

### TASK-012 · Evidencia, repetición y limpieza

- estado: [ ]
- cubre: REQ-008 · AC-008-a, AC-008-b · REQ-009 · AC-009-a, AC-009-b, AC-009-c
- depende: TASK-003, TASK-004, TASK-006, TASK-007, TASK-008, TASK-009, TASK-010, TASK-011
- test: —
- archivos: e2e/roles.e2e.ts, docs/QA.md
- hecho cuando: la salida enumera cada AC con PASS/FAIL y totales, tres corridas seguidas desde `db reset` terminan verdes en menos de 10 minutos y el reset final no deja datos de la batería. Se anota el resultado en `docs/QA.md`.
