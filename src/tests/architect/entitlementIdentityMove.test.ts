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
import {
  getEntitlementDeterministicId,
  getVacuumDeterministicId,
  getEntitlementIdentityKey,
} from '@/features/architect/utils/entitlements/entitlementIdentity';

// ─── Mock Firestore for world tests ─────────────────────────────────────────

// We mock entitlementWriter at the module level so moveWorldEntitlement
// calls the mocked versions of writeWorldEntitlement / deleteWorldEntitlement etc.
const mockWriteWorldEntitlement = vi
  .fn()
  .mockResolvedValue({ success: true, path: 'mock/path' });
const mockDeleteWorldEntitlement = vi
  .fn()
  .mockResolvedValue({ success: true, path: 'mock/path' });
const mockAttachEntitlementToTeam = vi
  .fn()
  .mockResolvedValue({ success: true });
const mockDetachEntitlementFromTeam = vi
  .fn()
  .mockResolvedValue({ success: true });
const mockIsEntitlementAuthoringEnabled = vi.fn().mockReturnValue(true);

vi.mock('@/features/architect/utils/entitlements/entitlementWriter', () => ({
  writeWorldEntitlement: (...args: unknown[]) =>
    mockWriteWorldEntitlement(...args),
  deleteWorldEntitlement: (...args: unknown[]) =>
    mockDeleteWorldEntitlement(...args),
  attachEntitlementToTeam: (...args: unknown[]) =>
    mockAttachEntitlementToTeam(...args),
  detachEntitlementFromTeam: (...args: unknown[]) =>
    mockDetachEntitlementFromTeam(...args),
  isEntitlementAuthoringEnabled: () => mockIsEntitlementAuthoringEnabled(),
  validateEntitlementDocument: () => ({ valid: true, errors: [] }),
  generateEntitlementId: () => 'ent:MOCK:2026:1:own:random00',
}));

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

  beforeEach(async () => {
    mockWriteWorldEntitlement.mockClear();
    mockDeleteWorldEntitlement.mockClear();
    mockAttachEntitlementToTeam.mockClear();
    mockDetachEntitlementFromTeam.mockClear();

    mockWriteWorldEntitlement.mockResolvedValue({
      success: true,
      path: 'mock/path',
    });
    mockDeleteWorldEntitlement.mockResolvedValue({
      success: true,
      path: 'mock/path',
    });
    mockAttachEntitlementToTeam.mockResolvedValue({ success: true });
    mockDetachEntitlementFromTeam.mockResolvedValue({ success: true });

    const mod = await import(
      '@/features/architect/utils/entitlements/moveWorldEntitlement'
    );
    moveWorldEntitlement = mod.moveWorldEntitlement;
  });

  it('Test 1: Edit with no identity-change calls normal write only', async () => {
    const doc = makePickOwnershipDoc('LAL', 2026, 'LAL_2026_1st');
    const id = getEntitlementDeterministicId(doc);
    const fakeDb = {} as any;

    const result = await moveWorldEntitlement(fakeDb, {
      worldId: 'world1',
      fromId: id,
      toId: id,
      document: doc,
      userId: 'user1',
    });

    expect(result.success).toBe(true);
    expect(result.toId).toBe(id);
    // Normal write — should call writeWorldEntitlement once
    expect(mockWriteWorldEntitlement).toHaveBeenCalledTimes(1);
    // Should NOT call delete since fromId === toId
    expect(mockDeleteWorldEntitlement).not.toHaveBeenCalled();
  });

  it('Test 2: Edit with identity-change writes to new ID AND deletes old ID', async () => {
    const oldDoc = makePickOwnershipDoc('LAL', 2026, 'LAL_2026_1st');
    const newDoc = makePickOwnershipDoc('LAL', 2027, 'LAL_2027_1st'); // Changed year + pickId
    const oldId = getEntitlementDeterministicId(oldDoc);
    const newId = getEntitlementDeterministicId(newDoc);
    const fakeDb = {} as any;

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
    // Should write to new ID
    expect(mockWriteWorldEntitlement).toHaveBeenCalledWith(expect.anything(), {
      worldId: 'world1',
      entitlementId: newId,
      document: newDoc,
      userId: 'user1',
    });
    // Should delete old ID
    expect(mockDeleteWorldEntitlement).toHaveBeenCalledWith(
      expect.anything(),
      'world1',
      oldId
    );
    // Should update team inventory
    expect(mockDetachEntitlementFromTeam).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        worldId: 'world1',
        teamCode: 'LAL',
        entitlementId: oldId,
      })
    );
    expect(mockAttachEntitlementToTeam).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        worldId: 'world1',
        teamCode: 'LAL',
        entitlementId: newId,
      })
    );
  });

  it('Test 3: Edit with identity-change collision still deletes old ID (no preservation of both)', async () => {
    // Simulate: oldId = X, newId = Y, and Y already exists.
    // writeWorldEntitlement with merge:true handles the collision.
    // We just verify the delete of X still occurs.
    const oldDoc = makePickOwnershipDoc('BOS', 2026, 'BOS_2026_1st');
    const newDoc = makePickOwnershipDoc('BOS', 2027, 'BOS_2027_1st');

    const oldId = getEntitlementDeterministicId(oldDoc);
    const newId = getEntitlementDeterministicId(newDoc);
    const fakeDb = {} as any;

    // Write succeeds (merge:true upserts over existing collision target)
    mockWriteWorldEntitlement.mockResolvedValue({
      success: true,
      path: 'mock/path',
    });

    const result = await moveWorldEntitlement(fakeDb, {
      worldId: 'world1',
      fromId: oldId,
      toId: newId,
      document: newDoc,
      userId: 'user1',
    });

    expect(result.success).toBe(true);
    expect(result.toId).toBe(newId);
    // Write happened to new ID
    expect(mockWriteWorldEntitlement).toHaveBeenCalledTimes(1);
    // Old ID was deleted
    expect(mockDeleteWorldEntitlement).toHaveBeenCalledWith(
      expect.anything(),
      'world1',
      oldId
    );
    // Only one write, one delete — never two records for the same identity
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
