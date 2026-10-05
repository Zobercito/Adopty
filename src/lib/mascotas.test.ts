import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buscarMascotas,
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

describe('buscarMascotas', () => {
  /** Cliente mínimo que encadena filtros y responde por rango solicitado. */
  function clienteStub(total: number, filasPorRango: (from: number) => unknown[]) {
    // Builder "thenable": se puede encadenar (.is/.eq/.order) y también awaiting
    // directo, que es como lo usa el conteo `head`.
    const builder: any = new Proxy(
      {
        then: (res: any) => res({ count: total }),
      },
      {
        get(_t, prop: string) {
          if (prop === 'then') return (res: any) => res({ count: total });
          if (prop === 'range') {
            return (from: number) => {
              const filas = filasPorRango(from);
              return Promise.resolve(
                filas.length
                  ? { data: filas, error: null, count: total }
                  : // PostgREST responde 416 si `from` pasa el total de filas.
                    {
                      data: null,
                      count: null,
                      error: { message: 'Requested range not satisfiable' },
                    },
              );
            };
          }
          return () => builder;
        },
      },
    );
    return { from: () => builder } as any;
  }

  const fila = (n: number) => ({ id: `m${n}`, nombre: `M${n}`, fotos_mascota: [] });
  const hasta = (total: number) => (from: number) =>
    Array.from({ length: Math.max(0, Math.min(8, total - from)) }, (_, i) => fila(from + i));

  it('devuelve la página pedida con su total', async () => {
    const r = await buscarMascotas(clienteStub(28, hasta(28)), { page: 2, pageSize: 20 });
    expect(r).toMatchObject({ total: 28, page: 2, totalPages: 2 });
    expect(r.items).toHaveLength(8);
  });

  it('recorta a la última página si la pedida ya no existe (?page=99)', async () => {
    const r = await buscarMascotas(clienteStub(28, hasta(28)), { page: 99, pageSize: 20 });
    expect(r).toMatchObject({ total: 28, page: 2, totalPages: 2 });
    expect(r.items.length).toBeGreaterThan(0);
  });

  it('no recorta cuando no hay resultados: devuelve lista vacía', async () => {
    const r = await buscarMascotas(clienteStub(0, hasta(0)), { page: 1, pageSize: 20 });
    expect(r).toMatchObject({ total: 0, page: 1, totalPages: 1 });
    expect(r.items).toEqual([]);
  });
});
