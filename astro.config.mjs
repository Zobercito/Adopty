// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  vite: {
    // npm user config trae ignore-scripts=true; este plugin no necesita scripts
    plugins: [tailwindcss()],
  },
});
