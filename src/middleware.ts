import { defineMiddleware } from 'astro:middleware';
import { supabaseServer } from './lib/supabase';

const PROTECTED = ['/panel', '/mensajes', '/mascota/nueva', '/perfil', '/favoritos'];

/** Refresca sesión SSR y protege rutas privadas (redirige a /login?next=). */
export const onRequest = defineMiddleware(async (context, next) => {
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
});
