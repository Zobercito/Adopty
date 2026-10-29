/**
 * Flujos que envían un correo (alta, cambio y recuperación) — hallazgo I.
 *
 * La respuesta al cliente es deliberadamente indistinguible exista o no una
 * cuenta con ese correo: un 409 «ya está en uso» o el texto de GoTrue permiten
 * enumerar qué correos están registrados. El aviso real viaja por correo y el
 * detalle queda solo en el log del servidor, sin PII.
 */

export interface RespuestaEnvioCorreo {
  ok: true;
  mensaje: string;
}

export const MENSAJE_ENVIO_CORREO = 'Si el correo es válido, recibirás un enlace de confirmación.';

/** Respuesta uniforme: el mismo cuerpo tanto si el correo está libre como ocupado. */
export function respuestaEnvioCorreo(): RespuestaEnvioCorreo {
  return { ok: true, mensaje: MENSAJE_ENVIO_CORREO };
}

/**
 * ¿El error de Supabase Auth significa «ese correo ya tiene cuenta»? Se mira el
 * código y, como respaldo, el texto: GoTrue no devuelve un código estable en
 * todas sus versiones. Solo sirve para decidir el log; nunca el cuerpo.
 */
export function esCorreoYaRegistrado(error: unknown): boolean {
  const e = (error ?? {}) as { code?: unknown; message?: unknown };
  const codigo = typeof e.code === 'string' ? e.code.toLowerCase() : '';
  if (
    codigo === 'user_already_exists' ||
    codigo === 'user_already_registered' ||
    codigo === 'email_exists'
  ) {
    return true;
  }
  const texto = typeof e.message === 'string' ? e.message.toLowerCase() : '';
  return (
    texto.includes('already registered') ||
    texto.includes('already been registered') ||
    texto.includes('already exists') ||
    texto.includes('already in use')
  );
}

/** Log de un duplicado: sin correo ni identificadores (Ley 81). */
export function avisoCorreoDuplicado(contexto: string): void {
  console.warn(`[auth] ${contexto}: correo ya registrado; respuesta uniforme (sin PII)`);
}
