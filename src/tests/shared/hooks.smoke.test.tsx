// @vitest-environment jsdom
/**
 * Smoke tests for src/shared/hooks JS→TS conversions.
 * Covers useFirebaseQuery (most logic-rich hook).
 * Other hooks (useAuth, useImageDownload, useClickOutside, usePlayerDetail)
 * are exercised via component-level mocks in:
 *   - src/tests/scouting/playerProfile.behavior.test.tsx
 *   - src/tests/architect/GMDashboard.smoke.test.tsx
 */
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import useFirebaseQuery from '@/shared/hooks/useFirebaseQuery';

// seedMockData / resetMockDataStore are re-exported through firebase/firestore mock
// (setupFirebaseMocks.ts wires vi.mock('firebase/firestore') to tests/__mocks__/firebase.ts)
import { seedMockData, resetMockDataStore } from '../../../tests/__mocks__/firebase.js';

describe('useFirebaseQuery', () => {
  beforeEach(() => {
    resetMockDataStore();
  });

  it('returns data from a seeded collection', async () => {
    seedMockData('probe_col/alpha', { label: 'Alpha', rank: 1 });
    seedMockData('probe_col/beta', { label: 'Beta', rank: 2 });

    const { result } = renderHook(() => useFirebaseQuery('probe_col'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.data).toHaveLength(2);
    const labels = result.current.data.map((d) => (d as { label: string }).label);
    expect(labels).toEqual(expect.arrayContaining(['Alpha', 'Beta']));
  });

  it('returns empty array and no error when enabled=false', async () => {
    seedMockData('probe_col/alpha', { label: 'Alpha' });

    const { result } = renderHook(() =>
      useFirebaseQuery('probe_col', [], { enabled: false })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toHaveLength(0);
    expect(result.current.error).toBeNull();
  });

  it('returns empty data for an empty collection', async () => {
    const { result } = renderHook(() => useFirebaseQuery('empty_col'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toHaveLength(0);
    expect(result.current.error).toBeNull();
  });
});
