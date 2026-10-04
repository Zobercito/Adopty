/**
 * ¿Está Google OAuth habilitado en este entorno?
 *
 * El código del flujo (ruta, callback, botones) existe desde la Fase 1, pero el
 * provider solo funciona si en Supabase → Authentication → Providers → Google hay
 * credenciales de Google Cloud configuradas.
 *
 * Mientras eso no pase, el botón se oculta en la UI en vez de llevar a un error,
 * y `/api/auth/google` responde 404. Para activarlo:
 *   1) Google Cloud Console → OAuth 2.0 Client ID
 *   2) Supabase → Authentication → Providers → Google →.client_id / secret → Guardar
 *   3) Aquí: PUBLIC_GOOGLE_ENABLED=true
 */
export const googleActivo = import.meta.env.PUBLIC_GOOGLE_ENABLED === 'true';
