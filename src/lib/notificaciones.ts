import type { SupabaseClient } from '@supabase/supabase-js';

/** Eventos que pueden generar un aviso por email (los valida la RPC). */
export type TipoNotificacion =
  'solicitud_nueva' | 'solicitud_aprobada' | 'solicitud_rechazada' | 'mensaje_nuevo';

/**
 * Encola un aviso. La autorización y el envío viven en la RPC
 * `encolar_notificacion`: comprueba la relación llamante→destinatario, lee el
 * correo del destinatario dentro de la base y lo manda con pg_net. Nunca
 * devuelve el email a la aplicación y nunca lanza: un fallo de aviso no debe
 * tumbar la operación principal.
 */
export async function notificar(
  supabase: SupabaseClient,
  tipo: TipoNotificacion,
  id_mascota: string,
  id_destinatario: string,
): Promise<void> {
  try {
    const { error } = await supabase.rpc('encolar_notificacion', {
      p_tipo: tipo,
      p_mascota: id_mascota,
      p_destinatario: id_destinatario,
    });
    if (error) console.warn('[notificaciones] no se pudo encolar (sin PII)');
  } catch {
    console.warn('[notificaciones] no se pudo encolar (sin PII)');
  }
}
