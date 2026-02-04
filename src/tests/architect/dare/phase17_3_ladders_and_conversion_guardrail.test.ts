/**
 * @file phase17_3_ladders_and_conversion_guardrail.test.ts
 * @description Phase 17.3 Guardrail Tests - Multi-year ladder roll-forward, conversion to 2RP,
 *              final tier expiry, and deterministic write ordering
 *
 * PURPOSE: Verify the DARE engine correctly handles:
 *   - A) ROLL FORWARD: Protection triggers → new entitlement for next year
 *   - B) CONVERT TO 2RP: Protection triggers conversion → new round=2 entitlement
 *   - C) FINAL YEAR CANCEL/EXPIRE: Last ladder tier → expired, no new entitlement
 *   - D) CONVEYS: Position outside protection → conveyed, no new entitlement
 *   - E) DETERMINISTIC ORDERING: Same inputs → same output order
 *
 * OWNERSHIP: Feature: architect/entitlements
 * PHASE: PST 17.3
 *
 * HISTORY:
 *  - 2026-02-04: Created for Phase 17.3 verification
 */

import { describe, it, expect } from 'vitest';

// Import resolution adapter
import { resolveConveyanceForEntitlement } from '@/features/architect/utils/entitlements/dare/conveyanceResolutionAdapter';

// Import entitlement mutator functions
import {
  buildEntitlementWritesFromResolution,
  buildRolledEntitlementDoc,
  buildConvertedEntitlementDoc,
  buildResolvedEntitlementDoc,
  buildTeamUpdatesFromResolutions,
  _testExports,
} from '@/features/architect/utils/entitlements/dare/entitlementMutator';

// Import types
import type { EntitlementResolution } from '@/features/architect/utils/entitlements/dare/types';
import type { EffectiveEntitlement } from '@/features/architect/utils/entitlements/entitlementResolver';

const { updatePickIdYear, updatePickIdRound } = _testExports;

// =============================================================================
// TEST FIXTURES
// =============================================================================

function makeEntitlement(
  id: string,
  holderTeam: string,
  underlyingPickId: string,
  seasonYear: number,
  round: number = 1
): EffectiveEntitlement {
  return {
    id,
    kind: 'pick_ownership',
    holderTeam,
    underlyingPickId,
    seasonYear,
    round,
    description: `${holderTeam} owns ${underlyingPickId}`,
    underlyingStatus: 'clean',
  };
}

function makeLadder(
  tiers: Array<{
    year: number;
    condition: string;
    ifTriggered: 'roll' | 'convey' | 'cancel' | 'convert';
    rollToYear?: number;
    convertToRound?: number;
  }>
) {
  return tiers.map((t) => ({
    year: t.year,
    condition: t.condition,
    ifTriggered: t.ifTriggered,
    rollToYear: t.rollToYear,
    convertToRound: t.convertToRound,
  }));
}

// =============================================================================
// SCENARIO A: LADDER ROLL FORWARD (Year N → Year N+1)
// =============================================================================

