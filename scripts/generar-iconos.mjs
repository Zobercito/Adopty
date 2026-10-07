/**
 * Genera los iconos PNG de la PWA desde el logo de marca (PNG con fondo
 * transparente en public/brand/adopty-logo-icon.png).
 *
 * Uso:  node scripts/generar-iconos.mjs
 *
 * Por qué hace falta: el manifest solo declaraba `favicon.svg`, y Chrome exige
 * íconos PNG de 192 y 512 para ofrecer el botón "Instalar app". Este script
 * deja los archivos listos y versionados, así que cualquier teammate puede
 * regenerarlos si cambia el logo.
 */
/* eslint-disable no-console -- es un script de CLI: su salida ES el producto */
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destino = resolve(raiz, 'public');
const logo = resolve(raiz, 'public/brand/adopty-logo-icon.png');

// Icono recortado (sin borde transparente) listo para componer.
const icono = await sharp(logo).trim().toBuffer({ resolveWithObject: true });

/** Compone el icono centrado sobre un fondo opaco. `inset` = margen interior. */
async function png(fondo, s, archivo, inset = 0.12) {
  const lado = Math.round(s * (1 - inset * 2));
  const ico = await sharp(icono.data)
    .resize(lado, lado, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp({ create: { width: s, height: s, channels: 4, background: fondo } })
    .composite([{ input: ico, left: Math.round((s - lado) / 2), top: Math.round((s - lado) / 2) }])
    .png({ compressionLevel: 9 })
    .toFile(resolve(destino, archivo));
  console.log(`  ✅ ${archivo} (${s}×${s})`);
}

await mkdir(destino, { recursive: true });
console.log('Generando iconos PWA desde el logo de marca…');
// Fondo blanco para "any"; el icono de marca ya lleva sus colores.
await png({ r: 255, g: 255, b: 255, alpha: 1 }, 192, 'icon-192.png');
await png({ r: 255, g: 255, b: 255, alpha: 1 }, 512, 'icon-512.png');
// Maskable: icono dentro de la zona segura (80 %) sobre fondo oscuro de marca.
await png({ r: 30, g: 41, b: 59, alpha: 1 }, 512, 'icon-maskable-512.png', 0.2);
await png({ r: 255, g: 255, b: 255, alpha: 1 }, 180, 'apple-touch-icon.png', 0.16);
await png({ r: 255, g: 255, b: 255, alpha: 1 }, 167, 'apple-add-icon-image.png', 0.16);
// Favicon PNG (además del .svg existente).
await png({ r: 255, g: 255, b: 255, alpha: 1 }, 48, 'favicon.png', 0.05);
console.log('Listo.');
