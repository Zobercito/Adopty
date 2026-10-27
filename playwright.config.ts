import { defineConfig, devices } from '@playwright/test';

/**
 * E2E con Playwright. Dos suites:
 * - `publico.e2e.ts`: solo lectura (páginas, guards, 401/400). Segura contra cualquier entorno.
 * - `flujo.e2e.ts`: registro → publicar → solicitar → aprobar → chat → reportar.
 *   ESCRIBE datos, así que solo corre con `E2E_FLUJO=1` y contra Supabase local.
 *
 * `E2E_BASE_URL` apunta a un deploy ya levantado (p. ej. un preview de Vercel);
 * sin ella se usa el dev server local (se reutiliza si ya está corriendo).
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:4321';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
