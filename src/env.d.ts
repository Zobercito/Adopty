/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    user: any | null;
    /** true si el usuario autenticado está en la tabla `administradores`. */
    isAdmin: boolean;
  }
}