describe('Phase 17.3 - Ladder Roll Forward', () => {
  it('should roll entitlement to next year when protection triggers in year 1', () => {
    const entitlement = makeEntitlement(
      'ent-roll-1',
      'LAL',
      'BOS_2026_1st',
      2026
    );

    const ladder = makeLadder([
      {
        year: 2026,
        condition: 'Top 10',
        ifTriggered: 'roll',
        rollToYear: 2027,
      },
      { year: 2027, condition: 'Top 5', ifTriggered: 'roll', rollToYear: 2028 },
      { year: 2028, condition: 'Unprotected', ifTriggered: 'convey' },
    ]);

    const positionsMap = { BOS: 8 }; // Position 8 triggers Top 10 protection

    const resolution = resolveConveyanceForEntitlement(
      entitlement,
      positionsMap,
      ladder,
      { draftYear: 2026 }
    );

    // Verify resolution outcome
    expect(resolution.outcome).toBe('rolled');
    expect(resolution.newYear).toBe(2027);
    expect(resolution.newEntitlementId).toBeDefined();
    expect(resolution.position).toBe(8);
    expect(resolution.newProtection).toBe('Top 5');

    // Verify entitlement writes
    const writes = buildEntitlementWritesFromResolution(
      'world-1',
      entitlement,
      resolution,
      new Date().toISOString()
    );

    expect(writes).toHaveLength(2); // Original resolved + new rolled

    // Write 1: Original marked resolved
    const resolvedWrite = writes.find((w) => w.entitlementId === 'ent-roll-1');
    expect(resolvedWrite).toBeDefined();
    expect(resolvedWrite!.document!.resolved).toBe(true);
    expect(resolvedWrite!.document!.resolvedOutcome).toBe('rolled');
    expect(resolvedWrite!.document!.rolledToEntitlementId).toBe(
      resolution.newEntitlementId
    );

    // Write 2: New entitlement for next year
    const rolledWrite = writes.find(
      (w) => w.entitlementId === resolution.newEntitlementId
    );
    expect(rolledWrite).toBeDefined();
    expect(rolledWrite!.document!.seasonYear).toBe(2027);
    expect(rolledWrite!.document!.holderTeam).toBe('LAL');
    expect(rolledWrite!.document!.underlyingPickId).toBe('BOS_2027_1st');
    expect(rolledWrite!.document!.rolledFromEntitlementId).toBe('ent-roll-1');
    expect(rolledWrite!.document!.rolledFromYear).toBe(2026);
  });

  it('should include correct metadata for rolled entitlement (fromYear/toYear)', () => {
    const entitlement = makeEntitlement(
      'ent-roll-2',
      'MIA',
      'CHI_2026_1st',
      2026
    );

    const ladder = makeLadder([
      {
        year: 2026,
        condition: 'Lottery',
        ifTriggered: 'roll',
        rollToYear: 2027,
      },
      { year: 2027, condition: 'Unprotected', ifTriggered: 'convey' },
    ]);

    const positionsMap = { CHI: 12 }; // Lottery (1-14) triggers

    const resolution = resolveConveyanceForEntitlement(
      entitlement,
      positionsMap,
      ladder,
      { draftYear: 2026 }
    );

    expect(resolution.outcome).toBe('rolled');

    const rolledDoc = buildRolledEntitlementDoc(
      entitlement,
      resolution,
      new Date().toISOString()
    );

    // Verify metadata fields
    expect(rolledDoc.rolledFromEntitlementId).toBe('ent-roll-2');
    expect(rolledDoc.rolledFromYear).toBe(2026);
    expect(rolledDoc.seasonYear).toBe(2027);
    expect(rolledDoc.underlyingPickId).toContain('2027');
  });
});

// =============================================================================
// SCENARIO B: FINAL TIER EXPIRES/CANCELS
// =============================================================================

