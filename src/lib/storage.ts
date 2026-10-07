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

const PERFIL_MAX = 300 * 1024; // ≤300 KB tras conversión

/**
 * Sube la foto de perfil al bucket `perfiles` como WebP cuadrada (512×512) ≤300KB.
 * Devuelve la ruta relativa (`userId/uuid.webp`), nunca una URL.
 *
 * El bucket `mascotas` no se reutiliza: su INSERT no limita la ruta, así que
 * cualquier autenticado podía escribir sobre la carpeta de otro.
 */
export async function subirFotoPerfil(
  supabase: SupabaseClient,
  userId: string,
  file: File,
): Promise<string> {
  const buf = await validar(file);
  // `position: 'attention'` usa el recorte central del EXIF: mismo look que las
  // fotos de mascota sin tener que pedirle recorte manual al usuario.
  const webp = await sharp(buf)
    .rotate()
    .resize(512, 512, { fit: 'cover', position: 'attention', withoutEnlargement: false })
    .webp({ quality: 82 })
    .toBuffer();
  const salida =
    webp.length <= PERFIL_MAX
      ? webp
      : await sharp(buf)
          .rotate()
          .resize(512, 512, { fit: 'cover' })
          .webp({ quality: 60 })
          .toBuffer();

  const path = `${userId}/${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage.from('perfiles').upload(path, salida, {
    contentType: 'image/webp',
    upsert: false,
  });
  if (error) throw new Error(`No se pudo subir tu foto: ${error.message}`);
  return path;
}

/** Borra la foto de perfil (ignora rutas que no viven en storage). */
export async function borrarFotoPerfilStorage(
  supabase: SupabaseClient,
  path: string,
): Promise<void> {
  if (!path || path.startsWith('/') || path.startsWith('http')) return;
  await supabase.storage.from('perfiles').remove([path]);
}
