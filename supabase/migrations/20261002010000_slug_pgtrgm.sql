-- Adopty: slug amigable + pg_trgm para búsqueda por similitud
-- Correr DESPUÉS de las migraciones existentes.

-- 1. Columna slug en mascotas
ALTER TABLE mascotas ADD COLUMN IF NOT EXISTS slug TEXT;

-- 2. Generar slug para mascotas existentes (nombre + primeros 8 chars del id)
UPDATE mascotas SET slug = LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(nombre, '[^a-zA-Z0-9 ]', '', 'g'),
    ' +', '-', 'g'
  )
) || '-' || SUBSTRING(id::text, 1, 8)
WHERE slug IS NULL;

-- 3. Slug único + not null
CREATE UNIQUE INDEX IF NOT EXISTS idx_mascotas_slug ON mascotas(slug) WHERE deleted_at IS NULL;
ALTER TABLE mascotas ALTER COLUMN slug SET NOT NULL;

-- 4. Trigger: genera el slug automáticamente al insertar (si no viene)
--    Necesario porque el API POST /api/mascotas no envía slug.
CREATE OR REPLACE FUNCTION public.set_mascota_slug() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := LOWER(
      REGEXP_REPLACE(
        REGEXP_REPLACE(NEW.nombre, '[^a-zA-Z0-9 ]', '', 'g'),
        ' +', '-', 'g'
      )
    ) || '-' || SUBSTRING(NEW.id::text, 1, 8);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_mascota_slug ON mascotas;
CREATE TRIGGER trg_mascota_slug BEFORE INSERT ON mascotas
  FOR EACH ROW EXECUTE FUNCTION set_mascota_slug();

-- 5. Índices pg_trgm para búsqueda por similitud
CREATE INDEX IF NOT EXISTS idx_mascotas_nombre_trgm ON mascotas USING gin (nombre gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_mascotas_raza_trgm ON mascotas USING gin (raza gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_mascotas_ubicacion_trgm ON mascotas USING gin (ubicacion gin_trgm_ops);

-- 6. Función de búsqueda por similitud (umbral 0.3 = 30% similitud)
CREATE OR REPLACE FUNCTION buscar_por_similitud(
  p_query TEXT,
  p_limite INT DEFAULT 20
)
RETURNS TABLE(id UUID, nombre TEXT, raza TEXT, ubicacion TEXT, similitud REAL)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    m.id,
    m.nombre,
    m.raza,
    m.ubicacion,
    GREATEST(
      similarity(m.nombre, p_query),
      similarity(m.raza, p_query),
      similarity(m.ubicacion, p_query)
    ) AS similitud
  FROM mascotas m
  WHERE m.deleted_at IS NULL
    AND m.estado = 'disponible'
    AND (
      similarity(m.nombre, p_query) > 0.3
      OR similarity(m.raza, p_query) > 0.3
      OR similarity(m.ubicacion, p_query) > 0.3
    )
  ORDER BY similitud DESC
  LIMIT p_limite;
$$;

REVOKE ALL ON FUNCTION buscar_por_similitud(TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION buscar_por_similitud(TEXT, INT) TO authenticated, anon;