describe('Phase 17.3 - Final Tier Expires', () => {
  it('should expire entitlement when final tier protection triggers with cancel', () => {
    const entitlement = makeEntitlement(
      'ent-final-1',
      'NYK',
      'ORL_2026_1st',
      2026
    );

    // Single tier with cancel = final year
    const ladder = makeLadder([
      { year: 2026, condition: 'Top 3', ifTriggered: 'cancel' },
    ]);

    const positionsMap = { ORL: 2 }; // Position 2 triggers Top 3

    const resolution = resolveConveyanceForEntitlement(
      entitlement,
      positionsMap,
      ladder,
      { draftYear: 2026 }
    );

    // Verify resolution outcome
    expect(resolution.outcome).toBe('expired');
    expect(resolution.newEntitlementId).toBeUndefined();

    // Verify only one write (mark resolved, no new entitlement)
    const writes = buildEntitlementWritesFromResolution(
      'world-1',
      entitlement,
      resolution,
      new Date().toISOString()
    );

    expect(writes).toHaveLength(1);
    expect(writes[0].entitlementId).toBe('ent-final-1');
    expect(writes[0].document!.resolved).toBe(true);
    expect(writes[0].document!.resolvedOutcome).toBe('expired');
  });

  it('should expire entitlement at final ladder year even without explicit cancel', () => {
    const entitlement = makeEntitlement(
      'ent-final-2',
      'PHX',
      'DET_2028_1st',
      2028
    );

    // Final year of a multi-year ladder (no more tiers after 2028)
    const ladder = makeLadder([
      {
        year: 2026,
        condition: 'Top 10',
        ifTriggered: 'roll',
        rollToYear: 2027,
      },
      { year: 2027, condition: 'Top 5', ifTriggered: 'roll', rollToYear: 2028 },
      { year: 2028, condition: 'Top 3', ifTriggered: 'cancel' }, // Final tier
    ]);

    const positionsMap = { DET: 3 }; // Position 3 triggers Top 3

    const resolution = resolveConveyanceForEntitlement(
      entitlement,
      positionsMap,
      ladder,
      { draftYear: 2028 }
    );

    expect(resolution.outcome).toBe('expired');
    expect(resolution.newEntitlementId).toBeUndefined();
  });
});

// =============================================================================
// SCENARIO C: CONVERSION TO 2RP
// =============================================================================

describe('Phase 17.3 - Conversion to 2nd Round Pick', () => {
  it('should convert to 2nd round pick when conversion triggers', () => {
    const entitlement = makeEntitlement(
      'ent-conv-1',
      'ATL',
      'SAS_2026_1st',
      2026
    );

    const ladder = makeLadder([
      {
        year: 2026,
        condition: 'Lottery',
        ifTriggered: 'convert',
        convertToRound: 2,
      },
    ]);

    const positionsMap = { SAS: 5 }; // Lottery triggers conversion

    const resolution = resolveConveyanceForEntitlement(
      entitlement,
      positionsMap,
      ladder,
      { draftYear: 2026 }
    );

    // Verify resolution outcome
    expect(resolution.outcome).toBe('converted');
    expect(resolution.convertedToRound).toBe(2);
    expect(resolution.newEntitlementId).toBeDefined();

    // Verify entitlement writes
    const writes = buildEntitlementWritesFromResolution(
      'world-1',
      entitlement,
      resolution,
      new Date().toISOString()
    );

    expect(writes).toHaveLength(2); // Original resolved + new converted

    // Write 1: Original marked resolved
    const resolvedWrite = writes.find((w) => w.entitlementId === 'ent-conv-1');
    expect(resolvedWrite!.document!.resolved).toBe(true);
    expect(resolvedWrite!.document!.resolvedOutcome).toBe('converted');
    expect(resolvedWrite!.document!.convertedToEntitlementId).toBe(
      resolution.newEntitlementId
    );

    // Write 2: New entitlement with round=2
    const convertedWrite = writes.find(
      (w) => w.entitlementId === resolution.newEntitlementId
    );
    expect(convertedWrite!.document!.round).toBe(2);
    expect(convertedWrite!.document!.holderTeam).toBe('ATL');
    expect(convertedWrite!.document!.underlyingPickId).toBe('SAS_2026_2nd');
    expect(convertedWrite!.document!.convertedFromEntitlementId).toBe(
      'ent-conv-1'
    );
    expect(convertedWrite!.document!.convertedFromRound).toBe(1);
  });

  it('should build correct converted entitlement doc with proper pickId', () => {
    const entitlement = makeEntitlement(
      'ent-conv-2',
      'MEM',
      'HOU_2026_1st',
      2026
    );

    const resolution: EntitlementResolution = {
      entitlementId: 'ent-conv-2',
      outcome: 'converted',
      year: 2026,
      position: 10,
      originalOwner: 'MEM',
      newEntitlementId: 'ent-conv-2-to-2nd',
      convertedToRound: 2,
      reason: 'Protection triggered conversion',
      resolvedAt: new Date().toISOString(),
      method: 'lottery',
    };

    const convertedDoc = buildConvertedEntitlementDoc(
      entitlement,
      resolution,
      new Date().toISOString()
    );

    expect(convertedDoc.round).toBe(2);
    expect(convertedDoc.underlyingPickId).toBe('HOU_2026_2nd');
    expect(convertedDoc.convertedFromEntitlementId).toBe('ent-conv-2');
    expect(convertedDoc.convertedFromRound).toBe(1);
    expect(convertedDoc.seasonYear).toBe(2026); // Same year for conversion
  });
});

