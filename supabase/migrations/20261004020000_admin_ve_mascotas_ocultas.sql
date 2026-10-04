-- Adopty — El admin debe poder VER las publicaciones ocultas
--
-- Bug detectado al probar el panel: `mascotas_select` solo deja ver las
-- mascotas `disponible` sin borrar, o las propias del usuario:
--
--     (estado = 'disponible' AND deleted_at IS NULL) OR (auth.uid() = id_publicador)
--
-- Como el embeds `reportes -> mascotas` corre con la sesión del admin (que no es
-- el dueño), PostgREST devolvía `mascotas: null` y la bandeja "Ocultadas" salía
-- siempre vacía. Lo mismo pasaba con mascotas en `en_proceso` o `adoptada`.
-- O sea: la restauración existía pero era inalcanzable desde la interfaz.
--
-- Se añade una policy para admins, igual que ya existe en reportes y
-- verificaciones_org. Es una policy ADICIONAL: la RLS combina con OR, así que
-- el público y los dueños siguen viendo exactamente lo mismo que antes.

DROP POLICY IF EXISTS mascotas_admin_select ON public.mascotas;
CREATE POLICY mascotas_admin_select ON public.mascotas
  FOR SELECT USING (soy_admin());
