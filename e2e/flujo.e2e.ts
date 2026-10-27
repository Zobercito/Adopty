import { readFileSync } from 'node:fs';
import { expect, request as apiRequest, test, type APIRequestContext } from '@playwright/test';
import sharp from 'sharp';

/**
 * Flujo principal de punta a punta (CU-01…CU-08): registro → publicar con foto →
 * solicitar → aprobar → chat → reportar (por la interfaz).
 *
 * ESCRIBE en la base de datos (crea 3 cuentas y 2 mascotas por corrida), así que:
 * - solo corre con `E2E_FLUJO=1`;
 * - se niega a correr si Supabase no es local (`supabase start` + `supabase db reset`);
 * - en local el registro no pide confirmar el correo, así que deja sesión al instante.
 */

function supabaseUrl(): string {
  if (process.env.PUBLIC_SUPABASE_URL) return process.env.PUBLIC_SUPABASE_URL;
  try {
    const linea = readFileSync('.env', 'utf8')
      .split('\n')
      .find((l) => l.startsWith('PUBLIC_SUPABASE_URL='));
    return linea?.split('=')[1]?.trim() ?? '';
  } catch {
    return '';
  }
}

const esLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(supabaseUrl());
test.skip(process.env.E2E_FLUJO !== '1', 'Flujo con escrituras: activar con E2E_FLUJO=1');
test.skip(!esLocal, 'El flujo solo corre contra Supabase local: escribe cuentas y mascotas');

test.describe.configure({ mode: 'serial' });

const sello = Date.now().toString(36);
const PASSWORD = 'E2e-Adopty-2026!';
const correo = (rol: string) => `e2e-${rol}-${sello}@adopty.test`;

let publicador: APIRequestContext;
let adoptante: APIRequestContext;
let tercero: APIRequestContext;
let mascotaId = '';
let mascotaReporteSlug = '';
let solicitudId = '';
let idAdoptante = '';

/** Registra una cuenta; cada contexto guarda su propia cookie de sesión. */
async function registrar(nombre: string, rol: string, tipo: 'persona' | 'organizacion') {
  const baseURL = test.info().project.use.baseURL;
  // `Origin` como en el navegador: Astro rechaza por CSRF los formularios sin él.
  const ctx = await apiRequest.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL ?? '' } });
  const res = await ctx.post('/api/auth/register', {
    data: { nombre, correo: correo(rol), password: PASSWORD, tipo_usuario: tipo },
    maxRedirects: 0,
  });
  expect(res.status(), await res.text()).toBe(302);
  return ctx;
}

