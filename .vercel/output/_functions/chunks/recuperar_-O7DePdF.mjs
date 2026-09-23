import { t as __exportAll } from "./rolldown-runtime_D7D4PA-g.mjs";
import { A as renderTemplate, j as maybeRenderHead, w as renderComponent } from "./sequence_Qu4yb8w1.mjs";
import { t as createComponent } from "./compiler_DLnCfwpd.mjs";
import { t as renderScript } from "./script_D2a6f4nu.mjs";
import { n as $$Layout, t as $$Navbar } from "./Navbar_BZZipPdO.mjs";
//#region src/pages/recuperar.astro
var recuperar_exports = /* @__PURE__ */ __exportAll({
	default: () => $$Recuperar,
	file: () => $$file,
	prerender: () => false,
	url: () => $$url
});
var $$Recuperar = createComponent(($$result, $$props, $$slots) => {
	return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Adopty — Recuperar contraseña" }, { "default": async ($$result) => renderTemplate`${renderComponent($$result, "Navbar", $$Navbar, { "active": "inicio" })}${maybeRenderHead($$result)}<main class="max-w-md mx-auto px-4 mt-10"><div class="soft-card p-8"><h1 class="font-display font-extrabold text-2xl" style="color:#1E293B">Recuperar contraseña</h1><p class="text-sm mt-1">Te enviamos un enlace para restablecerla.</p><p id="err" class="text-sm mt-3 font-semibold hidden" style="color:#B45309" role="alert"></p><p id="ok" class="text-sm mt-3 font-semibold hidden" style="color:#065F46" role="status"></p><form id="recForm" class="mt-5 grid gap-3"><div><label class="text-xs font-bold uppercase tracking-wide" for="correo">Correo</label><input id="correo" name="correo" type="email" required autocomplete="email" class="input-soft mt-1 text-sm"></div><button class="btn-primary py-3 text-sm mt-2" type="submit">Enviar enlace</button></form><p class="text-sm mt-4 text-center"><a href="/login" class="hover:underline">Volver a entrar</a></p></div></main>${renderScript($$result, "/home/fran/MEGA/Proyectos_Prog/Clases 2026/ING SOFTWARE II/ADOPTY/adopty/src/pages/recuperar.astro?astro&type=script&index=0&lang.ts")}` })}`;
}, "/home/fran/MEGA/Proyectos_Prog/Clases 2026/ING SOFTWARE II/ADOPTY/adopty/src/pages/recuperar.astro", void 0);
var $$file = "/home/fran/MEGA/Proyectos_Prog/Clases 2026/ING SOFTWARE II/ADOPTY/adopty/src/pages/recuperar.astro";
var $$url = "/recuperar";
//#endregion
//#region \0virtual:astro:page:src/pages/recuperar@_@astro
var page = () => recuperar_exports;
//#endregion
export { page };
