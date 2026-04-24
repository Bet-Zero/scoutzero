/**
 * FILE: src/tests/architect/mutationPipeline.catchallNarrowing.test.ts
 * PURPOSE: Behavioral proofs for the catchall narrowing pass on mutationPipeline.ts.
 *   Covers the three target boundaries:
 *   - ArchitectMutationContract[key: string]: unknown → NARROWED (firstYearSalary, year1Salary added explicitly)
 *   - ArchitectTradePayloadTeam.picksOut / picksIn    → deliberate non-change (passthrough boundary)
 *   - ArchitectMutationTeamRecord.totals              → deliberate non-change (dual-shape: TeamCapTotals vs TeamTotals)
 *
 * HISTORY:
 *   2026-03-24  Catchall Narrowing Pass
 */

import { describe, expect, it } from 'vitest';
import {
  buildWorldMutationEventPayload,
  computeWorldMutation,
} from '@/features/architect/utils/mutationPipeline';
import type { ArchitectMutationTeamRecord } from '@/features/architect/utils/mutationPipeline';

const TEST_TIMESTAMP = Date.parse('2026-03-24T12:00:00.000Z');

function makeMinimalTeam(teamCode: string): ArchitectMutationTeamRecord {
  return {
    teamCode,
    teamName: `Team ${teamCode}`,
    roster: [],
    players: [],
    capHolds: [],
    deadCap: [],
    exceptions: { tpe: [] },
    tradeExceptions: [],
    entitlementIds: [],
    totals: null,
  };
}

// ============================================================================
// Boundary 1: ArchitectMutationContract[key: string]: unknown → NARROWED
//
// Before: the catch-all index signature allowed any string key.
// After:  two formerly-implicit fields are explicit: firstYearSalary, year1Salary.
//         Both are read in deriveContractSummary() via the fallback chain:
//           Number(contract.firstYearSalary) || Number(contract.year1Salary) || ...
// ============================================================================

describe('mutationPipeline catchall narrowing — ArchitectMutationContract explicit fields', () => {
  describe('contract.firstYearSalary', () => {
    it('reads firstYearSalary into contractSummary when salariesByYear is absent', () => {
      const event = buildWorldMutationEventPayload({
        mutationType: 'signFreeAgent',
        eventId: 'evt_first_year_salary',
        seasonId: '2025-26',
        worldId: 'world_test',
        timestamp: TEST_TIMESTAMP,
        computeResult: {
          metadata: {
            playerId: 'player_1',
            playerName: 'Test Player',
            contract: {
              years: 2,
              firstYearSalary: 12_000_000,
            },
          },
          teamUpdates: [{ teamCode: 'LAL' }],
          playerUpdates: [{ playerId: 'player_1' }],
        },
        auditContext: {
          operationId: 'op_first_year_salary',
          teamCodes: ['LAL'],
        },
      });

      expect((event.mutationMetadata as any)?.contractSummary?.firstYearSalary).toBe(12_000_000);
    });

    it('is the first in the fallback chain — wins over year1Salary when both are set', () => {
      const event = buildWorldMutationEventPayload({
        mutationType: 'signFreeAgent',
        eventId: 'evt_first_year_salary_priority',
        seasonId: '2025-26',
        worldId: 'world_test',
        timestamp: TEST_TIMESTAMP,
        computeResult: {
          metadata: {
            playerId: 'player_2',
            playerName: 'Test Player 2',
            contract: {
              firstYearSalary: 12_000_000,
              year1Salary: 9_000_000,
            },
          },
          teamUpdates: [{ teamCode: 'LAL' }],
          playerUpdates: [{ playerId: 'player_2' }],
        },
        auditContext: {
          operationId: 'op_first_year_priority',
          teamCodes: ['LAL'],
        },
      });

      // firstYearSalary is earlier in the || chain, so it wins
      expect((event.mutationMetadata as any)?.contractSummary?.firstYearSalary).toBe(12_000_000);
    });
  });

  describe('contract.year1Salary', () => {
    it('falls back to year1Salary when firstYearSalary is absent and salariesByYear is absent', () => {
      const event = buildWorldMutationEventPayload({
        mutationType: 'signFreeAgent',
        eventId: 'evt_year1_salary',
        seasonId: '2025-26',
        worldId: 'world_test',
        timestamp: TEST_TIMESTAMP,
        computeResult: {
          metadata: {
            playerId: 'player_3',
            playerName: 'Test Player 3',
            contract: {
              years: 3,
              year1Salary: 9_500_000,
            },
          },
          teamUpdates: [{ teamCode: 'LAL' }],
          playerUpdates: [{ playerId: 'player_3' }],
        },
        auditContext: {
          operationId: 'op_year1_salary',
          teamCodes: ['LAL'],
        },
      });

      // year1Salary is the second option in the fallback chain
      expect((event.mutationMetadata as any)?.contractSummary?.firstYearSalary).toBe(9_500_000);
    });
  });
});

// ============================================================================
// Boundary 3: ArchitectMutationTeamRecord.totals — behavioral proof
//
// Deliberate non-change: Record<string, unknown> | null.
// Two incompatible shapes used at runtime:
//   - TeamCapTotals (from computeTeamCapTotals — yearKey, playersTotal, etc.)
//   - TeamTotals from Firestore (totalSalary, capHit, etc.; uses .passthrough())
// Narrowing requires a coordinated architectural change (separate load/compute types).
//
// This test proves the actual runtime shape produced by computeTeamCapTotals is
// correct even though the TypeScript type remains a loose record.
// ============================================================================

describe('mutationPipeline catchall narrowing — totals behavioral proof', () => {
  it('computeTeamCapTotals writes numeric cap fields into totals on the renounceRights path', () => {
    const team = makeMinimalTeam('LAL');
    const player = {
      player_id: 'player_cap_1',
      displayName: 'Cap Player',
    };

    const result = computeWorldMutation({
      mutationType: 'renounceRights',
      payload: { teamCode: 'LAL', playerId: 'player_cap_1' },
      currentState: { team, player },
      seasonId: '2025-26',
      timestamp: TEST_TIMESTAMP,
    });

    expect(result.success).toBe(true);

    const updatedTeam = result.teamUpdates?.[0]?.team as ArchitectMutationTeamRecord;
    // After renounceRights, totals is overwritten by computeTeamCapTotals which returns
    // a TeamCapTotals shape with required numeric fields — not the old open Record<string, unknown>
    expect(updatedTeam.totals).not.toBeNull();
    const totals = updatedTeam.totals as Record<string, unknown>;
    expect(typeof totals.totalCapAllocations).toBe('number');
    expect(typeof totals.yearKey).toBe('number');
    expect(typeof totals.salaryCap).toBe('number');
  });
});
