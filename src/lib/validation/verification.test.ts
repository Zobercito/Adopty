import { describe, expect, it } from 'vitest';
import { verificacionSchema } from './verification';

const base = {
  tipo_evidencia: 'redes_sociales' as const,
  descripcion: '',
};

describe('verificacionSchema (A.1)', () => {
  it('acepta evidencia http y https', () => {
    for (const url of ['https://instagram.com/refugio', 'http://refugio.org/equipo']) {
      expect(verificacionSchema.safeParse({ ...base, url_evidencia: url }).success).toBe(true);
    }
  });

  it('rechaza esquemas que el navegador ejecuta al abrirse', () => {
    for (const url of [
      'javascript:alert(document.cookie)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
    ]) {
      const r = verificacionSchema.safeParse({ ...base, url_evidencia: url });
      expect(r.success).toBe(false);
    }
  });

  it('rechaza lo que no es una URL', () => {
    expect(verificacionSchema.safeParse({ ...base, url_evidencia: 'refugio.org' }).success).toBe(
      false,
    );
  });
});
