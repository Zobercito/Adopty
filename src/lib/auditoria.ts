import type { SupabaseClient } from '@supabase/supabase-js';

export interface LogAuditoria {
  id?: string;
  id_usuario: string;
  accion: string;
  tabla: string;
  id_registro: string;
  datos_anteriores?: Record<string, unknown>;
  datos_nuevos?: Record<string, unknown>;
  ip?: string;
  user_agent?: string;
  fecha?: string;
}

/**
 * Registra una acción en la tabla de auditoría.
 * No lanza errores: si falla, solo hace console.warn.
 */
export async function registrarAuditoria(
  supabase: SupabaseClient,
  log: LogAuditoria,
): Promise<void> {
  try {
    await supabase.from('auditoria').insert({
      id_usuario: log.id_usuario,
      accion: log.accion,
      tabla: log.tabla,
      id_registro: log.id_registro,
      datos_anteriores: log.datos_anteriores,
      datos_nuevos: log.datos_nuevos,
      ip: log.ip,
      user_agent: log.user_agent,
    });
  } catch (e) {
    console.warn('No se pudo registrar auditoría:', e);
  }
}
