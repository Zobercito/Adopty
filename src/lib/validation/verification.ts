import { z } from 'zod';

/**
 * URL de evidencia para la verificación de una organización.
 *
 * `z.string().url()` no basta: `new URL('javascript:alert(1)')` es válida y el
 * panel de admin pinta el valor como `href`. Aquí se exige esquema http/https,
 * que es el único que tiene sentido como evidencia y el único que no ejecuta
 * código al abrirse.
 */
export const urlEvidenciaSchema = z
  .string()
  .max(500)
  .url('URL inválida')
  .refine((valor) => /^https?:\/\//i.test(valor), 'La URL debe empezar por http:// o https://');

export const verificacionSchema = z.object({
  tipo_evidencia: z.enum(['redes_sociales', 'documento', 'sitio_web', 'otro']),
  url_evidencia: urlEvidenciaSchema,
  descripcion: z.string().max(1000).optional().or(z.literal('')),
});