// =============================================================================
// SCENARIO D: NON-TRIGGER (CONVEYS)
// =============================================================================

describe('Phase 17.3 - Non-Trigger Conveys', () => {
  it('should convey when position is outside protection range', () => {
    const entitlement = makeEntitlement(
      'ent-convey-1',
      'BKN',
      'WAS_2026_1st',
      2026
    );

    const ladder = makeLadder([
      {
        year: 2026,
        condition: 'Top 10',
        ifTriggered: 'roll',
        rollToYear: 2027,
      },
      { year: 2027, condition: 'Unprotected', ifTriggered: 'convey' },
    ]);

    const positionsMap = { WAS: 15 }; // Position 15 is outside Top 10

    const resolution = resolveConveyanceForEntitlement(
      entitlement,
      positionsMap,
      ladder,
      { draftYear: 2026 }
    );

    // Verify resolution outcome
    expect(resolution.outcome).toBe('conveyed');
    expect(resolution.position).toBe(15);
    expect(resolution.newEntitlementId).toBeUndefined();
    expect(resolution.newYear).toBeUndefined();

    // Verify only one write (mark resolved, no new entitlement)
    const writes = buildEntitlementWritesFromResolution(
      'world-1',
      entitlement,
      resolution,
      new Date().toISOString()
    );

    expect(writes).toHaveLength(1);
    expect(writes[0].document!.resolved).toBe(true);
    expect(writes[0].document!.resolvedOutcome).toBe('conveyed');
  });

  it('should convey unprotected pick regardless of position', () => {
    const entitlement = makeEntitlement(
      'ent-convey-2',
      'LAC',
      'MIN_2026_1st',
      2026
    );

    // No protection ladder = unprotected
    const ladder = null;

    const positionsMap = { MIN: 1 }; // Even #1 pick conveys if unprotected

    const resolution = resolveConveyanceForEntitlement(
      entitlement,
      positionsMap,
      ladder,
      { draftYear: 2026 }
    );

    expect(resolution.outcome).toBe('conveyed');
    expect(resolution.position).toBe(1);
    expect(resolution.newEntitlementId).toBeUndefined();
  });
});

// =============================================================================
// SCENARIO E: DETERMINISTIC WRITE ORDERING
// =============================================================================

