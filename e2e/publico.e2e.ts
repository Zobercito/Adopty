import { expect, test } from '@playwright/test';

/**
 * Suite pública: no inicia sesión ni escribe nada en la base de datos.
 * Comprueba que las páginas cargan, que los guards redirigen y que la API
 * rechaza lo que debe rechazar antes de tocar Supabase.
 */

test.describe('páginas públicas', () => {
  for (const ruta of [
    '/',
    '/explorar',
    '/login',
    '/register',
    '/recuperar',
    '/terminos',
    '/privacidad',
    '/offline',
  ]) {
    test(`${ruta} responde 200 y tiene título`, async ({ page }) => {
      const res = await page.goto(ruta);
      expect(res?.status()).toBe(200);
      await expect(page).toHaveTitle(/Adopty/i);
    });
  }

  test('una ruta inexistente da 404', async ({ page }) => {
    const res = await page.goto('/esta-ruta-no-existe');
    expect(res?.status()).toBe(404);
  });

  test('robots.txt y sitemap existen', async ({ request }) => {
    expect((await request.get('/robots.txt')).ok()).toBe(true);
    const sitemap = await request.get('/sitemap-index.xml');
    // En dev el sitemap no se genera: solo se exige en un build/deploy.
    if (!process.env.E2E_BASE_URL)
      test.skip(sitemap.status() === 404, 'sitemap solo existe en build');
    expect(sitemap.ok()).toBe(true);
  });
});

test.describe('explorar', () => {
  test('los filtros viajan en la URL y la URL reproduce la búsqueda', async ({ page }) => {
    await page.goto('/explorar?especie=gato');
    await expect(page).toHaveURL(/especie=gato/);
    const res = await page.request.get('/api/mascotas?especie=gato');
    expect(res.ok()).toBe(true);
    const { items } = (await res.json()) as { items: { especie: string }[] };
    for (const m of items) expect(m.especie).toBe('gato');
  });

  test('una página fuera de rango no rompe la búsqueda', async ({ request }) => {
    const res = await request.get('/api/mascotas?page=9999');
    expect(res.ok()).toBe(true);
    const body = (await res.json()) as { items: unknown[] };
    expect(Array.isArray(body.items)).toBe(true);
  });
});

test.describe('rutas privadas sin sesión', () => {
  for (const ruta of [
    '/perfil',
    '/favoritos',
    '/mis-solicitudes',
    '/panel',
    '/mensajes',
    '/mascota/nueva',
    '/admin',
  ]) {
    test(`${ruta} redirige a /login?next=`, async ({ page }) => {
      await page.goto(ruta);
      await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(ruta)}`));
    });
  }
});

test.describe('API sin sesión', () => {
  const casos: [string, string, unknown?][] = [
    ['GET', '/api/favoritos'],
    ['GET', '/api/mensajes'],
    ['GET', '/api/solicitudes'],
    ['GET', '/api/mis-datos'],
    ['POST', '/api/mascotas', {}],
    ['POST', '/api/solicitudes', {}],
    ['POST', '/api/mensajes', {}],
    ['POST', '/api/reportes', {}],
  ];
  for (const [metodo, ruta, cuerpo] of casos) {
    test(`${metodo} ${ruta} → 401`, async ({ request }) => {
      const res = await request.fetch(ruta, { method: metodo, data: cuerpo });
      expect(res.status()).toBe(401);
    });
  }

  test('POST /api/mascotas/upload → 401', async ({ request, baseURL }) => {
    // Astro rechaza (403) los formularios sin `Origin` por CSRF; el navegador siempre lo manda.
    const res = await request.post('/api/mascotas/upload', {
      multipart: {},
      headers: { Origin: baseURL ?? '' },
    });
    expect(res.status()).toBe(401);
  });
});

test.describe('validación en servidor', () => {
  test('registro con datos inválidos → 400 sin crear cuenta', async ({ request }) => {
    const res = await request.post('/api/auth/register', {
      data: { nombre: 'x', correo: 'no-es-correo', password: '123', tipo_usuario: 'persona' },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toBeTruthy();
  });

  test('login con JSON roto → 400', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      headers: { 'Content-Type': 'application/json' },
      data: '{roto',
    });
    expect(res.status()).toBe(400);
  });
});
