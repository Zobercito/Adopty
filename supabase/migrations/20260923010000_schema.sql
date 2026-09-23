-- Adopty Fase 1 — 001_schema.sql
-- Modelo de datos objetivo (§6 del plan). Postgres 3FN, UUID, ENUMs.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============ ENUMs ============
DO $$ BEGIN CREATE TYPE tipo_usuario AS ENUM ('persona', 'organizacion'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE especie AS ENUM ('perro', 'gato', 'otro'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE sexo_mascota AS ENUM ('Macho', 'Hembra'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE tamano_mascota AS ENUM ('Pequeño', 'Mediano', 'Grande'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE estado_mascota AS ENUM ('disponible', 'en_proceso', 'adoptada'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE estado_solicitud AS ENUM ('pendiente', 'aprobada', 'rechazada', 'cancelada'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ usuarios (espejo de auth.users) ============
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  correo TEXT UNIQUE NOT NULL,
  tipo_usuario tipo_usuario NOT NULL DEFAULT 'persona',
  fecha_registro TIMESTAMPTZ NOT NULL DEFAULT now(),
  activo BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS personas (
  id UUID PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL CHECK (char_length(nombre) BETWEEN 2 AND 80),
  telefono TEXT NULL CHECK (telefono IS NULL OR char_length(telefono) <= 20),
  foto_perfil TEXT NULL,
  descripcion TEXT NULL CHECK (descripcion IS NULL OR char_length(descripcion) <= 500)
);

CREATE TABLE IF NOT EXISTS organizaciones (
  id UUID PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre_oficial TEXT NOT NULL CHECK (char_length(nombre_oficial) BETWEEN 2 AND 120),
  direccion TEXT NOT NULL,
  descripcion TEXT NULL CHECK (descripcion IS NULL OR char_length(descripcion) <= 1000),
  verificada BOOLEAN NOT NULL DEFAULT false,
  sitio_web TEXT NULL
);

-- ============ mascotas ============
CREATE TABLE IF NOT EXISTS mascotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_publicador UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL CHECK (char_length(nombre) BETWEEN 2 AND 60),
  especie especie NOT NULL,
  raza TEXT NOT NULL CHECK (char_length(raza) BETWEEN 2 AND 80),
  edad_meses INT NOT NULL CHECK (edad_meses BETWEEN 0 AND 360),
  sexo sexo_mascota NOT NULL,
  tamano tamano_mascota NOT NULL,
  descripcion TEXT NOT NULL CHECK (char_length(descripcion) BETWEEN 10 AND 2000),
  estado_salud TEXT NOT NULL DEFAULT '' CHECK (char_length(estado_salud) <= 500),
  ubicacion TEXT NOT NULL CHECK (char_length(ubicacion) BETWEEN 2 AND 120),
  estado estado_mascota NOT NULL DEFAULT 'disponible',
  fecha_publicacion TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_mascotas_estado_fecha ON mascotas (estado, fecha_publicacion DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_mascotas_especie_tamano ON mascotas (especie, tamano) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_mascotas_raza_trgm ON mascotas USING gin (raza gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_mascotas_ubicacion_trgm ON mascotas USING gin (ubicacion gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_mascotas_publicador ON mascotas (id_publicador);

-- ============ fotos ============
CREATE TABLE IF NOT EXISTS fotos_mascota (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_mascota UUID NOT NULL REFERENCES mascotas(id) ON DELETE CASCADE,
  url_foto TEXT NOT NULL,
  es_principal BOOLEAN NOT NULL DEFAULT false,
  orden INT NOT NULL DEFAULT 0 CHECK (orden BETWEEN 0 AND 4)
);
CREATE INDEX IF NOT EXISTS idx_fotos_mascota ON fotos_mascota (id_mascota, orden);

-- Trigger: máximo 5 fotos por mascota
CREATE OR REPLACE FUNCTION check_max_fotos() RETURNS trigger AS $$
BEGIN
  IF (SELECT count(*) FROM fotos_mascota WHERE id_mascota = NEW.id_mascota) >= 5 THEN
    RAISE EXCEPTION 'Máximo 5 fotos por mascota';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_max_fotos ON fotos_mascota;
CREATE TRIGGER trg_max_fotos BEFORE INSERT ON fotos_mascota
  FOR EACH ROW EXECUTE FUNCTION check_max_fotos();

-- ============ solicitudes ============
CREATE TABLE IF NOT EXISTS solicitudes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_mascota UUID NOT NULL REFERENCES mascotas(id) ON DELETE CASCADE,
  id_adoptante UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  estado estado_solicitud NOT NULL DEFAULT 'pendiente',
  mensaje_inicial TEXT NOT NULL CHECK (char_length(mensaje_inicial) BETWEEN 10 AND 1000),
  fecha_solicitud TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Un adoptante no puede tener 2 solicitudes pendientes sobre la misma mascota
CREATE UNIQUE INDEX IF NOT EXISTS uq_solicitud_pendiente
  ON solicitudes (id_mascota, id_adoptante) WHERE estado = 'pendiente';
CREATE INDEX IF NOT EXISTS idx_solicitudes_mascota ON solicitudes (id_mascota, estado);
CREATE INDEX IF NOT EXISTS idx_solicitudes_adoptante ON solicitudes (id_adoptante, estado);

-- ============ mensajes ============
CREATE TABLE IF NOT EXISTS mensajes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_emisor UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  id_receptor UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  id_mascota UUID NOT NULL REFERENCES mascotas(id) ON DELETE CASCADE,
  contenido TEXT NOT NULL CHECK (char_length(contenido) BETWEEN 1 AND 2000),
  leido BOOLEAN NOT NULL DEFAULT false,
  fecha_envio TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_no_automensaje CHECK (id_emisor <> id_receptor)
);
CREATE INDEX IF NOT EXISTS idx_mensajes_receptor ON mensajes (id_receptor, leido);
CREATE INDEX IF NOT EXISTS idx_mensajes_hilo ON mensajes (id_mascota, id_emisor, id_receptor, fecha_envio);

-- ============ favoritos ============
CREATE TABLE IF NOT EXISTS favoritos (
  id_usuario UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  id_mascota UUID NOT NULL REFERENCES mascotas(id) ON DELETE CASCADE,
  fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id_usuario, id_mascota)
);

-- ============ updated_at automático ============
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_mascotas_updated ON mascotas;
CREATE TRIGGER trg_mascotas_updated BEFORE UPDATE ON mascotas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============ espejo auth.users -> usuarios ============
-- Crea la fila en usuarios al registrarse; el tipo y nombre llegan en user_metadata.
-- NOTA: SECURITY DEFINER + SET search_path = public + nombres calificados son
-- obligatorios: GoTrue invoca el trigger con un search_path sin `public`.
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tipo public.tipo_usuario := 'persona';
BEGIN
  IF (NEW.raw_user_meta_data ->> 'tipo_usuario') = 'organizacion' THEN v_tipo := 'organizacion'; END IF;
  INSERT INTO public.usuarios (id, correo, tipo_usuario)
  VALUES (NEW.id, NEW.email, v_tipo)
  ON CONFLICT (id) DO NOTHING;
  IF v_tipo = 'persona' THEN
    INSERT INTO public.personas (id, nombre)
    VALUES (NEW.id, coalesce(NEW.raw_user_meta_data ->> 'nombre', split_part(NEW.email, '@', 1)))
    ON CONFLICT (id) DO NOTHING;
  ELSE
    INSERT INTO public.organizaciones (id, nombre_oficial, direccion)
    VALUES (NEW.id, coalesce(NEW.raw_user_meta_data ->> 'nombre', split_part(NEW.email, '@', 1)), 'Panamá')
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_new_user ON auth.users;
CREATE TRIGGER trg_new_user AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
