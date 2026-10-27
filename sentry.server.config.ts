import * as Sentry from '@sentry/astro';

// En el servidor la variable no necesita prefijo PUBLIC_; en Vercel se define
// como SENTRY_DSN y en local vive en `.env`.
const dsn = process.env.SENTRY_DSN ?? import.meta.env.SENTRY_DSN;

// El middleware lo importa para que también los endpoints (no solo las páginas
// renderizadas) tengan cliente; este guard evita inicializarlo dos veces.
if (dsn && !Sentry.getClient()) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? import.meta.env.MODE,
    tracesSampleRate: 0,
    dataCollection: {
      userInfo: false,
      cookies: false,
      urlQueryParams: false,
      httpBodies: [],
      stackFrameVariables: false,
    },
    beforeSend(event) {
      // La app maneja sesiones y datos de contacto: no mandamos cookies, tokens
      // ni la query (puede traer correos o identificadores).
      if (event.request) {
        delete event.request.cookies;
        delete event.request.query_string;
        if (event.request.headers) {
          delete event.request.headers.cookie;
          delete event.request.headers.authorization;
        }
        if (event.request.url) event.request.url = event.request.url.split('?')[0];
      }
      return event;
    },
  });
}
