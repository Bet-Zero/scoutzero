// vitest.ui.config.js
// Browser-mode (jsdom) Vitest config for React component tests.
// Runs only .jsx/.tsx test files that need DOM/React rendering.
// See docs/testing/VALIDATION_TIERS_MASTER.md (P3 section) for details.

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
    include: [
      // Component/UI tests that need jsdom + React
      'tests/**/*.test.jsx',
      'tests/**/*.test.tsx',
      'src/tests/**/*.test.jsx',
      'src/tests/**/*.test.tsx',
      // Pure .ts tests that use localStorage (browser global)
      'src/tests/architect/wizardTranslation.test.ts',
      'src/tests/architect/pickRightWizardDraft.test.ts',
      'src/tests/architect/utils/freeAgencyFilterPersistence.test.ts',
      'src/tests/entitlements/vacuumEntitlementOverlayStore.test.ts',
      'src/tests/entitlements/entitlementResolver.vacuumOverlay.test.ts',
      'tests/entitlements/vacuumTradeTransfer.test.ts',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.emulator.test.{js,ts,jsx,tsx}',
    ],
  },
});
