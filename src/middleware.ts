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
    context.locals.tienePublicaciones = false;
    context.locals.mensajesSinLeer = 0;

    if (esProtegida(context.url.pathname) && !user) {
      const nextUrl = encodeURIComponent(context.url.pathname + context.url.search);
      return context.redirect(`/login?next=${nextUrl}`);
    }

    // Solo para usuarios con sesión: 3 consultas baratas (PK/índices) para el
    // navbar: si es admin, si tiene publicaciones y cuántos mensajes sin leer.
    if (user) {
      const [{ data: esAdmin }, { data: estado }, { count: publicaciones }, { count: sinLeer }] =
        await Promise.all([
          supabase.rpc('soy_admin'),
          supabase.from('usuarios').select('activo').eq('id', user.id).maybeSingle(),
          supabase
            .from('mascotas')
            .select('id', { count: 'exact', head: true })
            .eq('id_publicador', user.id)
            .is('deleted_at', null),
          supabase
            .from('mensajes')
            .select('id', { count: 'exact', head: true })
            .eq('id_receptor', user.id)
            .eq('leido', false),
        ]);
      // Una sesión ya abierta de una cuenta dada de baja se cierra en el acto:
      // sin service role no hay "revocar todas", así que esta es la barrera.
      if (estado && !estado.activo) {
        await supabase.auth.signOut();
        context.locals.user = null;
        context.locals.isAdmin = false;
        context.locals.tienePublicaciones = false;
        context.locals.mensajesSinLeer = 0;
        if (esProtegida(context.url.pathname)) {
          return context.redirect('/login?error=cuenta-dada-de-baja');
        }
        return next();
      }
      context.locals.isAdmin = Boolean(esAdmin);
      context.locals.tienePublicaciones = (publicaciones ?? 0) > 0;
      context.locals.mensajesSinLeer = sinLeer ?? 0;
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
