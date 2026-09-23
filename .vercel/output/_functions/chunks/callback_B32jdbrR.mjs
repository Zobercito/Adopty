import { t as __exportAll } from "./rolldown-runtime_D7D4PA-g.mjs";
import { t as supabaseServer } from "./supabase_Cm6zLzj-.mjs";
//#region src/pages/api/auth/callback.ts
var callback_exports = /* @__PURE__ */ __exportAll({
	GET: () => GET,
	prerender: () => false
});
/**
* GET /api/auth/callback?code= — intercambio de código (confirmación de email
* y futuro Google OAuth) por sesión en cookies SSR.
*/
var GET = async ({ url, cookies, redirect }) => {
	const code = url.searchParams.get("code");
	const next = url.searchParams.get("next") ?? "/perfil";
	if (code) {
		const { error } = await supabaseServer(cookies).auth.exchangeCodeForSession(code);
		if (!error) return redirect(next.startsWith("/") ? next : "/perfil", 302);
	}
	return redirect("/login?error=callback", 302);
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/auth/callback@_@ts
var page = () => callback_exports;
//#endregion
export { page };
