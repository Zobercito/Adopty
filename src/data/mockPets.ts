/** Tipos + datos temporales Fase 0 (port de adopty-mockup/js/mockData.js). En Fase 1 se reemplaza por Supabase. */
export type Especie = 'perro' | 'gato' | 'otro';
export type EstadoMascota = 'Disponible' | 'En proceso' | 'Adoptada';

export interface Pet {
  id: string;
  nombre: string;
  especie: Especie;
  raza: string;
  edad: string;
  edadMeses: number;
  sexo: 'Macho' | 'Hembra';
  tamano: 'Pequeño' | 'Mediano' | 'Grande';
  ubicacion: string;
  estado: EstadoMascota;
  salud: string;
  personalidad: string;
  publicador: string;
  verificado: boolean;
  interesados: number;
  grad: string;
  fecha: string;
  foto: string;
}

export const PETS: Pet[] = [
  { id: 'toby', nombre: 'Toby', especie: 'perro', raza: 'Labrador mix', edad: '8 meses', edadMeses: 8, sexo: 'Macho', tamano: 'Mediano', ubicacion: 'Ciudad de Panamá', estado: 'Disponible', salud: 'Vacunado y desparasitado', personalidad: 'Juguetón, sociable con niños y otros perros. Ideal para casa con patio.', publicador: 'Refugio Patitas Felices', verificado: true, interesados: 12, grad: 'pet-grad-1', fecha: '12 sept 2026', foto: '/assets/1.jpeg' },
  { id: 'mishi', nombre: 'Mishi', especie: 'gato', raza: 'Doméstico pelo corto', edad: '1 año', edadMeses: 12, sexo: 'Hembra', tamano: 'Pequeño', ubicacion: 'San Miguelito', estado: 'Disponible', salud: 'Esterilizada, vacunada', personalidad: 'Tranquila, cariñosa, le encanta dormir al sol. Ideal para apartamento.', publicador: 'Eira R. (rescatista)', verificado: false, interesados: 8, grad: 'pet-grad-2', fecha: '10 sept 2026', foto: '/assets/2.jpeg' },
  { id: 'rocky', nombre: 'Rocky', especie: 'perro', raza: 'Beagle', edad: '2 años', edadMeses: 24, sexo: 'Macho', tamano: 'Mediano', ubicacion: 'Arraiján', estado: 'En proceso', salud: 'Vacunado, sano', personalidad: 'Energético y leal, necesita paseos diarios.', publicador: 'Refugio Patitas Felices', verificado: true, interesados: 21, grad: 'pet-grad-3', fecha: '5 sept 2026', foto: '/assets/3.jpeg' },
  { id: 'luna', nombre: 'Luna', especie: 'gato', raza: 'Siamés mix', edad: '6 meses', edadMeses: 6, sexo: 'Hembra', tamano: 'Pequeño', ubicacion: 'Bethania', estado: 'Disponible', salud: 'Vacunada, desparasitada', personalidad: 'Curiosa y ronroneadora, se lleva bien con otros gatos.', publicador: 'Fundación Huellitas', verificado: true, interesados: 15, grad: 'pet-grad-4', fecha: '14 sept 2026', foto: '/assets/4.jpg' },
  { id: 'max', nombre: 'Max', especie: 'perro', raza: 'Criollo', edad: '3 años', edadMeses: 36, sexo: 'Macho', tamano: 'Grande', ubicacion: 'Tocumen', estado: 'Disponible', salud: 'Esterilizado, vacunado', personalidad: 'Protector y noble, perfecto como compañero de familia.', publicador: 'Francisco G.', verificado: false, interesados: 5, grad: 'pet-grad-5', fecha: '8 sept 2026', foto: '/assets/5.jpeg' },
  { id: 'nina', nombre: 'Nina', especie: 'perro', raza: 'Poodle', edad: '1 año', edadMeses: 12, sexo: 'Hembra', tamano: 'Pequeño', ubicacion: 'El Cangrejo', estado: 'Disponible', salud: 'Vacunada, pelo hipoalergénico', personalidad: 'Inteligente y dócil, aprende trucos rápido.', publicador: 'Refugio Patitas Felices', verificado: true, interesados: 19, grad: 'pet-grad-6', fecha: '13 sept 2026', foto: '/assets/6.JPG' },
  { id: 'simba', nombre: 'Simba', especie: 'gato', raza: 'Naranja tabby', edad: '4 meses', edadMeses: 4, sexo: 'Macho', tamano: 'Pequeño', ubicacion: 'Vía España', estado: 'Disponible', salud: 'Desparasitado, primera vacuna', personalidad: 'Bebé juguetón, muy activo y divertido.', publicador: 'Fundación Huellitas', verificado: true, interesados: 23, grad: 'pet-grad-1', fecha: '15 sept 2026', foto: '/assets/7.jpeg' },
  { id: 'coco', nombre: 'Coco', especie: 'otro', raza: 'Conejo holandés', edad: '1 año', edadMeses: 12, sexo: 'Macho', tamano: 'Pequeño', ubicacion: 'Albrook', estado: 'Disponible', salud: 'Sano, revisado por veterinario', personalidad: 'Dócil, ideal para niños responsables.', publicador: 'Eira R. (rescatista)', verificado: false, interesados: 4, grad: 'pet-grad-2', fecha: '9 sept 2026', foto: '/assets/8.jpeg' },
  { id: 'kira', nombre: 'Kira', especie: 'perro', raza: 'Husky mix', edad: '2 años', edadMeses: 24, sexo: 'Hembra', tamano: 'Grande', ubicacion: 'Clayton', estado: 'Adoptada', salud: 'Esterilizada y vacunada', personalidad: 'Historia de éxito: adoptada en agosto.', publicador: 'Refugio Patitas Felices', verificado: true, interesados: 30, grad: 'pet-grad-3', fecha: '20 ago 2026', foto: '/assets/9.jpg' },
];
