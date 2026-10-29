import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { esCorreoYaRegistrado, MENSAJE_ENVIO_CORREO, respuestaEnvioCorreo } from './correo';
import { PUT as cambiarEmail } from '../pages/api/auth/cambiar-email';
import { POST as register } from '../pages/api/auth/register';
import { POST as recuperar } from '../pages/api/auth/recuperar';

/**
 * Guardia de regresión de I (enumeración de correos).
 *
 * El cliente debe recibir exactamente lo mismo exista o no una cuenta con el
 * correo indicado; el detalle solo va al log del servidor y sin PII. Se prueba
 * el helper y los tres handlers con un cliente de Supabase falso (sin red).
 */

const estado = vi.hoisted(() => ({ cliente: null as unknown }));

vi.mock('./supabase', () => ({ supabaseServer: () => estado.cliente }));

vi.mock('./ratelimit', () => ({
  rateLimitDistribuido: async () => ({ ok: true, restante: 9 }),
  respuestaRateLimit: () => Response.json({ error: 'Demasiados intentos' }, { status: 429 }),
  ipCliente: () => '203.0.113.7',
}));

const USUARIO = { id: 'uid-1', email: 'actual@ejemplo.pa' };
const YA_REGISTRADO = {
  code: 'email_exists',
  message: 'A user with this email address has already been registered',
};

function clienteCambiarEmail(error: unknown) {
  return {
    auth: {
      getUser: async () => ({ data: { user: USUARIO } }),
      updateUser: async () => ({ data: {}, error }),
    },
    from: () => {
      throw new Error('cambiar-email no debe consultar la tabla usuarios');
    },
  };
}

function clienteRegister(data: unknown, error: unknown) {
  return { auth: { signUp: async () => ({ data, error }) } };
}

function clienteRecuperar(error: unknown) {
  return { auth: { resetPasswordForEmail: async () => ({ error }) } };
}

function contexto(cuerpo: unknown, ruta: string) {
  const url = `http://localhost${ruta}`;
  return {
    request: new Request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    }),
    cookies: {},
    url: new URL(url),
    redirect: (destino: string, estadoHttp = 302) =>
      new Response(null, { status: estadoHttp, headers: { Location: destino } }),
  } as unknown as Parameters<typeof register>[0];
}

const ALTA = {
  nombre: 'Ana Pérez',
  correo: 'nueva@ejemplo.pa',
  password: 'secreto-largo-1',
  tipo_usuario: 'persona',
};

describe('respuestaEnvioCorreo (I)', () => {
  it('es idéntica para correo libre y para correo en uso', () => {
    const libre = respuestaEnvioCorreo();
    const enUso = respuestaEnvioCorreo();
    expect(enUso).toEqual(libre);
    expect(libre).toEqual({ ok: true, mensaje: MENSAJE_ENVIO_CORREO });
    expect(libre.mensaje).not.toMatch(/ya está|en uso|already/i);
  });

  it('reconoce el error de correo ya registrado y no otros fallos', () => {
    expect(esCorreoYaRegistrado(YA_REGISTRADO)).toBe(true);
    expect(esCorreoYaRegistrado({ code: 'user_already_exists' })).toBe(true);
    expect(esCorreoYaRegistrado({ message: 'User already registered' })).toBe(true);
    expect(esCorreoYaRegistrado({ code: 'weak_password', message: 'Password too short' })).toBe(
      false,
    );
    expect(esCorreoYaRegistrado({ code: 'unexpected_failure', message: 'Database error' })).toBe(
      false,
    );
    expect(esCorreoYaRegistrado(null)).toBe(false);
  });
});

