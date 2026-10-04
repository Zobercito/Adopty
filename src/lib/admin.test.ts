import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  esAdmin,
  fechaCorta,
  listarReportes,
  listarVerificaciones,
  reporteBadge,
  verifBadge,
} from './admin';

/** Fake mínimo del query builder (select/eq/in/order + rpc) para probar sin DB. */
function clienteFalso(tablas: Record<string, Record<string, unknown>[]>, admin = false) {
  const desde = (filas: Record<string, unknown>[]) => {
    const eq: [string, unknown][] = [];
    const dentro: [string, unknown[]][] = [];
    const q: Record<string, (...a: never[]) => unknown> = {
      select: () => q,
      eq: (c: string, v: unknown) => {
        eq.push([c, v]);
        return q;
      },
      in: (c: string, vs: unknown[]) => {
        dentro.push([c, vs]);
        return q;
      },
      order: () => q,
      then: (resolver: (v: unknown) => unknown) => {
        let salida = [...filas];
        for (const [c, v] of eq) salida = salida.filter((r) => r[c] === v);
        for (const [c, vs] of dentro)
          salida = salida.filter((r) => (vs as unknown[]).includes(r[c]));
        return Promise.resolve({ data: salida, error: null }).then(resolver);
      },
    };
    return q;
  };
  return {
    from: (t: string) => desde(tablas[t] ?? []),
    rpc: (fn: string) => Promise.resolve({ data: fn === 'soy_admin' ? admin : null, error: null }),
  } as unknown as SupabaseClient;
}

describe('badges de administración', () => {
  it('reportes: pendiente / resuelto / descartado', () => {
    expect(reporteBadge('pendiente')[2]).toBe('Pendiente');
    expect(reporteBadge('resuelto')[2]).toBe('Resuelto');
    expect(reporteBadge('descartado')[2]).toBe('Descartado');
  });
  it('verificaciones: pendiente / aprobada / rechazada', () => {
    expect(verifBadge('pendiente')[2]).toBe('Pendiente');
    expect(verifBadge('aprobada')[2]).toBe('Aprobada');
    expect(verifBadge('rechazada')[2]).toBe('Rechazada');
  });
});

describe('fechaCorta', () => {
  it('formatea o cae a guion', () => {
    expect(fechaCorta(null)).toBe('—');
    expect(fechaCorta('2026-09-20T10:00:00Z')).toMatch(/2026/);
  });
});

describe('esAdmin', () => {
  it('true/false según la fila en administradores', async () => {
    await expect(esAdmin(clienteFalso({}, true))).resolves.toBe(true);
    await expect(esAdmin(clienteFalso({}, false))).resolves.toBe(false);
  });
  it('false si el RPC falla', async () => {
    const roto = {
      rpc: () => Promise.resolve({ data: null, error: { message: 'boom' } }),
    } as unknown as SupabaseClient;
    await expect(esAdmin(roto)).resolves.toBe(false);
  });
});

describe('listarReportes', () => {
  const tablas = {
    reportes: [
      {
        id: 'r1',
        id_reportador: 'u-orga',
        motivo: 'Publicación falsa con datos de contacto',
        estado: 'pendiente',
        notas_admin: null,
        fecha_reporte: '2026-09-20T10:00:00Z',
        fecha_resolucion: null,
        mascotas: {
          id: 'm1',
          nombre: 'Toby',
          slug: 'toby-99a8939b',
          estado: 'disponible',
          ubicacion: 'Ciudad de Panamá',
        },
      },
    ],
    personas: [],
    organizaciones: [{ id: 'u-orga', nombre_oficial: 'Refugio Falso' }],
  };

  it('resuelve el nombre del reportador sin exponer el correo', async () => {
    const r = await listarReportes(clienteFalso(tablas), 'pendiente');
    expect(r).toHaveLength(1);
    expect(r[0].reportador).toBe('Refugio Falso');
    expect(r[0].tipo_reportador).toBe('organizacion');
    expect(r[0].mascota.slug).toBe('toby-99a8939b');
    expect(JSON.stringify(r[0])).not.toContain('@');
  });

  it('descarta reportes cuya mascota ya no existe', async () => {
    const roto = {
      ...tablas,
      reportes: [{ ...tablas.reportes[0], mascotas: null }],
    };
    await expect(listarReportes(clienteFalso(roto), 'pendiente')).resolves.toEqual([]);
  });
});

describe('listarVerificaciones', () => {
  const tablas = {
    verificaciones_org: [
      {
        id: 'v1',
        tipo_evidencia: 'sitio_web',
        url_evidencia: 'https://refugio.example',
        descripcion: 'Web oficial',
        estado: 'pendiente',
        notas_admin: null,
        fecha_solicitud: '2026-09-21T10:00:00Z',
        fecha_resolucion: null,
        organizaciones: { id: 'o1', nombre_oficial: 'Refugio Patitas', verificada: false },
      },
    ],
  };

  it('trae la organización asociada', async () => {
    const r = await listarVerificaciones(clienteFalso(tablas), 'pendiente');
    expect(r).toHaveLength(1);
    expect(r[0].organizacion.nombre_oficial).toBe('Refugio Patitas');
    expect(r[0].organizacion.verificada).toBe(false);
  });
});
