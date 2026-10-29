/**
 * Graba el recorrido público de la demo y genera `docs/screenshots/demo.gif`.
 *
 * Uso:  node scripts/grabar-demo.mjs [base]
 *
 * Por qué existe: el README muestra un GIF del producto, pero grabarlo a mano
 * no es reproducible. Este script hace el recorrido con Playwright (solo
 * lectura: no inicia sesión ni escribe nada) y deja un `.webm` en /tmp para que
 * ffmpeg lo convierta. Requiere `ffmpeg` en el PATH y Playwright instalado.
 *
 * Contra producción no sirve todavía: la tarjeta de `explorar` corta el badge
 * de estado en la versión desplegada. Grábalo contra `npm run dev` local.
 */
/* eslint-disable no-console -- es un script de CLI: su salida ES el producto */

import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:4321';
const TMP = '/tmp/opencode/video';
const SALIDA = 'docs/screenshots/demo.gif';
const W = 1280;
const H = 720;

/**
 * Playwright no dibuja el puntero en la grabación. Este script lo pinta como
 * una flecha real y esconde la barra de desarrollo de Astro (solo existe en
 * `astro dev`).
 *
 * Dos detalles hacen que parezca real:
 * - La punta de la flecha está en el origen (0,0), así que apunta exactamente al
 *   punto que Playwright pulsa.
 * - La posición se guarda en `sessionStorage`. Al navegar, la página nueva no
 *   dispara `mousemove`, y sin esto el puntero reaparecía en el centro de la
 *   pantalla a cada cambio de página.
 */
const CURSOR = () => {
  const add = () => {
    const style = document.createElement('style');
    style.textContent = 'astro-dev-toolbar { display: none !important; }';
    document.head.appendChild(style);
    if (document.getElementById('__cur')) return;

    // Flecha clásica: blanca con contorno oscuro y sombra suave. El viewBox
    // deja la punta en (4,3) y se compensa con el margen del contenedor.
    const el = document.createElement('div');
    el.id = '__cur';
    el.style.cssText = [
      'position:fixed',
      'left:0',
      'top:0',
      'width:20px',
      'height:22px',
      'margin:-3px 0 0 -4px',
      'opacity:0',
      'pointer-events:none',
      'z-index:2147483647',
    ].join(';');
    el.innerHTML = `
      <svg width="20" height="22" viewBox="0 0 20 22" fill="none"
           style="display:block;filter:drop-shadow(0 1px 2px rgba(15,23,42,.35));transition:transform .06s ease-out;transform-origin:4px 3px">
        <path d="M4 3 L4 19 L8.3 15.1 L10.9 21 L14.1 19.6 L11.4 13.8 L16.6 13.4 Z"
              fill="#fff" stroke="#111827" stroke-width="1.3" stroke-linejoin="round"/>
      </svg>`;
    document.body.appendChild(el);

    const flecha = el.firstElementChild;

    // Posición previa a la navegación; si no hay, no se pinta hasta que el
    // ratón se mueva (un cursor quieto en el centro también se ve raro).
    let pos = null;
    try {
      const guardada = JSON.parse(sessionStorage.getItem('__curpos') || 'null');
      if (guardada && Number.isFinite(guardada.x) && Number.isFinite(guardada.y)) pos = guardada;
    } catch {
      /* sessionStorage puede fallar en modo privado: se ignora */
    }

    const paint = () => {
      el.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
    };
    if (pos) {
      paint();
      el.style.opacity = '1';
    }

    window.addEventListener(
      'mousemove',
      (e) => {
        pos = { x: e.clientX, y: e.clientY };
        el.style.opacity = '1';
        paint();
        try {
          sessionStorage.setItem('__curpos', JSON.stringify(pos));
        } catch {
          /* idem */
        }
      },
      { passive: true },
    );
    // Micro-animación al pulsar: la flecha se encoge un poco, como un clic real.
    window.addEventListener('mousedown', () => (flecha.style.transform = 'scale(.86)'), {
      passive: true,
    });
    window.addEventListener('mouseup', () => (flecha.style.transform = ''), { passive: true });
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', add, { once: true });
  } else {
    add();
  }
};

/**
 * Mueve el ratón con aceleración y frenada (ease-in-out), no a velocidad
 * constante: un desplazamiento lineal también delata que es un script.
 */
let raton = null;
async function glide(page, x, y, pasos = 22) {
  if (!raton) {
    await page.mouse.move(x, y, { steps: pasos });
    raton = { x, y };
    await page.waitForTimeout(160);
    return;
  }
  const desde = raton;
  const suave = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
  for (let i = 1; i <= pasos; i++) {
    const e = suave(i / pasos);
    await page.mouse.move(desde.x + (x - desde.x) * e, desde.y + (y - desde.y) * e);
    await page.waitForTimeout(9);
  }
  raton = { x, y };
  await page.waitForTimeout(140);
}

/** Centro del elemento, en coordenadas de la ventana. */
async function center(locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`Elemento sin caja: ${locator}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
  locale: 'es-PA',
  recordVideo: { dir: TMP, size: { width: W, height: H } },
});
await context.addInitScript(CURSOR);

const page = await context.newPage();
page.setDefaultTimeout(30000);

// 1. Portada.
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);

// 2. Carrusel de destacadas → Explorar.
const cta = page.locator('a[href="/explorar"]', { hasText: 'Explorar todas las mascotas' }).first();
await cta.scrollIntoViewIfNeeded();
await page.waitForTimeout(1200);
const pCta = await center(cta);
await glide(page, pCta.x, pCta.y);
await cta.click();
await page.waitForLoadState('networkidle');
await page.locator('#grid article').first().waitFor();
await page.waitForTimeout(1800);

// 3. Filtro por especie.
const chip = page.locator('label.chip', { hasText: 'Gatos' }).first();
const pChip = await center(chip);
await glide(page, pChip.x, pChip.y);
await chip.click();
await page.waitForTimeout(2400);

// 4. Primera tarjeta del resultado: la foto y luego "Ver perfil".
const card = page.locator('#grid article').first();
await card.scrollIntoViewIfNeeded();
const caja = await card.boundingBox();
if (!caja) throw new Error('La tarjeta no tiene caja');
await glide(page, caja.x + caja.width / 2, caja.y + caja.height * 0.35);
await page.waitForTimeout(1400);

const ver = card.locator('a.btn-primary').first();
const pVer = await center(ver);
await glide(page, pVer.x, pVer.y);
await page.waitForTimeout(500);
await ver.click();
await page.waitForLoadState('networkidle');
await page.locator('h1').first().waitFor();
await page.waitForTimeout(2000);

// 5. Lectura de la ficha: el ratón baja con el desplazamiento, como al leer.
await page.mouse.wheel(0, 420);
await page.waitForTimeout(600);
await glide(page, 600, 380, 14);
await page.waitForTimeout(1600);

const video = page.video();
await page.close();
const raw = path.join(TMP, 'demo.webm');
await video.saveAs(raw);
await context.close();
await browser.close();

// 820 px de ancho, 8 fps y 96 colores: ~2,5 MB, que GitHub muestra sin problemas.
fs.mkdirSync(path.dirname(SALIDA), { recursive: true });
execFileSync(
  'ffmpeg',
  [
    '-y',
    '-v',
    'error',
    '-i',
    raw,
    '-vf',
    'fps=8,scale=820:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',
    '-loop',
    '0',
    SALIDA,
  ],
  { stdio: 'inherit' },
);

console.log(`${SALIDA} — ${(fs.statSync(SALIDA).size / 1024 / 1024).toFixed(1)} MB`);