describe('endpoints de correo (I)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    estado.cliente = null;
  });

  it('cambiar-email responde igual con el correo libre y con el correo en uso', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    estado.cliente = clienteCambiarEmail(null);
    const libre = await cambiarEmail(
      contexto({ correo: 'nuevo@ejemplo.pa' }, '/api/auth/cambiar-email'),
    );
    estado.cliente = clienteCambiarEmail(YA_REGISTRADO);
    const enUso = await cambiarEmail(
      contexto({ correo: 'ocupado@ejemplo.pa' }, '/api/auth/cambiar-email'),
    );

    expect(libre.status).toBe(200);
    expect(enUso.status).toBe(libre.status);
    expect(await enUso.clone().json()).toEqual(await libre.clone().json());
    const cuerpo = (await enUso.clone().json()) as { mensaje: string };
    expect(cuerpo.mensaje).toBe(MENSAJE_ENVIO_CORREO);
    expect(JSON.stringify(cuerpo)).not.toMatch(/ya está en uso|already/i);
    // El duplicado queda en el log, sin el correo.
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).not.toContain('ocupado@ejemplo.pa');
  });

  it('register responde igual en alta nueva (sin sesión) y con correo ya registrado', async () => {
    estado.cliente = clienteRegister({ session: null, user: { id: 'nuevo' } }, null);
    const alta = await register(contexto(ALTA, '/api/auth/register'));
    estado.cliente = clienteRegister({ user: null }, { code: 'user_already_exists' });
    const duplicado = await register(
      contexto({ ...ALTA, correo: 'existente@ejemplo.pa' }, '/api/auth/register'),
    );

    expect(alta.status).toBe(200);
    expect(duplicado.status).toBe(alta.status);
    const cuerpoAlta = await alta.clone().json();
    expect(await duplicado.clone().json()).toEqual(cuerpoAlta);
    expect(cuerpoAlta).toMatchObject({ ok: true, confirmaEmail: true });
    expect(JSON.stringify(cuerpoAlta)).not.toMatch(/already|registrad/i);
  });

  it('register mantiene un error genérico ante una caída real del servicio', async () => {
    estado.cliente = clienteRegister(
      { user: null },
      { code: 'unexpected_failure', message: 'Database error querying schema' },
    );
    const res = await register(contexto(ALTA, '/api/auth/register'));

    expect(res.status).toBe(400);
    const cuerpo = (await res.json()) as { error: string };
    expect(cuerpo.error).not.toMatch(/database|schema|unexpected/i);
    expect(cuerpo.error.length).toBeGreaterThan(10);
  });

  it('recuperar responde igual exista o no el correo', async () => {
    estado.cliente = clienteRecuperar(null);
    const existe = await recuperar(
      contexto({ correo: 'existe@ejemplo.pa' }, '/api/auth/recuperar'),
    );
    estado.cliente = clienteRecuperar({ code: 'user_not_found', message: 'User not found' });
    const noExiste = await recuperar(
      contexto({ correo: 'nadie@ejemplo.pa' }, '/api/auth/recuperar'),
    );

    expect(existe.status).toBe(200);
    expect(noExiste.status).toBe(existe.status);
    expect(await noExiste.clone().json()).toEqual(await existe.clone().json());
    expect(JSON.stringify(await noExiste.clone().json())).not.toMatch(/not found|user/i);
  });
});

describe('ningún endpoint devuelve el texto que delata (I)', () => {
  const FUENTES = ['cambiar-email.ts', 'register.ts', 'recuperar.ts'].map((f) =>
    fileURLToPath(new URL(`../pages/api/auth/${f}`, import.meta.url)),
  );

  it('los tres usan la respuesta uniforme y no reenvían error.message', () => {
    const fuentes = FUENTES.map((f) => readFileSync(f, 'utf8'));
    for (const fuente of fuentes) {
      expect(fuente).not.toMatch(/ya está en uso/i);
      expect(fuente).not.toMatch(/Response\.json\(\s*\{\s*error:\s*(?:error|e)\??\.message/);
    }
    expect(fuentes[0]).toContain('respuestaEnvioCorreo(');
    expect(fuentes[1]).toContain('respuestaEnvioCorreo(');
    // recuperar conserva la forma `{ ok: true }` que ya consumía la UI.
    expect(fuentes[2]).toContain('Response.json({ ok: true })');
  });
});
