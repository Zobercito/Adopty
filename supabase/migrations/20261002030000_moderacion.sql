-- Adopty: moderación de publicaciones + verificación de organizaciones

-- 1. Tabla de reportes
CREATE TABLE IF NOT EXISTS reportes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_mascota UUID NOT NULL REFERENCES mascotas(id) ON DELETE CASCADE,
  id_reportador UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  motivo TEXT NOT NULL CHECK (char_length(motivo) BETWEEN 10 AND 500),
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'revisado', 'resuelto', 'descartado')),
  notas_admin TEXT,
  fecha_reporte TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_resolucion TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reportes_mascota ON reportes(id_mascota);
CREATE INDEX IF NOT EXISTS idx_reportes_estado ON reportes(estado);

-- RLS: reportador ve sus reportes; admin (service_role) ve todos
ALTER TABLE reportes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reportes_select ON reportes;
CREATE POLICY reportes_select ON reportes FOR SELECT USING (auth.uid() = id_reportador);
DROP POLICY IF EXISTS reportes_insert ON reportes;
CREATE POLICY reportes_insert ON reportes FOR INSERT WITH CHECK (auth.uid() = id_reportador);

-- 2. Tabla de verificación de organizaciones
CREATE TABLE IF NOT EXISTS verificaciones_org (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_organizacion UUID NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
  tipo_evidencia TEXT NOT NULL CHECK (tipo_evidencia IN ('redes_sociales', 'documento', 'sitio_web', 'otro')),
  url_evidencia TEXT NOT NULL,
  descripcion TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'rechazada')),
  notas_admin TEXT,
  fecha_solicitud TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_resolucion TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_verificaciones_org ON verificaciones_org(id_organizacion);
CREATE INDEX IF NOT EXISTS idx_verificaciones_estado ON verificaciones_org(estado);

-- RLS: organización ve sus verificaciones
ALTER TABLE verificaciones_org ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS verificaciones_select ON verificaciones_org;
CREATE POLICY verificaciones_select ON verificaciones_org FOR SELECT USING (
  auth.uid() IN (SELECT id FROM organizaciones WHERE id = id_organizacion)
);
DROP POLICY IF EXISTS verificaciones_insert ON verificaciones_org;
CREATE POLICY verificaciones_insert ON verificaciones_org FOR INSERT WITH CHECK (
  auth.uid() IN (SELECT id FROM organizaciones WHERE id = id_organizacion)
);
