import { t as __exportAll } from "./rolldown-runtime_D7D4PA-g.mjs";
import { A as renderTemplate, N as addAttribute, V as createAstro, j as maybeRenderHead, w as renderComponent } from "./sequence_Qu4yb8w1.mjs";
import { t as createComponent } from "./compiler_DLnCfwpd.mjs";
import { t as renderScript } from "./script_D2a6f4nu.mjs";
import { t as supabaseServer } from "./supabase_Cm6zLzj-.mjs";
import { n as $$Layout, t as $$Navbar } from "./Navbar_BZZipPdO.mjs";
//#region src/pages/perfil.astro
var perfil_exports = /* @__PURE__ */ __exportAll({
	default: () => $$Perfil,
	file: () => $$file,
	prerender: () => false,
	url: () => $$url
});
createAstro("https://astro.build");
var $$Perfil = createComponent(async ($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$Perfil;
	const user = Astro.locals.user;
	if (!user) return Astro.redirect("/login?next=/perfil");
	const supabase = supabaseServer(Astro.cookies);
	const { data: perfil } = await supabase.from("usuarios").select("tipo_usuario, correo").eq("id", user.id).single();
	const tipo = perfil?.tipo_usuario ?? "persona";
	let detalle = {};
	let verificada = false;
	if (tipo === "persona") {
		const { data } = await supabase.from("personas").select("nombre, telefono, descripcion").eq("id", user.id).single();
		detalle = data ?? {};
	} else {
		const { data } = await supabase.from("organizaciones").select("nombre_oficial, direccion, descripcion, sitio_web, verificada").eq("id", user.id).single();
		detalle = data ?? {};
		verificada = Boolean(data?.verificada);
	}
	const nombre = detalle.nombre ?? detalle.nombre_oficial ?? user.email?.split("@")[0] ?? "Usuario";
	return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Adopty — Mi perfil" }, { "default": async ($$result) => renderTemplate`${renderComponent($$result, "Navbar", $$Navbar, { "active": "inicio" })}${maybeRenderHead($$result)}<main class="max-w-xl mx-auto px-4 mt-10"><div class="soft-card p-8"><div class="flex items-center gap-4"><span class="w-14 h-14 rounded-full flex items-center justify-center font-bold text-white text-xl" style="background:#2EC4B6">${nombre.charAt(0).toUpperCase()}</span><div><h1 class="font-display font-extrabold text-2xl" style="color:#1E293B">${nombre}</h1><p class="text-sm">${perfil?.correo} · ${tipo === "persona" ? "Persona" : "Organización"}${tipo === "organizacion" && (verificada ? " · ✓ Verificada" : " · pendiente de verificación")}</p></div></div><p id="err" class="text-sm mt-3 font-semibold hidden" style="color:#B45309" role="alert"></p><p id="ok" class="text-sm mt-3 font-semibold hidden" style="color:#065F46" role="status"></p>${tipo === "persona" ? renderTemplate`<form id="perfForm" class="mt-5 grid gap-3"><div><label class="text-xs font-bold uppercase tracking-wide" for="nombre">Nombre</label><input id="nombre" name="nombre" required minlength="2" maxlength="80"${addAttribute(detalle.nombre ?? "", "value")} class="input-soft mt-1 text-sm"></div><div><label class="text-xs font-bold uppercase tracking-wide" for="telefono">Teléfono (opcional, no se muestra en público)</label><input id="telefono" name="telefono" maxlength="20"${addAttribute(detalle.telefono ?? "", "value")} class="input-soft mt-1 text-sm"></div><div><label class="text-xs font-bold uppercase tracking-wide" for="descripcion">Descripción</label><textarea id="descripcion" name="descripcion" maxlength="500" rows="3" class="input-soft mt-1 text-sm">${detalle.descripcion ?? ""}</textarea></div><button class="btn-primary py-3 text-sm mt-2" type="submit">Guardar</button></form>` : renderTemplate`<form id="perfForm" class="mt-5 grid gap-3" data-org="1"><div><label class="text-xs font-bold uppercase tracking-wide" for="nombre_oficial">Nombre oficial</label><input id="nombre_oficial" name="nombre_oficial" required minlength="2" maxlength="120"${addAttribute(detalle.nombre_oficial ?? "", "value")} class="input-soft mt-1 text-sm"></div><div><label class="text-xs font-bold uppercase tracking-wide" for="direccion">Dirección</label><input id="direccion" name="direccion" required maxlength="200"${addAttribute(detalle.direccion ?? "", "value")} class="input-soft mt-1 text-sm"></div><div><label class="text-xs font-bold uppercase tracking-wide" for="sitio_web">Sitio web (opcional)</label><input id="sitio_web" name="sitio_web" type="url" maxlength="200"${addAttribute(detalle.sitio_web ?? "", "value")} class="input-soft mt-1 text-sm"></div><div><label class="text-xs font-bold uppercase tracking-wide" for="descripcion">Descripción</label><textarea id="descripcion" name="descripcion" maxlength="1000" rows="3" class="input-soft mt-1 text-sm">${detalle.descripcion ?? ""}</textarea></div><button class="btn-primary py-3 text-sm mt-2" type="submit">Guardar</button></form>`}${!verificada && tipo === "organizacion" && renderTemplate`<p class="text-xs mt-4 text-gray-400">Para el badge "verificada": escríbenos con evidencia (redes/documento) — proceso manual v1.</p>`}<form action="/api/auth/logout" method="post" class="mt-4"><button class="btn-ghost w-full py-2.5 text-sm" type="submit">Cerrar sesión</button></form></div></main>${renderScript($$result, "/home/fran/MEGA/Proyectos_Prog/Clases 2026/ING SOFTWARE II/ADOPTY/adopty/src/pages/perfil.astro?astro&type=script&index=0&lang.ts")}` })}`;
}, "/home/fran/MEGA/Proyectos_Prog/Clases 2026/ING SOFTWARE II/ADOPTY/adopty/src/pages/perfil.astro", void 0);
var $$file = "/home/fran/MEGA/Proyectos_Prog/Clases 2026/ING SOFTWARE II/ADOPTY/adopty/src/pages/perfil.astro";
var $$url = "/perfil";
//#endregion
//#region \0virtual:astro:page:src/pages/perfil@_@astro
var page = () => perfil_exports;
//#endregion
export { page };
