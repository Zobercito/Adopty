import { t as __exportAll } from "./rolldown-runtime_D7D4PA-g.mjs";
import { t as supabaseServer } from "./supabase_Cm6zLzj-.mjs";
import { z } from "zod";
//#region src/pages/api/auth/recuperar.ts
var recuperar_exports = /* @__PURE__ */ __exportAll({
	POST: () => POST,
	prerender: () => false
});
/** POST /api/auth/recuperar — envía email de recuperación (link vuelve al callback). */
var POST = async ({ request, cookies, url }) => {
	const parsed = z.object({ correo: z.string().email() }).safeParse(await request.json().catch(() => null));
	if (!parsed.success) return Response.json({ error: "Correo inválido" }, { status: 400 });
	const { error } = await supabaseServer(cookies).auth.resetPasswordForEmail(parsed.data.correo, { redirectTo: `${url.origin}/api/auth/callback?next=/perfil` });
	if (error) return Response.json({ error: error.message }, { status: 400 });
	return Response.json({ ok: true });
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/auth/recuperar@_@ts
var page = () => recuperar_exports;
//#endregion
export { page };
