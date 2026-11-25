// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';
import sentry from '@sentry/astro';

// https://astro.build/config
// SITE_URL: dominio de producción. Definir en Vercel → Settings → Environment Variables
// (ej. https://tu-dominio.com). El fallback apunta al dominio del proyecto Adopty.
// OJO: no usar `adopty.vercel.app` — ese dominio pertenece a otro proyecto.
const site = process.env.SITE_URL ?? 'https://adopty-fran-4fd7.vercel.app';

// Rutas privadas o sin valor de búsqueda: no deben aparecer en el sitemap.
const RUTAS_PRIVADAS = [
  '/admin',
  '/panel',
  '/mensajes',
  '/perfil',
  '/favoritos',
  '/mis-solicitudes',
  '/mascota/nueva',
  '/login',
  '/register',
  '/recuperar',
  '/offline',
  '/404',
  '/500',
];
/** @param {string} page */
const esRutaPrivada = (page) => {
  const path = new URL(page).pathname.replace(/\/+$/, '') || '/';
  return path !== '/' && RUTAS_PRIVADAS.some((r) => path === r || path.startsWith(`${r}/`));
};

export default defineConfig({
  site,
  adapter: vercel(),
  integrations: [sentry({ telemetry: false }), sitemap({ filter: (page) => !esRutaPrivada(page) })],
  // CSP por página con hashes de Astro (script-src) y `style-src 'unsafe-inline'`
  // porque la UI usa atributos `style` dinámicos. El header de `vercel.json` añade
  // `frame-ancestors` (ignorado en <meta>) y actúa de respaldo en páginas sin meta.
  security: {
    csp: {
      algorithm: 'SHA-256',
      directives: [
        "default-src 'self'",
        "img-src 'self' data: blob: https://*.supabase.co",
        "font-src 'self' data:",
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://va.vercel-scripts.com https://vitals.vercel-insights.com https://*.vercel-insights.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io",
        'frame-src https://vercel.live https://*.vercel.live',
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
        "manifest-src 'self'",
        "worker-src 'self'",
        'upgrade-insecure-requests',
      ],
      scriptDirective: {
        resources: [
          "'self'",
          'https://va.vercel-scripts.com',
          'https://vercel.live',
          'https://*.vercel.live',
        ],
      },
      styleDirective: {
        resources: ["'self'", "'unsafe-inline'"],
      },
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
