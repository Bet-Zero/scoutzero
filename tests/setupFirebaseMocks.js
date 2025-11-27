/**
 * Firebase Mock Setup
 * 
 * Sets up Firebase mocks before each test and provides utilities
 * for seeding test data and resetting between tests.
 * 
 * @file tests/setupFirebaseMocks.js
 */

import { beforeEach, afterEach } from 'vitest';
import { vi } from 'vitest';
import {
  resetMockDataStore,
  seedMockData,
  getMockData,
  getAllMockData,
} from './__mocks__/firebase.js';

// Mock Firebase app initialization
vi.mock('@/firebaseConfig', () => {
  return {
    db: {
      // Mock db object for Firestore operations
    },
  };
});

// Mock firebase/firestore module - import all exports from our mock
vi.mock('firebase/firestore', async () => {
  const mockFirebase = await import('./__mocks__/firebase.js');
  return mockFirebase;
});

// Reset mock data before each test
beforeEach(() => {
  resetMockDataStore();
});

// Cleanup after each test (optional, but good practice)
afterEach(() => {
  // Reset is already done in beforeEach, but this ensures cleanup
  resetMockDataStore();
});

// Export utilities for use in tests
export { seedMockData, getMockData, getAllMockData, resetMockDataStore };

