-- Adopty — las mascotas de una cuenta suspendida dejan de ser públicas.
--
-- `mascotas_select` solo miraba estado y `deleted_at`, así que suspender a un
-- publicador lo dejaba sin poder operar pero sus fichas seguían visibles y
-- solicitables. La suspensión ahora también retira sus publicaciones del
-- catálogo; al reactivar la cuenta vuelven solas (la fila no se toca).
--
-- La comprobación va en `private` (no expuesto por PostgREST) y en una función
-- `SECURITY DEFINER`: `usuarios` tiene RLS y una subconsulta directa desde la
-- policy devolvería siempre false para anon. Así no se puede consultar el
-- estado de una cuenta por RPC.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO anon, authenticated;

CREATE OR REPLACE FUNCTION private.publicador_activo(p_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((SELECT activo FROM public.usuarios WHERE id = p_id), false);
$$;

REVOKE ALL ON FUNCTION private.publicador_activo(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.publicador_activo(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS mascotas_select ON public.mascotas;
CREATE POLICY mascotas_select ON public.mascotas FOR SELECT USING (
  (
    estado = 'disponible'
    AND deleted_at IS NULL
    AND private.publicador_activo(id_publicador)
  )
  OR auth.uid() = id_publicador
);

-- Ya no se usa la versión pública (quedaba expuesta como RPC).
DROP FUNCTION IF EXISTS public.publicador_activo(uuid);
