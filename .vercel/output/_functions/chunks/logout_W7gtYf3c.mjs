import { t as __exportAll } from "./rolldown-runtime_D7D4PA-g.mjs";
import { t as supabaseServer } from "./supabase_Cm6zLzj-.mjs";
//#region src/pages/api/auth/logout.ts
var logout_exports = /* @__PURE__ */ __exportAll({
	POST: () => POST,
	prerender: () => false
});
/** POST /api/auth/logout — cierra sesión y vuelve al inicio. */
var POST = async ({ cookies, redirect }) => {
	await supabaseServer(cookies).auth.signOut();
	return redirect("/", 302);
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/auth/logout@_@ts
var page = () => logout_exports;
//#endregion
export { page };
