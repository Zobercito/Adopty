-- Adopty — A: el badge `verificada` no se puede auto-asignar al crear la organización.
--
-- `20261003010000_admin.sql` endureció solo el UPDATE (`GRANT UPDATE (columnas de
-- perfil)`), pero el INSERT seguía abierto: `org_insert` únicamente exigía
-- `auth.uid() = id`. Con la anon key (pública) bastaba un POST a
-- `/rest/v1/organizaciones` con `verificada: true` para que `perfil_publico()`
-- devolviera `tipo='organizacion'` y `verificada=true`, y `organizaciones_select`
-- expusiera la ficha como verificada.
--
-- La app no inserta en esta tabla: la fila la crea `handle_new_user()` al registrar
-- la cuenta, y ese trigger es SECURITY DEFINER (no pasa por RLS ni por los grants
-- de `authenticated`). Por eso se revoca el INSERT entero en vez de conceder
-- columnas: cualquier concesión volvería a permitir fabricar una organización para
-- un usuario `persona`. La policy se conserva, endurecida, como segunda barrera si
-- algún día se vuelve a conceder el INSERT.

REVOKE INSERT ON public.organizaciones FROM authenticated;
REVOKE INSERT ON public.organizaciones FROM anon;

DROP POLICY IF EXISTS org_insert ON public.organizaciones;
CREATE POLICY org_insert ON public.organizaciones FOR INSERT
  WITH CHECK (
    auth.uid() = id
    AND public.cuenta_activa()
    AND verificada = false
  );
