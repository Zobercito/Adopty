import { z } from 'zod';

/** Preferencia de avisos por email (perfil). */
export const notificacionesSchema = z.object({
  notificaciones_email: z.boolean('Indica si quieres recibir avisos'),
});

export type NotificacionesInput = z.infer<typeof notificacionesSchema>;
