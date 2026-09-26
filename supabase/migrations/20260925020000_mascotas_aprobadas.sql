-- Adopty Fase 4 — el adoptante APROBADO puede seguir viendo la ficha y fotos de su adopción
-- aunque la mascota ya esté en_proceso (RLS base solo muestra `disponible` a no-dueños).
--
-- OJO: las policies mascotas<->solicitudes se referencian mutuamente; para no caer en
-- "infinite recursion" se usan helpers SECURITY DEFINER (bypasean RLS, solo devuelven boolean).
-- Correr en SQL Editor de cloud (o `supabase db push` con CLI logueado).

-- Helper: ¿soy publicador de esta mascota?
CREATE OR REPLACE FUNCTION soy_publicador(p_mascota uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.mascotas WHERE id = p_mascota AND id_publicador = auth.uid());
$$;
REVOKE ALL ON FUNCTION soy_publicador(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION soy_publicador(uuid) TO authenticated, anon;

-- Helper: ¿tengo solicitud aprobada en esta mascota?
CREATE OR REPLACE FUNCTION tengo_aprobada(p_mascota uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.solicitudes WHERE id_mascota = p_mascota AND id_adoptante = auth.uid() AND estado = 'aprobada');
$$;
REVOKE ALL ON FUNCTION tengo_aprobada(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tengo_aprobada(uuid) TO authenticated, anon;

-- solicitudes: misma semántica que 002_rls pero sin referencia directa a mascotas (rompe el ciclo)
DROP POLICY IF EXISTS sol_select ON solicitudes;
CREATE POLICY sol_select ON solicitudes FOR SELECT USING (
  auth.uid() = id_adoptante OR soy_publicador(id_mascota)
);
DROP POLICY IF EXISTS sol_update ON solicitudes;
CREATE POLICY sol_update ON solicitudes FOR UPDATE USING (
  auth.uid() = id_adoptante OR soy_publicador(id_mascota)
);

-- mascotas/fotos: adoptante aprobado ve su adopción
DROP POLICY IF EXISTS mascotas_aprobadas ON mascotas;
CREATE POLICY mascotas_aprobadas ON mascotas FOR SELECT USING (tengo_aprobada(id));
DROP POLICY IF EXISTS fotos_aprobadas ON fotos_mascota;
CREATE POLICY fotos_aprobadas ON fotos_mascota FOR SELECT USING (tengo_aprobada(id_mascota));
