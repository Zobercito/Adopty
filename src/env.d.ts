/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    user: any | null;
    /** true si el usuario autenticado está en la tabla `administradores`. */
    isAdmin: boolean;
    /** true si el usuario tiene al menos una mascota publicada (para mostrar/ocultar el Panel). */
    tienePublicaciones: boolean;
    /** Mensajes sin leer recibidos (para el punto en la pestaña Mensajes). */
    mensajesSinLeer: number;
  }
}
