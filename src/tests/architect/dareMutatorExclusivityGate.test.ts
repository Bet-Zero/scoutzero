/**
 * FILE: src/tests/architect/dareMutatorExclusivityGate.test.ts
 * PURPOSE: Tests for TM-EXCL-E3 DARE mutator exclusivity gating.
 *          Verifies that applyGatedDAREResultsToBatch refuses to write
 *          when the mutation-set would create exclusivity conflicts.
 * OWNERSHIP: Feature: architect/utils/entitlements (Exclusivity Gates)
 *
 * HISTORY:
 *  - 2026-02-20: Created for TM-EXCL-E3
 *
 * REF: docs/architect/TRADE_MACHINE_ENTITLEMENTS_ADVANCED_MASTER.md §10.8
 */

import { describe, it, expect, vi } from 'vitest';
import { applyGatedDAREResultsToBatch } from '@/features/architect/utils/entitlements/dare/entitlementMutator';
import type {
  DAREOutput,
  DARETeamUpdate,
  DAREEntitlementWrite,
} from '@/features/architect/utils/entitlements/dare/types';
import type { EntitlementDocLike } from '@/features/architect/utils/entitlements/entitlementExclusivityValidator';

// ─── helpers ─────────────────────────────────────────────────────────────────

function makePickOwnership(
  id: string,
  underlyingPickId: string
): EntitlementDocLike {
  return { id, kind: 'pick_ownership', underlyingPickId };
}

/** Build a minimal mock Firestore `db` with doc() that returns a ref stub */
function mockDb() {
  return {
    type: 'firestore',
  } as any;
}

/** Build a mock WriteBatch that tracks operations */
function mockBatch() {
  const ops: Array<{ type: string; ref: any; data?: any }> = [];
  return {
    set: vi.fn((ref: any, data: any, _opts?: any) => {
      ops.push({ type: 'set', ref, data });
    }),
    delete: vi.fn((ref: any) => {
      ops.push({ type: 'delete', ref });
    }),
    commit: vi.fn(),
    _ops: ops,
  } as any;
}

