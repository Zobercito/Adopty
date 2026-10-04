-- Adopty — Correcciones del panel de administración
--
-- Cierra agujeros encontrados al auditar la moderación:
--   1. Auto-reporte: un usuario podía reportar su propia publicación.
--   2. Reportes duplicados: el mismo usuario podía reportar la misma mascota
--      N veces (la API esperaba un 23505 que nunca llegaba).
--   3. El admin podía saltarse la RPC con un PATCH directo por PostgREST,
--      esquivando auditoría y las reglas de negocio.
--   4. Estado 'revisado': permitido por el CHECK pero jamás usado.
--   5. Solicitudes de verificación duplicadas de la misma organización.
--   6. Faltaba la operación inversa: restaurar una publicación oculta.

-- ============ 1 y 2. Unicidad + no auto-reporte ============
-- Sin duplicados por (mascota, reportador). Así el 23505 de la API es real.
-- (Hoy la tabla está vacía; si hubiera duplicados, el índice fallaría a propósito.)
CREATE UNIQUE INDEX IF NOT EXISTS uq_reportes_mascota_reportador
  ON public.reportes(id_mascota, id_reportador);

-- Defensa en profundidad: aunque alguien llame la API de otra forma (o PostgREST
-- directo), el dueño no puede reportar lo suyo. La API también lo valida para
-- devolver un mensaje claro, pero la regla vive aquí.
CREATE OR REPLACE FUNCTION public.validar_auto_reporte() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.mascotas m
    WHERE m.id = NEW.id_mascota AND m.id_publicador = NEW.id_reportador
  ) THEN
    RAISE EXCEPTION 'No puedes reportar tu propia publicación'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_validar_auto_reporte ON public.reportes;
CREATE TRIGGER trg_validar_auto_reporte BEFORE INSERT ON public.reportes
  FOR EACH ROW EXECUTE FUNCTION public.validar_auto_reporte();

-- ============ 3. La RPC es la ÚNICA vía de cambio ============
-- Se eliminan las policies de UPDATE: el admin ya no puede hacer PATCH directo
-- por PostgREST. Los RPC SECURITY DEFINER (resolver_*, restaurar_*) siguen
-- funcionando porque se ejecutan como el dueño y no pasan por RLS.
-- Las de SELECT se conservan: son las que permiten LISTAR todo.
DROP POLICY IF EXISTS reportes_admin_update ON public.reportes;
DROP POLICY IF EXISTS verificaciones_admin_update ON public.verificaciones_org;

-- ============ 4. Estado muerto ============
-- 'revisado' nunca lo usó el código. Se aprieta el CHECK a los estados reales.
ALTER TABLE public.reportes DROP CONSTRAINT IF EXISTS reportes_estado_check;
ALTER TABLE public.reportes ADD CONSTRAINT reportes_estado_check
  CHECK (estado IN ('pendiente', 'resuelto', 'descartado'));

-- ============ 5. Una sola solicitud de verificación pendiente por organización ============
-- Índice único parcial: permite el histórico (aprobadas/rechazadas) pero no
-- dos 'pendiente' a la vez.
CREATE UNIQUE INDEX IF NOT EXISTS uq_verificacion_pendiente_por_org
  ON public.verificaciones_org(id_organizacion)
  WHERE estado = 'pendiente';

-- ============ 6. Restaurar una publicación oculta ============
-- La UI prometía "se puede restaurar". Ahora existe de verdad.
-- Vuelve a poner la mascota visible y deja rastro en sus reportes.
CREATE OR REPLACE FUNCTION public.restaurar_publicacion(p_mascota_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT soy_admin() THEN
    RAISE EXCEPTION 'Solo un administrador puede restaurar publicaciones';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.mascotas WHERE id = p_mascota_id) THEN
    RAISE EXCEPTION 'Mascota no encontrada';
  END IF;

  UPDATE public.mascotas
  SET deleted_at = NULL
  WHERE id = p_mascota_id AND deleted_at IS NOT NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La publicación no estaba oculta';
  END IF;

  -- Deja constancia en los reportes que la ocultaron.
  UPDATE public.reportes
  SET notas_admin = trim(both ' ' from coalesce(notas_admin, '') || ' Publicación restaurada por moderación.')
  WHERE id_mascota = p_mascota_id AND estado = 'resuelto';
END $$;

REVOKE ALL ON FUNCTION public.restaurar_publicacion(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restaurar_publicacion(UUID) TO authenticated;

-- ============ Apoyo para el historial del panel ============
-- El panel lista por estado y ordena por fecha: índice compuesto.
CREATE INDEX IF NOT EXISTS idx_reportes_estado_fecha
  ON public.reportes(estado, fecha_reporte DESC);
CREATE INDEX IF NOT EXISTS idx_verificaciones_estado_fecha
  ON public.verificaciones_org(estado, fecha_solicitud DESC);