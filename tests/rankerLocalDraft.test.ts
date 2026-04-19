// tests/rankerLocalDraft.test.js
// Tests for local draft persistence (sessionStorage) and owner gating.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  loadLocalDraft,
  saveLocalDraftImmediate,
  clearLocalDraft,
  hasLocalDraft,
  createInitialDraft,
  __testing,
} from '@/features/ranker/utils/rankerLocalDraft';
import { isOwnerUid, getOwnerCount } from '@/config/ownerConfig';
import {
  createClosureCache,
  suggestNextPair,
} from '@/features/ranker/utils/rankingEngine';

const { serializeSkippedPairs, deserializeSkippedPairs, STORAGE_KEY } =
  __testing;

// Mock sessionStorage for node environment
const createMockSessionStorage = () => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
};

// Simple mock for sessionStorage
let mockStorage;

beforeEach(() => {
  mockStorage = createMockSessionStorage();
  // Replace global sessionStorage
  vi.stubGlobal('sessionStorage', mockStorage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('rankerLocalDraft serialization', () => {
  describe('skippedPairs serialization', () => {
    it('converts Set to array', () => {
      const set = new Set(['a<>b', 'c<>d', 'e<>f']);
      const arr = serializeSkippedPairs(set);
      expect(Array.isArray(arr)).toBe(true);
      expect(arr).toHaveLength(3);
      expect(arr).toContain('a<>b');
    });

    it('passes through array unchanged', () => {
      const arr = ['x<>y', 'z<>w'];
      const result = serializeSkippedPairs(arr);
      expect(result).toEqual(arr);
    });

    it('handles null/undefined gracefully', () => {
      expect(serializeSkippedPairs(null)).toEqual([]);
      expect(serializeSkippedPairs(undefined)).toEqual([]);
    });

    it('deserializes array to Set', () => {
      const arr = ['a<>b', 'c<>d'];
      const set = deserializeSkippedPairs(arr);
      expect(set instanceof Set).toBe(true);
      expect(set.size).toBe(2);
      expect(set.has('a<>b')).toBe(true);
    });

    it('round-trips correctly', () => {
      const original = new Set(['x<>y', 'z<>w', 'a<>b']);
      const serialized = serializeSkippedPairs(original);
      const deserialized = deserializeSkippedPairs(serialized);
      expect([...deserialized].sort()).toEqual([...original].sort());
    });
  });

  describe('draft save/load round trip', () => {
    it('preserves all draft fields on round trip', () => {
      const draft = {
        name: 'Test Ranking',
        playerPoolIds: ['p1', 'p2', 'p3'],
        setupData: { topTier: ['p1'], bottomTier: [], anchor: null },
        results: [{ winner: 'p1', loser: 'p2' }],
        skippedPairs: new Set(['p2<>p3']),
        anchorDone: true,
        isFinished: false,
        adjustments: null,
      };

      saveLocalDraftImmediate(draft);
      const loaded = loadLocalDraft();

      expect(loaded.name).toBe(draft.name);
      expect(loaded.playerPoolIds).toEqual(draft.playerPoolIds);
      expect(loaded.setupData).toEqual(draft.setupData);
      expect(loaded.results).toEqual(draft.results);
      expect(loaded.skippedPairs instanceof Set).toBe(true);
      expect(loaded.skippedPairs.has('p2<>p3')).toBe(true);
      expect(loaded.anchorDone).toBe(draft.anchorDone);
      expect(loaded.isFinished).toBe(draft.isFinished);
      expect(loaded.adjustments).toBe(draft.adjustments);
      expect(typeof loaded.draftUpdatedAt).toBe('number');
    });

    it('returns null when no draft exists', () => {
      const loaded = loadLocalDraft();
      expect(loaded).toBe(null);
    });

    it('returns null for invalid draft (too few players)', () => {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          playerPoolIds: ['p1'], // Only 1 player
          results: [],
        })
      );
      const loaded = loadLocalDraft();
      expect(loaded).toBe(null);
    });

    it('clears draft correctly', () => {
      saveLocalDraftImmediate({
        playerPoolIds: ['p1', 'p2'],
        results: [],
      });
      expect(hasLocalDraft()).toBe(true);

      clearLocalDraft();
      expect(hasLocalDraft()).toBe(false);
      expect(loadLocalDraft()).toBe(null);
    });
  });

  describe('createInitialDraft', () => {
    it('creates draft with default name', () => {
      const draft = createInitialDraft({
        playerPoolIds: ['p1', 'p2', 'p3'],
      });

      expect(draft.playerPoolIds).toEqual(['p1', 'p2', 'p3']);
      expect(draft.name).toMatch(/^Ranking \d{4}-\d{2}-\d{2}$/);
      expect(draft.setupData).toBe(null);
      expect(draft.results).toEqual([]);
      expect(draft.skippedPairs).toEqual([]);
      expect(draft.anchorDone).toBe(false);
      expect(draft.isFinished).toBe(false);
      expect(draft.adjustments).toBe(null);
      expect(typeof draft.draftUpdatedAt).toBe('number');
    });

    it('uses provided name', () => {
      const draft = createInitialDraft({
        playerPoolIds: ['p1', 'p2'],
        name: 'My Custom Ranking',
      });
      expect(draft.name).toBe('My Custom Ranking');
    });
  });
});

