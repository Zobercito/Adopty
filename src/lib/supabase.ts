import { createBrowserClient, createServerClient, type CookieOptions } from '@supabase/ssr';
import type { AstroCookies } from 'astro';

const url = import.meta.env.PUBLIC_SUPABASE_URL;
const anon = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anon) {
  throw new Error('Faltan PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY en el entorno (.env).');
}

/** Cliente para el navegador (componentes cliente / scripts). */
export const supabaseBrowser = () => createBrowserClient(url, anon);

/** Cliente SSR ligado a las cookies de la petición (API routes, middleware, páginas server). */
export const supabaseServer = (cookies: AstroCookies) =>
  createServerClient(url, anon, {
    cookies: {
      get: (key: string) => cookies.get(key)?.value,
      set: (key: string, value: string, options: CookieOptions) => cookies.set(key, value, options),
      remove: (key: string, options: CookieOptions) => cookies.delete(key, options),
    },
  });
