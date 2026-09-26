/* eslint-disable no-console */
 /**
 * Perf smoke (Fase 7) — mide p50/p95 de la búsqueda contra el dev server local.
 * Uso: `npm run dev` en otra terminal y luego `node scripts/perf.mjs [base]`.
 * Criterio del plan: búsqueda p95 < 1s.
 */
const base = process.argv[2] ?? 'http://localhost:4321';
const rutas = [
  '/api/mascotas',
  '/api/mascotas?especie=gato',
  '/api/mascotas?especie=gato&tamano=Peque%C3%B1o&q=a&orden=recientes&page=1',
  '/api/mascotas?q=bethania&orden=antiguos',
  '/explorar?especie=perro',
];
const N = 15;

const pct = (xs, p) => xs[Math.min(xs.length - 1, Math.floor((p / 100) * xs.length))];

for (const ruta of rutas) {
  const tiempos = [];
  let ok = 0;
  for (let i = 0; i < N; i++) {
    const t0 = performance.now();
    try {
      const r = await fetch(base + ruta);
      if (r.ok) ok++;
      await r.arrayBuffer();
    } catch {
      /* cuenta como fallo */
    }
    tiempos.push(performance.now() - t0);
  }
  tiempos.sort((a, b) => a - b);
  const p50 = pct(tiempos, 50).toFixed(0);
  const p95 = pct(tiempos, 95).toFixed(0);
  const marca = Number(p95) < 1000 && ok === N ? 'OK ' : 'REVISAR';
  console.log(`${marca} ${ruta} → ok ${ok}/${N} · p50 ${p50}ms · p95 ${p95}ms`);
}
