-- Adopty — completa el endurecimiento de `20261029100000`.
--
-- Estas funciones de trigger se crearon sin `REVOKE ALL ... FROM PUBLIC`, así
-- que conservaban el EXECUTE implícito que PostgreSQL concede a PUBLIC. El
-- REVOKE de roles de API no lo retira y el advisor seguía viéndolas
-- ejecutables por `anon` en `/rest/v1/rpc/*`. Las de trigger más recientes ya
-- estaban limpias (`validar_mascota`, `validar_solicitud`, `solo_marcar_leido`).
-- El disparador no comprueba EXECUTE al ejecutarse, solo al crearse.

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_usuarios_correo() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_mascota_slug() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validar_auto_reporte() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_max_fotos() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC;
