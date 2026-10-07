import { describe, expect, it } from 'vitest';
import { afinidad, type PerfilEstilo } from './match';

const perfil: PerfilEstilo = {
  ambiente: 'casa_chica',
  ninos: false,
  especie_pref: 'perro',
  ubicacion: 'Bethania',
  energia_pref: 'moderada',
  otras_mascotas: false,
  edad_pref: 'indiferente',
};

const mascota = {
  especie: 'perro' as const,
  tamano: 'Mediano' as const,
  ubicacion: 'Bethania',
  nivel_energia: 'moderada' as const,
  apto_ninos: true,
  apto_otros: true,
  edad_meses: 24,
};

describe('afinidad', () => {
  it('da 100 con un match perfecto', () => {
    expect(afinidad(perfil, mascota)).toBe(100);
  });

  it('resta la especie cuando no coincide', () => {
    expect(afinidad({ ...perfil, especie_pref: 'gato' }, mascota)).toBe(70);
  });

  it('"indiferente" no penaliza la especie', () => {
    expect(afinidad({ ...perfil, especie_pref: 'indiferente' }, mascota)).toBe(100);
  });

  it('pierde convivencia si hay niños y la mascota no es apta', () => {
    expect(afinidad({ ...perfil, ninos: true }, { ...mascota, apto_ninos: false })).toBe(90);
  });

  it('la energía adyacente puntúa a medias', () => {
    expect(afinidad({ ...perfil, energia_pref: 'activa' }, mascota)).toBe(93);
  });

  it('el tamaño penaliza según el ambiente', () => {
    expect(afinidad({ ...perfil, ambiente: 'apartamento' }, { ...mascota, tamano: 'Grande' })).toBe(
      80,
    );
  });

  it('la ubicación parcial puntúa menos que la exacta', () => {
    const parcial = afinidad(perfil, { ...mascota, ubicacion: 'Bethania, Panamá' });
    expect(parcial).toBe(94);
  });
});
