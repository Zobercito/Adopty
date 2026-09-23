import { t as __exportAll } from "./rolldown-runtime_D7D4PA-g.mjs";
import { t as supabaseServer } from "./supabase_Cm6zLzj-.mjs";
import { n as organizacionSchema, r as personaSchema } from "./user_BAilX-eZ.mjs";
//#region src/pages/api/perfil.ts
var perfil_exports = /* @__PURE__ */ __exportAll({
	PUT: () => PUT,
	prerender: () => false
});
/** PUT /api/perfil — actualiza persona u organización del usuario autenticado. */
var PUT = async ({ request, cookies }) => {
	const supabase = supabaseServer(cookies);
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return Response.json({ error: "No autenticado" }, { status: 401 });
	const { data: perfil } = await supabase.from("usuarios").select("tipo_usuario").eq("id", user.id).single();
	if (!perfil) return Response.json({ error: "Perfil no encontrado" }, { status: 404 });
	const body = await request.json().catch(() => null);
	if (perfil.tipo_usuario === "persona") {
		const parsed = personaSchema.safeParse(body);
		if (!parsed.success) return Response.json({ error: "Datos inválidos" }, { status: 400 });
		const { error } = await supabase.from("personas").update({
			nombre: parsed.data.nombre,
			telefono: parsed.data.telefono || null,
			descripcion: parsed.data.descripcion || null
		}).eq("id", user.id);
		if (error) return Response.json({ error: error.message }, { status: 400 });
	} else {
		const parsed = organizacionSchema.safeParse(body);
		if (!parsed.success) return Response.json({ error: "Datos inválidos" }, { status: 400 });
		const { error } = await supabase.from("organizaciones").update({
			nombre_oficial: parsed.data.nombre_oficial,
			direccion: parsed.data.direccion,
			descripcion: parsed.data.descripcion || null,
			sitio_web: parsed.data.sitio_web || null
		}).eq("id", user.id);
		if (error) return Response.json({ error: error.message }, { status: 400 });
	}
	return Response.json({ ok: true });
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/perfil@_@ts
var page = () => perfil_exports;
//#endregion
export { page };
