import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fotoUrl } from './mascotas';
import { petUpdateSchema } from './validation/pet';

/**
 * Guardia de regresión de E.
 *
 * `fotos_write`, `personas_update` y `org_update` permiten escribir la ruta de
 * la foto como texto libre, así que el CHECK de la base es la frontera real:
 * una URL de un tercero en una ficha pública filtra la IP/Referer de cada
 * visitante (Ley 81). `fotoUrl()` tampoco debe devolver intacto un `http(s)://`.
 */
const sql = readFileSync(
  new URL('../../supabase/migrations/20261028070000_rutas_foto_check.sql', import.meta.url),
  'utf8',
);

describe('petUpdateSchema confina las rutas de foto (E)', () => {
  it('rechaza URLs externas en fotos_keep', () => {
    expect(petUpdateSchema.safeParse({ fotos_keep: ['https://x/y.png'] }).success).toBe(false);
    expect(petUpdateSchema.safeParse({ fotos_keep: ['//x/y.webp'] }).success).toBe(false);
  });

  it('acepta rutas relativas .webp en fotos_keep y fotos_new', () => {
    expect(petUpdateSchema.safeParse({ fotos_keep: ['uid/archivo.webp'] }).success).toBe(true);
    expect(petUpdateSchema.safeParse({ fotos_new: ['uid/archivo.webp'] }).success).toBe(true);
    expect(petUpdateSchema.safeParse({ fotos_new: ['https://x/y.webp'] }).success).toBe(false);
  });

  it('acepta los assets locales del seed al conservar, también con mayúsculas', () => {
    expect(petUpdateSchema.safeParse({ fotos_keep: ['/assets/6.JPG'] }).success).toBe(true);
    expect(petUpdateSchema.safeParse({ fotos_keep: ['/assets/1.jpeg'] }).success).toBe(true);
    expect(petUpdateSchema.safeParse({ fotos_keep: ['/assets/6.webp'] }).success).toBe(true);
    expect(petUpdateSchema.safeParse({ fotos_keep: ['/assets/logo.svg'] }).success).toBe(false);
    expect(
      petUpdateSchema.safeParse({ fotos_keep: ['/assets/../../etc/passwd.jpg'] }).success,
    ).toBe(false);
  });

  it('no admite assets locales como foto nueva (las nuevas van al bucket)', () => {
    expect(petUpdateSchema.safeParse({ fotos_new: ['/assets/6.JPG'] }).success).toBe(false);
  });
});

describe('migración con CHECK de rutas de foto (E)', () => {
  it('añade el CHECK a las tres columnas', () => {
    expect(sql).toMatch(/alter table public\.fotos_mascota[\s\S]*?check \(/i);
    expect(sql).toMatch(/alter table public\.personas[\s\S]*?check \(/i);
    expect(sql).toMatch(/alter table public\.organizaciones[\s\S]*?check \(/i);
  });

  it('usa el patrón relativo .webp y admite NULL en perfiles', () => {
    const patron = String.raw`^[A-Za-z0-9_-]+/[A-Za-z0-9_-]+\.webp$`;
    expect(sql.split(patron).length - 1).toBeGreaterThanOrEqual(3);
    expect(sql).toMatch(/foto_perfil is null/i);
    expect(sql).toMatch(/logo is null/i);
  });

  it('compara la extensión de los assets sin distinguir mayúsculas (~*)', () => {
    const patronAsset = String.raw`~* '^/assets/[A-Za-z0-9_.-]+\.(jpe?g|png|webp)$'`;
    expect(sql.split(patronAsset).length - 1).toBe(6);
    expect(sql).not.toMatch(/~ '\^\/assets\//);
  });

  it('sanea antes de validar (NOT VALID + UPDATE/DELETE)', () => {
    expect(sql.match(/\)\s*not valid;/gi)?.length).toBe(3);
    expect(sql).toMatch(/delete from public\.fotos_mascota/i);
    expect(sql).toMatch(/update public\.personas/i);
    expect(sql).toMatch(/update public\.organizaciones/i);
  });
});

describe('fotoUrl no sirve recursos de terceros (E)', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('descarta http(s):// y rutas fuera del bucket', () => {
    expect(fotoUrl('https://tercero/t.gif')).toBe('');
    expect(fotoUrl('http://tercero/t.gif')).toBe('');
    expect(fotoUrl('//tercero/t.gif')).toBe('');
    expect(fotoUrl('javascript:alert(1)')).toBe('');
  });

  it('sigue resolviendo rutas válidas y assets locales', () => {
    vi.stubEnv('PUBLIC_SUPABASE_URL', 'https://xyz.supabase.co');
    expect(fotoUrl('uid/foto.webp')).toBe(
      'https://xyz.supabase.co/storage/v1/object/public/mascotas/uid/foto.webp',
    );
    expect(fotoUrl('/assets/1.jpeg')).toBe('/assets/1.jpeg');
  });
});
