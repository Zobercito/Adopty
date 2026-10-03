import { track } from '@vercel/analytics';

/**
 * Analytics de embudo: búsqueda → detalle → solicitud → aprobación.
 * Usa la API oficial de Vercel Analytics (`track`). En SSR/bloqueo no falla.
 */
export type EventoEmbudo =
  | 'busqueda'
  | 'ver_detalle'
  | 'solicitar'
  | 'solicitud_aprobada'
  | 'mensaje_enviado'
  | 'favorito_agregado';

export function trackEvento(evento: EventoEmbudo, data?: Record<string, string | number>): void {
  try {
    track(evento, data);
  } catch {
    /* analytics bloqueado o SSR: no romper la app */
  }
}

declare global {
  interface Window {
    adoptyTrack?: typeof trackEvento;
  }
}
