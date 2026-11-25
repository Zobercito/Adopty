/* eslint-disable no-console */
/**
 * Backfill de variantes 640/1280 para fotos ya subidas (AUD-09).
 *
 * Usa la sesión del PROPIO publicador (email/contraseña), no service role: la RLS
 * de Storage exige que la carpeta sea `auth.uid()` y la cuenta esté activa.
 * Ejecutar una vez por cuenta que tenga fotos antiguas.
 *
 * Uso:
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_ANON_KEY=<anon> \
 *   ADOPTY_EMAIL=publicador@ejemplo.com \
 *   ADOPTY_PASSWORD='...' \
 *   node scripts/backfill-srcset.mjs
 *
 * Añade `--dry-run` para ver qué fotos faltan sin subir nada.
 */
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const email = process.env.ADOPTY_EMAIL;
const password = process.env.ADOPTY_PASSWORD;
const dryRun = process.argv.includes('--dry-run');

if (!url || !anon || !email || !password) {
  console.error('Faltan SUPABASE_URL, SUPABASE_ANON_KEY, ADOPTY_EMAIL o ADOPTY_PASSWORD.');
  process.exit(1);
}

const supabase = createClient(url, anon);
const { data: sesion, error: errLogin } = await supabase.auth.signInWithPassword({
  email,
  password,
});
if (errLogin || !sesion.user) {
  console.error('No se pudo iniciar sesión:', errLogin?.message ?? 'sin usuario');
  process.exit(1);
}

const { data: mascotas, error: errMascotas } = await supabase
  .from('mascotas')
  .select('id, fotos_mascota(url_foto)')
  .eq('id_publicador', sesion.user.id)
  .is('deleted_at', null);
if (errMascotas) {
  console.error('No se pudieron leer las mascotas:', errMascotas.message);
  process.exit(1);
}

const rutas = new Set();
for (const m of mascotas ?? []) {
  for (const f of m.fotos_mascota ?? []) {
    if (f.url_foto && !f.url_foto.startsWith('/') && !f.url_foto.startsWith('http')) {
      rutas.add(f.url_foto);
    }
  }
}

console.log(`Cuenta: ${email} · fotos en storage: ${rutas.size}${dryRun ? ' (dry-run)' : ''}`);

let ok = 0;
let fallos = 0;
for (const path of rutas) {
  const base = path.replace(/\.webp$/i, '');
  try {
    if (dryRun) {
      console.log(`  [dry] ${base}-640.webp y ${base}-1280.webp`);
      ok++;
      continue;
    }
    const { data: original, error: errDown } = await supabase.storage
      .from('mascotas')
      .download(path);
    if (errDown || !original) throw new Error(errDown?.message ?? 'descarga vacía');
    const buf = Buffer.from(await original.arrayBuffer());

    for (const ancho of [640, 1280]) {
      const variante = await sharp(buf)
        .rotate()
        .resize({ width: ancho, withoutEnlargement: true })
        .webp({ quality: 72 })
        .toBuffer();
      const { error: errUp } = await supabase.storage
        .from('mascotas')
        .upload(`${base}-${ancho}.webp`, variante, {
          contentType: 'image/webp',
          upsert: true,
        });
      if (errUp) throw new Error(`${ancho}px: ${errUp.message}`);
    }
    ok++;
  } catch (e) {
    fallos++;
    console.warn(`  fallo ${path}: ${e instanceof Error ? e.message : 'error'}`);
  }
}

console.log(`Listo: ${ok} fotos procesadas, ${fallos} con error.`);
await supabase.auth.signOut();
