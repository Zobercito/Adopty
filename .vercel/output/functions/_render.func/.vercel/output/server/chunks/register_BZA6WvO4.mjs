import { t as __exportAll } from "./rolldown-runtime_D7D4PA-g.mjs";
import { A as renderTemplate, V as createAstro, j as maybeRenderHead, w as renderComponent } from "./sequence_Qu4yb8w1.mjs";
import { t as createComponent } from "./compiler_DLnCfwpd.mjs";
import { t as renderScript } from "./script_D2a6f4nu.mjs";
import { n as $$Layout, t as $$Navbar } from "./Navbar_BZZipPdO.mjs";
//#region src/pages/register.astro
var register_exports = /* @__PURE__ */ __exportAll({
	default: () => $$Register,
	file: () => $$file,
	prerender: () => false,
	url: () => $$url
});
createAstro("https://astro.build");
var $$Register = createComponent(($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$Register;
	if (Astro.locals.user) return Astro.redirect("/perfil");
	return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Adopty — Crear cuenta" }, { "default": async ($$result) => renderTemplate`${renderComponent($$result, "Navbar", $$Navbar, { "active": "inicio" })}${maybeRenderHead($$result)}<main class="max-w-md mx-auto px-4 mt-10"><div class="soft-card p-8"><h1 class="font-display font-extrabold text-2xl" style="color:#1E293B">Crear cuenta</h1><p class="text-sm mt-1">¿Ya tienes? <a href="/login" class="font-bold" style="color:#14A098">Entra</a></p><p id="err" class="text-sm mt-3 font-semibold hidden" style="color:#B45309" role="alert"></p><p id="ok" class="text-sm mt-3 font-semibold hidden" style="color:#065F46" role="status"></p><form id="regForm" class="mt-5 grid gap-3"><div><label class="text-xs font-bold uppercase tracking-wide" for="nombre">Nombre / Organización</label><input id="nombre" name="nombre" required minlength="2" maxlength="80" autocomplete="name" class="input-soft mt-1 text-sm"></div><div><label class="text-xs font-bold uppercase tracking-wide" for="correo">Correo</label><input id="correo" name="correo" type="email" required autocomplete="email" class="input-soft mt-1 text-sm"></div><div><label class="text-xs font-bold uppercase tracking-wide" for="password">Contraseña (mín. 8)</label><input id="password" name="password" type="password" required minlength="8" autocomplete="new-password" class="input-soft mt-1 text-sm"></div><fieldset><legend class="text-xs font-bold uppercase tracking-wide">Tipo de cuenta</legend><div class="flex gap-2 mt-2"><label class="chip cursor-pointer"><input type="radio" name="tipo_usuario" value="persona" checked class="accent-orange-500"> Persona</label><label class="chip cursor-pointer"><input type="radio" name="tipo_usuario" value="organizacion" class="accent-orange-500"> Organización</label></div></fieldset><label class="flex items-start gap-2 text-xs mt-1"><input type="checkbox" required class="mt-0.5 accent-orange-500"><span>Acepto el uso de mi correo y ubicación para fines de adopción (Ley 81 de Protección de Datos de Panamá).</span></label><button class="btn-primary py-3 text-sm mt-2" type="submit">Registrarme</button></form></div></main>${renderScript($$result, "/home/fran/MEGA/Proyectos_Prog/Clases 2026/ING SOFTWARE II/ADOPTY/adopty/src/pages/register.astro?astro&type=script&index=0&lang.ts")}` })}`;
}, "/home/fran/MEGA/Proyectos_Prog/Clases 2026/ING SOFTWARE II/ADOPTY/adopty/src/pages/register.astro", void 0);
var $$file = "/home/fran/MEGA/Proyectos_Prog/Clases 2026/ING SOFTWARE II/ADOPTY/adopty/src/pages/register.astro";
var $$url = "/register";
//#endregion
//#region \0virtual:astro:page:src/pages/register@_@astro
var page = () => register_exports;
//#endregion
export { page };
