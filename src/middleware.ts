import { defineMiddleware } from 'astro:middleware';
import { supabaseServer } from './lib/supabase';

const PROTECTED = [
  '/panel',
  '/mensajes',
  '/mascota/nueva',
  '/perfil',
  '/favoritos',
  '/mis-solicitudes',
];

/** Refresca sesión SSR, protege rutas privadas y maneja errores globalmente. */
export const onRequest = defineMiddleware(async (context, next) => {
  try {
    const supabase = supabaseServer(context.cookies);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    context.locals.user = user;

    if (PROTECTED.some((p) => context.url.pathname.startsWith(p)) && !user) {
      const nextUrl = encodeURIComponent(context.url.pathname + context.url.search);
      return context.redirect(`/login?next=${nextUrl}`);
    }
    return next();
  } catch (e) {
    console.error('Error en middleware:', e);
    // Si falla la sesión, redirige a login en rutas protegidas
    if (PROTECTED.some((p) => context.url.pathname.startsWith(p))) {
      return context.redirect('/login');
    }
    return next();
  }
});
