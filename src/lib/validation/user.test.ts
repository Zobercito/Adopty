import { describe, expect, it } from 'vitest';
import { loginSchema, organizacionSchema, personaSchema, registerSchema } from './user';

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
  it('persona: nombre 2-80, teléfono y descripción opcionales', () => {
    expect(personaSchema.safeParse({ nombre: 'Fran', telefono: '', descripcion: '' }).success).toBe(
      true,
    );
    expect(personaSchema.safeParse({ nombre: 'F' }).success).toBe(false);
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
});
