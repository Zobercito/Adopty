import { describe, expect, it } from 'vitest';
import {
  borrarCuentaSchema,
  cambiarCorreoSchema,
  cambiarPasswordSchema,
  loginSchema,
  organizacionSchema,
  personaSchema,
  registerSchema,
} from './user';

describe('registerSchema (Fase 1)', () => {
  it('acepta un registro válido persona/organización', () => {
    expect(
      registerSchema.safeParse({
        nombre: 'Eira R.',
        correo: 'eira@adopty.pa',
        password: 'Secreta123',
        tipo_usuario: 'persona',
      }).success,
    ).toBe(true);
    expect(
      registerSchema.safeParse({
        nombre: 'Refugio',
        correo: 'refugio@adopty.pa',
        password: 'Secreta123',
        tipo_usuario: 'organizacion',
      }).success,
    ).toBe(true);
  });
  it('rechaza correo inválido, clave corta y tipo desconocido', () => {
    expect(
      registerSchema.safeParse({
        nombre: 'Ab',
        correo: 'no-es-correo',
        password: 'x',
        tipo_usuario: 'persona',
      }).success,
    ).toBe(false);
    expect(
      registerSchema.safeParse({
        nombre: 'Ab',
        correo: 'a@b.pa',
        password: 'corta',
        tipo_usuario: 'admin',
      }).success,
    ).toBe(false);
  });
});

describe('loginSchema', () => {
  it('acepta credenciales con forma válida', () => {
    expect(loginSchema.safeParse({ correo: 'a@b.pa', password: 'x' }).success).toBe(true);
  });
  it('rechaza correo inválido', () => {
    expect(loginSchema.safeParse({ correo: 'zzz', password: 'x' }).success).toBe(false);
  });
});

describe('personaSchema / organizacionSchema', () => {
  it('persona: nombre 2-80; experiencia, motivación y descripción opcionales', () => {
    expect(
      personaSchema.safeParse({
        nombre: 'Fran',
        descripcion: '',
        experiencia: '',
        motivacion: '',
      }).success,
    ).toBe(true);
    expect(personaSchema.safeParse({ nombre: 'F' }).success).toBe(false);
  });
  it('persona: el teléfono ya no forma parte del perfil', () => {
    // Se eliminó el campo: mandarlo no debe cambiar nada ni romper la validación.
    const r = personaSchema.safeParse({ nombre: 'Fran', telefono: '6000-0000' });
    expect(r.success).toBe(true);
    expect(r.data).not.toHaveProperty('telefono');
  });
  it('persona: experiencia solo admite los tres valores del enum', () => {
    for (const v of ['primera_vez', 'alguna_vez', 'experimentada']) {
      expect(personaSchema.safeParse({ nombre: 'Fran', experiencia: v }).success).toBe(true);
    }
    expect(personaSchema.safeParse({ nombre: 'Fran', experiencia: 'experto' }).success).toBe(false);
  });
  it('persona: la motivación no pasa de 300 caracteres', () => {
    expect(personaSchema.safeParse({ nombre: 'Fran', motivacion: 'a'.repeat(300) }).success).toBe(
      true,
    );
    expect(personaSchema.safeParse({ nombre: 'Fran', motivacion: 'a'.repeat(301) }).success).toBe(
      false,
    );
  });
  it('organización: exige nombre oficial y dirección, web opcional válida', () => {
    expect(
      organizacionSchema.safeParse({
        nombre_oficial: 'Refugio',
        direccion: 'Panamá',
        sitio_web: 'no-url',
      }).success,
    ).toBe(false);
    expect(
      organizacionSchema.safeParse({
        nombre_oficial: 'Refugio',
        direccion: 'Panamá',
        sitio_web: '',
      }).success,
    ).toBe(true);
  });
  it('organización: contacto_visible es opcional y por defecto falso', () => {
    const r = organizacionSchema.safeParse({
      nombre_oficial: 'Refugio',
      direccion: 'Panamá',
    });
    expect(r.success).toBe(true);
    expect(r.data?.contacto_visible).toBeUndefined();
  });
});

describe('cambiarCorreoSchema / borrarCuentaSchema', () => {
  it('cambio de correo: exige correo válido', () => {
    expect(cambiarCorreoSchema.safeParse({ correo: 'nuevo@adopty.pa' }).success).toBe(true);
    expect(cambiarCorreoSchema.safeParse({ correo: 'no-es-correo' }).success).toBe(false);
  });
  it('baja: contraseña y la palabra ELIMINAR son obligatorias', () => {
    expect(borrarCuentaSchema.safeParse({ password: 'x', confirmacion: 'ELIMINAR' }).success).toBe(
      true,
    );
    // toleramos minúsculas y espacios, pero no otra palabra
    expect(
      borrarCuentaSchema.safeParse({ password: 'x', confirmacion: ' eliminar ' }).success,
    ).toBe(true);
    expect(borrarCuentaSchema.safeParse({ password: 'x', confirmacion: 'borrar' }).success).toBe(
      false,
    );
    expect(borrarCuentaSchema.safeParse({ password: '', confirmacion: 'ELIMINAR' }).success).toBe(
      false,
    );
  });
});

describe('cambiarPasswordSchema', () => {
  const valido = { actual: 'Secreta123', nueva: 'NuevaClave456', confirmar: 'NuevaClave456' };

  it('acepta un cambio válido', () => {
    expect(cambiarPasswordSchema.safeParse(valido).success).toBe(true);
  });

  it('exige la contraseña actual', () => {
    const r = cambiarPasswordSchema.safeParse({ ...valido, actual: '' });
    expect(r.success).toBe(false);
  });

  it('rechaza la nueva si no coincide la confirmación', () => {
    const r = cambiarPasswordSchema.safeParse({ ...valido, confirmar: 'OtraClave789' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(/no coinciden/i);
  });

  it('exige mínimo 8 caracteres en la nueva', () => {
    const r = cambiarPasswordSchema.safeParse({ ...valido, nueva: 'corta', confirmar: 'corta' });
    expect(r.success).toBe(false);
  });

  it('no permite repetir la contraseña actual', () => {
    const r = cambiarPasswordSchema.safeParse({
      actual: 'Secreta123',
      nueva: 'Secreta123',
      confirmar: 'Secreta123',
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(/distinta/i);
  });
});
