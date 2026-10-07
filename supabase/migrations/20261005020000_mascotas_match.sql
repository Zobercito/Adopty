-- Fase 2 — campos de mascota para el match (energía y compatibilidad).
-- Defaults para no romper las filas existentes.

DO $$ BEGIN CREATE TYPE nivel_energia AS ENUM ('tranquila', 'moderada', 'activa'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE mascotas
  ADD COLUMN IF NOT EXISTS nivel_energia nivel_energia NOT NULL DEFAULT 'moderada',
  ADD COLUMN IF NOT EXISTS apto_ninos BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS apto_otros BOOLEAN NOT NULL DEFAULT true;
