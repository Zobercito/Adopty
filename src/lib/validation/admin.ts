import { z } from 'zod';

/**
 * PATCH /api/admin/cuentas — suspender o reactivar una cuenta.
 * El RPC `estado_cuenta` revalida `soy_admin()`; Zod solo cubre la forma del cuerpo.
 */
export const cuentaEstadoSchema = z.object({
  id: z.uuid('Cuenta inválida'),
  activo: z.boolean('Indica si la cuenta queda activa'),
});

export type CuentaEstadoInput = z.infer<typeof cuentaEstadoSchema>;