describe('resume with skippedPairs from local draft', () => {
  const players = [
    { id: '1', name: 'A' },
    { id: '2', name: 'B' },
    { id: '3', name: 'C' },
    { id: '4', name: 'D' },
  ];

  it('suggestNextPair respects skippedPairs after reload', () => {
    // Save a draft with skipped pairs
    const draft = {
      playerPoolIds: players.map((p) => p.id),
      results: [{ winner: '1', loser: '2' }],
      skippedPairs: new Set(['1<>3']), // 1 vs 3 was skipped
      anchorDone: true,
      isFinished: false,
    };

    saveLocalDraftImmediate(draft);
    const loaded = loadLocalDraft();

    // Rebuild closure cache
    const cache = createClosureCache();
    cache.rebuild(loaded.results);

    // Get next pair
    const next = suggestNextPair(loaded.results, players, {
      skippedPairs: loaded.skippedPairs,
      closureCache: cache,
    });

    // Next pair should NOT be 1 vs 3 (or 3 vs 1)
    if (next.length === 2) {
      const key =
        next[0].id < next[1].id
          ? `${next[0].id}<>${next[1].id}`
          : `${next[1].id}<>${next[0].id}`;
      expect(key).not.toBe('1<>3');
    }
  });

  it('closure rebuild from results works after load', () => {
    const results = [
      { winner: 'A', loser: 'B' },
      { winner: 'B', loser: 'C' },
      { winner: 'A', loser: 'C' }, // Transitive redundant
    ];

    const draft = {
      playerPoolIds: ['A', 'B', 'C', 'D'],
      results,
      anchorDone: true,
      isFinished: false,
    };

    saveLocalDraftImmediate(draft);
    const loaded = loadLocalDraft();

    // Rebuild closure and verify transitive closure
    const cache = createClosureCache();
    cache.rebuild(loaded.results);

    // A should reach B and C
    expect(cache.closure['A']?.has('B')).toBe(true);
    expect(cache.closure['A']?.has('C')).toBe(true);

    // B should reach C
    expect(cache.closure['B']?.has('C')).toBe(true);

    // Verify no cycle was introduced
    expect(cache.closure['C']?.has('A')).toBeFalsy();
    expect(cache.closure['B']?.has('A')).toBeFalsy();
  });
});

describe('owner gating', () => {
  // Note: In actual runtime, VITE_OWNER_UIDS would be set via environment.
  // For this test, we verify the isOwnerUid function behavior.

  it('isOwnerUid returns false for null/undefined', () => {
    expect(isOwnerUid(null)).toBe(false);
    expect(isOwnerUid(undefined)).toBe(false);
    expect(isOwnerUid('')).toBe(false);
  });

  it('isOwnerUid returns false for non-string input', () => {
    expect(isOwnerUid(123)).toBe(false);
    expect(isOwnerUid({})).toBe(false);
    expect(isOwnerUid([])).toBe(false);
  });

  it('getOwnerCount returns a number', () => {
    const count = getOwnerCount();
    expect(typeof count).toBe('number');
    expect(count).toBeGreaterThanOrEqual(0);
  });

  describe('Firestore save gating', () => {
    it('non-owner should not have Firestore write access', () => {
      // Simulate the logic that would be in useRankerSession
      const userId = 'anonymous-user-123';
      const isOwner = isOwnerUid(userId);

      // Mock function representing Firestore save
      const saveToFirestore = vi.fn();

      // Simulate the guard
      const attemptSave = () => {
        if (!isOwner) {
          return { error: 'Not authorized to save to Firestore' };
        }
        saveToFirestore();
        return { success: true };
      };

      const result = attemptSave();

      expect(result.error).toBe('Not authorized to save to Firestore');
      expect(saveToFirestore).not.toHaveBeenCalled();
    });

    it('owner check is deterministic for same input', () => {
      const testUid = 'test-user-456';
      const result1 = isOwnerUid(testUid);
      const result2 = isOwnerUid(testUid);
      expect(result1).toBe(result2);
    });
  });
});

describe('draft state transitions', () => {
  it('merges partial updates correctly', () => {
    // Initial draft
    const initial = {
      playerPoolIds: ['p1', 'p2', 'p3'],
      results: [],
      setupData: null,
      anchorDone: false,
      isFinished: false,
    };

    saveLocalDraftImmediate(initial);

    // Update with new results
    saveLocalDraftImmediate({
      results: [{ winner: 'p1', loser: 'p2' }],
    });

    let loaded = loadLocalDraft();
    expect(loaded.results).toEqual([{ winner: 'p1', loser: 'p2' }]);
    expect(loaded.playerPoolIds).toEqual(['p1', 'p2', 'p3']); // Preserved

    // Update with setup data
    saveLocalDraftImmediate({
      setupData: { topTier: [], bottomTier: [], anchor: null },
      anchorDone: true,
    });

    loaded = loadLocalDraft();
    expect(loaded.setupData).toEqual({
      topTier: [],
      bottomTier: [],
      anchor: null,
    });
    expect(loaded.anchorDone).toBe(true);
    expect(loaded.results).toEqual([{ winner: 'p1', loser: 'p2' }]); // Still preserved
  });

  it('updates draftUpdatedAt on each save', async () => {
    saveLocalDraftImmediate({
      playerPoolIds: ['p1', 'p2'],
      results: [],
    });

    const firstLoad = loadLocalDraft();
    const firstTimestamp = firstLoad.draftUpdatedAt;

    // Wait a bit to ensure timestamp changes
    await new Promise((resolve) => setTimeout(resolve, 10));

    saveLocalDraftImmediate({
      results: [{ winner: 'p1', loser: 'p2' }],
    });

    const secondLoad = loadLocalDraft();
    expect(secondLoad.draftUpdatedAt).toBeGreaterThan(firstTimestamp);
  });
});
