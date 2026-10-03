-- Adopty: tabla de auditoría para trazabilidad de acciones sensibles
CREATE TABLE IF NOT EXISTS auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_usuario UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  accion TEXT NOT NULL,
  tabla TEXT NOT NULL,
  id_registro UUID NOT NULL,
  datos_anteriores JSONB,
  datos_nuevos JSONB,
  ip TEXT,
  user_agent TEXT,
  fecha TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON auditoria(id_usuario, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_tabla ON auditoria(tabla, id_registro, fecha DESC);

-- RLS: solo el usuario puede ver e insertar sus propios logs
ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS auditoria_select ON auditoria;
CREATE POLICY auditoria_select ON auditoria FOR SELECT USING (auth.uid() = id_usuario);
DROP POLICY IF EXISTS auditoria_insert ON auditoria;
CREATE POLICY auditoria_insert ON auditoria FOR INSERT WITH CHECK (auth.uid() = id_usuario);
