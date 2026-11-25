import { execFileSync } from 'node:child_process';
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

const esLocal = hostLocal(supabaseUrl());

/** true si la URL apunta a esta máquina; false si es remota o no parsea. */
function hostLocal(valor: string): boolean {
  try {
    const { hostname } = new URL(valor);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  } catch {
    return false;
  }
}

test.skip(process.env.E2E_FLUJO !== '1', 'Pruebas con escrituras: activar con E2E_FLUJO=1');
test.skip(
  !esLocal || !hostLocal(process.env.E2E_BASE_URL ?? 'http://localhost:4321'),
  'La batería por roles solo corre contra Supabase local y un destino local',
);

test.describe.configure({ mode: 'serial' });

const sello = Date.now().toString(36);
const PASSWORD = 'Roles-Adopty-2026!';
const correo = (rol: string) => `roles-${rol}-${sello}@adopty.test`;

let adoptante: APIRequestContext;
let organizacion: APIRequestContext;
let tercero: APIRequestContext;
let admin: APIRequestContext;
let adminListo = false;

/** Ejecuta SQL contra la base local (fixtures de la suite). */
function psql(sql: string): string {
  return execFileSync(
    'docker',
    [
      'exec',
      '-i',
      process.env.SUPABASE_DB_CONTAINER ?? 'supabase_db_adopty',
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-tA',
      '-c',
      sql,
    ],
    { encoding: 'utf8' },
  ).trim();
}

/** Fixture local: nombra admin a la cuenta por correo (sin service role). */
function hacerAdmin(correoAdmin: string): void {
  // El correo lo genera la suite: solo minúsculas, dígitos, punto, guion y @.
  if (!/^[a-z0-9.@-]+$/.test(correoAdmin)) throw new Error('Correo inesperado en el fixture');
  // Insertar y contar en sentencias separadas: una CTE no ve sus propias filas
  // en el SELECT de la misma sentencia.
  psql(`insert into administradores (id)
        select id from usuarios where correo = '${correoAdmin}'
        on conflict do nothing;`);
  const salida = psql(`select count(*) from administradores a
                         join usuarios u on u.id = a.id
                        where u.correo = '${correoAdmin}';`);
  if (salida !== '1') {
    throw new Error(`El fixture de admin no encontró la cuenta ${correoAdmin} (salida: ${salida})`);
  }
}

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

/** Inicia sesión en un contexto ya existente (para restaurarla tras el logout). */
async function login(ctx: APIRequestContext, rol: string): Promise<void> {
  const res = await ctx.post('/api/auth/login', {
    data: { correo: correo(rol), password: PASSWORD },
    maxRedirects: 0,
  });
  expect(res.status(), await res.text()).toBe(302);
}

test.beforeAll(async () => {
  // Cada corrida crea 4 cuentas y el límite de registro (10/min por IP) persiste
  // entre corridas; se limpia solo ese cubo, no los de otras suites.
  try {
    psql("delete from public.rate_limits where clave like 'register:%';");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  adoptante = await registrar(`Adoptante Roles ${sello}`, 'adoptante', 'persona');
  organizacion = await registrar(`Refugio Roles ${sello}`, 'organizacion', 'organizacion');
  tercero = await registrar(`Tercero Roles ${sello}`, 'tercero', 'persona');
  admin = await registrar(`Admin Roles ${sello}`, 'admin', 'persona');
  // Si Docker no existe, los casos de admin se omiten; un fixture roto debe fallar.
  try {
    hacerAdmin(correo('admin'));
    adminListo = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.warn('[roles] Docker no disponible: se omiten los casos de admin');
    } else {
      throw error;
    }
  }
});

test.afterAll(async () => {
  await Promise.all([
    adoptante?.dispose(),
    organizacion?.dispose(),
    tercero?.dispose(),
    admin?.dispose(),
  ]);
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

  // El resto de la suite necesita el tercero con sesión: se restaura.
  await login(tercero, 'tercero');
  expect((await tercero.get('/api/perfil')).status()).toBe(200);
});

test('AC-005-a · solo el admin abre el panel y las APIs de administración', async () => {
  test.skip(!adminListo, 'Fixture de admin no disponible (docker/psql)');

  const panel = await admin.get('/admin');
  expect(panel.status(), await panel.text()).toBe(200);

  const api = await admin.get('/api/admin/reportes');
  expect(api.status(), await api.text()).toBe(200);

  const panelAjeno = await adoptante.get('/admin');
  expect(panelAjeno.status()).toBe(404);

  const apiAjena = await adoptante.get('/api/admin/reportes');
  expect(apiAjena.status()).toBe(403);
});

test('AC-002-a · el adoptante lee y edita su propio perfil', async () => {
  const antes = await adoptante.get('/api/perfil');
  expect(antes.status()).toBe(200);

  const editado = await adoptante.put('/api/perfil', {
    multipart: {
      nombre: `Adoptante Editado ${sello}`,
      descripcion: 'Perfil actualizado por la suite de roles.',
      experiencia: 'alguna_vez',
      motivacion: 'Quiero adoptar.',
    },
  });
  expect(editado.status(), await editado.text()).toBe(200);

  const resDespues = await adoptante.get('/api/perfil');
  expect(resDespues.status(), await resDespues.text()).toBe(200);
  const despues = (await resDespues.json()) as {
    detalle: { nombre?: string };
  };
  expect(despues.detalle.nombre).toBe(`Adoptante Editado ${sello}`);

  // El cambio no toca el perfil de otra cuenta.
  const resOtro = await tercero.get('/api/perfil');
  expect(resOtro.status(), await resOtro.text()).toBe(200);
  const otro = (await resOtro.json()) as {
    detalle: { nombre?: string };
  };
  expect(otro.detalle.nombre).toBe(`Tercero Roles ${sello}`);
});

