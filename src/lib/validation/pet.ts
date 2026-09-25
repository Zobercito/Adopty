import { z } from 'zod';

/** Zod petSchema (Fase 2) — espeja CHECKs de 001_schema.sql. Cliente solo muestra mensajes. */
export const petSchema = z.object({
  nombre: z.string().trim().min(2, 'Mínimo 2 caracteres').max(60, 'Máximo 60 caracteres'),
  especie: z.enum(['perro', 'gato', 'otro'], { message: 'Especie inválida' }),
  raza: z.string().trim().min(2, 'Mínimo 2 caracteres').max(80, 'Máximo 80 caracteres'),
  edad_meses: z.coerce
    .number()
    .int('Edad en meses (entero)')
    .min(0, 'Mínimo 0 meses')
    .max(360, 'Máximo 360 meses'),
  sexo: z.enum(['Macho', 'Hembra'], { message: 'Sexo inválido' }),
  tamano: z.enum(['Pequeño', 'Mediano', 'Grande'], { message: 'Tamaño inválido' }),
  ubicacion: z.string().trim().min(2, 'Mínimo 2 caracteres').max(120, 'Máximo 120 caracteres'),
  descripcion: z
    .string()
    .trim()
    .min(10, 'Mínimo 10 caracteres')
    .max(2000, 'Máximo 2000 caracteres'),
  estado_salud: z.string().trim().max(500, 'Máximo 500 caracteres').optional().default(''),
  estado: z.enum(['disponible', 'en_proceso', 'adoptada']).default('disponible'),
  fotos: z
    .array(z.string().regex(/^[\w-]+\/[\w-]+\.webp$/, 'Ruta de foto inválida'))
    .min(1, 'Sube al menos 1 foto')
    .max(5, 'Máximo 5 fotos'),
});

/** Actualización (PUT/PATCH): campos parciales + gestión de fotos existentes/nuevas. */
export const petUpdateSchema = petSchema
  .omit({ fotos: true })
  .partial()
  .extend({
    fotos_keep: z.array(z.string()).max(5).optional(),
    fotos_new: z
      .array(z.string().regex(/^[\w-]+\/[\w-]+\.webp$/))
      .max(5)
      .optional(),
  });

export type PetInput = z.infer<typeof petSchema>;
export type PetUpdateInput = z.infer<typeof petUpdateSchema>;
