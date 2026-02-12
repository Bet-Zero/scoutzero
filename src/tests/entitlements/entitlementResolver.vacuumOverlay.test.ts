/**
 * FILE: src/tests/entitlements/entitlementResolver.vacuumOverlay.test.ts
 * PURPOSE: Tests that vacuum overlay is correctly merged at the resolver seam,
 *          and that world mode completely ignores the overlay.
 * OWNERSHIP: Feature: architect/tradeMachine (TM-VACUUM-E1)
 *
 * HISTORY:
 *  - 2026-02-12: Created for TM-VACUUM-E1 — Vacuum Pick Editing MVP.
 *
 * LINKS:
 *  - src/features/architect/utils/entitlements/entitlementResolver.ts
 *  - src/features/architect/utils/entitlements/vacuumEntitlementOverlayStore.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  applyVacuumEdit,
  applyVacuumCreate,
  removeEdit,
  removeCreate,
  clearVacuumOverlay,
} from '@/features/architect/utils/entitlements/vacuumEntitlementOverlayStore';

// ── Mock Firebase ──
// We need to mock the Firestore calls made by the resolver so we can test
// the overlay merge logic in isolation.

const mockBaseTeamDoc = {
  exists: () => true,
  data: () => ({
    entitlementIds: ['ent:BOS:2027:1:own:base1', 'ent:BOS:2027:2:own:base2'],
  }),
};

const mockWorldTeamDoc = {
  exists: () => true,
  data: () => ({
    entitlementIds: ['ent:BOS:2027:1:own:base1', 'ent:BOS:2027:2:own:base2'],
  }),
};

const mockBaseEntitlements = [
  {
    id: 'ent:BOS:2027:1:own:base1',
    holderTeam: 'BOS',
    seasonYear: 2027,
    round: 1,
    kind: 'pick_ownership',
    description: 'BOS 2027 1st',
  },
  {
    id: 'ent:BOS:2027:2:own:base2',
    holderTeam: 'BOS',
    seasonYear: 2027,
    round: 2,
    kind: 'pick_ownership',
    description: 'BOS 2027 2nd',
  },
];

const mockWorldOverrides = [
  {
    id: 'ent:BOS:2027:1:own:base1',
    description: 'BOS 2027 1st (world override)',
  },
];

vi.mock('@/firebaseConfig', () => ({
  db: {},
}));

vi.mock('@/constants/collections', () => ({
  ARCHITECT_BASE_ENTITLEMENTS_PATH: 'architect_baseEntitlements',
  ARCHITECT_BASE_TEAMS_PATH: 'architect_baseTeams',
  ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION: 'entitlements',
  ARCHITECT_WORLDS_COLLECTION: 'architect_worlds',
}));

// Mock firebase/firestore functions
vi.mock('firebase/firestore', () => {
  return {
    collection: vi.fn(),
    doc: vi.fn(),
    documentId: vi.fn(() => '__documentId__'),
    getDoc: vi.fn((ref: unknown) => {
      // Return different docs based on the mock path context
      const refObj = ref as { _type?: string };
      if (refObj?._type === 'worldTeam')
        return Promise.resolve(mockWorldTeamDoc);
      return Promise.resolve(mockBaseTeamDoc);
    }),
    getDocs: vi.fn(() => {
      // This will be overridden per-test via mockImplementation
      return Promise.resolve({ docs: [] });
    }),
    query: vi.fn((...args: unknown[]) => args),
    where: vi.fn(),
  };
});

// We need to import the module under test AFTER mocks are set up
import { getDoc, getDocs, doc } from 'firebase/firestore';

// Override doc to return tagged refs so getDoc can distinguish them
const mockDoc = vi.mocked(doc);
const mockGetDoc = vi.mocked(getDoc);
const mockGetDocs = vi.mocked(getDocs);

describe('entitlementResolver — vacuum overlay merge', () => {
  beforeEach(() => {
    localStorage.clear();
    clearVacuumOverlay();
    vi.clearAllMocks();

    // Default: doc() returns plain objects, getDoc returns base team doc
    mockDoc.mockImplementation((...args: unknown[]) => {
      const pathParts = args.slice(1) as string[];
      const fullPath = pathParts.join('/');
      // Tag world team docs
      if (fullPath.includes('architect_worlds') && fullPath.includes('teams')) {
        return { _type: 'worldTeam', _path: fullPath } as never;
      }
      return { _type: 'baseTeam', _path: fullPath } as never;
    });

    mockGetDoc.mockImplementation((ref: unknown) => {
      const refObj = ref as { _type?: string };
      if (refObj?._type === 'worldTeam') {
        return Promise.resolve(mockWorldTeamDoc) as never;
      }
      return Promise.resolve(mockBaseTeamDoc) as never;
    });
  });

  // Helper: configure getDocs to return appropriate data
  function setupBaseEntitlements() {
    mockGetDocs.mockImplementation(() => {
      return Promise.resolve({
        docs: mockBaseEntitlements.map((ent) => ({
          id: ent.id,
          data: () => ({ ...ent }),
        })),
      }) as never;
    });
  }

  function setupWorldEntitlements() {
    let callCount = 0;
    mockGetDocs.mockImplementation(() => {
      callCount++;
      // First call = base entitlements, second call = world overrides
      if (callCount === 1) {
        return Promise.resolve({
          docs: mockBaseEntitlements.map((ent) => ({
            id: ent.id,
            data: () => ({ ...ent }),
          })),
        }) as never;
      }
      return Promise.resolve({
        docs: mockWorldOverrides.map((ent) => ({
          id: ent.id,
          data: () => ({ ...ent }),
        })),
      }) as never;
    });
  }

  // ── Vacuum mode (worldId = null) ──

  describe('vacuum mode (worldId = null)', () => {
    it('returns base entitlements when no overlay exists', async () => {
      setupBaseEntitlements();

      const { resolveEntitlementsForTeam } = await import(
        '@/features/architect/utils/entitlements/entitlementResolver'
      );

      const result = await resolveEntitlementsForTeam(null, 'BOS');
      expect(result.length).toBe(2);
      expect(result[0].id).toBe('ent:BOS:2027:1:own:base1');
      expect(result[0].description).toBe('BOS 2027 1st');
    });

    it('merges vacuum edits onto matching base entitlements', async () => {
      setupBaseEntitlements();

      // Apply a vacuum edit BEFORE importing the resolver
      applyVacuumEdit('BOS', 'ent:BOS:2027:1:own:base1', {
        description: 'BOS 2027 1st (vacuum edited)',
        protectionLadder: [{ year: 2027, condition: 'Top 5' }],
      });

      // Re-import to get fresh module
      const { resolveEntitlementsForTeam } = await import(
        '@/features/architect/utils/entitlements/entitlementResolver'
      );

      const result = await resolveEntitlementsForTeam(null, 'BOS');
      expect(result.length).toBe(2);

      const edited = result.find((e) => e.id === 'ent:BOS:2027:1:own:base1');
      expect(edited).toBeTruthy();
      expect(edited!.description).toBe('BOS 2027 1st (vacuum edited)');
      expect(edited!.protectionLadder).toEqual([
        { year: 2027, condition: 'Top 5' },
      ]);
      expect(edited!.__vacuumEdited).toBe(true);

      // Unedited entitlement should be unchanged
      const unedited = result.find((e) => e.id === 'ent:BOS:2027:2:own:base2');
      expect(unedited).toBeTruthy();
      expect(unedited!.description).toBe('BOS 2027 2nd');
    });

    it('appends vacuum creates to the result list', async () => {
      setupBaseEntitlements();

      const vacuumId = 'vacuum:BOS:2028:1:own:newpick1';
      applyVacuumCreate('BOS', vacuumId, {
        holderTeam: 'BOS',
        seasonYear: 2028,
        round: 1,
        kind: 'pick_ownership',
        description: 'BOS 2028 1st (vacuum created)',
      });

      const { resolveEntitlementsForTeam } = await import(
        '@/features/architect/utils/entitlements/entitlementResolver'
      );

      const result = await resolveEntitlementsForTeam(null, 'BOS');
      expect(result.length).toBe(3); // 2 base + 1 vacuum create

      const created = result.find((e) => e.id === vacuumId);
      expect(created).toBeTruthy();
      expect(created!.description).toBe('BOS 2028 1st (vacuum created)');
      expect(created!.holderTeam).toBe('BOS');
      expect(created!.__vacuumSessionOnly).toBe(true);
    });

    it('removeEdit reverts a single edited entitlement back to base', async () => {
      setupBaseEntitlements();

      applyVacuumEdit('BOS', 'ent:BOS:2027:1:own:base1', {
        description: 'Edited in session',
      });
      removeEdit('BOS', 'ent:BOS:2027:1:own:base1');

      const { resolveEntitlementsForTeam } = await import(
        '@/features/architect/utils/entitlements/entitlementResolver'
      );

      const result = await resolveEntitlementsForTeam(null, 'BOS');
      const restored = result.find((e) => e.id === 'ent:BOS:2027:1:own:base1');
      expect(restored).toBeTruthy();
      expect(restored!.description).toBe('BOS 2027 1st');
      expect(restored!.__vacuumEdited).toBeUndefined();
    });

    it('removeCreate removes a single session-only entitlement from resolved list', async () => {
      setupBaseEntitlements();

      const vacuumId = 'vacuum:BOS:2028:1:own:newpick1';
      applyVacuumCreate('BOS', vacuumId, {
        holderTeam: 'BOS',
        seasonYear: 2028,
        round: 1,
        kind: 'pick_ownership',
      });
      removeCreate('BOS', vacuumId);

      const { resolveEntitlementsForTeam } = await import(
        '@/features/architect/utils/entitlements/entitlementResolver'
      );

      const result = await resolveEntitlementsForTeam(null, 'BOS');
      expect(result.length).toBe(2);
      expect(result.find((e) => e.id === vacuumId)).toBeUndefined();
    });

    it('combines edits and creates correctly', async () => {
      setupBaseEntitlements();

      // Edit an existing entitlement
      applyVacuumEdit('BOS', 'ent:BOS:2027:1:own:base1', {
        description: 'Edited',
      });
      // Create a new entitlement
      applyVacuumCreate('BOS', 'vacuum:BOS:2028:2:own:created1', {
        holderTeam: 'BOS',
        seasonYear: 2028,
        round: 2,
        kind: 'pick_ownership',
      });

      const { resolveEntitlementsForTeam } = await import(
        '@/features/architect/utils/entitlements/entitlementResolver'
      );

      const result = await resolveEntitlementsForTeam(null, 'BOS');
      expect(result.length).toBe(3);
      expect(
        result.find((e) => e.id === 'ent:BOS:2027:1:own:base1')!.description
      ).toBe('Edited');
      expect(
        result.find((e) => e.id === 'vacuum:BOS:2028:2:own:created1')
      ).toBeTruthy();
    });

    it('ignores edits for IDs not in base entitlements', async () => {
      setupBaseEntitlements();

      applyVacuumEdit('BOS', 'ent:BOS:2099:1:own:nonexistent', {
        description: 'Should be ignored',
      });

      const { resolveEntitlementsForTeam } = await import(
        '@/features/architect/utils/entitlements/entitlementResolver'
      );

      const result = await resolveEntitlementsForTeam(null, 'BOS');
      // Only the 2 base entitlements — the edit for a non-existent ID is silently skipped
      expect(result.length).toBe(2);
      expect(
        result.every((e) => e.id !== 'ent:BOS:2099:1:own:nonexistent')
      ).toBe(true);
    });
  });

  // ── World mode (worldId truthy) ──

  describe('world mode (worldId truthy)', () => {
    it('ignores vacuum overlay entirely', async () => {
      setupWorldEntitlements();

      // Apply vacuum edits — these should NOT appear in world mode results
      applyVacuumEdit('BOS', 'ent:BOS:2027:1:own:base1', {
        description: 'Vacuum edit — should be ignored in world mode',
      });
      applyVacuumCreate('BOS', 'vacuum:BOS:2028:1:own:shouldnotappear', {
        holderTeam: 'BOS',
        kind: 'pick_ownership',
      });

      const { resolveEntitlementsForTeam } = await import(
        '@/features/architect/utils/entitlements/entitlementResolver'
      );

      const result = await resolveEntitlementsForTeam('world-123', 'BOS');

      // Should contain base + world override, NOT vacuum overlay
      expect(result.length).toBe(2);

      const ent1 = result.find((e) => e.id === 'ent:BOS:2027:1:own:base1');
      expect(ent1).toBeTruthy();
      // Should have world override, not vacuum edit
      expect(ent1!.description).toBe('BOS 2027 1st (world override)');

      // Vacuum create should NOT be appended
      expect(
        result.find((e) => (e.id as string)?.startsWith('vacuum:'))
      ).toBeUndefined();
    });
  });
});
