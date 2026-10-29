import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Guardia de regresión de D.
 *
 * El seed crea usuarios reales en `auth.users` y la colección Postman repite el
 * par correo/contraseña. Si vuelve una contraseña fija (o el seed se reactiva
 * para entornos enlazados), cualquiera que lea el repo puede entrar con una
 * cuenta demo, una de ellas organización verificada.
 */
const leer = (ruta: string) => readFileSync(new URL(ruta, import.meta.url), 'utf8');

const seed = leer('../../supabase/seed.sql');
const config = leer('../../supabase/config.toml');
const postman = leer('../../postman/adopty.json');
const readme = leer('../../README.md');

describe('seed sin credenciales conocidas (D)', () => {
  it('no contiene la contraseña demo histórica', () => {
    expect(seed).not.toContain('Adopty123');
    expect(postman).not.toContain('Adopty123');
    expect(readme).not.toContain('Adopty123');
  });

  it('genera la contraseña en el propio SQL, no una fija', () => {
    expect(seed).toMatch(/crypt\(gen_random_uuid\(\)::text, gen_salt\('bf'\)\)/);
    expect(seed).not.toMatch(/crypt\('[^']*',\s*gen_salt\('bf'\)\)\s*,\s*now\(\)/i);
  });

  it('desactiva el seed automático en config.toml', () => {
    const bloque = config.match(/\[db\.seed\]([\s\S]*?)(?=\n\[|$)/);
    expect(bloque?.[1]).toMatch(/^\s*enabled\s*=\s*false\s*$/m);
    expect(bloque?.[1]).not.toMatch(/^\s*enabled\s*=\s*true\s*$/m);
  });

  it('la colección Postman sigue siendo JSON válido y usa variables para la clave', () => {
    const coleccion = JSON.parse(postman) as { variable: Array<{ key: string; value: string }> };
    const claves = coleccion.variable.map((v) => v.key);
    expect(claves).toContain('demo_password');
    expect(claves).toContain('qa_password');
    expect(postman).toMatch(/"password\\":\\"\{\{demo_password\}\}\\"/);
    expect(postman).toMatch(/"password\\":\\"\{\{qa_password\}\}\\"/);
  });
});
