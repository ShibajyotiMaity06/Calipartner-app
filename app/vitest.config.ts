import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url).href) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
