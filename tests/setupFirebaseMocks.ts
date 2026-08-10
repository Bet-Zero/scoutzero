/**
 * Firebase Mock Setup
 * 
 * Sets up Firebase mocks before each test and provides utilities
 * for seeding test data and resetting between tests.
 * 
 * @file tests/setupFirebaseMocks.ts
 */

import { beforeEach, afterEach } from 'vitest';
import { vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import {
  resetMockDataStore,
  seedMockData,
  getMockData,
  getAllMockData,
  clearMockCallables,
} from './__mocks__/firebase.js';
import { setContractSourceReleaseLoaderForTests } from '@/features/architect/utils/contractSource/contractSourceRelease';
import { makeTestContractSourceRelease } from './fixtures/architect/contractSourceRelease';

// GitHub Actions currently runs Node 18, where Web Crypto is not exposed on
// globalThis by default. Match the browser runtime used by release verification
// so governed SHA-256 checks exercise the same implementation in every suite.
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: webcrypto,
  });
}

const testContractSourceRelease = makeTestContractSourceRelease();
setContractSourceReleaseLoaderForTests(async () => testContractSourceRelease);

// Mock Firebase app initialization
vi.mock('@/firebaseConfig', () => {
  return {
    db: {
      // Mock db object for Firestore operations
    },
    functions: {
      // Mock functions object for Cloud Functions
    },
    auth: {
      // Mock auth object (if needed)
    },
  };
});

// Mock firebase/firestore module - import all exports from our mock
vi.mock('firebase/firestore', async () => {
  const mockFirebase = await import('./__mocks__/firebase.js');
  return mockFirebase;
});

// Mock firebase/functions module
vi.mock('firebase/functions', async () => {
  const mockFirebase = await import('./__mocks__/firebase.js');
  return {
    httpsCallable: mockFirebase.httpsCallable,
    getFunctions: mockFirebase.getFunctions,
    connectFunctionsEmulator: mockFirebase.connectFunctionsEmulator,
  };
});

// Reset mock data before each test
beforeEach(() => {
  resetMockDataStore();
  clearMockCallables();
});

// Cleanup after each test (optional, but good practice)
afterEach(() => {
  // Reset is already done in beforeEach, but this ensures cleanup
  resetMockDataStore();
  clearMockCallables();
});

// Export utilities for use in tests
export { seedMockData, getMockData, getAllMockData, resetMockDataStore, clearMockCallables };
