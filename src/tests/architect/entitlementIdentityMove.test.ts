/**
 * FILE: src/tests/architect/entitlementIdentityMove.test.ts
 * PURPOSE: Tests for Entitlement Identity-Change Move/Rekey (R1-R4).
 *          Validates world move, vacuum rekey, and collision handling.
 * OWNERSHIP: Test suite (Entitlement Identity-Change Dedupe)
 *
 * HISTORY:
 *  - 2026-02-20: Created for Entitlement Identity-Change Dedupe execution.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Firestore } from 'firebase/firestore';
import {
  getEntitlementDeterministicId,
  getVacuumDeterministicId,
} from '@/features/architect/utils/entitlements/entitlementIdentity';

// ─── Mock Firestore for world tests ─────────────────────────────────────────

const mockRunTransaction = vi.fn();
const mockDoc = vi.fn((...segments: string[]) => segments.join('/'));
const mockGetDoc = vi.fn();
const mockArrayUnion = vi.fn((value: string) => ({ __op: 'arrayUnion', value }));
const mockArrayRemove = vi.fn((value: string) => ({
  __op: 'arrayRemove',
  value,
}));
const mockServerTimestamp = vi.fn(() => ({ __op: 'serverTimestamp' }));

vi.mock('firebase/firestore', () => ({
  runTransaction: (...args: unknown[]) => mockRunTransaction(...args),
  doc: (...args: unknown[]) => mockDoc(...(args as string[])),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  arrayUnion: (...args: unknown[]) => mockArrayUnion(...(args as [string])),
  arrayRemove: (...args: unknown[]) =>
    mockArrayRemove(...(args as [string])),
  serverTimestamp: () => mockServerTimestamp(),
}));

const mockIsEntitlementAuthoringEnabled = vi.fn().mockReturnValue(true);
const mockBuildWorldEntitlementWritePayload = vi.fn();
const mockAssertNoEntitlementIdCollision = vi.fn();
const mockResolveEntitlementsForTeam = vi.fn().mockResolvedValue([]);
const mockResolveEntitlement = vi.fn();
const mockRunLeagueClaimUniquenessGate = vi
  .fn()
  .mockResolvedValue({ ok: true });

class MockEntitlementIdCollisionError extends Error {
  readonly code = 'ENTITLEMENT_ID_COLLISION';
}

vi.mock('@/features/architect/utils/entitlements/entitlementWriter', () => ({
  isEntitlementAuthoringEnabled: () => mockIsEntitlementAuthoringEnabled(),
  buildWorldEntitlementWritePayload: (...args: unknown[]) =>
    mockBuildWorldEntitlementWritePayload(...args),
  assertNoEntitlementIdCollision: (...args: unknown[]) =>
    mockAssertNoEntitlementIdCollision(...args),
  EntitlementIdCollisionError: MockEntitlementIdCollisionError,
}));

vi.mock('@/features/architect/utils/entitlements/entitlementResolver', () => ({
  resolveEntitlement: (...args: unknown[]) => mockResolveEntitlement(...args),
  resolveEntitlementsForTeam: (...args: unknown[]) =>
    mockResolveEntitlementsForTeam(...args),
}));

vi.mock(
  '@/features/architect/utils/entitlements/leagueClaimUniquenessGate',
  () => ({
    runLeagueClaimUniquenessGate: (...args: unknown[]) =>
      mockRunLeagueClaimUniquenessGate(...args),
  })
);

// ─── Mock localStorage for vacuum tests ──────────────────────────────────────

let mockStorage: Record<string, string> = {};

beforeEach(() => {
  mockStorage = {};
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => mockStorage[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      mockStorage[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete mockStorage[key];
    }),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePickOwnershipDoc(team: string, year: number, pickId: string) {
  return {
    holderTeam: team,
    seasonYear: year,
    round: 1,
    kind: 'pick_ownership' as const,
    underlyingPickId: pickId,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORLD TESTS — moveWorldEntitlement
// ═══════════════════════════════════════════════════════════════════════════════

describe('World: moveWorldEntitlement', () => {
  // Import after mocks are set up
  let moveWorldEntitlement: typeof import('@/features/architect/utils/entitlements/moveWorldEntitlement').moveWorldEntitlement;
  let tx: {
    set: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockIsEntitlementAuthoringEnabled.mockReturnValue(true);
    tx = {
      set: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    };
    mockRunTransaction.mockImplementation(
      async (
        _db: unknown,
        callback: (transaction: typeof tx) => unknown
      ) => callback(tx)
    );
    mockBuildWorldEntitlementWritePayload.mockImplementation(
      ({ entitlementId, document }) => ({
        ...document,
        id: entitlementId,
      })
    );
    mockGetDoc.mockResolvedValue({
      exists: () => false,
      id: '',
      data: () => ({}),
    });
    mockAssertNoEntitlementIdCollision.mockImplementation(() => {});
    mockResolveEntitlement.mockResolvedValue({ holderTeam: 'LAL' });
    mockResolveEntitlementsForTeam.mockResolvedValue([]);
    mockRunLeagueClaimUniquenessGate.mockResolvedValue({ ok: true });

    const mod = await import(
      '@/features/architect/utils/entitlements/moveWorldEntitlement'
    );
    moveWorldEntitlement = mod.moveWorldEntitlement;
  });

  it('Test 1: Edit with no identity-change calls normal write only', async () => {
    const doc = makePickOwnershipDoc('LAL', 2026, 'LAL_2026_1st');
    const id = getEntitlementDeterministicId(doc);
    const fakeDb = {} as Firestore;

    const result = await moveWorldEntitlement(fakeDb, {
      worldId: 'world1',
      fromId: id,
      toId: id,
      document: doc,
      userId: 'user1',
    });

    expect(result.success).toBe(true);
    expect(result.toId).toBe(id);
    expect(mockRunTransaction).toHaveBeenCalledTimes(1);
    expect(tx.set).toHaveBeenCalledTimes(1);
    expect(tx.delete).not.toHaveBeenCalled();
    // No inventory update needed when ID and holder team are unchanged.
    expect(tx.update).not.toHaveBeenCalled();
    expect(mockRunLeagueClaimUniquenessGate).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'ENTITLEMENT_MOVE',
        scopeMode: 'FULL_LEAGUE',
      })
    );
  });

  it('Test 2: Edit with identity-change writes to new ID AND deletes old ID', async () => {
    const oldDoc = makePickOwnershipDoc('LAL', 2026, 'LAL_2026_1st');
    const newDoc = makePickOwnershipDoc('LAL', 2027, 'LAL_2027_1st'); // Changed year + pickId
    const oldId = getEntitlementDeterministicId(oldDoc);
    const newId = getEntitlementDeterministicId(newDoc);
    const fakeDb = {} as Firestore;

    // Verify IDs are actually different
    expect(oldId).not.toBe(newId);

    const result = await moveWorldEntitlement(fakeDb, {
      worldId: 'world1',
      fromId: oldId,
      toId: newId,
      document: newDoc,
      userId: 'user1',
    });

    expect(result.success).toBe(true);
    expect(result.toId).toBe(newId);
    expect(mockRunTransaction).toHaveBeenCalledTimes(1);
    expect(tx.set).toHaveBeenCalledTimes(1);
    expect(tx.delete).toHaveBeenCalledTimes(1);
    // Same team move with new ID: remove old inventory ID then add new ID.
    expect(tx.update).toHaveBeenCalledTimes(2);
    expect(tx.update.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        entitlementIds: { __op: 'arrayRemove', value: oldId },
      })
    );
    expect(tx.update.mock.calls[1][1]).toEqual(
      expect.objectContaining({
        entitlementIds: { __op: 'arrayUnion', value: newId },
      })
    );
  });

  it('Test 3: Cross-team move updates source and destination inventories', async () => {
    const oldDoc = makePickOwnershipDoc('BOS', 2026, 'BOS_2026_1st');
    const newDoc = makePickOwnershipDoc('LAL', 2027, 'LAL_2027_1st');
    const oldId = getEntitlementDeterministicId(oldDoc);
    const newId = getEntitlementDeterministicId(newDoc);
    const fakeDb = {} as Firestore;

    mockResolveEntitlement.mockResolvedValue({ holderTeam: 'BOS' });

    const result = await moveWorldEntitlement(fakeDb, {
      worldId: 'world1',
      fromId: oldId,
      toId: newId,
      document: newDoc,
      userId: 'user1',
    });

    expect(result.success).toBe(true);
    expect(tx.set).toHaveBeenCalledTimes(1);
    expect(tx.delete).toHaveBeenCalledTimes(1);
    expect(tx.update).toHaveBeenCalledTimes(2);
    expect(tx.update.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        entitlementIds: { __op: 'arrayRemove', value: oldId },
      })
    );
    expect(tx.update.mock.calls[1][1]).toEqual(
      expect.objectContaining({
        entitlementIds: { __op: 'arrayUnion', value: newId },
      })
    );
  });

  it('Test 3b: claim uniqueness gate failure blocks move', async () => {
    const oldDoc = makePickOwnershipDoc('BOS', 2026, 'BOS_2026_1st');
    const oldId = getEntitlementDeterministicId(oldDoc);
    const newId = getEntitlementDeterministicId({
      ...oldDoc,
      seasonYear: 2027,
      underlyingPickId: 'BOS_2027_1st',
    });
    const fakeDb = {} as Firestore;

    mockResolveEntitlementsForTeam.mockResolvedValue([
      { id: oldId, ...oldDoc },
    ]);
    mockRunLeagueClaimUniquenessGate.mockResolvedValue({
      ok: false,
      errorType: 'CLAIM_UNIQUENESS_VIOLATION',
      message: 'Entitlement Move: Claim uniqueness violation',
      conflicts: [],
    });

    const result = await moveWorldEntitlement(fakeDb, {
      worldId: 'world1',
      fromId: oldId,
      toId: newId,
      document: {
        ...oldDoc,
        seasonYear: 2027,
        underlyingPickId: 'BOS_2027_1st',
      },
      userId: 'user1',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Claim uniqueness');
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it('Test 3c: transaction failure is fail-loud', async () => {
    const oldDoc = makePickOwnershipDoc('LAL', 2026, 'LAL_2026_1st');
    const newDoc = makePickOwnershipDoc('LAL', 2027, 'LAL_2027_1st');
    const oldId = getEntitlementDeterministicId(oldDoc);
    const newId = getEntitlementDeterministicId(newDoc);
    const fakeDb = {} as Firestore;

    mockRunTransaction.mockRejectedValueOnce(new Error('permission denied'));

    const result = await moveWorldEntitlement(fakeDb, {
      worldId: 'world1',
      fromId: oldId,
      toId: newId,
      document: newDoc,
      userId: 'user1',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('permission denied');
  });

  it('Test 3d: unresolved source holderTeam blocks move', async () => {
    const oldDoc = makePickOwnershipDoc('LAL', 2026, 'LAL_2026_1st');
    const newDoc = makePickOwnershipDoc('LAL', 2027, 'LAL_2027_1st');
    const oldId = getEntitlementDeterministicId(oldDoc);
    const newId = getEntitlementDeterministicId(newDoc);
    const fakeDb = {} as Firestore;

    mockResolveEntitlement.mockResolvedValueOnce(null);

    const result = await moveWorldEntitlement(fakeDb, {
      worldId: 'world1',
      fromId: oldId,
      toId: newId,
      document: newDoc,
      userId: 'user1',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('unable to resolve source holderTeam');
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it('Test 3e: deterministic ID collision blocks move before transaction', async () => {
    const oldDoc = makePickOwnershipDoc('LAL', 2026, 'LAL_2026_1st');
    const newDoc = makePickOwnershipDoc('LAL', 2027, 'LAL_2027_1st');
    const oldId = getEntitlementDeterministicId(oldDoc);
    const newId = getEntitlementDeterministicId(newDoc);
    const fakeDb = {} as Firestore;

    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: newId,
      data: () => ({
        id: newId,
        identityKey: 'own|LAL|2027|1|different_pick',
      }),
    });
    mockAssertNoEntitlementIdCollision.mockImplementationOnce(() => {
      throw new MockEntitlementIdCollisionError(
        'Entitlement Move: ENTITLEMENT_ID_COLLISION'
      );
    });

    const result = await moveWorldEntitlement(fakeDb, {
      worldId: 'world1',
      fromId: oldId,
      toId: newId,
      document: newDoc,
      userId: 'user1',
    });

    expect(result.success).toBe(false);
    expect(result.errorType).toBe('ENTITLEMENT_ID_COLLISION');
    expect(result.error).toContain('ENTITLEMENT_ID_COLLISION');
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// VACUUM TESTS — rekey + collision
// ═══════════════════════════════════════════════════════════════════════════════

describe('Vacuum: rekeyVacuumCreate', () => {
  // Dynamic imports so mocked localStorage is in place
  let rekeyVacuumCreate: typeof import('@/features/architect/utils/entitlements/vacuumEntitlementOverlayStore').rekeyVacuumCreate;
  let applyVacuumCreate: typeof import('@/features/architect/utils/entitlements/vacuumEntitlementOverlayStore').applyVacuumCreate;
  let loadVacuumOverlay: typeof import('@/features/architect/utils/entitlements/vacuumEntitlementOverlayStore').loadVacuumOverlay;

  beforeEach(async () => {
    mockStorage = {};
    const mod = await import(
      '@/features/architect/utils/entitlements/vacuumEntitlementOverlayStore'
    );
    rekeyVacuumCreate = mod.rekeyVacuumCreate;
    applyVacuumCreate = mod.applyVacuumCreate;
    loadVacuumOverlay = mod.loadVacuumOverlay;
  });

  it('Test 4: Vacuum create rekey — old key removed, new key present', () => {
    const oldDoc = makePickOwnershipDoc('LAL', 2026, 'LAL_2026_1st');
    const newDoc = makePickOwnershipDoc('LAL', 2027, 'LAL_2027_1st');
    const oldVacId = getVacuumDeterministicId(oldDoc);
    const newVacId = getVacuumDeterministicId(newDoc);

    // Seed the old entry
    applyVacuumCreate('LAL', oldVacId, oldDoc);

    // Verify seeded
    let envelope = loadVacuumOverlay();
    expect(envelope.overlays['LAL']?.creates[oldVacId]).toBeDefined();

    // Rekey
    rekeyVacuumCreate('LAL', oldVacId, newVacId, newDoc);

    // Verify
    envelope = loadVacuumOverlay();
    expect(envelope.overlays['LAL']?.creates[oldVacId]).toBeUndefined();
    expect(envelope.overlays['LAL']?.creates[newVacId]).toBeDefined();
    expect(envelope.overlays['LAL']?.creates[newVacId]?.id).toBe(newVacId);
    expect(envelope.overlays['LAL']?.creates[newVacId]?.underlyingPickId).toBe(
      'LAL_2027_1st'
    );
  });

  it('Test 5: Vacuum create rekey collision — target overwritten, old removed', () => {
    const docA = makePickOwnershipDoc('LAL', 2026, 'LAL_2026_1st');
    const docB = makePickOwnershipDoc('LAL', 2027, 'LAL_2027_1st');
    const vacIdA = getVacuumDeterministicId(docA);
    const vacIdB = getVacuumDeterministicId(docB);

    // Seed both entries
    applyVacuumCreate('LAL', vacIdA, docA);
    applyVacuumCreate('LAL', vacIdB, docB);

    // Now user edits entry A, changing its identity to match B's identity
    const updatedDocA = makePickOwnershipDoc('LAL', 2027, 'LAL_2027_1st');

    // The new deterministic ID for docA-edited should now equal vacIdB
    const newVacId = getVacuumDeterministicId(updatedDocA);
    expect(newVacId).toBe(vacIdB);

    // Rekey: A → B (overwrite)
    rekeyVacuumCreate('LAL', vacIdA, newVacId, updatedDocA);

    // Verify: old A gone, B overwritten with updated doc
    const envelope = loadVacuumOverlay();
    expect(envelope.overlays['LAL']?.creates[vacIdA]).toBeUndefined();
    expect(envelope.overlays['LAL']?.creates[vacIdB]).toBeDefined();
    // Total creates should be exactly 1
    expect(Object.keys(envelope.overlays['LAL']?.creates || {}).length).toBe(1);
  });
});

describe('Vacuum: resolveVacuumEditCollisions', () => {
  let resolveVacuumEditCollisions: typeof import('@/features/architect/utils/entitlements/vacuumEntitlementOverlayStore').resolveVacuumEditCollisions;
  let applyVacuumCreate: typeof import('@/features/architect/utils/entitlements/vacuumEntitlementOverlayStore').applyVacuumCreate;
  let applyVacuumEdit: typeof import('@/features/architect/utils/entitlements/vacuumEntitlementOverlayStore').applyVacuumEdit;
  let loadVacuumOverlay: typeof import('@/features/architect/utils/entitlements/vacuumEntitlementOverlayStore').loadVacuumOverlay;

  beforeEach(async () => {
    mockStorage = {};
    const mod = await import(
      '@/features/architect/utils/entitlements/vacuumEntitlementOverlayStore'
    );
    resolveVacuumEditCollisions = mod.resolveVacuumEditCollisions;
    applyVacuumCreate = mod.applyVacuumCreate;
    applyVacuumEdit = mod.applyVacuumEdit;
    loadVacuumOverlay = mod.loadVacuumOverlay;
  });

  it('Test 6: Base edit collision with vacuum create — create is removed', () => {
    // A vacuum create exists with identity LAL/2027/1/pick_ownership/LAL_2027_1st
    const createDoc = makePickOwnershipDoc('LAL', 2027, 'LAL_2027_1st');
    const vacId = getVacuumDeterministicId(createDoc);
    applyVacuumCreate('LAL', vacId, createDoc);

    // Verify it exists
    let envelope = loadVacuumOverlay();
    expect(envelope.overlays['LAL']?.creates[vacId]).toBeDefined();

    // Now user edits a base entitlement, changing its identity to match the create
    const editDoc = makePickOwnershipDoc('LAL', 2027, 'LAL_2027_1st');
    const baseId = 'base-ent-legacy-id';
    applyVacuumEdit('LAL', baseId, editDoc);

    // Resolve collisions
    resolveVacuumEditCollisions('LAL', editDoc);

    // Verify: vacuum create should be removed (base edit wins)
    envelope = loadVacuumOverlay();
    expect(envelope.overlays['LAL']?.creates[vacId]).toBeUndefined();
    // The edit should still be there
    expect(envelope.overlays['LAL']?.edits[baseId]).toBeDefined();
  });

  it('No collision — vacuum create preserved when identity differs', () => {
    const createDoc = makePickOwnershipDoc('LAL', 2027, 'LAL_2027_1st');
    const vacId = getVacuumDeterministicId(createDoc);
    applyVacuumCreate('LAL', vacId, createDoc);

    // Edit a base entitlement with DIFFERENT identity
    const editDoc = makePickOwnershipDoc('LAL', 2028, 'LAL_2028_1st');
    const baseId = 'base-ent-other';
    applyVacuumEdit('LAL', baseId, editDoc);

    resolveVacuumEditCollisions('LAL', editDoc);

    // Create should still exist — no collision
    const envelope = loadVacuumOverlay();
    expect(envelope.overlays['LAL']?.creates[vacId]).toBeDefined();
    expect(envelope.overlays['LAL']?.edits[baseId]).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// INTEGRATION: dedupeVacuumByIdentity safety net
// ═══════════════════════════════════════════════════════════════════════════════

describe('Vacuum: dedupeVacuumByIdentity safety net', () => {
  let dedupeVacuumByIdentity: typeof import('@/features/architect/utils/entitlements/vacuumEntitlementOverlayStore').dedupeVacuumByIdentity;
  let loadVacuumOverlay: typeof import('@/features/architect/utils/entitlements/vacuumEntitlementOverlayStore').loadVacuumOverlay;
  let saveVacuumOverlay: typeof import('@/features/architect/utils/entitlements/vacuumEntitlementOverlayStore').saveVacuumOverlay;

  beforeEach(async () => {
    mockStorage = {};
    const mod = await import(
      '@/features/architect/utils/entitlements/vacuumEntitlementOverlayStore'
    );
    dedupeVacuumByIdentity = mod.dedupeVacuumByIdentity;
    loadVacuumOverlay = mod.loadVacuumOverlay;
    saveVacuumOverlay = mod.saveVacuumOverlay;
  });

  it('removes duplicate creates that share the same identity key', () => {
    const doc = makePickOwnershipDoc('LAL', 2026, 'LAL_2026_1st');

    // Manually inject two creates with different IDs but same identity
    // (simulates legacy data or a bug)
    const envelope = {
      version: 1 as const,
      overlays: {
        LAL: {
          edits: {},
          creates: {
            'vacuum:LAL:2026:1:own:aaaaaaaa': {
              ...doc,
              id: 'vacuum:LAL:2026:1:own:aaaaaaaa',
            },
            'vacuum:LAL:2026:1:own:bbbbbbbb': {
              ...doc,
              id: 'vacuum:LAL:2026:1:own:bbbbbbbb',
            },
          },
        },
      },
      transfers: {},
      _updatedAt: new Date().toISOString(),
    };
    saveVacuumOverlay(envelope);

    const removed = dedupeVacuumByIdentity('LAL');
    expect(removed).toBe(1);

    // Should have exactly one create left
    const result = loadVacuumOverlay();
    const creates = result.overlays['LAL']?.creates || {};
    expect(Object.keys(creates).length).toBe(1);
  });

  it('returns 0 when no duplicates exist', () => {
    const doc1 = makePickOwnershipDoc('LAL', 2026, 'LAL_2026_1st');
    const doc2 = makePickOwnershipDoc('LAL', 2027, 'LAL_2027_1st');

    const envelope = {
      version: 1 as const,
      overlays: {
        LAL: {
          edits: {},
          creates: {
            [getVacuumDeterministicId(doc1)]: {
              ...doc1,
              id: getVacuumDeterministicId(doc1),
            },
            [getVacuumDeterministicId(doc2)]: {
              ...doc2,
              id: getVacuumDeterministicId(doc2),
            },
          },
        },
      },
      transfers: {},
      _updatedAt: new Date().toISOString(),
    };
    saveVacuumOverlay(envelope);

    const removed = dedupeVacuumByIdentity('LAL');
    expect(removed).toBe(0);

    // Both should still exist
    const result = loadVacuumOverlay();
    expect(Object.keys(result.overlays['LAL']?.creates || {}).length).toBe(2);
  });
});
