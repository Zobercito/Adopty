import { z } from 'zod';

/** Zod userSchema (Fase 1): espeja validación de servidor; el cliente solo muestra mensajes. */
export const registerSchema = z.object({
  nombre: z.string().min(2, 'Mínimo 2 caracteres').max(80, 'Máximo 80 caracteres'),
  correo: z.string().email('Correo inválido').max(160),
  password: z.string().min(8, 'Mínimo 8 caracteres').max(72),
  tipo_usuario: z.enum(['persona', 'organizacion']),
});

export const loginSchema = z.object({
  correo: z.string().email('Correo inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

/**
 * Cambio de contraseña: se valida también en servidor porque el cliente puede
 * falsearse. Exige la actual (para confirmar que eres tú) y que la nueva sea
 * distinta de ella.
 */
export const cambiarPasswordSchema = z
  .object({
    actual: z.string().min(1, 'Escribe tu contraseña actual'),
    nueva: z
      .string()
      .min(8, 'La nueva debe tener al menos 8 caracteres')
      .max(72, 'Máximo 72 caracteres'),
    confirmar: z.string().min(1, 'Confirma la nueva contraseña'),
  })
  .refine((d) => d.nueva === d.confirmar, {
    message: 'Las contraseñas nuevas no coinciden',
    path: ['confirmar'],
  })
  .refine((d) => d.nueva !== d.actual, {
    message: 'La nueva contraseña debe ser distinta de la actual',
    path: ['nueva'],
  });

/**
 * Perfil de persona. `telefono` se eliminó: se escribía pero no se leía en ningún
 * sitio y contradecía la promesa del chat ("el contacto es por chat interno").
 * `experiencia` y `motivacion` son los campos que un refugio sí evalúa.
 */
export const personaSchema = z.object({
  nombre: z.string().trim().min(2).max(80),
  // `.trim()` en los textos: dentro de un <textarea> el HTML conserva los saltos de
  // línea y la indentación del template, así que sin esto se guardaba espaciado
  // basura al principio y al final.
  descripcion: z.string().trim().max(500).optional().or(z.literal('')),
  experiencia: z.enum(['primera_vez', 'alguna_vez', 'experimentada']).optional().or(z.literal('')),
  motivacion: z.string().trim().max(300, 'Máximo 300 caracteres').optional().or(z.literal('')),
});

/** Cambio de correo: mismo límite que el registro. */
export const cambiarCorreoSchema = z.object({
  correo: z.string().email('Correo inválido').max(160),
});

/**
 * Baja de cuenta: contraseña (confirmar identidad) + palabra de confirmación.
 * El borrado real lo hace el RPC `eliminar_mi_cuenta`.
 */
export const borrarCuentaSchema = z.object({
  password: z.string().min(1, 'Escribe tu contraseña para confirmar'),
  confirmacion: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === 'ELIMINAR', {
      message: 'Escribe ELIMINAR para confirmar',
    }),
});

export const organizacionSchema = z.object({
  nombre_oficial: z.string().trim().min(2).max(120),
  direccion: z.string().trim().min(2).max(200),
  descripcion: z.string().trim().max(1000).optional().or(z.literal('')),
  sitio_web: z.string().trim().url('URL inválida').max(200).optional().or(z.literal('')),
  contacto_visible: z.boolean().optional(),
  redes: z
    .object({
      instagram: z.string().trim().max(200).optional().or(z.literal('')),
      facebook: z.string().trim().max(200).optional().or(z.literal('')),
      whatsapp: z.string().trim().max(40).optional().or(z.literal('')),
    })
    .optional(),
});

/** Redes de una organización, ya sea '' si no se indicó. */
export function redesVacias(
  redes?: {
    instagram?: string;
    facebook?: string;
    whatsapp?: string;
  } | null,
): { instagram: string; facebook: string; whatsapp: string } {
  return {
    instagram: redes?.instagram ?? '',
    facebook: redes?.facebook ?? '',
    whatsapp: redes?.whatsapp ?? '',
  };
}

/** Fase 1 — perfil de estilo de vida que alimenta el match. */
export const estiloVidaSchema = z.object({
  ambiente: z.enum(['apartamento', 'casa_chica', 'casa_grande']),
  ninos: z.boolean(),
  especie_pref: z.enum(['perro', 'gato', 'otro', 'indiferente']),
  ubicacion: z.string().min(2).max(120),
  energia_pref: z.enum(['tranquila', 'moderada', 'activa']),
  otras_mascotas: z.boolean(),
  edad_pref: z.enum(['cachorro', 'adulto', 'indiferente']),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
