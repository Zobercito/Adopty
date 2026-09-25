-- Adopty Fase 4 — aprobar_solicitud(): aprueba + mascota a en_proceso + auto-rechaza resto, atómico.
-- Correr en SQL Editor de cloud (o `supabase db push` con CLI logueado).
-- Solo el publicador puede invocarla con efecto (verificación con auth.uid() adentro);
-- SECURITY DEFINER para que los 3 UPDATE corran con permisos de la función.

CREATE OR REPLACE FUNCTION aprobar_solicitud(p_solicitud_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_mascota uuid; v_publicador uuid;
BEGIN
  SELECT s.id_mascota, m.id_publicador INTO v_mascota, v_publicador
  FROM solicitudes s JOIN mascotas m ON m.id = s.id_mascota
  WHERE s.id = p_solicitud_id AND s.estado = 'pendiente' AND m.deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no válida o ya resuelta'; END IF;
  IF v_publicador IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Solo el publicador puede aprobar'; END IF;
  UPDATE solicitudes SET estado = 'aprobada' WHERE id = p_solicitud_id;
  UPDATE mascotas SET estado = 'en_proceso' WHERE id = v_mascota;
  UPDATE solicitudes SET estado = 'rechazada'
  WHERE id_mascota = v_mascota AND estado = 'pendiente' AND id <> p_solicitud_id;
END $$;

REVOKE ALL ON FUNCTION aprobar_solicitud(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION aprobar_solicitud(uuid) TO authenticated;
