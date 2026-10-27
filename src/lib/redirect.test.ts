import { describe, expect, it } from 'vitest';
import { rutaInternaSegura } from './redirect';

describe('rutaInternaSegura', () => {
  it('acepta rutas internas con query y hash', () => {
    expect(rutaInternaSegura('/panel')).toBe('/panel');
    expect(rutaInternaSegura('/mascota/luna?x=1#fotos')).toBe('/mascota/luna?x=1#fotos');
  });

  it('cae al fallback con valores vacíos o no string', () => {
    expect(rutaInternaSegura(null)).toBe('/perfil');
    expect(rutaInternaSegura(undefined)).toBe('/perfil');
    expect(rutaInternaSegura('')).toBe('/perfil');
    expect(rutaInternaSegura(42)).toBe('/perfil');
  });

  it('rechaza rutas externas y protocol-relative', () => {
    expect(rutaInternaSegura('https://evil.example')).toBe('/perfil');
    expect(rutaInternaSegura('//evil.example')).toBe('/perfil');
    expect(rutaInternaSegura('///evil.example')).toBe('/perfil');
    expect(rutaInternaSegura('javascript:alert(1)')).toBe('/perfil');
  });

  it('rechaza backslashes y caracteres de control', () => {
    expect(rutaInternaSegura('/\\evil.example')).toBe('/perfil');
    expect(rutaInternaSegura('/\u0009panel')).toBe('/perfil');
    expect(rutaInternaSegura('/\u0000')).toBe('/perfil');
  });

  it('respeta un fallback personalizado', () => {
    expect(rutaInternaSegura('//evil.example', '/')).toBe('/');
  });
});
