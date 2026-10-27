// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';

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
  integrations: [sitemap({ filter: (page) => !esRutaPrivada(page) })],
  vite: {
    plugins: [tailwindcss()],
  },
});
