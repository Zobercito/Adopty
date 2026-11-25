# STATE — Verificación funcional por roles (Adopty)

perfil: ligero
version: 0.2
fase: 9-tareas
estado: trabajando
actualizado: 2026-11-25
huella: a02aea05166eb667

## Reglas que no se rompen

- R1 — La batería corre solo contra Supabase local; producción no se toca.
- R2 — No se usa la service role ni claves reales; el admin se crea con SQL local.
- R3 — Cada efecto cruzado se comprueba desde la cuenta afectada, no leyendo código.
- R4 — Ningún AC se marca PASS sin una aserción ejecutada y su salida real.
- R5 — Al terminar, `db reset` deja la base sin datos de la batería.

## Decisiones cerradas

| ID      | Decisión                                     | Documento     |
| ------- | -------------------------------------------- | ------------- |
| ADR-001 | Perfil ligero con `00-estado-actual.md`      | DECISIONES.md |
| ADR-002 | Solo Supabase local                          | DECISIONES.md |
| ADR-003 | Admin por fixture SQL, sin service role      | DECISIONES.md |
| ADR-004 | API con sesión real y smoke de UI            | DECISIONES.md |
| ADR-005 | Correo best-effort; se verifica el encolado  | DECISIONES.md |
| ADR-006 | Limpieza con `supabase db reset`             | DECISIONES.md |
| ADR-007 | La suite se versiona como `e2e/roles.e2e.ts` | DECISIONES.md |

## Dudas abiertas

| ID    | Pregunta                                           | Estado   |
| ----- | -------------------------------------------------- | -------- |
| Q-001 | ¿Se añade el fixture de admin al job `e2e` del CI? | diferida |

## Supuestos

| ID      | Supuesto                                                                                | Severidad | Documento |
| ------- | --------------------------------------------------------------------------------------- | --------- | --------- |
| SUP-001 | `docker exec` + `psql` funciona en la máquina local                                     | diferible | TAREAS.md |
| SUP-002 | El cambio de correo se valida hasta la petición; abrir el enlace no es obligatorio      | diferible | TAREAS.md |
| SUP-003 | Suspender invalida las mutaciones de la sesión abierta; si no, se reporta como hallazgo | diferible | TAREAS.md |
| SUP-004 | El rate-limit no interfiere con ~40 peticiones por corrida                              | diferible | TAREAS.md |

## Riesgos

| ID       | Riesgo                                                              | Impacto | Documento |
| -------- | ------------------------------------------------------------------- | ------- | --------- |
| RISK-001 | El fixture de admin falla y los casos de admin se omiten            | alto    | TAREAS.md |
| RISK-002 | `pg_net` local añade latencia por la llamada a Resend               | medio   | TAREAS.md |
| RISK-003 | Datos de corridas anteriores hacen fallar el antispam o los conteos | medio   | TAREAS.md |

## Siguiente paso

TASK-001 cerrada. Corregidos los encabezados de TAREAS.md (v0.2); el plan ya registra las 12 tareas. Ejecutar TASK-002 (fixture de admin) y seguir el orden hasta TASK-012.
