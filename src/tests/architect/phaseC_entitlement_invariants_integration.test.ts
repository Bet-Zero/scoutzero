/**
 * FILE: src/tests/architect/phaseC_entitlement_invariants_integration.test.ts
 * PURPOSE: Phase C integration tests for entitlement invariants B5/B6.
 *          Verifies invariants prevent illegal world states on mutation paths.
 * OWNERSHIP: Feature: architect/core
 *
 * HISTORY:
 *  - 2026-02-04: Phase C - Entitlement invariants integration verification
 *
 * TESTED INVARIANTS:
 *  - B5: No entitlement ID can exist on more than one team
 *  - B6: Pick-slot accounting remains valid for audited year range
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateMutationEntitlementInvariants,
  validateNoDuplicateEntitlements,
  validatePickSlotAccounting,
} from '@/features/architect/utils/leagueInvariants';

// =============================================================================
// MOCKS
// =============================================================================

const mocks = vi.hoisted(() => ({
  mockGetLeague: vi.fn(),
}));

// Mock teamLoader (getLeague is the only read-side dependency for entitlement invariants)
vi.mock('@/features/architect/utils/teamLoader', () => ({
  getLeague: mocks.mockGetLeague,
}));

// Mock Firestore (not directly used in these tests, but prevents import errors)
vi.mock('@/firebaseConfig', () => ({
  db: { type: 'mock-firestore' },
}));

// =============================================================================
// TEST DATA FACTORIES
// =============================================================================

type PhaseCTestEntitlement = {
  id: string;
  kind: string;
  seasonYear: number;
  round: number;
  underlyingPickId: string;
};

type PhaseCTestTeam = {
  teamCode: string;
  entitlementIds: string[];
  entitlements: PhaseCTestEntitlement[];
  roster: [];
  players: [];
  totals: Record<string, never>;
};

/**
 * Create a minimal team with entitlementIds (for B5 tests)
 */
function createTeam(
  teamCode: string,
  entitlementIds: string[] = [],
  entitlements: Array<{
    id: string;
    kind: string;
    seasonYear: number;
    round: number;
    underlyingPickId: string;
  }> = []
): PhaseCTestTeam {
  return {
    teamCode,
    entitlementIds,
    entitlements,
    roster: [],
    players: [],
    totals: {},
  };
}

/**
 * Create a pick_ownership entitlement
 */
function createPickOwnership(
  teamCode: string,
  year: number,
  round: number,
  holderTeam?: string
): {
  id: string;
  kind: string;
  seasonYear: number;
  round: number;
  underlyingPickId: string;
  holderTeam: string;
} {
  const roundSuffix = round === 1 ? '1st' : '2nd';
  const id = `ent:${teamCode}:${year}:${round}:own:${Math.random().toString(36).slice(2, 10)}`;
  return {
    id,
    kind: 'pick_ownership',
    seasonYear: year,
    round,
    underlyingPickId: `${teamCode}_${year}_${roundSuffix}`,
    holderTeam: holderTeam || teamCode,
  };
}

/**
 * Create a swap_right entitlement (should NOT count for B6 slot accounting)
 */
function createSwapRight(
  controllerTeam: string,
  targetTeam: string,
  year: number,
  round: number
): {
  id: string;
  kind: string;
  seasonYear: number;
  round: number;
  underlyingPickId: string;
  swapControllerPickId: string;
} {
  const roundSuffix = round === 1 ? '1st' : '2nd';
  const id = `ent:${controllerTeam}:${year}:${round}:swap:${Math.random().toString(36).slice(2, 10)}`;
  return {
    id,
    kind: 'swap_right',
    seasonYear: year,
    round,
    underlyingPickId: `${targetTeam}_${year}_${roundSuffix}`,
    swapControllerPickId: `${controllerTeam}_${year}_${roundSuffix}`,
  };
}

/**
 * Create a conveyance_right entitlement (should NOT count for B6 slot accounting)
 */
function createConveyanceRight(
  holderTeam: string,
  poolTeams: string[],
  year: number,
  round: number
): {
  id: string;
  kind: string;
  seasonYear: number;
  round: number;
  poolUnderlyingPickIds: string[];
  receivesRank: number[];
  receivesComparator: string;
} {
  const roundSuffix = round === 1 ? '1st' : '2nd';
  const id = `ent:${holderTeam}:${year}:${round}:conv:${Math.random().toString(36).slice(2, 10)}`;
  return {
    id,
    kind: 'conveyance_right',
    seasonYear: year,
    round,
    poolUnderlyingPickIds: poolTeams.map((t) => `${t}_${year}_${roundSuffix}`),
    receivesRank: [1],
    receivesComparator: 'less_favorable',
  };
}

