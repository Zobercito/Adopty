import type { SupabaseClient } from '@supabase/supabase-js';

export interface LogAuditoria {
  id?: string;
  /** Ignorado: el servidor usa siempre `auth.uid()`. Se conserva por compatibilidad. */
  id_usuario: string;
  accion: string;
  tabla: string;
  id_registro: string;
  datos_anteriores?: Record<string, unknown>;
  datos_nuevos?: Record<string, unknown>;
  /** Ignorados: no son fiables desde PostgREST. Se conservan por compatibilidad. */
  ip?: string;
  user_agent?: string;
  fecha?: string;
}

/**
 * Registra una acción en la tabla de auditoría.
 * No lanza errores: si falla, solo hace console.warn.
 *
 * La escritura va por la RPC `registrar_auditoria` (SECURITY DEFINER): el autor
 * lo deriva el servidor de la sesión y la acción/tabla se validan contra una
 * allowlist, así que la tabla no se puede falsificar por PostgREST.
 */
export async function registrarAuditoria(
  supabase: SupabaseClient,
  log: LogAuditoria,
): Promise<void> {
  try {
    const { error } = await supabase.rpc('registrar_auditoria', {
      p_accion: log.accion,
      p_tabla: log.tabla,
      p_id_registro: log.id_registro,
      p_datos_anteriores: log.datos_anteriores ?? null,
      p_datos_nuevos: log.datos_nuevos ?? null,
    });
    if (error) console.warn('No se pudo registrar auditoría:', error.message);
  } catch (e) {
    console.warn('No se pudo registrar auditoría:', e);
  }
}
