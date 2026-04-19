/**
 * FILE: vitest.emulator.config.js
 * PURPOSE: Vitest configuration for TRUE E2E tests against Firestore emulator.
 *          Does NOT use Firebase mocks - connects to real emulator instead.
 * OWNERSHIP: Tooling: CI/CD, Feature: architect/dare
 *
 * HISTORY:
 *  - 2026-02-04: Phase D4 - Created for true E2E emulator testing
 *
 * USAGE:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8082 vitest run --config vitest.emulator.config.js
 *
 * DIFFERENCES FROM vitest.config.js:
 *   - NO setupFirebaseMocks.ts - tests use REAL Firebase/emulator
 *   - Requires FIRESTORE_EMULATOR_HOST to be set
 *   - Only runs tests matching *.emulator.test.* pattern
 */

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // CRITICAL: More specific alias MUST come first to override @/firebaseConfig
      // This routes the emulator tests to use the Node-compatible Firebase config
      {
        find: '@/firebaseConfig',
        replacement: path.resolve(
          __dirname,
          './scripts/ci/firebaseEmulatorConfig.ts'
        ),
      },
      // General @ alias for all other imports
      {
        find: '@',
        replacement: path.resolve(__dirname, './src'),
      },
    ],
  },
  test: {
    environment: 'node', // Use Node, not jsdom, for true E2E
    setupFiles: ['./tests/setupDebug.ts'], // Keep debug logging, skip Firebase mocks
    include: ['**/*.emulator.test.{js,ts}'], // Only emulator tests
    testTimeout: 30000, // Longer timeout for emulator operations
    // No globalSetup needed - each test checks FIRESTORE_EMULATOR_HOST
  },
});
