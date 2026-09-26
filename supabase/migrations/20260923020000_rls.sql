-- Adopty Fase 1 — 002_rls.sql — Row Level Security por rol (§6 del plan).

-- ===== mascotas =====
ALTER TABLE mascotas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mascotas_select ON mascotas;
CREATE POLICY mascotas_select ON mascotas FOR SELECT USING (
  (estado = 'disponible' AND deleted_at IS NULL) OR auth.uid() = id_publicador
);
DROP POLICY IF EXISTS mascotas_insert ON mascotas;
CREATE POLICY mascotas_insert ON mascotas FOR INSERT WITH CHECK (auth.uid() = id_publicador);
DROP POLICY IF EXISTS mascotas_update ON mascotas;
CREATE POLICY mascotas_update ON mascotas FOR UPDATE USING (auth.uid() = id_publicador);
DROP POLICY IF EXISTS mascotas_delete ON mascotas;
CREATE POLICY mascotas_delete ON mascotas FOR DELETE USING (auth.uid() = id_publicador);

-- ===== fotos_mascota =====
ALTER TABLE fotos_mascota ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fotos_select ON fotos_mascota;
CREATE POLICY fotos_select ON fotos_mascota FOR SELECT USING (
  EXISTS (SELECT 1 FROM mascotas m WHERE m.id = id_mascota
    AND ((m.estado = 'disponible' AND m.deleted_at IS NULL) OR m.id_publicador = auth.uid()))
);
DROP POLICY IF EXISTS fotos_write ON fotos_mascota;
CREATE POLICY fotos_write ON fotos_mascota FOR ALL USING (
  EXISTS (SELECT 1 FROM mascotas m WHERE m.id = id_mascota AND m.id_publicador = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM mascotas m WHERE m.id = id_mascota AND m.id_publicador = auth.uid())
);

-- ===== solicitudes (solo emisor / publicador implicados) =====
ALTER TABLE solicitudes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sol_select ON solicitudes;
CREATE POLICY sol_select ON solicitudes FOR SELECT USING (
  auth.uid() = id_adoptante OR auth.uid() IN (
    SELECT m.id_publicador FROM mascotas m WHERE m.id = id_mascota)
);
DROP POLICY IF EXISTS sol_insert ON solicitudes;
CREATE POLICY sol_insert ON solicitudes FOR INSERT WITH CHECK (auth.uid() = id_adoptante);
DROP POLICY IF EXISTS sol_update ON solicitudes;
CREATE POLICY sol_update ON solicitudes FOR UPDATE USING (
  auth.uid() = id_adoptante OR auth.uid() IN (
    SELECT m.id_publicador FROM mascotas m WHERE m.id = id_mascota)
);

-- ===== mensajes (solo emisor / receptor) =====
ALTER TABLE mensajes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS msg_select ON mensajes;
CREATE POLICY msg_select ON mensajes FOR SELECT USING (
  auth.uid() = id_emisor OR auth.uid() = id_receptor);
DROP POLICY IF EXISTS msg_insert ON mensajes;
CREATE POLICY msg_insert ON mensajes FOR INSERT WITH CHECK (auth.uid() = id_emisor);
DROP POLICY IF EXISTS msg_update ON mensajes;
-- Solo el receptor marca como leído
CREATE POLICY msg_update ON mensajes FOR UPDATE USING (auth.uid() = id_receptor);

-- ===== favoritos (dueño) =====
ALTER TABLE favoritos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fav_all ON favoritos;
CREATE POLICY fav_all ON favoritos FOR ALL USING (auth.uid() = id_usuario)
  WITH CHECK (auth.uid() = id_usuario);

-- ===== usuarios / personas / organizaciones =====
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS usuarios_self ON usuarios;
CREATE POLICY usuarios_self ON usuarios FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS usuarios_update ON usuarios;
CREATE POLICY usuarios_update ON usuarios FOR UPDATE USING (auth.uid() = id);

ALTER TABLE personas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS personas_select ON personas;
CREATE POLICY personas_select ON personas FOR SELECT USING (true); -- nombre/foto visibles en tarjetas
DROP POLICY IF EXISTS personas_update ON personas;
CREATE POLICY personas_update ON personas FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS personas_insert ON personas;
CREATE POLICY personas_insert ON personas FOR INSERT WITH CHECK (auth.uid() = id);

ALTER TABLE organizaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_select ON organizaciones;
CREATE POLICY org_select ON organizaciones FOR SELECT USING (true); -- badge "verificada" público
DROP POLICY IF EXISTS org_update ON organizaciones;
CREATE POLICY org_update ON organizaciones FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS org_insert ON organizaciones;
CREATE POLICY org_insert ON organizaciones FOR INSERT WITH CHECK (auth.uid() = id);
