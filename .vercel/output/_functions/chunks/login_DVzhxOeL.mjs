import { t as __exportAll } from "./rolldown-runtime_D7D4PA-g.mjs";
import { t as supabaseServer } from "./supabase_Cm6zLzj-.mjs";
import { t as loginSchema } from "./user_BAilX-eZ.mjs";
//#region src/pages/api/auth/login.ts
var login_exports = /* @__PURE__ */ __exportAll({
	POST: () => POST,
	prerender: () => false
});
/** POST /api/auth/login — signIn con cookies SSR + retorno a ?next=. */
var POST = async ({ request, cookies, redirect }) => {
	let body;
	try {
		body = await request.json();
	} catch {
		return Response.json({ error: "JSON inválido" }, { status: 400 });
	}
	const parsed = loginSchema.safeParse(body);
	if (!parsed.success) return Response.json({ error: "Datos inválidos" }, { status: 400 });
	const { correo, password } = parsed.data;
	const { error } = await supabaseServer(cookies).auth.signInWithPassword({
		email: correo,
		password
	});
	if (error) return Response.json({ error: "Correo o contraseña incorrectos" }, { status: 401 });
	let next = "/perfil";
	try {
		const { next: n } = body ?? {};
		if (n && n.startsWith("/") && !n.startsWith("//")) next = n;
	} catch {}
	return redirect(next, 302);
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/auth/login@_@ts
var page = () => login_exports;
//#endregion
export { page };
