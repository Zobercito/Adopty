-- Fase 1 — Perfil de estilo de vida para el match.
-- 1:1 con usuarios. Lo llena el adoptante y alimenta el algoritmo de afinidad.

DO $$ BEGIN CREATE TYPE ambiente AS ENUM ('apartamento', 'casa_chica', 'casa_grande'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE especie_pref AS ENUM ('perro', 'gato', 'otro', 'indiferente'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE energia_pref AS ENUM ('tranquila', 'moderada', 'activa'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE edad_pref AS ENUM ('cachorro', 'adulto', 'indiferente'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS perfil_estilo_vida (
  id_persona UUID PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  ambiente ambiente NOT NULL,
  ninos BOOLEAN NOT NULL DEFAULT false,
  especie_pref especie_pref NOT NULL,
  ubicacion TEXT NOT NULL CHECK (char_length(ubicacion) BETWEEN 2 AND 120),
  energia_pref energia_pref NOT NULL,
  otras_mascotas BOOLEAN NOT NULL DEFAULT false,
  edad_pref edad_pref NOT NULL DEFAULT 'indiferente',
  actualizado TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE perfil_estilo_vida ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pev_select ON perfil_estilo_vida;
CREATE POLICY pev_select ON perfil_estilo_vida FOR SELECT USING (auth.uid() = id_persona);
DROP POLICY IF EXISTS pev_insert ON perfil_estilo_vida;
CREATE POLICY pev_insert ON perfil_estilo_vida FOR INSERT WITH CHECK (auth.uid() = id_persona);
DROP POLICY IF EXISTS pev_update ON perfil_estilo_vida;
CREATE POLICY pev_update ON perfil_estilo_vida FOR UPDATE USING (auth.uid() = id_persona);
