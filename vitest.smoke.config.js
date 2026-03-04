import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/tests/smoke/**/*.test.ts', 'src/tests/smoke/**/*.test.tsx'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
