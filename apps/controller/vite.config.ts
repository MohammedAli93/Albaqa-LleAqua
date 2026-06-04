import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@tahaddi/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@tahaddi/i18n': path.resolve(__dirname, '../../packages/i18n/src/index.ts'),
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: { port: 5174 },
});
