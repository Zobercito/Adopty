import { describe, expect, it } from 'vitest';
import { completitudPerfil, etiquetaExperiencia, SIN_CUENTA } from './perfil';

describe('completitudPerfil', () => {
  it('perfil vacío = 0% y reporta los cinco campos', () => {
    const r = completitudPerfil({});
    expect(r.pct).toBe(0);
    expect(r.faltan).toHaveLength(5);
  });

  it('perfil completo = 100% y sin pendientes', () => {
    const r = completitudPerfil({
      nombre: 'Fran',
      foto: 'u/1/a.webp',
      descripcion: 'Vivo en Ciudad de Panamá',
      experiencia: 'alguna_vez',
      motivacion: 'Quiero darle un hogar',
    });
    expect(r.pct).toBe(100);
    expect(r.faltan).toEqual([]);
  });

  it('un perfil a la mitad da 50%', () => {
    const r = completitudPerfil({
      nombre: 'Fran',
      descripcion: 'Hola',
      experiencia: 'primera_vez',
      motivacion: 'Porque sí',
    });
    // 15 (nombre) + 25 (sobre mí) + 15 (experiencia) + 25 (motivación), sin foto
    expect(r.pct).toBe(80);
    expect(r.faltan).toEqual(['foto de perfil']);
  });

  it('faltanCampos trae las claves exactas que la UI marca', () => {
    // La UI pone el punto pulsante al lado de un campo, así que necesita la
    // clave del campo, no su etiqueta.
    const r = completitudPerfil({ nombre: 'Fran', foto: 'u/1/a.webp', experiencia: 'alguna_vez' });
    expect(r.faltanCampos).toEqual(['descripcion', 'motivacion']);
    expect(r.faltan).toEqual(['sobre mí', 'motivación para adoptar']);
  });

  it('faltanCampos está vacío cuando el perfil está completo', () => {
    const r = completitudPerfil({
      nombre: 'Fran',
      foto: 'u/1/a.webp',
      descripcion: 'Hola',
      experiencia: 'experimentada',
      motivacion: 'Porque sí',
    });
    expect(r.faltanCampos).toEqual([]);
    expect(r.pct).toBe(100);
  });

  it('los espacios en blanco no cuentan como campo lleno', () => {
    const r = completitudPerfil({ nombre: '   ', foto: '', descripcion: '  ' });
    expect(r.pct).toBe(0);
  });

  it('la suma siempre da 100 con los cinco pesos', () => {
    const r = completitudPerfil({
      nombre: 'a',
      foto: 'b',
      descripcion: 'c',
      experiencia: 'd',
      motivacion: 'e',
    });
    expect(r.pct).toBe(100);
  });
});

describe('etiquetaExperiencia', () => {
  it('traduce los tres valores del enum', () => {
    expect(etiquetaExperiencia('primera_vez')).toBe('Primera adopción');
    expect(etiquetaExperiencia('alguna_vez')).toBe('He tenido mascotas antes');
    expect(etiquetaExperiencia('experimentada')).toBe('Mucha experiencia');
  });
  it('degrada sin romperse si el valor no existe o falta', () => {
    expect(etiquetaExperiencia(null)).toBe('Sin indicar');
    expect(etiquetaExperiencia('')).toBe('Sin indicar');
    expect(etiquetaExperiencia('inventado')).toBe('inventado');
  });
});

describe('nombre de cuenta eliminada', () => {
  it('es el texto que ve la otra parte en el chat', () => {
    expect(SIN_CUENTA).toBe('Usuario no disponible');
  });
});
