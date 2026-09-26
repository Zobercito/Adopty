import { describe, expect, it } from 'vitest';
import { petSchema, petUpdateSchema } from './pet';

const base = {
  nombre: 'Toby',
  especie: 'perro',
  raza: 'Labrador mix',
  edad_meses: 8,
  sexo: 'Macho',
  tamano: 'Mediano',
  ubicacion: 'Ciudad de Panamá',
  descripcion: 'Juguetón y sociable, ideal para casa con patio.',
  estado_salud: 'Vacunado',
  fotos: ['uid/foto.webp'],
};

describe('petSchema (Fase 2)', () => {
  it('acepta una mascota válida (coerce de edad string)', () => {
    const r = petSchema.safeParse({ ...base, edad_meses: '18' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.edad_meses).toBe(18);
  });
  it('rechaza edad fuera de 0-360, nombre corto y 0 fotos', () => {
    expect(petSchema.safeParse({ ...base, edad_meses: 999 }).success).toBe(false);
    expect(petSchema.safeParse({ ...base, edad_meses: -1 }).success).toBe(false);
    expect(petSchema.safeParse({ ...base, nombre: 'T' }).success).toBe(false);
    expect(petSchema.safeParse({ ...base, fotos: [] }).success).toBe(false);
  });
  it('rechaza 6 fotos y rutas no-webp', () => {
    expect(petSchema.safeParse({ ...base, fotos: Array(6).fill('u/f.webp') }).success).toBe(false);
    expect(petSchema.safeParse({ ...base, fotos: ['/assets/1.jpeg'] }).success).toBe(false);
  });
  it('rechaza especie/sexo/tamaño fuera de ENUM', () => {
    expect(petSchema.safeParse({ ...base, especie: 'pez' }).success).toBe(false);
    expect(petSchema.safeParse({ ...base, tamano: 'Mini' }).success).toBe(false);
  });
});

describe('petUpdateSchema', () => {
  it('acepta parciales y gestión de fotos', () => {
    expect(petUpdateSchema.safeParse({ nombre: 'Toby Jr.' }).success).toBe(true);
    expect(
      petUpdateSchema.safeParse({ fotos_keep: ['u/a.webp'], fotos_new: ['u/b.webp'] }).success,
    ).toBe(true);
    expect(petUpdateSchema.safeParse({ fotos_new: Array(6).fill('u/f.webp') }).success).toBe(false);
  });
});
