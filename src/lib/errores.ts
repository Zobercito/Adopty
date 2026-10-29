/**
 * Mensajes de error seguros para el cliente (hallazgo H).
 *
 * PostgREST y Postgres devuelven en `message` nombres de tabla, columna y
 * constraint; reenviarlos ayuda a quien sondea RLS. Solo se devuelve el texto
 * cuando es una regla de negocio propia (`P0001` de nuestras RPC, p. ej. la
 * baja de cuenta con una adopción pendiente). En cualquier otro caso el detalle
 * va al log del servidor y el cliente recibe un texto genérico.
 */

export const ERROR_GENERICO = 'No se pudo completar la operación';

/** 300 caracteres bastan para diagnosticar sin inflar el log. */
const MAX_DETALLE = 300;

interface ErrorPostgrest {
  code?: unknown;
  message?: unknown;
}

/**
 * `mensajeError(error, contexto, fallback)` — texto apto para el cliente.
 *
 * @param contexto ruta del endpoint, para que el log identifique el origen.
 * @param fallback texto genérico si el error no es una regla de negocio propia.
 */
export function mensajeError(error: unknown, contexto = 'api', fallback = ERROR_GENERICO): string {
  const e = (error ?? {}) as ErrorPostgrest;
  const codigo = typeof e.code === 'string' && e.code ? e.code : 'sin-código';
  const detalle = (
    typeof e.message === 'string' && e.message ? e.message : String(error ?? '')
  ).slice(0, MAX_DETALLE);

  // P0001 = RAISE EXCEPTION deliberado de nuestras RPC: mensaje de dominio.
  if (codigo === 'P0001' && detalle) return detalle;

  console.error(`[api] ${contexto} (${codigo}): ${detalle}`);
  return fallback;
}