function buildDAREOutput(
  teamUpdates: DARETeamUpdate[],
  docWrites: DAREEntitlementWrite[]
): DAREOutput {
  return {
    success: true,
    teamEntitlementIdUpdates: teamUpdates,
    entitlementDocWrites: docWrites,
    resolutionReceipt: {
      draftYear: 2027,
      method: 'manual',
      teamResults: [],
      summary: 'test',
    } as any,
    meta: {
      timestamp: new Date().toISOString(),
      worldId: 'test-world',
      draftYear: 2027,
      method: 'manual',
      entitlementsProcessed: docWrites.length,
      writeCount: docWrites.length,
    } as any,
  };
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe('DARE Mutator Exclusivity Gate (TM-EXCL-E3)', () => {
  it('blocks when DARE would create conflicting entitlements on a team', () => {
    const db = mockDb();
    const batch = mockBatch();

    // Pre-DARE state: BOS owns LAL_2027_1st
    const currentEntitlementsByTeam: Record<string, EntitlementDocLike[]> = {
      BOS: [makePickOwnership('ent-existing', 'LAL_2027_1st')],
    };

    // DARE creates a new entitlement that overlaps
    const dareOutput = buildDAREOutput(
      [
        {
          teamCode: 'BOS',
          entitlementIds: ['ent-existing', 'ent-rolled-new'],
          addedIds: ['ent-rolled-new'],
          removedIds: [],
        },
      ],
      [
        {
          action: 'upsert',
          entitlementId: 'ent-rolled-new',
          path: 'architect_worlds/test/entitlements/ent-rolled-new',
          document: {
            kind: 'pick_ownership',
            underlyingPickId: 'LAL_2027_1st',
          }, // same pick!
          reason: 'Rolled from protection',
        },
      ]
    );

    const result = applyGatedDAREResultsToBatch(
      db,
      batch,
      'test-world',
      dareOutput,
      currentEntitlementsByTeam
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const failedResult = result as Exclude<typeof result, { ok: true }>;
      expect(failedResult.errorType).toBe('EXCLUSIVITY_VIOLATION');
      expect(failedResult.message).toContain('BOS');
      expect(failedResult.message).toContain('DUP_PICK_OWNERSHIP_UNDERLIER');
      expect(failedResult.teamViolations).toBeDefined();
      expect(failedResult.teamViolations!.length).toBe(1);
    }

    // Verify no writes were added to batch
    expect(batch.set).not.toHaveBeenCalled();
    expect(batch.delete).not.toHaveBeenCalled();
  });

  it('fails safely when pre-DARE entitlement set is not provided', () => {
    const db = mockDb();
    const batch = mockBatch();

    const dareOutput = buildDAREOutput(
      [
        {
          teamCode: 'LAL',
          entitlementIds: ['ent-new'],
          addedIds: ['ent-new'],
          removedIds: [],
        },
      ],
      [
        {
          action: 'upsert',
          entitlementId: 'ent-new',
          path: 'architect_worlds/test/entitlements/ent-new',
          document: {
            kind: 'pick_ownership',
            underlyingPickId: 'LAL_2028_1st',
          },
          reason: 'Rolled',
        },
      ]
    );

    // Missing LAL from currentEntitlementsByTeam
    const result = applyGatedDAREResultsToBatch(
      db,
      batch,
      'test-world',
      dareOutput,
      {} // no teams provided
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const failedResult = result as Exclude<typeof result, { ok: true }>;
      expect(failedResult.message).toContain('LAL');
      expect(failedResult.message).toContain('not provided');
    }

    // No writes
    expect(batch.set).not.toHaveBeenCalled();
  });

  it('allows DARE mutations that produce a clean entitlement set', () => {
    const db = mockDb();
    const batch = mockBatch();

    // Pre-DARE: BOS owns LAL_2026_1st (about to be resolved)
    const currentEntitlementsByTeam: Record<string, EntitlementDocLike[]> = {
      BOS: [makePickOwnership('ent-original', 'LAL_2026_1st')],
    };

    // DARE resolves the 2026 and creates a 2027 rollover (different pick ID)
    const dareOutput = buildDAREOutput(
      [
        {
          teamCode: 'BOS',
          entitlementIds: ['ent-rolled-2027'],
          addedIds: ['ent-rolled-2027'],
          removedIds: ['ent-original'],
        },
      ],
      [
        {
          action: 'upsert',
          entitlementId: 'ent-original',
          path: 'architect_worlds/test/entitlements/ent-original',
          document: { resolved: true, resolvedOutcome: 'rolled' } as any,
          reason: 'Resolved: rolled',
        },
        {
          action: 'upsert',
          entitlementId: 'ent-rolled-2027',
          path: 'architect_worlds/test/entitlements/ent-rolled-2027',
          document: {
            kind: 'pick_ownership',
            underlyingPickId: 'LAL_2027_1st',
          },
          reason: 'Rolled from ent-original',
        },
      ]
    );

    const result = applyGatedDAREResultsToBatch(
      db,
      batch,
      'test-world',
      dareOutput,
      currentEntitlementsByTeam
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.writeCount).toBeGreaterThan(0);
    }
  });

  it('skips validation for teams with no DARE changes', () => {
    const db = mockDb();
    const batch = mockBatch();

    const currentEntitlementsByTeam: Record<string, EntitlementDocLike[]> = {
      BOS: [makePickOwnership('ent-1', 'BOS_2027_1st')],
    };

    // DARE output with no effective changes to BOS
    const dareOutput = buildDAREOutput(
      [
        {
          teamCode: 'BOS',
          entitlementIds: ['ent-1'],
          addedIds: [],
          removedIds: [],
        },
      ],
      []
    );

    const result = applyGatedDAREResultsToBatch(
      db,
      batch,
      'test-world',
      dareOutput,
      currentEntitlementsByTeam
    );

    expect(result.ok).toBe(true);
  });

  it('validates multiple teams and blocks if any team fails', () => {
    const db = mockDb();
    const batch = mockBatch();

    const currentEntitlementsByTeam: Record<string, EntitlementDocLike[]> = {
      BOS: [makePickOwnership('ent-bos', 'BOS_2027_1st')],
      LAL: [makePickOwnership('ent-lal-existing', 'GSW_2027_1st')],
    };

    // BOS is clean, LAL would get a conflict
    const dareOutput = buildDAREOutput(
      [
        {
          teamCode: 'BOS',
          entitlementIds: ['ent-bos', 'ent-bos-new'],
          addedIds: ['ent-bos-new'],
          removedIds: [],
        },
        {
          teamCode: 'LAL',
          entitlementIds: ['ent-lal-existing', 'ent-lal-conflict'],
          addedIds: ['ent-lal-conflict'],
          removedIds: [],
        },
      ],
      [
        {
          action: 'upsert',
          entitlementId: 'ent-bos-new',
          path: 'test',
          document: {
            kind: 'pick_ownership',
            underlyingPickId: 'CHI_2027_1st',
          },
          reason: 'test',
        },
        {
          action: 'upsert',
          entitlementId: 'ent-lal-conflict',
          path: 'test',
          document: {
            kind: 'pick_ownership',
            underlyingPickId: 'GSW_2027_1st',
          }, // dupe!
          reason: 'test',
        },
      ]
    );

    const result = applyGatedDAREResultsToBatch(
      db,
      batch,
      'test-world',
      dareOutput,
      currentEntitlementsByTeam
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const failedResult = result as Exclude<typeof result, { ok: true }>;
      expect(failedResult.message).toContain('LAL');
      expect(failedResult.teamViolations!.length).toBe(1);
    }

    // No writes at all
    expect(batch.set).not.toHaveBeenCalled();
  });

  it('blocks when post-DARE state creates cross-team claim conflict', () => {
    const db = mockDb();
    const batch = mockBatch();

    const currentEntitlementsByTeam: Record<string, EntitlementDocLike[]> = {
      BOS: [makePickOwnership('ent-bos', 'BOS_2028_1st')],
      LAL: [makePickOwnership('ent-lal', 'LAL_2028_1st')],
    };

    // DARE updates LAL to claim BOS_2028_1st, which BOS already claims.
    const dareOutput = buildDAREOutput(
      [
        {
          teamCode: 'LAL',
          entitlementIds: ['ent-lal'],
          addedIds: [],
          removedIds: [],
        },
      ],
      [
        {
          action: 'upsert',
          entitlementId: 'ent-lal',
          path: 'test',
          document: {
            kind: 'pick_ownership',
            underlyingPickId: 'BOS_2028_1st',
          },
          reason: 'Conflict regression test',
        },
      ]
    );

    const result = applyGatedDAREResultsToBatch(
      db,
      batch,
      'test-world',
      dareOutput,
      currentEntitlementsByTeam
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const failedResult = result as Exclude<typeof result, { ok: true }>;
      expect(failedResult.errorType).toBe('CLAIM_UNIQUENESS_VIOLATION');
      expect(failedResult.message).toContain('Claim uniqueness violation');
    }
    expect(batch.set).not.toHaveBeenCalled();
  });
});
