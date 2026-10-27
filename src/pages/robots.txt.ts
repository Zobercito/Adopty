import type { APIRoute } from 'astro';

export const prerender = true;

export const GET: APIRoute = ({ site }) => {
  const base = (site ?? new URL('https://adopty-fran-4fd7.vercel.app'))
    .toString()
    .replace(/\/$/, '');
  const body = ['User-agent: *', 'Allow: /', '', `Sitemap: ${base}/sitemap-index.xml`, ''].join(
    '\n',
  );
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
