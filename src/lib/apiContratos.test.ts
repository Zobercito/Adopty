import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Contratos de las rutas nuevas del bloque medio (AUD-19b).
 *
 * No sustituyen a un e2e, pero fallan si una mutación pierde autenticación,
 * validación Zod o rate-limit, o si los hooks de aviso/auditoría desaparecen.
 */
const leer = (ruta: string) => readFileSync(new URL(ruta, import.meta.url), 'utf8');

const notificaciones = leer('../pages/api/notificaciones.ts');
const solicitudes = leer('../pages/api/solicitudes/index.ts');
const solicitudAccion = leer('../pages/api/solicitudes/[id].ts');
const mensajes = leer('../pages/api/mensajes/index.ts');
const storage = leer('./storage.ts');

describe('contratos del bloque medio', () => {
  it('la preferencia de avisos exige sesión, Zod y rate-limit', () => {
    expect(notificaciones).toMatch(/auth\.getUser\(\)/);
    expect(notificaciones).toMatch(/notificacionesSchema\.safeParse/);
    expect(notificaciones).toMatch(/rateLimitDistribuido/);
    expect(notificaciones).toMatch(/from\('usuarios'\)[\s\S]*update\(\{ notificaciones_email/);
  });

  it('solicitudes y mensajes encolan el aviso correcto', () => {
    expect(solicitudes).toMatch(/notificar\(supabase, 'solicitud_nueva'/);
    expect(solicitudAccion).toMatch(/notificar\([\s\S]*'solicitud_aprobada'/);
    expect(solicitudAccion).toMatch(/notificar\([\s\S]*'solicitud_rechazada'/);
    expect(mensajes).toMatch(/notificar\(supabase, 'mensaje_nuevo'/);
  });

  it('el upload genera y borra las variantes 640/1280', () => {
    expect(storage).toMatch(/for \(const ancho of \[640, 1280\]\)/);
    expect(storage).toMatch(/base\}-\$\{ancho\}\.webp/);
    expect(storage).toMatch(/-640\.webp/);
    expect(storage).toMatch(/-1280\.webp/);
  });
});
