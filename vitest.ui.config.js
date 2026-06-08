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
    // Render-heavy jsdom suite: give each test a generous outer budget so a test
    // chaining several waitFor/findBy* calls doesn't blow the default 5s under
    // load. RTL's own async polling window is raised in the setup below.
    testTimeout: 15000,
    hookTimeout: 15000,
    setupFiles: [
      './tests/setupFirebaseMocks.ts',
      './tests/setupDebug.ts',
      './tests/setupReactTestingLibrary.ts',
    ],
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
