// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
// SITE_URL: dominio de producción (Fase 8 lo fija al desplegar; por defecto preview).
const site = process.env.SITE_URL ?? 'https://adopty.vercel.app';
export default defineConfig({
  site,
  adapter: vercel(),
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
