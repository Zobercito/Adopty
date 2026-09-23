import { lt as defineMiddleware, t as sequence } from "./chunks/sequence_Qu4yb8w1.mjs";
import { t as supabaseServer } from "./chunks/supabase_Cm6zLzj-.mjs";
//#region src/middleware.ts
var PROTECTED = [
	"/panel",
	"/mensajes",
	"/mascota/nueva",
	"/perfil"
];
/** Refresca sesión SSR y protege rutas privadas (redirige a /login?next=). */
var onRequest$1 = defineMiddleware(async (context, next) => {
	const { data: { user } } = await supabaseServer(context.cookies).auth.getUser();
	context.locals.user = user;
	if (PROTECTED.some((p) => context.url.pathname.startsWith(p)) && !user) {
		const nextUrl = encodeURIComponent(context.url.pathname + context.url.search);
		return context.redirect(`/login?next=${nextUrl}`);
	}
	return next();
});
//#endregion
//#region \0virtual:astro:middleware
var onRequest = sequence(onRequest$1);
//#endregion
export { onRequest };
