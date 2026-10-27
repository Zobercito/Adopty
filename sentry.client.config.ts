import * as Sentry from '@sentry/astro';

// Sin DSN no se inicializa: así CI y cualquier entorno sin la variable siguen
// funcionando y no se llenan los logs de avisos.
const dsn = import.meta.env.PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
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
