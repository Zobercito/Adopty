import { z } from 'zod';

/** Zod messageSchema (Fase 5) — espeja CHECKs de tabla mensajes. */
export const mensajeSchema = z.object({
  id_mascota: z.string().uuid('Mascota inválida'),
  contenido: z
    .string()
    .trim()
    .min(1, 'El mensaje no puede estar vacío')
    .max(2000, 'Máximo 2000 caracteres'),
  // Opcional: el publicador lo usa cuando hay >1 adoptante aprobado en la misma mascota
  id_receptor: z.string().uuid('Destinatario inválido').optional(),
});

/** Lectura (PATCH leído) — solo ID del mensaje. */
export const mensajeLeidoSchema = z.object({
  id: z.string().uuid('Mensaje inválido'),
});

export type MensajeInput = z.infer<typeof mensajeSchema>;
export type MensajeLeidoInput = z.infer<typeof mensajeLeidoSchema>;
