/**
 * Serializa JSON-LD para incrustarlo en `<script type="application/ld+json">`.
 * Escapa los caracteres que podrían cerrar el script o romper el parser.
 */
export function jsonLdSeguro(data: Record<string, unknown> | Record<string, unknown>[]): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
