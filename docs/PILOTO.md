# Runbook del piloto — Adopty (1–2 refugios)

## Objetivo (§13)

≥ 5 mascotas reales · ≥ 3 solicitudes · ≥ 1 adopción `en_proceso` · feedback registrado.

## Preparación (equipo, 30 min)

1. Deploy prod verificado (ver `CHECKLIST.md`).
2. Crear cuenta del refugio como **organización** y marcar `verificada = true`:
   ```sql
   UPDATE organizaciones SET verificada = true WHERE id = '<uuid-del-refugio>';
   ```
3. Pedir al refugio 5 fotos reales (JPEG/PNG, ideal < 5 MB) + datos: nombre, raza,
   edad en meses, sexo, tamaño, ubicación, salud, descripción (10–2000 caracteres).

## Ejecución (con el refugio, 1 h)

1. **Publicar (15 min):** el refugio publica 2 mascotas solo (acompañado); el equipo
   publica 3 más si faltan para la meta.
2. **Solicitar (15 min):** 3 cuentas de prueba (equipo + voluntarios) solicitan con
   mensajes reales distintos. Probar el 409 duplicado a propósito.
3. **Aprobar (10 min):** el refugio aprueba 1 desde `/panel/solicitudes` → verificar
   `en_proceso` + auto-rechazo del resto.
4. **Chatear (10 min):** 2 sesiones en vivo en `/mensajes` (adoptante + refugio).
5. **Feedback (10 min):** llenar sección 3 del `ACTA_ENTREGA.md`.

## Limpieza post-piloto

- Mascotas de prueba del equipo: soft-delete desde `/panel`.
- Solicitudes/mensajes de prueba: se conservan como historial demo o se purgan:
  ```sql
  DELETE FROM mensajes WHERE id_mascota IN (...);
  DELETE FROM solicitudes WHERE id_mascota IN (...);
  ```
- `pg_dump`/CSV de respaldo antes y después (ver `docs/QA.md` §4).

## Criterios de salida

Flujo e2e en prod sin errores + acta firmada + feedback con al menos 1 mejora accionable
para el backlog post-semestre.
