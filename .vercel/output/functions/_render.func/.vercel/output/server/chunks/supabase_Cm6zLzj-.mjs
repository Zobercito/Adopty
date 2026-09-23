import { createServerClient } from "@supabase/ssr";
//#region src/lib/supabase.ts
var url = "https://dvebieysgnhmimmxjwjc.supabase.co";
var anon = "PENDIENTE_poner_anon_key_del_dashboard";
var supabaseServer = (cookies) => createServerClient(url, anon, { cookies: {
	get: (key) => cookies.get(key)?.value,
	set: (key, value, options) => cookies.set(key, value, options),
	remove: (key, options) => cookies.delete(key, options)
} });
//#endregion
export { supabaseServer as t };
