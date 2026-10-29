import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ERROR_GENERICO, mensajeError } from './errores';

/**
 * Guardia de regresión de H.
 *
 * PostgREST devuelve nombres de tabla, columna y constraint en `message`; eso
 * facilita afinar ataques a RLS. `mensajeError` solo deja pasar las reglas de
 * negocio propias (`P0001`) y los endpoints no deben volver a reenviar el
 * texto crudo. Los `auth/*` quedan fuera: sus errores vienen de GoTrue (sin
 * esquema) y la enumeración de correos es el hallazgo I. Las páginas SSR se
 * revisan solo en el frontmatter: los scripts del cliente muestran el `error`
 * de nuestra propia API, que ya pasa por el helper.
 */
const API = fileURLToPath(new URL('../pages/api', import.meta.url));
const PAGINAS = fileURLToPath(new URL('../pages', import.meta.url));

const CRUDO = /\berror\??\.message\b|\be\.message\b/;

function ficherosApi(): string[] {
  return readdirSync(API, { recursive: true })
    .filter((f): f is string => typeof f === 'string' && f.endsWith('.ts'))
    .map((f) => join(API, f))
    .filter((f) => !f.includes(`${sep}auth${sep}`));
}

/** Líneas que devuelven `error.message` sin pasar por el helper. */
function fugas(): string[] {
  return ficherosApi().flatMap((fichero) =>
    readFileSync(fichero, 'utf8')
      .split('\n')
      .map((linea, i) => ({ linea, n: i + 1 }))
      .filter(
        ({ linea }) => /\berror\??\.message\b/.test(linea) && !linea.includes('mensajeError('),
      )
      .map(({ linea, n }) => `${relative(API, fichero)}:${n}: ${linea.trim()}`),
  );
}

/** Frontmatter (SSR) de una página `.astro`. */
function frontmatter(fichero: string): string {
  return /^---\n([\s\S]*?)\n---\n/.exec(readFileSync(fichero, 'utf8'))?.[1] ?? '';
}

function fugasPaginas(): string[] {
  return readdirSync(PAGINAS, { recursive: true })
    .filter((f): f is string => typeof f === 'string' && f.endsWith('.astro'))
    .map((f) => join(PAGINAS, f))
    .flatMap((fichero) =>
      frontmatter(fichero)
        .split('\n')
        .map((linea) => linea.trim())
        .filter((linea) => CRUDO.test(linea) && !linea.includes('mensajeError('))
        .map((linea) => `${relative(PAGINAS, fichero)}: ${linea}`),
    );
}

describe('mensajeError (H)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('oculta el NOT NULL de Postgres y registra el detalle', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const texto = mensajeError(
      {
        code: '23502',
        message:
          'null value in column "nombre" of relation "mascotas" violates not-null constraint',
      },
      'POST /api/mascotas',
    );
    expect(texto).toBe(ERROR_GENERICO);
    expect(texto).not.toMatch(/mascotas|nombre|column/i);
    expect(log).toHaveBeenCalledOnce();
    expect(String(log.mock.calls[0][0])).toContain('POST /api/mascotas');
    expect(String(log.mock.calls[0][0])).toContain('23502');
  });

  it('oculta el CHECK violado y el nombre de la constraint', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const texto = mensajeError(
      {
        code: '23514',
        message: 'new row for relation "fotos_mascota" violates check constraint "fotos_url_check"',
      },
      'PATCH /api/mascotas/:id',
    );
    expect(texto).toBe(ERROR_GENERICO);
    expect(texto).not.toMatch(/fotos_mascota|constraint/i);
  });

  it('preserva las reglas de negocio propias (P0001)', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const propio = 'No puedes cerrar la cuenta con una adopción pendiente';
    expect(mensajeError({ code: 'P0001', message: propio }, 'POST /api/cuenta/borrar')).toBe(
      propio,
    );
    // No es un fallo inesperado: no ensucia el log.
    expect(log).not.toHaveBeenCalled();
  });

  it('usa el fallback y no el mensaje cuando el error no trae código', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(mensajeError(new Error('relation "mascotas" does not exist'), 'GET /api/x')).toBe(
      ERROR_GENERICO,
    );
    expect(mensajeError(null, 'GET /api/x', 'Error de búsqueda')).toBe('Error de búsqueda');
  });
});

describe('endpoints sin mensajes crudos (H)', () => {
  it('recorre una lista no vacía de endpoints', () => {
    expect(ficherosApi().length).toBeGreaterThan(15);
  });

  it('ninguno responde `error.message` sin pasar por mensajeError', () => {
    expect(fugas()).toEqual([]);
  });
});

describe('páginas SSR sin mensajes crudos (H)', () => {
  it('recorre una lista no vacía de páginas', () => {
    const total = readdirSync(PAGINAS, { recursive: true }).filter(
      (f) => typeof f === 'string' && f.endsWith('.astro'),
    ).length;
    expect(total).toBeGreaterThan(15);
  });

  it('el frontmatter no reenvía el mensaje de Postgres', () => {
    expect(fugasPaginas()).toEqual([]);
  });
});
