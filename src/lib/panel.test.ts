import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getPanelResumen } from './panel';

/** Fake mínimo del query builder (filtros eq/is/in + order) para probar agregados sin DB. */
function clienteFalso(tablas: Record<string, Record<string, unknown>[]>) {
  const desde = (filas: Record<string, unknown>[]) => {
    const estado: {
      eq: [string, unknown][];
      nulos: string[];
      dentro: [string, unknown[]][];
      orden: [string, boolean] | null;
    } = {
      eq: [],
      nulos: [],
      dentro: [],
      orden: null,
    };
    const q: Record<string, (...a: never[]) => unknown> = {
      select: () => q,
      eq: (c: string, v: unknown) => {
        estado.eq.push([c, v]);
        return q;
      },
      is: (c: string, v: unknown) => {
        if (v === null) estado.nulos.push(c);
        return q;
      },
      in: (c: string, vs: unknown[]) => {
        estado.dentro.push([c, vs]);
        return q;
      },
      order: (c: string, o: { ascending: boolean }) => {
        estado.orden = [c, o.ascending];
        return q;
      },
      then: (resolver: (v: unknown) => unknown) => {
        let salida = [...filas];
        for (const [c, v] of estado.eq) salida = salida.filter((r) => r[c] === v);
        for (const c of estado.nulos) salida = salida.filter((r) => r[c] == null);
        for (const [c, vs] of estado.dentro)
          salida = salida.filter((r) => (vs as unknown[]).includes(r[c]));
        return Promise.resolve({ data: salida, error: null }).then(resolver);
      },
    };
    return q;
  };
  return { from: (t: string) => desde(tablas[t] ?? []) } as unknown as SupabaseClient;
}

describe('getPanelResumen (Fase 6)', () => {
  const YO = 'yo-uuid';
  const OTRO = 'otro-uuid';
  const tablas = {
    mascotas: [
      {
        id: 'm1',
        id_publicador: YO,
        nombre: 'Luna',
        raza: 'Siamés',
        estado: 'disponible',
        fecha_publicacion: '2026-09-20',
        deleted_at: null,
        fotos_mascota: [],
      },
      {
        id: 'm2',
        id_publicador: YO,
        nombre: 'Max',
        raza: 'Criollo',
        estado: 'en_proceso',
        fecha_publicacion: '2026-09-21',
        deleted_at: null,
        fotos_mascota: [],
      },
      {
        id: 'ajena',
        id_publicador: OTRO,
        nombre: 'Ajena',
        raza: 'X',
        estado: 'disponible',
        fecha_publicacion: '2026-09-22',
        deleted_at: null,
        fotos_mascota: [],
      },
    ],
    solicitudes: [
      { id_mascota: 'm1', estado: 'pendiente', id_adoptante: OTRO },
      { id_mascota: 'm1', estado: 'rechazada', id_adoptante: 'tercero' },
      { id_mascota: 'm2', estado: 'aprobada', id_adoptante: OTRO },
    ],
    mensajes: [
      { id_mascota: 'm1', id_emisor: OTRO, id_receptor: YO, leido: false },
      { id_mascota: 'm1', id_emisor: YO, id_receptor: OTRO, leido: true },
      { id_mascota: 'm2', id_emisor: YO, id_receptor: OTRO, leido: true },
    ],
  };

  it('agrega por mascota y totales sin contar ajenas', async () => {
    const r = await getPanelResumen(clienteFalso(tablas), YO);
    expect(r.publicadas).toBe(2);
    expect(r.pendientes).toBe(1);
    expect(r.noLeidos).toBe(1);
    // interesados: OTRO (solicitante+conversante) + tercero (rechazado también cuenta como interesado)
    expect(r.interesados).toBe(2);
    const luna = r.mascotas.find((m) => m.id === 'm1')!;
    expect(luna.solicitudes).toBe(2);
    expect(luna.pendientes).toBe(1);
    expect(luna.noLeidos).toBe(1);
    expect(luna.interesados).toBe(2);
    expect(r.mascotas.some((m) => m.id === 'ajena')).toBe(false);
  });

  it('publicador sin mascotas queda en ceros', async () => {
    const r = await getPanelResumen(
      clienteFalso({ mascotas: [], solicitudes: [], mensajes: [] }),
      'nadie',
    );
    expect(r).toMatchObject({
      publicadas: 0,
      pendientes: 0,
      noLeidos: 0,
      interesados: 0,
      mascotas: [],
    });
  });
});
