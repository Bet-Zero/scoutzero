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
import { where } from 'firebase/firestore';
import { useFirebaseQuery } from '@/shared/hooks/useFirebaseQuery';

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

  it('refetches when the owner changes (same constraint types, new key)', async () => {
    seedMockData('owned_col/a1', { ownerUid: 'guest-uid', label: 'Guest list' });
    seedMockData('owned_col/b1', { ownerUid: 'google-uid', label: 'Google list' });
    const { result, rerender } = renderHook(
      ({ uid }: { uid: string }) =>
        useFirebaseQuery('owned_col', [where('ownerUid', '==', uid)], { key: uid }),
      { initialProps: { uid: 'guest-uid' } }
    );
    await waitFor(() =>
      expect(result.current.data.map((d) => (d as { label: string }).label)).toEqual(['Guest list'])
    );
    rerender({ uid: 'google-uid' });
    await waitFor(() =>
      expect(result.current.data.map((d) => (d as { label: string }).label)).toEqual(['Google list'])
    );
  });

  it('returns empty data for an empty collection', async () => {
    const { result } = renderHook(() => useFirebaseQuery('empty_col'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toHaveLength(0);
    expect(result.current.error).toBeNull();
  });
});
