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
export default defineConfig({
  site,
  adapter: vercel(),
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
