import { defineMiddleware } from 'astro:middleware';
import { supabaseServer } from './lib/supabase';

const PROTECTED = [
  '/panel',
  '/mensajes',
  '/mascota/nueva',
  '/perfil',
  '/favoritos',
  '/mis-solicitudes',
  '/admin',
];

/** Rutas que exigen sesión (redirect a /login?next=). */
function esProtegida(pathname: string): boolean {
  return PROTECTED.some((p) => pathname.startsWith(p));
}

/** Refresca sesión SSR, marca si es admin, protege rutas privadas y maneja errores. */
export const onRequest = defineMiddleware(async (context, next) => {
  try {
    const supabase = supabaseServer(context.cookies);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    context.locals.user = user;
    context.locals.isAdmin = false;

    if (esProtegida(context.url.pathname) && !user) {
      const nextUrl = encodeURIComponent(context.url.pathname + context.url.search);
      return context.redirect(`/login?next=${nextUrl}`);
    }

    // Solo para usuarios con sesión: 1 consulta barata (PK sobre `administradores`).
    if (user) {
      const { data: esAdmin } = await supabase.rpc('soy_admin');
      context.locals.isAdmin = Boolean(esAdmin);
    }

    return next();
  } catch (e) {
    console.error('Error en middleware:', e);
    // Si falla la sesión, redirige a login en rutas protegidas
    if (esProtegida(context.url.pathname)) {
      return context.redirect('/login');
    }
    return next();
  }
});
