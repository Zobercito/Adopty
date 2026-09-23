import { t as __exportAll } from "./rolldown-runtime_D7D4PA-g.mjs";
import { A as renderTemplate, P as defineScriptVars, V as createAstro, j as maybeRenderHead, w as renderComponent } from "./sequence_Qu4yb8w1.mjs";
import { t as createComponent } from "./compiler_DLnCfwpd.mjs";
import { n as $$Layout, t as $$Navbar } from "./Navbar_BZZipPdO.mjs";
//#region src/pages/login.astro
var login_exports = /* @__PURE__ */ __exportAll({
	default: () => $$Login,
	file: () => $$file,
	prerender: () => false,
	url: () => $$url
});
createAstro("https://astro.build");
var $$Login = createComponent(($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$Login;
	if (Astro.locals.user) return Astro.redirect("/perfil");
	const next = Astro.url.searchParams.get("next") ?? "/perfil";
	const errorParam = Astro.url.searchParams.get("error");
	return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Adopty — Entrar" }, { "default": async ($$result) => renderTemplate`${renderComponent($$result, "Navbar", $$Navbar, { "active": "inicio" })}${maybeRenderHead($$result)}<main class="max-w-md mx-auto px-4 mt-10"><div class="soft-card p-8"><h1 class="font-display font-extrabold text-2xl" style="color:#1E293B">Entrar a Adopty</h1><p class="text-sm mt-1">¿Sin cuenta? <a href="/register" class="font-bold" style="color:#14A098">Regístrate</a></p>${errorParam === "callback" && renderTemplate`<p class="text-sm mt-3 font-semibold" style="color:#B45309" role="alert">El enlace expiró o es inválido. Intenta de nuevo.</p>`}<p id="err" class="text-sm mt-3 font-semibold hidden" style="color:#B45309" role="alert"></p><form id="loginForm" class="mt-5 grid gap-3"><div><label class="text-xs font-bold uppercase tracking-wide" for="correo">Correo</label><input id="correo" name="correo" type="email" required autocomplete="email" class="input-soft mt-1 text-sm"></div><div><label class="text-xs font-bold uppercase tracking-wide" for="password">Contraseña</label><input id="password" name="password" type="password" required autocomplete="current-password" class="input-soft mt-1 text-sm"></div><button class="btn-primary py-3 text-sm mt-2" type="submit">Entrar</button></form><p class="text-sm mt-4 text-center"><a href="/recuperar" class="hover:underline">¿Olvidaste tu contraseña?</a></p><p class="text-xs mt-4 text-gray-400 text-center">Google OAuth llega en el siguiente paso de Fase 1.</p></div></main><script>(function(){${defineScriptVars({ next })}
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = document.getElementById('err');
      err.classList.add('hidden');
      const fd = new FormData(e.target);
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo: fd.get('correo'), password: fd.get('password'), next }),
      });
      if (res.redirected) { location.href = res.url; return; }
      const data = await res.json().catch(() => ({}));
      err.textContent = data.error ?? 'Error al entrar';
      err.classList.remove('hidden');
    });
  })();<\/script>` })}`;
}, "/home/fran/MEGA/Proyectos_Prog/Clases 2026/ING SOFTWARE II/ADOPTY/adopty/src/pages/login.astro", void 0);
var $$file = "/home/fran/MEGA/Proyectos_Prog/Clases 2026/ING SOFTWARE II/ADOPTY/adopty/src/pages/login.astro";
var $$url = "/login";
//#endregion
//#region \0virtual:astro:page:src/pages/login@_@astro
var page = () => login_exports;
//#endregion
export { page };
