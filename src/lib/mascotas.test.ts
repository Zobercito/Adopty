import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  edadLabel,
  estadoLabel,
  fotoUrl,
  fotosOrdenadas,
  gradFor,
  paramsFrom,
  type FotoRow,
} from './mascotas';

describe('edadLabel', () => {
  it('0-360 meses en lenguaje natural', () => {
    expect(edadLabel(0)).toBe('Recién nacido');
    expect(edadLabel(1)).toBe('1 mes');
    expect(edadLabel(6)).toBe('6 meses');
    expect(edadLabel(12)).toBe('1 año');
    expect(edadLabel(18)).toBe('1 año, 6 meses');
    expect(edadLabel(24)).toBe('2 años');
  });
});

describe('estadoLabel', () => {
  it('mapea estados DB a etiqueta', () => {
    expect(estadoLabel('disponible')).toBe('Disponible');
    expect(estadoLabel('en_proceso')).toBe('En proceso');
    expect(estadoLabel('adoptada')).toBe('Adoptada');
  });
});

describe('fotosOrdenadas', () => {
  const f = (o: number, p: boolean): FotoRow => ({
    id_mascota: 'x',
    url_foto: `f${o}`,
    es_principal: p,
    orden: o,
  });
  it('principal primero, luego por orden', () => {
    expect(fotosOrdenadas([f(2, false), f(0, false), f(1, true)]).map((x) => x.url_foto)).toEqual([
      'f1',
      'f0',
      'f2',
    ]);
    expect(fotosOrdenadas(undefined)).toEqual([]);
  });
});

describe('gradFor', () => {
  it('es determinista por id', () => {
    expect(gradFor('abc')).toBe(gradFor('abc'));
    expect(gradFor('abc')).toMatch(/^pet-grad-[1-6]$/);
  });
});

describe('fotoUrl', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('respeta rutas absolutas y del sitio', () => {
    expect(fotoUrl('/assets/1.jpeg')).toBe('/assets/1.jpeg');
    expect(fotoUrl('https://x.com/foto.jpg')).toBe('https://x.com/foto.jpg');
    expect(fotoUrl('')).toBe('');
  });
  it('resuelve rutas de storage con la URL pública', () => {
    vi.stubEnv('PUBLIC_SUPABASE_URL', 'https://xyz.supabase.co');
    expect(fotoUrl('uid/foto.webp')).toBe(
      'https://xyz.supabase.co/storage/v1/object/public/mascotas/uid/foto.webp',
    );
  });
});

describe('paramsFrom', () => {
  const sp = (s: string) => paramsFrom(new URLSearchParams(s));
  it('normaliza tamaño insensible a mayúsculas/tilde', () => {
    expect(sp('tamano=pequeno').tamano).toBe('Pequeño');
    expect(sp('tamano=Pequeño').tamano).toBe('Pequeño');
    expect(sp('tamano=Mini').tamano).toBeUndefined();
  });
  it('sanea q (sin comas/paréntesis) y acota página', () => {
    expect(sp('q=luna,(bethania)').q).toBe('luna  bethania');
    expect(sp('page=0').page).toBe(1);
    expect(sp('page=abc').page).toBe(1);
    expect(sp('orden=antiguos').orden).toBe('antiguos');
    expect(sp('orden=x').orden).toBe('recientes');
  });
});
