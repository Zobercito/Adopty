import { defineConfig } from 'vitest/config';

// Umbrales por debajo de la cobertura actual (2026-10-27) para que una
// regresión real rompa el CI sin volverlo frágil ante refactors menores.
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: ['src/lib/**/*.ts'],
      exclude: ['src/lib/**/*.test.ts'],
      thresholds: {
        statements: 65,
        branches: 52,
        functions: 62,
        lines: 70,
      },
    },
  },
});
