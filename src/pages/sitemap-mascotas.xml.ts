import type { APIRoute } from 'astro';
import { supabaseServer } from '../lib/supabase';

export const prerender = false;

const PAGINA = 1000;
// Límite del protocolo de sitemaps: 50 000 URLs por archivo.
const MAX_URLS = 50_000;

function xmlEscape(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * GET /sitemap-mascotas.xml — fichas públicas (disponibles y no borradas).
 *
 * Es dinámico porque las publicaciones cambian a diario; el sitemap estático de
 * @astrojs/sitemap solo conoce páginas. `robots.txt` anuncia ambos archivos.
 */
export const GET: APIRoute = async ({ site, cookies }) => {
  const supabase = supabaseServer(cookies);
  const base = (site ?? new URL('https://adopty-fran-4fd7.vercel.app'))
    .toString()
    .replace(/\/$/, '');
  const urls: string[] = [];

  for (let desde = 0; desde < MAX_URLS; desde += PAGINA) {
    const { data, error } = await supabase
      .from('mascotas')
      .select('slug, updated_at')
      .eq('estado', 'disponible')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .range(desde, Math.min(desde + PAGINA, MAX_URLS) - 1);
    if (error) {
      return new Response('No se pudo generar el sitemap', {
        status: 500,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
    const filas = (data ?? []) as { slug: string; updated_at: string }[];
    for (const fila of filas) {
      const lastmod = fila.updated_at ? `<lastmod>${fila.updated_at}</lastmod>` : '';
      urls.push(
        `<url><loc>${xmlEscape(`${base}/mascota/${fila.slug}`)}</loc>${lastmod}<changefreq>daily</changefreq><priority>0.8</priority></url>`,
      );
    }
    if (filas.length < PAGINA) break;
  }

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
};
