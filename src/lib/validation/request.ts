import { z } from 'zod';

/** Zod requestSchema (Fase 4) — espeja CHECKs de solicitudes. */
export const solicitudSchema = z.object({
  id_mascota: z.string().uuid('Mascota inválida'),
  mensaje_inicial: z
    .string()
    .trim()
    .min(10, 'Cuéntanos un poco más (mínimo 10 caracteres)')
    .max(1000, 'Máximo 1000 caracteres'),
});

export const solicitudAccionSchema = z.object({
  accion: z.enum(['aprobar', 'rechazar', 'cancelar'], { message: 'Acción inválida' }),
});

export type SolicitudInput = z.infer<typeof solicitudSchema>;
