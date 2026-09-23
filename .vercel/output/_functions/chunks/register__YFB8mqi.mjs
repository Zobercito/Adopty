import { t as __exportAll } from "./rolldown-runtime_D7D4PA-g.mjs";
import { t as supabaseServer } from "./supabase_Cm6zLzj-.mjs";
import { i as registerSchema } from "./user_BAilX-eZ.mjs";
//#region src/pages/api/auth/register.ts
var register_exports = /* @__PURE__ */ __exportAll({
	POST: () => POST,
	prerender: () => false
});
/** POST /api/auth/register — validación Zod en servidor + signUp con metadata. */
var POST = async ({ request, cookies, redirect }) => {
	let body;
	try {
		body = await request.json();
	} catch {
		return Response.json({ error: "JSON inválido" }, { status: 400 });
	}
	const parsed = registerSchema.safeParse(body);
	if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
	const { nombre, correo, password, tipo_usuario } = parsed.data;
	const { data, error } = await supabaseServer(cookies).auth.signUp({
		email: correo,
		password,
		options: { data: {
			nombre,
			tipo_usuario
		} }
	});
	if (error) return Response.json({ error: error.message }, { status: 400 });
	if (!data.session) return Response.json({
		ok: true,
		confirmaEmail: true
	});
	return redirect("/perfil", 302);
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/auth/register@_@ts
var page = () => register_exports;
//#endregion
export { page };
