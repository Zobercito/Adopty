-- Adopty — F: la auditoría deja de ser falsificable por el propio usuario.
--
-- `auditoria_insert` solo comprobaba `auth.uid() = id_usuario`, así que cualquier
-- usuario autenticado podía insertar por PostgREST una fila con la `accion`,
-- `tabla`, `id_registro` y `datos_*` que quisiera (p. ej.
-- `admin_reporte_ocultar`). El panel admin y las investigaciones leen esa tabla
-- como fuente de verdad. Se elimina la escritura directa y se expone una RPC
-- `SECURITY DEFINER` que deriva el autor de la sesión y valida acción/tabla
-- contra una allowlist.
--
-- Las funciones `SECURITY DEFINER` que ya insertaban en `auditoria`
-- (`eliminar_mi_cuenta` en 20261006030000, `estado_cuenta` en 20261006040000)
-- siguen funcionando: se ejecutan como el owner de la función, que conserva el
-- privilegio y no está sujeto a RLS (la tabla no tiene `FORCE ROW LEVEL
-- SECURITY`). Sus acciones (`baja_cuenta`, `suspender_cuenta`,
-- `reactivar_cuenta`) no forman parte de la allowlist de la RPC: no hay ningún
-- camino de cliente que deba escribirlas.

DROP POLICY IF EXISTS auditoria_insert ON public.auditoria;

REVOKE INSERT ON public.auditoria FROM authenticated;
REVOKE INSERT ON public.auditoria FROM anon;

CREATE OR REPLACE FUNCTION public.registrar_auditoria(
  p_accion TEXT,
  p_tabla TEXT,
  p_id_registro UUID,
  p_datos_anteriores JSONB DEFAULT NULL,
  p_datos_nuevos JSONB DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_valido BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501';
  END IF;
  IF NOT public.cuenta_activa() THEN
    RAISE EXCEPTION 'Cuenta inactiva' USING ERRCODE = '42501';
  END IF;
  IF p_id_registro IS NULL THEN
    RAISE EXCEPTION 'Datos inválidos' USING ERRCODE = 'P0001';
  END IF;

  -- Allowlist de pares acción/tabla que el cliente puede auditar. Cualquier
  -- otro valor se rechaza: la tabla es fuente de verdad, no un log libre.
  v_valido := (p_accion = 'password_cambiada' AND p_tabla = 'usuarios')
    OR (p_accion = 'mascota_crear' AND p_tabla = 'mascotas')
    OR (p_accion = 'mascota_eliminar' AND p_tabla = 'mascotas')
    OR (p_accion = 'solicitud_aprobar' AND p_tabla = 'solicitudes')
    OR (p_accion = 'solicitud_rechazar' AND p_tabla = 'solicitudes')
    OR (p_accion = 'solicitud_cancelar' AND p_tabla = 'solicitudes')
    OR (p_accion = 'admin_reporte_ocultar' AND p_tabla = 'reportes')
    OR (p_accion = 'admin_reporte_descartar' AND p_tabla = 'reportes')
    OR (p_accion = 'admin_verificacion_aprobar' AND p_tabla = 'verificaciones_org')
    OR (p_accion = 'admin_verificacion_rechazar' AND p_tabla = 'verificaciones_org')
    OR (p_accion = 'admin_mascota_restaurar' AND p_tabla = 'mascotas');

  IF NOT coalesce(v_valido, false) THEN
    RAISE EXCEPTION 'Acción de auditoría no permitida' USING ERRCODE = '42501';
  END IF;

  -- Las acciones de administración solo las registra un admin real; el rol se
  -- comprueba en servidor (`soy_admin()`), nunca con un parámetro.
  IF p_accion LIKE 'admin\_%' AND NOT public.soy_admin() THEN
    RAISE EXCEPTION 'Solo un administrador puede auditar acciones de admin'
      USING ERRCODE = '42501';
  END IF;

  IF pg_column_size(coalesce(p_datos_anteriores, '{}'::jsonb)) > 8192
     OR pg_column_size(coalesce(p_datos_nuevos, '{}'::jsonb)) > 8192 THEN
    RAISE EXCEPTION 'Datos de auditoría demasiado grandes' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.auditoria
    (id_usuario, accion, tabla, id_registro, datos_anteriores, datos_nuevos)
  VALUES
    (auth.uid(), p_accion, p_tabla, p_id_registro, p_datos_anteriores, p_datos_nuevos);
END; $$;

REVOKE ALL ON FUNCTION public.registrar_auditoria(TEXT, TEXT, UUID, JSONB, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_auditoria(TEXT, TEXT, UUID, JSONB, JSONB)
  TO authenticated;
