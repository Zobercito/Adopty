import { readFileSync } from 'node:fs';
import { expect, request as apiRequest, test, type APIRequestContext } from '@playwright/test';

/**
 * Verificación funcional por roles (plan-docs/TAREAS.md).
 *
 * Actúa como cada tipo de cuenta con una sesión real y comprueba los efectos
 * cruzados entre cuentas. ESCRIBE datos, así que:
 * - solo corre con `E2E_FLUJO=1`;
 * - se niega a correr si la base o la URL de destino no son locales;
 * - deja las cuentas creadas: la limpieza es `supabase db reset` (TASK-012).
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

/** El destino de las peticiones también debe ser local: un preview apunta a la BD cloud. */
function destinoLocal(): boolean {
  try {
    const { hostname } = new URL(process.env.E2E_BASE_URL ?? 'http://localhost:4321');
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  } catch {
    return false;
  }
}

test.skip(process.env.E2E_FLUJO !== '1', 'Pruebas con escrituras: activar con E2E_FLUJO=1');
test.skip(
  !esLocal || !destinoLocal(),
  'La batería por roles solo corre contra Supabase local y un destino local',
);

test.describe.configure({ mode: 'serial' });

const sello = Date.now().toString(36);
const PASSWORD = 'Roles-Adopty-2026!';
const correo = (rol: string) => `roles-${rol}-${sello}@adopty.test`;

let adoptante: APIRequestContext;
let organizacion: APIRequestContext;
let tercero: APIRequestContext;

/** Registra una cuenta; cada contexto guarda su propia cookie de sesión. */
async function registrar(
  nombre: string,
  rol: string,
  tipo: 'persona' | 'organizacion',
): Promise<APIRequestContext> {
  const baseURL = test.info().project.use.baseURL;
  // `Origin` como en el navegador: Astro rechaza por CSRF los formularios sin él.
  const ctx = await apiRequest.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL ?? '' } });
  try {
    const res = await ctx.post('/api/auth/register', {
      data: { nombre, correo: correo(rol), password: PASSWORD, tipo_usuario: tipo },
      maxRedirects: 0,
    });
    expect(res.status(), await res.text()).toBe(302);
    return ctx;
  } catch (error) {
    // Sin esto, un fallo en la aserción deja el contexto abierto y la cookie viva.
    await ctx.dispose();
    throw error;
  }
}

test.beforeAll(async () => {
  adoptante = await registrar(`Adoptante Roles ${sello}`, 'adoptante', 'persona');
  organizacion = await registrar(`Refugio Roles ${sello}`, 'organizacion', 'organizacion');
  tercero = await registrar(`Tercero Roles ${sello}`, 'tercero', 'persona');
});

test.afterAll(async () => {
  await Promise.all([adoptante?.dispose(), organizacion?.dispose(), tercero?.dispose()]);
});

test('AC-001-a · el registro de persona deja sesión y perfil propio', async () => {
  const res = await adoptante.get('/api/perfil');
  expect(res.status(), await res.text()).toBe(200);
  const perfil = (await res.json()) as {
    tipo: string;
    correo: string;
    detalle: { nombre?: string };
  };
  expect(perfil.tipo).toBe('persona');
  expect(perfil.correo).toBe(correo('adoptante'));
  expect(perfil.detalle.nombre).toBe(`Adoptante Roles ${sello}`);
});

test('AC-001-b · el registro de organización crea su fila con nombre_oficial', async () => {
  const res = await organizacion.get('/api/perfil');
  expect(res.status(), await res.text()).toBe(200);
  const perfil = (await res.json()) as {
    tipo: string;
    detalle: { nombre_oficial?: string };
  };
  expect(perfil.tipo).toBe('organizacion');
  expect(perfil.detalle.nombre_oficial).toBe(`Refugio Roles ${sello}`);
});

test('AC-001-c · cerrar sesión deja de autenticar las peticiones privadas', async () => {
  const antes = await tercero.get('/api/perfil');
  expect(antes.status()).toBe(200);

  const salir = await tercero.post('/api/auth/logout', { maxRedirects: 0 });
  expect(salir.status()).toBe(302);

  const despues = await tercero.get('/api/perfil');
  expect(despues.status()).toBe(401);
});
