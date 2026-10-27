/**
 * Devuelve una ruta interna segura para redirigir tras login/OAuth.
 *
 * Rechaza URLs absolutas, protocol-relative (`//`), backslashes y caracteres de
 * control. Esto evita open redirects del tipo `next=//sitio-malicioso`.
 */
export function rutaInternaSegura(next: unknown, fallback = '/perfil'): string {
  if (typeof next !== 'string') return fallback;
  const valor = next.trim();
  if (!valor || !valor.startsWith('/') || valor.startsWith('//')) return fallback;
  if (/[\\\u0000-\u001f\u007f]/.test(valor)) return fallback;

  const base = 'https://adopty.invalid';
  try {
    const url = new URL(valor, base);
    if (url.origin !== base) return fallback;
    const ruta = `${url.pathname}${url.search}${url.hash}`;
    return ruta.startsWith('/') ? ruta : fallback;
  } catch {
    return fallback;
  }
}
