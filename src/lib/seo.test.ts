import { describe, expect, it } from 'vitest';
import { jsonLdSeguro } from './seo';

describe('jsonLdSeguro', () => {
  it('produce JSON válido y conserva la estructura', () => {
    const data = {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Adopty',
      url: 'https://adopty.example/',
    };
    expect(JSON.parse(jsonLdSeguro(data))).toEqual(data);
  });

  it('escapa < y > para impedir cerrar el script', () => {
    const salida = jsonLdSeguro({ name: '</script><img src=x onerror=alert(1)>' });
    expect(salida).not.toContain('</script>');
    expect(salida).not.toContain('<img');
    expect(salida).toContain('\\u003c/script\\u003e');
    expect(JSON.parse(salida).name).toBe('</script><img src=x onerror=alert(1)>');
  });

  it('escapa & y separadores Unicode', () => {
    const salida = jsonLdSeguro({ texto: 'a&b\u2028c\u2029d' });
    expect(salida).toContain('\\u0026');
    expect(salida).toContain('\\u2028');
    expect(salida).toContain('\\u2029');
    expect(JSON.parse(salida).texto).toBe('a&b\u2028c\u2029d');
  });
});
