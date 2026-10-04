/**
 * Genera los iconos PNG de la PWA desde el logo en SVG.
 *
 * Uso:  node scripts/generar-iconos.mjs
 *
 * Por qué hace falta: el manifest solo declaraba `favicon.svg`, y Chrome exige
 * íconos PNG de 192 y 512 para ofrecer el botón "Instalar app". Este script
 * deja los archivos listos y versionados, así que cualquier teammate puede
 * regenerarlos si cambia el logo.
 */
/* eslint-disable no-console -- es un script de CLI: su salida ES el producto */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destino = resolve(raiz, 'public');

/** @param {number} s  lado del lienzo @param {number} inset  margen interior (0.10 = 10%) */
function svgLogo(s, inset = 0.1) {
  const escala = s * (1 - inset * 2);
  const x = (s - escala) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" fill="#FFF1E6"/>
  <g transform="translate(${x} ${x}) scale(${escala / 48})">
    <circle cx="24" cy="24" r="22" fill="#FFF1E6"/>
    <g fill="#FF7A29">
      <ellipse cx="24" cy="28" rx="8" ry="6.5"/>
      <ellipse cx="15.5" cy="20" rx="3.2" ry="4"/>
      <ellipse cx="21" cy="16.5" rx="3.2" ry="4"/>
      <ellipse cx="27" cy="16.5" rx="3.2" ry="4"/>
      <ellipse cx="32.5" cy="20" rx="3.2" ry="4"/>
    </g>
    <path d="M10 38c4 3.5 8.5 5 14 5s10-1.5 14-5" stroke="#2EC4B6" stroke-width="3" stroke-linecap="round" fill="none"/>
  </g>
</svg>`;
}

/** Versión "maskable": fondo hasta el borde y logo dentro del 80% de zona segura. */
function svgMaskable(s) {
  const inner = s * 0.8;
  const x = (s - inner) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" fill="#FF7A29"/>
  <g transform="translate(${x} ${x}) scale(${inner / 48})">
    <g fill="#FFFFFF">
      <ellipse cx="24" cy="28" rx="8" ry="6.5"/>
      <ellipse cx="15.5" cy="20" rx="3.2" ry="4"/>
      <ellipse cx="21" cy="16.5" rx="3.2" ry="4"/>
      <ellipse cx="27" cy="16.5" rx="3.2" ry="4"/>
      <ellipse cx="32.5" cy="20" rx="3.2" ry="4"/>
    </g>
    <path d="M10 38c4 3.5 8.5 5 14 5s10-1.5 14-5" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" fill="none"/>
  </g>
</svg>`;
}

/** Apple no acepta SVG en touch-icon: genera también el PNG de 180. */
async function png(svg, s, archivo) {
  await sharp(Buffer.from(svg), { density: 384 })
    .resize(s, s)
    .png({ compressionLevel: 9 })
    .toFile(resolve(destino, archivo));
  console.log(`  ✅ ${archivo} (${s}×${s})`);
}

await mkdir(destino, { recursive: true });
console.log('Generando iconos PWA…');
for (const s of [192, 512]) await png(svgLogo(s), s, `icon-${s}.png`);
await png(svgMaskable(512), 512, 'icon-maskable-512.png');
await png(svgLogo(180, 0.16), 180, 'apple-touch-icon.png');

// apple-add-icon-image.png es lo que usa Safari 15+ para el "Add to Home Screen".
await png(svgLogo(167, 0.16), 167, 'apple-add-icon-image.png');

await writeFile(resolve(destino, 'icon.svg'), svgLogo(512), 'utf8');
console.log('  ✅ icon.svg');
console.log('Listo.');
