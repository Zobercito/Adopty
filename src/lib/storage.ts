import sharp from 'sharp';
import type { SupabaseClient } from '@supabase/supabase-js';

const MAX_BYTES = 5 * 1024 * 1024; // 5MB por foto (política del plan)
const WEBP_MAX = 500 * 1024; // ≤500 KB tras conversión
const FORMATOS_OK = new Set(['jpeg', 'png', 'webp']);

/** Valida (tipo real vía sharp, no solo cabecera) y rechaza >5MB. */
async function validar(file: File): Promise<Buffer> {
  if (file.size > MAX_BYTES) throw new Error(`"${file.name || 'foto'}" supera 5 MB`);
  const buf = Buffer.from(await file.arrayBuffer());
  const meta = await sharp(buf)
    .metadata()
    .catch(() => null);
  if (!meta || !meta.format || !FORMATOS_OK.has(meta.format)) {
    throw new Error(`"${file.name || 'foto'}" no es JPEG, PNG ni WebP`);
  }
  return buf;
}

/** Convierte a WebP ≤500KB (EXIF rotado fuera, máx. 1600px). */
async function aWebp(buf: Buffer): Promise<Buffer> {
  for (const [quality, width] of [
    [80, 1600],
    [65, 1400],
    [50, 1200],
    [40, 1000],
    [30, 800],
  ] as const) {
    const out = await sharp(buf)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();
    if (out.length <= WEBP_MAX) return out;
  }
  // caso extremo: último intento aunque pese un poco más (siempre ≤ ~800px)
  return sharp(buf)
    .rotate()
    .resize({ width: 800, withoutEnlargement: true })
    .webp({ quality: 30 })
    .toBuffer();
}

/**
 * Sube 1–5 fotos al bucket `mascotas` como WebP ≤500KB.
 * Devuelve rutas relativas (`userId/uuid.webp`), nunca URLs.
 */
export async function subirFotos(
  supabase: SupabaseClient,
  userId: string,
  files: File[],
): Promise<string[]> {
  if (files.length < 1 || files.length > 5) throw new Error('Sube entre 1 y 5 fotos');
  const paths: string[] = [];
  for (const file of files) {
    const buf = await validar(file);
    const webp = await aWebp(buf);
    const path = `${userId}/${crypto.randomUUID()}.webp`;
    const { error } = await supabase.storage.from('mascotas').upload(path, webp, {
      contentType: 'image/webp',
      upsert: false,
    });
    if (error) throw new Error(`No se pudo subir una foto: ${error.message}`);
    paths.push(path);
  }
  return paths;
}

/** Borra objetos del bucket (ignora rutas tipo `/assets/` que no viven en storage). */
export async function borrarFotosStorage(supabase: SupabaseClient, paths: string[]): Promise<void> {
  const objetos = paths.filter((p) => p && !p.startsWith('/') && !p.startsWith('http'));
  if (objetos.length) await supabase.storage.from('mascotas').remove(objetos);
}