// =============================================================================
// PHASE C TESTS: B5 (Duplicate Entitlement Blocking)
// =============================================================================

describe('Phase C: Entitlement Invariants Integration', () => {
  const WORLD_ID = 'world-phase-c-test';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('B5: Duplicate Entitlement Prevention', () => {
    describe('C1: Blocks mutation when world already contains duplicate entitlement ownership', () => {
      it('should detect pre-existing duplicate entitlements via validateNoDuplicateEntitlements', () => {
        // Seed: Both LAL and BOS claim the same entitlement
        const duplicateEntId = 'ent:LAL:2026:1:own:DUPLICATE';
        const teams = [
          createTeam('LAL', [duplicateEntId, 'ent:LAL:2026:2:own:a1']),
          createTeam('BOS', [duplicateEntId, 'ent:BOS:2026:1:own:b1']),
          createTeam('MIA', ['ent:MIA:2026:1:own:c1']),
        ];

        const result = validateNoDuplicateEntitlements(teams);

        expect(result.valid).toBe(false);
        expect(result.error).toContain(duplicateEntId);
        expect(result.error).toContain('LAL');
        expect(result.error).toContain('BOS');
        expect(result.duplicates).toHaveLength(1);
        expect(result.duplicates![0].entitlementId).toBe(duplicateEntId);
        expect(result.duplicates![0].teams).toEqual(
          expect.arrayContaining(['LAL', 'BOS'])
        );
      });

      it('should block executeTrade mutation when pre-existing duplicates detected in league', async () => {
        // Seed world with pre-existing duplicate (illegal state)
        const duplicateEntId = 'ent:CHI:2027:1:own:ALREADY_DUP';
        const existingLeague = [
          createTeam('LAL', ['ent:LAL:2026:1:own:a1']),
          createTeam('BOS', ['ent:BOS:2026:1:own:b1']),
          createTeam('CHI', [duplicateEntId]), // CHI has this
          createTeam('MIA', [duplicateEntId]), // MIA also has this (DUPLICATE!)
        ];
        mocks.mockGetLeague.mockResolvedValue(existingLeague);

        // Attempt any trade mutation (LAL <-> BOS)
        const computeResult = {
          teamUpdates: [
            {
              teamCode: 'LAL',
              team: createTeam('LAL', [
                'ent:LAL:2026:1:own:a1',
                'ent:BOS:2026:1:own:b1',
              ]),
            },
            { teamCode: 'BOS', team: createTeam('BOS', []) },
          ],
        };

        const result = await validateMutationEntitlementInvariants(
          WORLD_ID,
          'executeTrade',
          computeResult
        );

        expect(result.valid).toBe(false);
        expect(result.error).toContain(duplicateEntId);
        expect(result.duplicates).toHaveLength(1);
      });
    });

    describe('C2: Blocks mutation that would create duplicates post-mutation', () => {
      it('should block trade that transfers entitlement already on another team', async () => {
        // Seed world with clean state
        const contestedEntId = 'ent:BOS:2026:1:own:CONTESTED';
        const existingLeague = [
          createTeam('LAL', ['ent:LAL:2026:1:own:a1']),
          createTeam('BOS', [contestedEntId]),
          createTeam('MIA', ['ent:MIA:2026:1:own:c1']),
        ];
        mocks.mockGetLeague.mockResolvedValue(existingLeague);

        // Trade result: LAL receives contestedEntId, but BOS doesn't remove it (bug simulation)
        // This creates a post-trade state where both LAL and BOS have contestedEntId
        const computeResult = {
          teamUpdates: [
            {
              teamCode: 'LAL',
              team: createTeam('LAL', [
                'ent:LAL:2026:1:own:a1',
                contestedEntId,
              ]),
            },
            {
              teamCode: 'BOS',
              team: createTeam('BOS', [contestedEntId]), // BOS still has it! (BUG)
            },
          ],
        };

        const result = await validateMutationEntitlementInvariants(
          WORLD_ID,
          'executeTrade',
          computeResult
        );

        expect(result.valid).toBe(false);
        expect(result.error).toContain(contestedEntId);
        expect(result.error).toContain('LAL');
        expect(result.error).toContain('BOS');
        expect(result.duplicates).toHaveLength(1);
      });

      it('should pass when trade properly transfers entitlement (no duplicates)', async () => {
        // Seed world with clean state
        const transferredEntId = 'ent:BOS:2026:1:own:TRANSFERRED';
        const existingLeague = [
          createTeam('LAL', ['ent:LAL:2026:1:own:a1']),
          createTeam('BOS', [transferredEntId]),
          createTeam('MIA', ['ent:MIA:2026:1:own:c1']),
        ];
        mocks.mockGetLeague.mockResolvedValue(existingLeague);

        // Trade result: LAL receives entitlement, BOS removes it (correct behavior)
        const computeResult = {
          teamUpdates: [
            {
              teamCode: 'LAL',
              team: createTeam('LAL', [
                'ent:LAL:2026:1:own:a1',
                transferredEntId,
              ]),
            },
            {
              teamCode: 'BOS',
              team: createTeam('BOS', []), // BOS removed it correctly
            },
          ],
        };

        const result = await validateMutationEntitlementInvariants(
          WORLD_ID,
          'executeTrade',
          computeResult
        );

        expect(result.valid).toBe(true);
        expect(result.duplicates).toBeUndefined();
      });
    });

    describe('Mutation type filtering', () => {
      it('should skip validation for non-trade mutations (always pass)', async () => {
        // Even with a "bad" getLeague, non-trade mutations pass
        mocks.mockGetLeague.mockResolvedValue([
          createTeam('LAL', ['ent:DUPLICATE']),
          createTeam('BOS', ['ent:DUPLICATE']),
        ]);

        // Test signing mutation
        const signingResult = await validateMutationEntitlementInvariants(
          WORLD_ID,
          'executeSigning',
          {}
        );
        expect(signingResult.valid).toBe(true);

        // Test waive mutation
        const waiveResult = await validateMutationEntitlementInvariants(
          WORLD_ID,
          'executeWaive',
          {}
        );
        expect(waiveResult.valid).toBe(true);
      });

      it('should skip validation when computeResult has no teamUpdates', async () => {
        mocks.mockGetLeague.mockResolvedValue([
          createTeam('LAL', ['ent:DUPLICATE']),
          createTeam('BOS', ['ent:DUPLICATE']),
        ]);

        const result = await validateMutationEntitlementInvariants(
          WORLD_ID,
          'executeTrade',
          { success: true } // No teamUpdates
        );

        expect(result.valid).toBe(true);
      });
    });
  });

  // =============================================================================
  // PHASE C TESTS: B6 (Pick Slot Accounting)
  // =============================================================================

  describe('B6: Pick Slot Accounting', () => {
    const TEAM_CODES_3 = ['LAL', 'BOS', 'MIA'];
    const YEAR_RANGE_1 = [2026];

    describe('C3: B6 passes with valid slots', () => {
      it('should pass when all slots accounted for (3 teams × 2 rounds × 1 year = 6 slots)', () => {
        const teams = [
          {
            teamCode: 'LAL',
            entitlements: [
              createPickOwnership('LAL', 2026, 1),
              createPickOwnership('LAL', 2026, 2),
            ],
          },
          {
            teamCode: 'BOS',
            entitlements: [
              createPickOwnership('BOS', 2026, 1),
              createPickOwnership('BOS', 2026, 2),
            ],
          },
          {
            teamCode: 'MIA',
            entitlements: [
              createPickOwnership('MIA', 2026, 1),
              createPickOwnership('MIA', 2026, 2),
            ],
          },
        ];

        const result = validatePickSlotAccounting(
          teams,
          YEAR_RANGE_1,
          TEAM_CODES_3
        );

        expect(result.valid).toBe(true);
        expect(result.expected).toBe(6);
        expect(result.actual).toBe(6);
        expect(result.missingSlots).toBeUndefined();
        expect(result.extraSlots).toBeUndefined();
      });

      it('should pass when pick ownership is held by different team than originator', () => {
        // LAL owns BOS 2026 1st (traded pick)
        const teams = [
          {
            teamCode: 'LAL',
            entitlements: [
              createPickOwnership('LAL', 2026, 1),
              createPickOwnership('LAL', 2026, 2),
              createPickOwnership('BOS', 2026, 1, 'LAL'), // LAL owns BOS pick
            ],
          },
          {
            teamCode: 'BOS',
            entitlements: [
              // BOS 2026 1st is with LAL
              createPickOwnership('BOS', 2026, 2),
            ],
          },
          {
            teamCode: 'MIA',
            entitlements: [
              createPickOwnership('MIA', 2026, 1),
              createPickOwnership('MIA', 2026, 2),
            ],
          },
        ];

        const result = validatePickSlotAccounting(
          teams,
          YEAR_RANGE_1,
          TEAM_CODES_3
        );

        expect(result.valid).toBe(true);
        expect(result.expected).toBe(6);
        expect(result.actual).toBe(6);
      });
    });

    describe('C4: B6 blocks with missing slot', () => {
      it('should detect missing slot when pick_ownership entitlement removed', () => {
        // Missing: MIA 2026 2nd round
        const teams = [
          {
            teamCode: 'LAL',
            entitlements: [
              createPickOwnership('LAL', 2026, 1),
              createPickOwnership('LAL', 2026, 2),
            ],
          },
          {
            teamCode: 'BOS',
            entitlements: [
              createPickOwnership('BOS', 2026, 1),
              createPickOwnership('BOS', 2026, 2),
            ],
          },
          {
            teamCode: 'MIA',
            entitlements: [
              createPickOwnership('MIA', 2026, 1),
              // MISSING: MIA 2026 2nd
            ],
          },
        ];

        const result = validatePickSlotAccounting(
          teams,
          YEAR_RANGE_1,
          TEAM_CODES_3
        );

        expect(result.valid).toBe(false);
        expect(result.error).toContain('Missing: 1');
        expect(result.expected).toBe(6);
        expect(result.actual).toBe(5);
        expect(result.missingSlots).toHaveLength(1);
        expect(result.missingSlots![0]).toMatchObject({
          year: 2026,
          round: 2,
          team: 'MIA',
        });
      });

      it('should detect multiple missing slots across years', () => {
        const yearRange = [2026, 2027];
        const teams = [
          {
            teamCode: 'LAL',
            entitlements: [
              createPickOwnership('LAL', 2026, 1),
              createPickOwnership('LAL', 2026, 2),
              // MISSING: LAL 2027 1st and 2nd
            ],
          },
          {
            teamCode: 'BOS',
            entitlements: [
              createPickOwnership('BOS', 2026, 1),
              createPickOwnership('BOS', 2026, 2),
              createPickOwnership('BOS', 2027, 1),
              createPickOwnership('BOS', 2027, 2),
            ],
          },
          {
            teamCode: 'MIA',
            entitlements: [
              createPickOwnership('MIA', 2026, 1),
              createPickOwnership('MIA', 2026, 2),
              createPickOwnership('MIA', 2027, 1),
              createPickOwnership('MIA', 2027, 2),
            ],
          },
        ];

        const result = validatePickSlotAccounting(
          teams,
          yearRange,
          TEAM_CODES_3
        );

        expect(result.valid).toBe(false);
        expect(result.expected).toBe(12); // 3 teams × 2 rounds × 2 years
        expect(result.actual).toBe(10);
        expect(result.missingSlots).toHaveLength(2);
        expect(result.missingSlots).toEqual(
          expect.arrayContaining([
            { year: 2027, round: 1, team: 'LAL' },
            { year: 2027, round: 2, team: 'LAL' },
          ])
        );
      });

      it('should detect altered underlyingPickId that creates missing slot', () => {
        // BOS 2026 1st has wrong underlyingPickId, creating orphan slot
        const teams = [
          {
            teamCode: 'LAL',
            entitlements: [
              createPickOwnership('LAL', 2026, 1),
              createPickOwnership('LAL', 2026, 2),
            ],
          },
          {
            teamCode: 'BOS',
            entitlements: [
              {
                id: 'ent:BOS:2026:1:own:corrupted',
                kind: 'pick_ownership',
                seasonYear: 2026,
                round: 1,
                underlyingPickId: 'WRONG_FORMAT', // Invalid format - won't parse
                holderTeam: 'BOS',
              },
              createPickOwnership('BOS', 2026, 2),
            ],
          },
          {
            teamCode: 'MIA',
            entitlements: [
              createPickOwnership('MIA', 2026, 1),
              createPickOwnership('MIA', 2026, 2),
            ],
          },
        ];

        const result = validatePickSlotAccounting(
          teams,
          YEAR_RANGE_1,
          TEAM_CODES_3
        );

        expect(result.valid).toBe(false);
        expect(result.missingSlots).toHaveLength(1);
        expect(result.missingSlots![0]).toMatchObject({
          year: 2026,
          round: 1,
          team: 'BOS',
        });
      });
    });

    describe('C5: B6 ignores swap_right and conveyance_right', () => {
      it('should only count pick_ownership for slot accounting (swap_right ignored)', () => {
        const teams = [
          {
            teamCode: 'LAL',
            entitlements: [
              createPickOwnership('LAL', 2026, 1),
              createPickOwnership('LAL', 2026, 2),
              // Extra swap_right - should NOT be counted
              createSwapRight('LAL', 'BOS', 2026, 1),
            ],
          },
          {
            teamCode: 'BOS',
            entitlements: [
              createPickOwnership('BOS', 2026, 1),
              createPickOwnership('BOS', 2026, 2),
            ],
          },
          {
            teamCode: 'MIA',
            entitlements: [
              createPickOwnership('MIA', 2026, 1),
              createPickOwnership('MIA', 2026, 2),
              // Extra swap_right - should NOT be counted
              createSwapRight('MIA', 'LAL', 2026, 2),
            ],
          },
        ];

        const result = validatePickSlotAccounting(
          teams,
          YEAR_RANGE_1,
          TEAM_CODES_3
        );

        expect(result.valid).toBe(true);
        expect(result.actual).toBe(6); // Only pick_ownership counted
      });

      it('should only count pick_ownership for slot accounting (conveyance_right ignored)', () => {
        const teams = [
          {
            teamCode: 'LAL',
            entitlements: [
              createPickOwnership('LAL', 2026, 1),
              createPickOwnership('LAL', 2026, 2),
              // Extra conveyance_right - should NOT be counted
              createConveyanceRight('LAL', ['BOS', 'MIA'], 2026, 1),
            ],
          },
          {
            teamCode: 'BOS',
            entitlements: [
              createPickOwnership('BOS', 2026, 1),
              createPickOwnership('BOS', 2026, 2),
            ],
          },
          {
            teamCode: 'MIA',
            entitlements: [
              createPickOwnership('MIA', 2026, 1),
              createPickOwnership('MIA', 2026, 2),
            ],
          },
        ];

        const result = validatePickSlotAccounting(
          teams,
          YEAR_RANGE_1,
          TEAM_CODES_3
        );

        expect(result.valid).toBe(true);
        expect(result.actual).toBe(6); // Only pick_ownership counted
      });

      it('should still detect missing slot even with extra swap/conveyance rights', () => {
        const teams = [
          {
            teamCode: 'LAL',
            entitlements: [
              createPickOwnership('LAL', 2026, 1),
              // MISSING: LAL 2026 2nd
              createSwapRight('LAL', 'BOS', 2026, 2), // Swap right doesn't fill the slot!
            ],
          },
          {
            teamCode: 'BOS',
            entitlements: [
              createPickOwnership('BOS', 2026, 1),
              createPickOwnership('BOS', 2026, 2),
            ],
          },
          {
            teamCode: 'MIA',
            entitlements: [
              createPickOwnership('MIA', 2026, 1),
              createPickOwnership('MIA', 2026, 2),
              createConveyanceRight('MIA', ['LAL'], 2026, 2), // Conveyance doesn't fill LAL's slot
            ],
          },
        ];

        const result = validatePickSlotAccounting(
          teams,
          YEAR_RANGE_1,
          TEAM_CODES_3
        );

        expect(result.valid).toBe(false);
        expect(result.actual).toBe(5);
        expect(result.missingSlots).toHaveLength(1);
        expect(result.missingSlots![0]).toMatchObject({
          year: 2026,
          round: 2,
          team: 'LAL',
        });
      });
    });
  });

  // =============================================================================
  // SCOPE NOTE: B6 Integration with Mutation Pipeline
  // =============================================================================

  describe('B6 Integration Note', () => {
    it('documents that B6 (validatePickSlotAccounting) is NOT called in mutation pipeline', () => {
      /**
       * SCOPE NOTE: Per code analysis of leagueInvariants.ts:
       *
       * validateMutationEntitlementInvariants() (Phase 3.6) ONLY calls:
       *   - validateNoDuplicateEntitlements() (B5)
       *
       * It does NOT call:
       *   - validatePickSlotAccounting() (B6)
       *
       * B6 exists as a utility for:
       *   - Audit/diagnostic scripts
       *   - Future integration if full slot accounting enforcement is desired
       *
       * Decision: B6 enforcement in mutation path requires product decision on:
       *   - Performance cost (full league scan + entitlement resolution)
       *   - Scope (trade-only vs all mutations)
       *   - Error UX (what to show user when slot accounting fails)
       *
       * This test documents current behavior, NOT a gap to fix in Phase C.
       */
      expect(true).toBe(true); // Documentation test
    });
  });
});