test('AC-002-b · el estilo de vida se guarda y se relee', async () => {
  const datos = {
    ambiente: 'apartamento',
    ninos: false,
    especie_pref: 'perro',
    ubicacion: 'Ciudad de Panamá',
    energia_pref: 'moderada',
    otras_mascotas: false,
    edad_pref: 'indiferente',
  };
  const guardado = await adoptante.put('/api/estilo-de-vida', { data: datos });
  expect(guardado.status(), await guardado.text()).toBe(200);

  const leido = (await (await adoptante.get('/api/estilo-de-vida')).json()) as {
    perfil: Record<string, unknown> | null;
  };
  expect(leido.perfil).toMatchObject(datos);
});

test('AC-002-c · los favoritos son del adoptante y no los ve otra cuenta', async () => {
  const lista = await adoptante.get('/api/mascotas?page=1');
  expect(lista.status(), await lista.text()).toBe(200);
  const { items } = (await lista.json()) as { items: { id: string }[] };
  const idMascota = items[0]?.id;
  expect(idMascota, 'No hay mascotas disponibles: aplica supabase/seed.sql').toBeTruthy();

  const alta = await adoptante.post('/api/favoritos', { data: { id_mascota: idMascota } });
  expect(alta.status(), await alta.text()).toBe(200);

  const resMios = await adoptante.get('/api/favoritos');
  expect(resMios.status(), await resMios.text()).toBe(200);
  const mios = (await resMios.json()) as { favoritos: string[] };
  expect(mios.favoritos).toContain(idMascota);

  const resAjenos = await tercero.get('/api/favoritos');
  expect(resAjenos.status(), await resAjenos.text()).toBe(200);
  const ajenos = (await resAjenos.json()) as { favoritos: string[] };
  expect(ajenos.favoritos).not.toContain(idMascota);

  const baja = await adoptante.delete(`/api/favoritos?id_mascota=${idMascota}`);
  expect(baja.status()).toBe(200);

  const vacios = (await (await adoptante.get('/api/favoritos')).json()) as { favoritos: string[] };
  expect(vacios.favoritos).not.toContain(idMascota);
});

test('AC-002-e · la exportación trae sus datos y ningún dato ajeno', async () => {
  const lista = await adoptante.get('/api/mascotas?page=1');
  const { items } = (await lista.json()) as { items: { id: string }[] };
  const favPropio = items[0]?.id;
  const favAjeno = items[1]?.id;
  expect(favPropio && favAjeno).toBeTruthy();

  // Datos reales que deben aparecer (creados en AC-002-a/b) y un favorito ajeno
  // que no debe filtrarse.
  await adoptante.post('/api/favoritos', { data: { id_mascota: favPropio } });
  await tercero.post('/api/favoritos', { data: { id_mascota: favAjeno } });

  const res = await adoptante.get('/api/mis-datos');
  expect(res.status(), await res.text()).toBe(200);

  const texto = await res.text();
  const datos = JSON.parse(texto) as {
    cuenta: { correo?: string };
    perfil: { nombre?: string } | null;
    estilo_de_vida: { ambiente?: string } | null;
    solicitudes_enviadas: unknown[];
    favoritos: { id_mascota: string }[];
  };
  expect(datos.cuenta.correo).toBe(correo('adoptante'));
  expect(datos.perfil?.nombre).toBe(`Adoptante Editado ${sello}`);
  expect(datos.estilo_de_vida?.ambiente).toBe('apartamento');
  expect(Array.isArray(datos.solicitudes_enviadas)).toBe(true);

  const idsFavoritos = datos.favoritos.map((f) => f.id_mascota);
  expect(idsFavoritos).toContain(favPropio);
  expect(idsFavoritos).not.toContain(favAjeno);
  expect(texto).not.toContain(correo('tercero'));
  expect(texto).not.toContain(correo('admin'));
});

test('AC-002-g · la preferencia de avisos persiste en el perfil', async () => {
  const apagar = await adoptante.put('/api/notificaciones', {
    data: { notificaciones_email: false },
  });
  expect(apagar.status(), await apagar.text()).toBe(200);

  const sinAviso = await (await adoptante.get('/perfil')).text();
  expect(sinAviso).toMatch(/id="notifEmail"[^>]*/);
  expect(sinAviso).not.toMatch(/id="notifEmail"[^>]*checked/);

  const encender = await adoptante.put('/api/notificaciones', {
    data: { notificaciones_email: true },
  });
  expect(encender.status()).toBe(200);

  const conAviso = await (await adoptante.get('/perfil')).text();
  expect(conAviso).toMatch(/id="notifEmail"[^>]*checked/);
});
