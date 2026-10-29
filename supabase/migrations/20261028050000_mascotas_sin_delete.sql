-- Adopty — B: el dueño ya no puede borrar físicamente una mascota.
--
-- `mascotas_delete` permitía al publicador un DELETE real sobre su fila. Las FK
-- de `reportes`, `solicitudes`, `fotos_mascota` y `mensajes` son ON DELETE
-- CASCADE (20260923010000_schema.sql, 20261002030000_moderacion.sql), así que un
-- `DELETE /rest/v1/mascotas?id=eq.<id>` con la anon key destruía la prueba del
-- reporte, el hilo de mensajes y las solicitudes, sin pasar por
-- `resolver_reporte()` ni dejar auditoría. La API solo hace borrado lógico
-- (`deleted_at`), así que la vía física no hace falta para ningún rol de
-- usuario. Mantenimiento (owner / service_role) conserva el privilegio.

DROP POLICY IF EXISTS mascotas_delete ON public.mascotas;

REVOKE DELETE ON public.mascotas FROM authenticated;
REVOKE DELETE ON public.mascotas FROM anon;
