import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * Smoke de accesibilidad (WCAG 2.0/2.1/2.2 A+AA) sobre las páginas clave en
 * móvil y escritorio. Complementa la auditoría manual de axe/Lighthouse.
 */

const PAGINAS = ['/', '/explorar', '/login', '/register', '/terminos'];
const ANCHOS = [360, 1280];

for (const ruta of PAGINAS) {
  for (const ancho of ANCHOS) {
    test(`${ruta} sin violaciones axe a ${ancho}px`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: 800 });
      await page.goto(ruta, { waitUntil: 'networkidle' });

      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();

      const detalle = violations.map((v) => `${v.id} (${v.nodes.length} nodos)`).join('\n');
      expect(violations, detalle).toEqual([]);
    });
  }
}
