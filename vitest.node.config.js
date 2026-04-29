// vitest.node.config.js
// Node-only Vitest config for pure-logic tests (no jsdom/React).
// Runs ~90% of the test suite without browser-mode overhead.
// See docs/testing/VALIDATION_TIERS_MASTER.md (P3 section) for details.

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@\/shared\/components\/ui\/filters$/,
        replacement: path.resolve(
          __dirname,
          './src/shared/components/ui/filters/index.ts'
        ),
      },
      {
        find: /^@\/shared\/utils\/contracts$/,
        replacement: path.resolve(
          __dirname,
          './src/shared/utils/contracts/index.ts'
        ),
      },
      {
        find: /^@\//,
        replacement: `${path.resolve(__dirname, './src')}/`,
      },
    ],
  },
  test: {
    environment: 'node',
    setupFiles: ['./tests/setupFirebaseMocks.ts', './tests/setupDebug.ts'],
    include: [
      // Root-level pure-logic tests (.js/.ts only — excludes .jsx/.tsx)
      'tests/**/*.test.js',
      'tests/**/*.test.ts',
      // src/tests pure-logic tests (.js/.ts only)
      'src/tests/**/*.test.js',
      'src/tests/**/*.test.ts',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.emulator.test.{js,ts}',
      // These .ts tests use localStorage (browser global) — must run in jsdom
      'src/tests/architect/wizardTranslation.test.ts',
      'src/tests/architect/pickRightWizardDraft.test.ts',
      'src/tests/architect/utils/freeAgencyFilterPersistence.test.ts',
      'src/tests/entitlements/vacuumEntitlementOverlayStore.test.ts',
      'src/tests/entitlements/entitlementResolver.vacuumOverlay.test.ts',
      'tests/entitlements/vacuumTradeTransfer.test.ts',
      // Requires @firebase/rules-unit-testing (not installed) + running emulator
      'src/tests/security/firestoreRules.integration.test.ts',
    ],
  },
});
