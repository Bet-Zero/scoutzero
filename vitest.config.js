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
    setupFiles: ['./tests/setupFirebaseMocks.js', './tests/setupDebug.js'],
    // Exclude *.emulator.test.* files - they require the real Firestore emulator
    // and have a separate config: vitest.emulator.config.js
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.emulator.test.{js,ts}',
    ],
  },
});
