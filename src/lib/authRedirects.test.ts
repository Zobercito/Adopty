import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Guardia de AUD-04: los redirects de Auth usan el dominio configurado
 * (`import.meta.env.SITE`) y nunca el Host de la petición. Si vuelve `url.origin`,
 * un Host manipulado + un comodín en Redirect URLs podría llevarse el `code`.
 */
const leer = (ruta: string) => readFileSync(new URL(ruta, import.meta.url), 'utf8');

const register = leer('../pages/api/auth/register.ts');
const recuperar = leer('../pages/api/auth/recuperar.ts');
const google = leer('../pages/api/auth/google.ts');
const callback = leer('../pages/api/auth/callback.ts');

describe('redirects de Auth sin url.origin (AUD-04)', () => {
  it('usa import.meta.env.SITE en los tres flujos', () => {
    for (const fuente of [register, recuperar, google]) {
      expect(fuente).toContain('import.meta.env.SITE');
      expect(fuente).not.toContain('url.origin');
    }
  });

  it('mantiene la validación de `next` en Google y callback', () => {
    expect(google).toMatch(/rutaInternaSegura/);
    expect(callback).toMatch(/rutaInternaSegura/);
  });
});