async function publicar(ctx: APIRequestContext, nombre: string) {
  const png = await sharp({
    create: { width: 320, height: 240, channels: 3, background: '#ff6b35' },
  })
    .png()
    .toBuffer();
  const subida = await ctx.post('/api/mascotas/upload', {
    multipart: { fotos: { name: 'foto.png', mimeType: 'image/png', buffer: png } },
  });
  // Regresión: el endpoint usaba rateLimit sin importarlo y respondía 500 con sesión.
  expect(subida.status(), await subida.text()).toBe(200);
  const { paths } = (await subida.json()) as { paths: string[] };
  expect(paths).toHaveLength(1);

  const res = await ctx.post('/api/mascotas', {
    data: {
      nombre,
      especie: 'perro',
      raza: 'Mestizo',
      edad_meses: 14,
      sexo: 'Hembra',
      tamano: 'Mediano',
      ubicacion: 'Ciudad de Panamá',
      descripcion: 'Mascota creada por la suite e2e de Adopty.',
      fotos: paths,
    },
  });
  expect(res.status(), await res.text()).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

test.beforeAll(async () => {
  publicador = await registrar(`Refugio E2E ${sello}`, 'org', 'organizacion');
  adoptante = await registrar('Adoptante E2E', 'adoptante', 'persona');
  tercero = await registrar('Tercero E2E', 'tercero', 'persona');
});

test.afterAll(async () => {
  await Promise.all([publicador?.dispose(), adoptante?.dispose(), tercero?.dispose()]);
});

test('el publicador sube una foto y publica una mascota', async () => {
  mascotaId = await publicar(publicador, `Luna E2E ${sello}`);
  const detalle = await adoptante.get(`/api/mascotas/${mascotaId}`);
  expect(detalle.ok()).toBe(true);
  const pet = (await detalle.json()) as { estado: string; fotos: unknown[] };
  expect(pet.estado).toBe('disponible');
  expect(pet.fotos).toHaveLength(1);
});

test('nadie puede editar una mascota ajena', async () => {
  const res = await tercero.patch(`/api/mascotas/${mascotaId}`, { data: { estado: 'adoptada' } });
  expect(res.status()).toBe(403);
});

test('el adoptante solicita y no puede duplicar la solicitud', async () => {
  const datos = { id_mascota: mascotaId, mensaje_inicial: 'Tengo patio y experiencia con perros.' };
  const res = await adoptante.post('/api/solicitudes', { data: datos });
  expect(res.status(), await res.text()).toBe(201);
  solicitudId = ((await res.json()) as { id: string }).id;

  const dup = await adoptante.post('/api/solicitudes', { data: datos });
  expect(dup.status()).toBe(409);
});

test('el publicador no puede solicitar su propia mascota', async () => {
  const res = await publicador.post('/api/solicitudes', {
    data: { id_mascota: mascotaId, mensaje_inicial: 'Intento solicitar lo mío.' },
  });
  expect(res.status()).toBe(403);
});

test('el chat está cerrado hasta aprobar', async () => {
  const res = await adoptante.post('/api/mensajes', {
    data: { id_mascota: mascotaId, contenido: '¿Puedo visitarla?' },
  });
  expect(res.status()).toBe(403);
});

test('un tercero no puede aprobar ni ver la solicitud', async () => {
  const res = await tercero.patch(`/api/solicitudes/${solicitudId}`, {
    data: { accion: 'aprobar' },
  });
  // La RLS ni siquiera le deja leerla: 404, o 403 si llegara a verla.
  expect([403, 404]).toContain(res.status());
  const lista = await tercero.get('/api/solicitudes?rol=publicador');
  const { solicitudes } = (await lista.json()) as { solicitudes: { id: string }[] };
  expect(solicitudes.map((s) => s.id)).not.toContain(solicitudId);
});

test('el adoptante no puede aprobar su propia solicitud', async () => {
  const res = await adoptante.patch(`/api/solicitudes/${solicitudId}`, {
    data: { accion: 'aprobar' },
  });
  expect(res.status()).toBe(403);
});

test('el publicador aprueba y la mascota pasa a en_proceso', async () => {
  const lista = await publicador.get('/api/solicitudes?rol=publicador');
  const { solicitudes } = (await lista.json()) as {
    solicitudes: { id: string; adoptante: { id: string } }[];
  };
  const mia = solicitudes.find((s) => s.id === solicitudId);
  expect(mia).toBeTruthy();
  idAdoptante = mia!.adoptante.id;

  const res = await publicador.patch(`/api/solicitudes/${solicitudId}`, {
    data: { accion: 'aprobar' },
  });
  expect(res.status(), await res.text()).toBe(200);

  const detalle = await publicador.get(`/api/mascotas/${mascotaId}`);
  expect(((await detalle.json()) as { estado: string }).estado).toBe('en_proceso');

  // Las transiciones terminales no se reabren.
  const otra = await publicador.patch(`/api/solicitudes/${solicitudId}`, {
    data: { accion: 'rechazar' },
  });
  expect(otra.status()).toBe(409);
});

test('con la solicitud aprobada, ambos chatean y cuentan no-leídos', async () => {
  const ida = await adoptante.post('/api/mensajes', {
    data: { id_mascota: mascotaId, contenido: '¡Gracias! ¿Cuándo puedo visitarla?' },
  });
  expect(ida.status(), await ida.text()).toBe(201);

  const bandeja = await publicador.get('/api/mensajes');
  const { items } = (await bandeja.json()) as {
    items: { id_mascota: string; otra_parte: string; no_leidos: number }[];
  };
  const hilo = items.find((h) => h.id_mascota === mascotaId);
  expect(hilo?.otra_parte).toBe(idAdoptante);
  expect(hilo?.no_leidos).toBe(1);

  const vuelta = await publicador.post('/api/mensajes', {
    data: { id_mascota: mascotaId, contenido: 'El sábado a las 10 a. m.' },
  });
  expect(vuelta.status(), await vuelta.text()).toBe(201);

  // Un tercero no ve el hilo ni puede escribir en él.
  const ajena = await tercero.get('/api/mensajes');
  const ajenos = ((await ajena.json()) as { items: { id_mascota: string }[] }).items;
  expect(ajenos.map((h) => h.id_mascota)).not.toContain(mascotaId);
  const intruso = await tercero.post('/api/mensajes', {
    data: { id_mascota: mascotaId, contenido: 'Hola, ¿puedo entrar?' },
  });
  expect(intruso.status()).toBe(403);
});

test('reportar una publicación desde la ficha (interfaz)', async ({ page }) => {
  // Mascota nueva y disponible: la de arriba ya está en proceso.
  const id = await publicar(publicador, `Kira E2E ${sello}`);
  const detalle = await publicador.get(`/api/mascotas/${id}`);
  mascotaReporteSlug = ((await detalle.json()) as { slug: string }).slug;

  await page.goto('/login?next=' + encodeURIComponent(`/mascota/${mascotaReporteSlug}`));
  await page.fill('#correo', correo('tercero'));
  await page.fill('#password', PASSWORD);
  await page.click('#loginBtn');
  await expect(page).toHaveURL(new RegExp(`/mascota/${mascotaReporteSlug}`));

  await page.getByText('Reportar publicación').click();
  await page.fill('#motivo', 'Publicación de prueba creada por la suite e2e.');
  await page.locator('#reportForm button[type="submit"]').click();
  // Regresión: el script usaba `petId` de otro <script> y fallaba con ReferenceError.
  await expect(page.locator('#reportMsg')).toHaveText(/Reporte enviado/);
});
