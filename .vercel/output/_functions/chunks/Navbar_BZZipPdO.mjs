import { A as renderTemplate, D as renderSlot, M as renderHead, N as addAttribute, T as Fragment, V as createAstro, j as maybeRenderHead, w as renderComponent, z as unescapeHTML } from "./sequence_Qu4yb8w1.mjs";
import { t as createComponent } from "./compiler_DLnCfwpd.mjs";
//#region src/layouts/Layout.astro
createAstro("https://astro.build");
var $$Layout = createComponent(($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$Layout;
	const { title = "Adopty — Adopta con amor en Panamá", description = "Plataforma centralizada de adopción de mascotas en Panamá: busca, chatea y solicita sin exponer tu número." } = Astro.props;
	return renderTemplate`<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description"${addAttribute(description, "content")}><link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"><title>${title}</title>${renderHead($$result)}</head><body>${renderSlot($$result, $$slots["default"])}<footer class="max-w-6xl mx-auto px-4 my-10"><div class="soft-card p-6 flex flex-col sm:flex-row justify-between gap-3 text-sm"><p><b style="color:#1E293B">Adopty</b> · Ing. Software II · Francisco Gonzalez · Eira Arrocha</p><p>Astro · Tailwind · Supabase · Vercel</p></div></footer></body></html>`;
}, "/home/fran/MEGA/Proyectos_Prog/Clases 2026/ING SOFTWARE II/ADOPTY/adopty/src/layouts/Layout.astro", void 0);
//#endregion
//#region src/components/Navbar.astro
createAstro("https://astro.build");
var $$Navbar = createComponent(($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$Navbar;
	const { active = "inicio" } = Astro.props;
	const user = Astro.locals.user ?? null;
	const initial = (user?.email?.charAt(0) ?? "A").toUpperCase();
	const link = (key, href, label) => active === key ? `<a href="${href}" style="color:#FF7A29">${label}</a>` : `<a href="${href}" class="hover:opacity-70">${label}</a>`;
	return renderTemplate`${maybeRenderHead($$result)}<div class="max-w-6xl mx-auto px-4 pt-4 sticky top-3 z-50"><nav class="nav-float flex items-center justify-between px-4 sm:px-6 py-3" aria-label="Navegación principal"><a href="/" class="flex items-center gap-2" aria-label="Adopty inicio"><img src="/assets/logo.svg" class="w-9 h-9" alt="Logo Adopty"><span class="font-display font-extrabold text-xl" style="color:#1E293B">Ad<span style="color:#FF7A29">o</span>pty<span style="color:#2EC4B6">.</span></span></a><div class="hidden md:flex items-center gap-7 text-sm font-semibold" style="color:#475569">${renderComponent($$result, "Fragment", Fragment, {}, { "default": ($$result) => renderTemplate`${unescapeHTML(link("inicio", "/", "Inicio"))}` })}${renderComponent($$result, "Fragment", Fragment, {}, { "default": ($$result) => renderTemplate`${unescapeHTML(link("explorar", "/explorar", "Explorar"))}` })}<span class="opacity-50" title="Fase 1+">Panel</span><span class="opacity-50" title="Fase 1+">Mensajes</span></div><div class="flex items-center gap-3">${user ? renderTemplate`<a href="/perfil" aria-label="Mi perfil" class="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white" style="background:#2EC4B6">${initial}</a>` : renderTemplate`<a href="/login" class="btn-ghost text-sm px-5 py-2">Entrar</a>`}<a href="/explorar" class="btn-primary text-sm px-5 py-2.5 hidden sm:inline-block">Adoptar</a></div></nav></div>`;
}, "/home/fran/MEGA/Proyectos_Prog/Clases 2026/ING SOFTWARE II/ADOPTY/adopty/src/components/Navbar.astro", void 0);
//#endregion
export { $$Layout as n, $$Navbar as t };
