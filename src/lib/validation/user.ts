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

export const personaSchema = z.object({
  nombre: z.string().min(2).max(80),
  telefono: z.string().max(20).optional().or(z.literal('')),
  descripcion: z.string().max(500).optional().or(z.literal('')),
});

export const organizacionSchema = z.object({
  nombre_oficial: z.string().min(2).max(120),
  direccion: z.string().min(2).max(200),
  descripcion: z.string().max(1000).optional().or(z.literal('')),
  sitio_web: z.string().url('URL inválida').max(200).optional().or(z.literal('')),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
