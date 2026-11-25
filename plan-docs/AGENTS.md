# plan-docs — fuente de verdad

Este directorio es el plan del proyecto. El código se escribe después y obedece
a estos documentos. Si el código y el plan discrepan, el plan manda hasta que se
cambie el plan.

## Orden de lectura

1. `STATE.md` — estado actual, decisiones, dudas, supuestos.
2. El documento de la fase en curso.
3. `TAREAS.md` — la siguiente tarea desbloqueada.

No leas todos los documentos en cada turno. `STATE.md` está para eso.

## Quién escribe qué

| Artefacto                    | Escribe | No puede escribir |
| ---------------------------- | ------- | ----------------- |
| Documentos del plan          | planner | builder           |
| `TAREAS.md`, línea `estado:` | builder | —                 |
| `bitacora/**`                | builder | planner           |
| Código                       | builder | planner           |

## Reglas

- Un identificador no se renumera nunca.
- Un supuesto sin registrar es un fallo. Va a `STATE.md` como `SUP-00n`.
- Los documentos posteriores no reescriben los anteriores. Si hay conflicto, se
  para y se pregunta.
- Nada de secretos ni credenciales en este directorio: solo nombres de variables.

## Terminado

Una tarea está terminada cuando su prueba se ha ejecutado de verdad, el revisor
no tiene hallazgos críticos, la casilla está marcada y la bitácora tiene la
entrada con el resultado.