describe('Phase 17.3 - Deterministic Write Ordering', () => {
  it('should produce deterministic team updates regardless of resolution order', () => {
    const teams = [
      { teamCode: 'BOS', entitlementIds: ['ent-a', 'ent-b'] },
      { teamCode: 'LAL', entitlementIds: ['ent-c'] },
      { teamCode: 'ATL', entitlementIds: ['ent-d'] },
    ];

    const resolutions1: EntitlementResolution[] = [
      {
        entitlementId: 'ent-a',
        outcome: 'conveyed',
        year: 2026,
        originalOwner: 'BOS',
        reason: 'Conveyed',
        resolvedAt: '2026-01-01T00:00:00Z',
        method: 'lottery',
      },
      {
        entitlementId: 'ent-c',
        outcome: 'rolled',
        year: 2026,
        originalOwner: 'LAL',
        newEntitlementId: 'ent-c-rolled',
        reason: 'Rolled',
        resolvedAt: '2026-01-01T00:00:00Z',
        method: 'lottery',
      },
      {
        entitlementId: 'ent-d',
        outcome: 'converted',
        year: 2026,
        originalOwner: 'ATL',
        newEntitlementId: 'ent-d-conv',
        reason: 'Converted',
        resolvedAt: '2026-01-01T00:00:00Z',
        method: 'lottery',
      },
    ];

    // Same resolutions in different order
    const resolutions2: EntitlementResolution[] = [
      resolutions1[2],
      resolutions1[0],
      resolutions1[1],
    ];

    const updates1 = buildTeamUpdatesFromResolutions(teams, resolutions1);
    const updates2 = buildTeamUpdatesFromResolutions(teams, resolutions2);

    // Both should produce same team updates (sorted by teamCode)
    const sortedUpdates1 = [...updates1].sort((a, b) =>
      a.teamCode.localeCompare(b.teamCode)
    );
    const sortedUpdates2 = [...updates2].sort((a, b) =>
      a.teamCode.localeCompare(b.teamCode)
    );

    expect(sortedUpdates1).toEqual(sortedUpdates2);

    // Verify specific updates
    const bosUpdate = sortedUpdates1.find((u) => u.teamCode === 'BOS');
    expect(bosUpdate!.removedIds).toContain('ent-a');
    expect(bosUpdate!.entitlementIds).toContain('ent-b'); // ent-b unchanged

    const lalUpdate = sortedUpdates1.find((u) => u.teamCode === 'LAL');
    expect(lalUpdate!.removedIds).toContain('ent-c');
    expect(lalUpdate!.addedIds).toContain('ent-c-rolled');

    const atlUpdate = sortedUpdates1.find((u) => u.teamCode === 'ATL');
    expect(atlUpdate!.removedIds).toContain('ent-d');
    expect(atlUpdate!.addedIds).toContain('ent-d-conv');
  });

  it('should produce consistent entitlement writes for same input', () => {
    const entitlement = makeEntitlement(
      'ent-det-1',
      'CLE',
      'IND_2026_1st',
      2026
    );

    const ladder = makeLadder([
      { year: 2026, condition: 'Top 5', ifTriggered: 'roll', rollToYear: 2027 },
      { year: 2027, condition: 'Unprotected', ifTriggered: 'convey' },
    ]);

    const positionsMap = { IND: 3 }; // Triggers Top 5

    // Run resolution multiple times
    const resolution1 = resolveConveyanceForEntitlement(
      entitlement,
      positionsMap,
      ladder,
      { draftYear: 2026 }
    );

    const resolution2 = resolveConveyanceForEntitlement(
      entitlement,
      positionsMap,
      ladder,
      { draftYear: 2026 }
    );

    // Outcomes should match (excluding timestamps and generated IDs)
    expect(resolution1.outcome).toBe(resolution2.outcome);
    expect(resolution1.newYear).toBe(resolution2.newYear);
    expect(resolution1.newProtection).toBe(resolution2.newProtection);
    expect(resolution1.position).toBe(resolution2.position);
  });
});

// =============================================================================
// HELPER TESTS
// =============================================================================

describe('Phase 17.3 - Pick ID Helpers', () => {
  it('updatePickIdYear should correctly update year in pick ID', () => {
    expect(updatePickIdYear('BOS_2026_1st', 2027)).toBe('BOS_2027_1st');
    expect(updatePickIdYear('LAL_2025_2nd', 2028)).toBe('LAL_2028_2nd');
    expect(updatePickIdYear(undefined, 2027)).toBeUndefined();
  });

  it('updatePickIdRound should correctly update round in pick ID', () => {
    expect(updatePickIdRound('BOS_2026_1st', '2nd')).toBe('BOS_2026_2nd');
    expect(updatePickIdRound('LAL_2027_2nd', '1st')).toBe('LAL_2027_1st');
    expect(updatePickIdRound(undefined, '2nd')).toBeUndefined();
  });
});
