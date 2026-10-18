import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url).href),
      'react-native': 'react-native-web',
    },
  },
  define: {
    __DEV__: 'true',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/testSetup.ts'],
    server: {
      deps: {
        inline: ['react-native', 'react-native-web'],
      },
    },
  },
});
