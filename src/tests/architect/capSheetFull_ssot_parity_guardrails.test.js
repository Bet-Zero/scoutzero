/**
 * FILE: src/tests/architect/capSheetFull_ssot_parity_guardrails.test.js
 * PURPOSE: Guardrails for CapSheetFull SSOT Parity (CAP_SHEET_E2E_SSOT_PARITY_E1)
 * OWNERSHIP: Feature: architect/cap-sheet
 *
 * HISTORY:
 *  - 2026-02-28: CAP_SHEET_E2E_SSOT_PARITY_E1 - Created
 *
 * TESTS:
 * A) Source-scan guardrails:
 *    1. CapSheetFull.tsx imports computeTeamCapTotals
 *    2. CapSheetFull.tsx does NOT contain local reduce salary summation
 *    3. computeTeamCapTotals.ts declares explicit included/excluded ownership lists
 *    4. computeTeamCapTotals.ts declares canonical-owner usage fence
 *    5. calculateTeamCapHit(...) is fenced as player-only validation math
 *    6. useCapValidation.ts declares validation-only cap-math ownership
 *    7. capLegalityValidation.ts declares action-specific validation ownership
 *
 * B) Behavioral guardrails:
 *    8. yearTotals match computeTeamCapTotals.totalCapAllocations for team with dead money
 *    9. Dead money IS included in total (regression guard)
 *    10. Incomplete roster charges ARE included in total (regression guard)
 *    11. Cap holds ARE included in total
 *    12. Adjacent exception/TPE/hard-cap surfaces do NOT alter canonical totals
 *    13. calculateTeamCapHit stays player-only while computeTeamCapTotals includes full allocations
 *    14. computeTeamCapTotals uses team.players (not team.roster) for salary computation
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import { calculateTeamCapHit } from '@/features/architect/utils/capHelpers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CAP_SHEET_FULL_PATH = path.resolve(
  __dirname,
  '../../features/architect/capSheet/CapSheetFull/CapSheetFull.tsx'
);

const COMPUTE_TOTALS_PATH = path.resolve(
  __dirname,
  '../../features/architect/utils/capTotals/computeTeamCapTotals.ts'
);

const CAP_HELPERS_PATH = path.resolve(
  __dirname,
  '../../features/architect/utils/capHelpers.ts'
);

const USE_CAP_VALIDATION_PATH = path.resolve(
  __dirname,
  '../../features/architect/hooks/useCapValidation.ts'
);

const CAP_LEGALITY_VALIDATION_PATH = path.resolve(
  __dirname,
  '../../features/architect/utils/capLegalityValidation.ts'
);

const COMPUTE_TOTALS_SHIM_PATH = path.resolve(
  __dirname,
  '../../features/architect/utils/capTotals/computeTeamCapTotals.js'
);

const YEAR = 2026; // 2025-26 season

// Helper: create players to fill or partially fill a roster
function createPlayers(count, salary = 5_000_000) {
  return Array.from({ length: count }, (_, i) => ({
    player_id: `player-${i}`,
    displayName: `Player ${i}`,
    contract: {
      contractType: 'Standard',
      salariesByYear: [
        { season: '2025-26', salary, capHit: salary },
      ],
    },
  }));
}

// ==============================================================================
// A) Source-scan guardrails
// ==============================================================================

describe('CapSheetFull SSOT Parity — Source-Scan Guardrails', () => {
  const capSheetFullSource = fs.readFileSync(CAP_SHEET_FULL_PATH, 'utf-8');
  const computeTotalsSource = fs.readFileSync(COMPUTE_TOTALS_PATH, 'utf-8');
  const capHelpersSource = fs.readFileSync(CAP_HELPERS_PATH, 'utf-8');
  const useCapValidationSource = fs.readFileSync(
    USE_CAP_VALIDATION_PATH,
    'utf-8'
  );
  const capLegalityValidationSource = fs.readFileSync(
    CAP_LEGALITY_VALIDATION_PATH,
    'utf-8'
  );

  it('TEST 1: CapSheetFull imports computeTeamCapTotals', () => {
    expect(capSheetFullSource).toMatch(/import.*computeTeamCapTotals.*from/);
  });

  it('TEST 2: CapSheetFull does NOT contain local reduce salary summation pattern', () => {
    // The old pattern was: sortedPlayers.reduce((sum, player) => {
    // with getContractYearSlice inside the reduce for yearTotals
    // We check that there's no reduce building yearTotals from player salaries
    const hasLocalReduceForTotals =
      /yearTotals\[year\]\s*=\s*sortedPlayers\.reduce/.test(capSheetFullSource);
    expect(hasLocalReduceForTotals).toBe(false);
  });

  it('TEST 3: computeTeamCapTotals declares explicit included/excluded ownership lists', () => {
    expect(computeTotalsSource).toContain('INCLUDED IN CANONICAL TOTALS');
    expect(computeTotalsSource).toContain('EXCLUDED FROM CANONICAL TOTALS');
  });

  it('TEST 4: computeTeamCapTotals declares canonical-owner usage fence', () => {
    expect(computeTotalsSource).toContain('Canonical Cap Sheet totals owner.');
    expect(computeTotalsSource).toContain(
      'Use computeTeamCapTotals(...) when a caller needs totalCapAllocations,'
    );
    expect(computeTotalsSource).toContain(
      'Do not use computeTeamCapTotals(...) for player-only validation/projection'
    );
  });

  it('TEST 5: calculateTeamCapHit is fenced as player-only validation math', () => {
    expect(capHelpersSource).toContain(
      'calculateTeamCapHit(...) keeps a historical generic name'
    );
    expect(capHelpersSource).toMatch(
      /not a Cap Sheet\s+totals authority\./
    );
    expect(capHelpersSource).toContain(
      'For full Cap Sheet allocations, use computeTeamCapTotals(...).'
    );
  });

  it('TEST 6: useCapValidation declares validation-only cap-math ownership', () => {
    expect(useCapValidationSource).toContain('CAP-MATH OWNERSHIP');
    expect(useCapValidationSource).toContain(
      'useCapValidation owns action-specific UI validation math only.'
    );
    expect(useCapValidationSource).toContain(
      'calculateValidationPlayerOnlyCapHit(...) intentionally stays player-only.'
    );
    expect(useCapValidationSource).toContain(
      'const calculateValidationPlayerOnlyCapHit ='
    );
  });

  it('TEST 7: capLegalityValidation declares action-specific validation ownership', () => {
    expect(capLegalityValidationSource).toContain(
      'This file owns action-specific validation and projection math for'
    );
    expect(capLegalityValidationSource).toContain(
      'These helpers must not become alternate Cap Sheet totals authorities.'
    );
    expect(capLegalityValidationSource).toContain(
      'const calculateValidationPlayerOnlyTeamCapHit ='
    );
    expect(capLegalityValidationSource).toContain(
      'const computeCanonicalMutationTeamCapTotals ='
    );
  });
});

// ==============================================================================
// B) Behavioral guardrails
// ==============================================================================

describe('CapSheetFull SSOT Parity — Behavioral Guardrails', () => {
  it('TEST 8: yearTotals match computeTeamCapTotals for team with dead money + players + holds', () => {
    const team = {
      players: createPlayers(14, 10_000_000),
      deadCap: [
        {
          playerId: 'waived-1',
          amountByYear: [
            { season: '2025-26', amount: 3_000_000 },
          ],
        },
      ],
      capHolds: [
        {
          playerId: 'hold-1',
          playerName: 'Cap Hold Player',
          amount: 2_000_000,
          season: '2025-26',
          type: 'bird',
          active: true,
          isSigned: false,
        },
      ],
    };

    const totals = computeTeamCapTotals(team, YEAR);

    // 14 players * 10M = 140M players
    expect(totals.playersTotal).toBe(140_000_000);
    // 3M dead money
    expect(totals.deadMoneyTotal).toBe(3_000_000);
    // 2M cap holds
    expect(totals.capHoldsTotal).toBe(2_000_000);
    // No incomplete charges (14 >= min roster)
    expect(totals.incompleteChargesTotal).toBe(0);
    // Total = 140M + 3M + 2M = 145M
    expect(totals.totalCapAllocations).toBe(145_000_000);
  });

  it('TEST 9: Dead money IS included in totalCapAllocations (regression guard)', () => {
    const team = {
      players: createPlayers(14, 0), // No salary
      deadCap: [
        {
          playerId: 'waived-1',
          amountByYear: [
            { season: '2025-26', amount: 7_500_000 },
          ],
        },
      ],
      capHolds: [],
    };

    const totals = computeTeamCapTotals(team, YEAR);
    expect(totals.deadMoneyTotal).toBe(7_500_000);
    expect(totals.totalCapAllocations).toBeGreaterThanOrEqual(7_500_000);
  });

  it('TEST 10: Incomplete roster charges ARE included in totalCapAllocations', () => {
    // Only 10 players, below minimum roster requirement
    const team = {
      players: createPlayers(10, 0),
      deadCap: [],
      capHolds: [],
    };

    const totals = computeTeamCapTotals(team, YEAR);
    // Standard min roster is 14, so 4 missing slots
    expect(totals.incompleteChargesTotal).toBeGreaterThan(0);
    expect(totals.totalCapAllocations).toBe(totals.incompleteChargesTotal);
  });

  it('TEST 11: Cap holds ARE included in totalCapAllocations', () => {
    const team = {
      players: createPlayers(14, 0),
      deadCap: [],
      capHolds: [
        {
          playerId: 'hold-1',
          playerName: 'Hold Player',
          amount: 5_000_000,
          season: '2025-26',
          type: 'bird',
          active: true,
          isSigned: false,
        },
      ],
    };

    const totals = computeTeamCapTotals(team, YEAR);
    expect(totals.capHoldsTotal).toBe(5_000_000);
    expect(totals.totalCapAllocations).toBe(5_000_000);
  });

  it('TEST 12: adjacent exception/TPE/hard-cap surfaces do NOT alter canonical totals', () => {
    const baseTeam = {
      players: createPlayers(14, 6_000_000),
      deadCap: [
        {
          playerId: 'waived-1',
          amountByYear: [{ season: '2025-26', amount: 2_000_000 }],
        },
      ],
      capHolds: [
        {
          playerId: 'hold-1',
          playerName: 'Hold Player',
          amount: 3_000_000,
          season: '2025-26',
          type: 'bird',
          active: true,
          isSigned: false,
        },
      ],
    };

    const baseTotals = computeTeamCapTotals(baseTeam, YEAR);
    const adjacentSurfaceStateTeam = {
      ...baseTeam,
      exceptions: {
        mle: { enabled: true, totalAmount: 12_800_000, usedAmount: 5_000_000 },
      },
      tradeExceptions: [
        { id: 'tpe-1', amount: 7_500_000, expiresOn: '2026-07-01' },
      ],
      hardCapped: 1,
      hardCapTriggered: 'SignAndTrade',
      hardCapFirstApron: { active: true, season: '2025-26' },
      faExceptionBuckets: [{ type: 'NTMLE', used: 5_000_000, amount: 12_800_000 }],
    };

    const adjacentTotals = computeTeamCapTotals(adjacentSurfaceStateTeam, YEAR);
    expect(adjacentTotals).toEqual(baseTotals);
  });

  it('TEST 13: calculateTeamCapHit stays player-only while computeTeamCapTotals includes full allocations', () => {
    const team = {
      players: createPlayers(10, 4_000_000),
      deadCap: [
        {
          playerId: 'waived-1',
          amountByYear: [{ season: '2025-26', amount: 3_000_000 }],
        },
      ],
      capHolds: [
        {
          playerId: 'hold-1',
          playerName: 'Hold Player',
          amount: 2_000_000,
          season: '2025-26',
          type: 'bird',
          active: true,
          isSigned: false,
        },
      ],
    };

    const playerOnlyCapHit = calculateTeamCapHit(team.players, YEAR);
    const totals = computeTeamCapTotals(team, YEAR);

    expect(playerOnlyCapHit).toBe(40_000_000);
    expect(totals.playersTotal).toBe(playerOnlyCapHit);
    expect(totals.deadMoneyTotal).toBe(3_000_000);
    expect(totals.capHoldsTotal).toBe(2_000_000);
    expect(totals.incompleteChargesTotal).toBeGreaterThan(0);
    expect(totals.totalCapAllocations).toBe(
      totals.playersTotal +
        totals.deadMoneyTotal +
        totals.capHoldsTotal +
        totals.incompleteChargesTotal
    );
    expect(totals.totalCapAllocations).toBeGreaterThan(playerOnlyCapHit);
  });

  it('TEST 14: computeTeamCapTotals reads from team.players, not team.roster', () => {
    const source = fs.readFileSync(COMPUTE_TOTALS_PATH, 'utf-8');

    // computePlayersTotal receives "players" parameter from teamCapSheet?.players
    expect(source).toMatch(/teamCapSheet\?\.players/);

    // Should NOT use teamCapSheet?.roster for salary computation
    const usesRosterForCompute =
      /computePlayersTotal\(.*teamCapSheet\?\.roster/.test(source);
    expect(usesRosterForCompute).toBe(false);
  });

  it('TEST 15: computeTeamCapTotals.js is absent after shim retirement', () => {
    expect(fs.existsSync(COMPUTE_TOTALS_SHIM_PATH)).toBe(false);
  });
});
