import { z } from 'zod';

/**
 * Ruta de foto del bucket `mascotas`: `userId/uuid.webp`, nunca una URL.
 * Espeja el CHECK de `20261028070000_rutas_foto_check.sql` (E).
 */
const RUTA_FOTO = /^[\w-]+\/[\w-]+\.webp$/;

/**
 * Asset local del sitio (`/assets/6.JPG`), que usan el seed y `mockPets`.
 * Solo se admite al **conservar** una foto ya guardada (`fotos_keep`): las
 * nuevas siempre se suben al bucket. La extensión va con flag `i` para casar
 * con el CHECK (`~*`) y con `fotoRender`.
 */
const RUTA_ASSET = /^\/assets\/[\w.-]+\.(?:jpe?g|png|webp)$/i;

const esRutaFotoGuardada = (valor: string): boolean =>
  RUTA_FOTO.test(valor) || RUTA_ASSET.test(valor);

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
  // Fase 2 — datos para el match.
  nivel_energia: z.enum(['tranquila', 'moderada', 'activa']).default('moderada'),
  apto_ninos: z.boolean().default(true),
  apto_otros: z.boolean().default(true),
  fotos: z
    .array(z.string().regex(RUTA_FOTO, 'Ruta de foto inválida'))
    .min(1, 'Sube al menos 1 foto')
    .max(5, 'Máximo 5 fotos'),
});

/** Actualización (PUT/PATCH): campos parciales + gestión de fotos existentes/nuevas. */
export const petUpdateSchema = petSchema
  .omit({ fotos: true })
  .partial()
  .extend({
    // `fotos_keep` conserva rutas ya guardadas: mismo confinamiento que `fotos`,
    // más los assets locales que el seed ya tenía.
    fotos_keep: z
      .array(z.string().refine(esRutaFotoGuardada, 'Ruta de foto inválida'))
      .max(5)
      .optional(),
    fotos_new: z.array(z.string().regex(RUTA_FOTO, 'Ruta de foto inválida')).max(5).optional(),
  });

export type PetInput = z.infer<typeof petSchema>;
export type PetUpdateInput = z.infer<typeof petUpdateSchema>;
