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
 *    2D. CapSheetFull.tsx declares explicit multi-year hierarchy surfaces
 *    3. computeTeamCapTotals.ts declares the legacy compatibility ownership list
 *    4. legacy totals and governed dated ledgers have an explicit usage fence
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
 *    15. CapSheetFull visible body is not filtered only by current-year slices
 *    16. Future-only contract rows still carry future-year canonical cap truth
 *    18. Mixed future-year player-body semantics still sum to canonical playersTotal while non-player allocations stay separate
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import { calculateTeamCapHit } from '@/features/architect/utils/capHelpers';
import { getPlayerCapSheetAmountsForYear } from '@/features/architect/utils/contractUtils';

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

const DATED_SALARY_LEDGERS_PATH = path.resolve(
  __dirname,
  '../../features/architect/utils/capTotals/datedSalaryLedgers.ts'
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
const CAP_LEGALITY_VALIDATION_SIGNING_PATH = path.resolve(
  __dirname,
  '../../features/architect/utils/capLegalityValidation/signing.ts'
);
// Stage 6B: signing.ts was further split — the canonical
// computeCanonicalMutationTeamCapTotals owner moved into
// signing.helpers.ts; signing.validators.ts holds the validator entry
// points. Concatenate the whole signing sub-folder so the SSOT helper
// invariants stay findable.
const CAP_LEGALITY_VALIDATION_SIGNING_VALIDATORS_PATH = path.resolve(
  __dirname,
  '../../features/architect/utils/capLegalityValidation/signing.validators.ts'
);
const CAP_LEGALITY_VALIDATION_SIGNING_HELPERS_PATH = path.resolve(
  __dirname,
  '../../features/architect/utils/capLegalityValidation/signing.helpers.ts'
);
const CAP_LEGALITY_VALIDATION_SIGNING_VALIDATE_PATH = path.resolve(
  __dirname,
  '../../features/architect/utils/capLegalityValidation/signing.validate.ts'
);
const readCapLegalitySigningBundle = (): string => {
  let bundle = fs.readFileSync(CAP_LEGALITY_VALIDATION_SIGNING_PATH, 'utf-8');
  for (const extraPath of [
    CAP_LEGALITY_VALIDATION_SIGNING_VALIDATORS_PATH,
    CAP_LEGALITY_VALIDATION_SIGNING_HELPERS_PATH,
    CAP_LEGALITY_VALIDATION_SIGNING_VALIDATE_PATH,
  ]) {
    if (fs.existsSync(extraPath)) {
      bundle += fs.readFileSync(extraPath, 'utf-8');
    }
  }
  return bundle;
};

const COMPUTE_TOTALS_SHIM_PATH = path.resolve(
  __dirname,
  '../../features/architect/utils/capTotals/computeTeamCapTotals.js'
);

const YEAR = 2026; // 2025-26 season
const FUTURE_YEAR = YEAR + 1; // 2026-27 season

// Helper: create players to fill or partially fill a roster
function createPlayers(count: number, salary = 5_000_000) {
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

function createMultiYearPlayers(
  count: number,
  currentYearSalary = 1_000_000,
  futureYearSalary = currentYearSalary
) {
  return Array.from({ length: count }, (_, i) => ({
    player_id: `multi-year-player-${i}`,
    displayName: `Multi-Year Player ${i}`,
    contract: {
      contractType: 'Standard',
      salariesByYear: [
        {
          season: '2025-26',
          salary: currentYearSalary,
          capHit: currentYearSalary,
        },
        {
          season: '2026-27',
          salary: futureYearSalary,
          capHit: futureYearSalary,
        },
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
  const datedSalaryLedgersSource = fs.readFileSync(
    DATED_SALARY_LEDGERS_PATH,
    'utf-8'
  );
  const capHelpersSource = fs.readFileSync(CAP_HELPERS_PATH, 'utf-8');
  const useCapValidationSource = fs.readFileSync(
    USE_CAP_VALIDATION_PATH,
    'utf-8'
  );
  const capLegalityValidationSource = fs.readFileSync(
    CAP_LEGALITY_VALIDATION_PATH,
    'utf-8'
  );
  // computeCanonicalMutationTeamCapTotals moved to signing.ts submodule (Wave 4 Step 2c).
  // Stage 6B: signing.ts was further split — the canonical helper now
  // lives in signing.validators.ts; readCapLegalitySigningBundle handles
  // the concatenation.
  const capLegalityValidationSigningSource = readCapLegalitySigningBundle();

  it('TEST 1: CapSheetFull imports the independent-book canonical snapshot', () => {
    expect(capSheetFullSource).toMatch(
      /import.*createCanonicalTeamTotalsSnapshot.*from/
    );
  });

  it('TEST 2: CapSheetFull does NOT contain local reduce salary summation pattern', () => {
    // The old pattern was: sortedPlayers.reduce((sum, player) => {
    // with getContractYearSlice inside the reduce for yearTotals
    // We check that there's no reduce building yearTotals from player salaries
    const hasLocalReduceForTotals =
      /yearTotals\[year\]\s*=\s*sortedPlayers\.reduce/.test(capSheetFullSource);
    expect(hasLocalReduceForTotals).toBe(false);
  });

  it('TEST 2B: CapSheetFull uses shared row cap-sheet amounts instead of raw salary fallback cells', () => {
    expect(capSheetFullSource).toContain('getPlayerCapSheetAmountsForYear');
    expect(capSheetFullSource).not.toContain(
      'const salaryValue = entry?.salary ?? entry?.capHit ?? 0;'
    );
  });

  it('TEST 2C: CapSheetFull does not filter visible players solely by current-year slices', () => {
    expect(capSheetFullSource).not.toMatch(
      /\.filter\(\(p\)\s*=>\s*getContractYearSlice\(p,\s*currentYear\)\)/
    );
    expect(capSheetFullSource).toContain('firstVisibleYear');
    expect(capSheetFullSource).toContain('for (const year of allYears)');
  });

  it('TEST 2D: CapSheetFull declares explicit multi-year hierarchy surfaces and copy', () => {
    expect(capSheetFullSource).toContain('Primary multi-year cap sheet surface');
    expect(capSheetFullSource).toContain('Multi-year player detail surface');
    expect(capSheetFullSource).toContain(
      'Multi-year canonical yearly totals surface'
    );
    // Cap-hold / dead-money / exceptions detail now share one unified tab bar.
    expect(capSheetFullSource).toContain('Cap detail tabs');
    expect(capSheetFullSource).toContain('Canonical Yearly Totals');
    expect(capSheetFullSource).toContain(
      'Player rows show season-by-season contract detail only.'
    );
    expect(capSheetFullSource).toContain(
      'Player rows above and cap hold details below support the same'
    );
    expect(capSheetFullSource).toContain('Canonical yearly total');
  });

  it('TEST 3: computeTeamCapTotals declares the legacy compatibility ownership list', () => {
    expect(computeTotalsSource).toContain('BZE-268 COMPATIBILITY BOUNDARY');
    expect(computeTotalsSource).toContain(
      'INCLUDED IN LEGACY COMPATIBILITY TOTALS'
    );
    expect(computeTotalsSource).toContain(
      'EXCLUDED FROM LEGACY COMPATIBILITY TOTALS'
    );
  });

  it('TEST 4: legacy totals and governed dated ledgers have an explicit usage fence', () => {
    expect(computeTotalsSource).toContain(
      'Legacy Cap Sheet compatibility totals owner.'
    );
    expect(computeTotalsSource).toContain(
      'Use computeTeamCapTotals(...) when a caller needs totalCapAllocations,'
    );
    expect(computeTotalsSource).toContain(
      'Do not use computeTeamCapTotals(...) for player-only validation/projection'
    );
    expect(datedSalaryLedgersSource).toContain(
      "borrow another ledger's total"
    );
    expect(datedSalaryLedgersSource).toContain(
      'runtime date or a different Salary Cap Year'
    );
    expect(datedSalaryLedgersSource).toContain(
      'export function evaluateDatedSalaryLedgers('
    );
  });

  it('TEST 5: calculateTeamCapHit is fenced as player-only validation math', () => {
    expect(capHelpersSource).toContain(
      'calculateTeamCapHit(...) keeps a historical generic name'
    );
    expect(capHelpersSource).toContain(
      'intentionally player-only validation/projection math and not a Cap Sheet'
    );
    expect(capHelpersSource).toContain('totals authority.');
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
    // computeCanonicalMutationTeamCapTotals moved to signing.ts submodule (Wave 4 Step 2c)
    expect(capLegalityValidationSigningSource).toContain(
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
        totals.incompleteChargesTotal!
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

  it('TEST 16: shared row-amount helper keeps future cap-hit rules aligned with totals semantics', () => {
    const veteranMinimumPlayer = {
      player_id: 'vet-min-1',
      displayName: 'Veteran Minimum Wing',
      isMinimum: true,
      yearsOfService: 4,
      contract: {
        contractType: 'Standard',
        salariesByYear: [
          { season: '2025-26', salary: 2_390_000, capHit: 2_390_000 },
        ],
      },
    };
    const adjustedStandardPlayer = {
      player_id: 'adjusted-standard-1',
      displayName: 'Adjusted Standard',
      contract: {
        contractType: 'Standard',
        salariesByYear: [
          { season: '2025-26', salary: 8_000_000, capHit: 9_000_000 },
        ],
      },
    };
    const twoWayPlayer = {
      player_id: 'two-way-1',
      displayName: 'Two-Way Prospect',
      contractType: 'two-way',
      contract: {
        contractType: 'Two-Way',
        salariesByYear: [
          { season: '2025-26', salary: 700_000, capHit: 700_000 },
        ],
      },
    };

    expect(getPlayerCapSheetAmountsForYear(veteranMinimumPlayer, YEAR)).toEqual({
      contractSlice: expect.objectContaining({
        salary: 2_390_000,
        capHit: 2_390_000,
      }),
      capHit: 2_176_096,
      baseSalary: 2_390_000,
      hasCapHitAdjustment: true,
    });

    expect(getPlayerCapSheetAmountsForYear(adjustedStandardPlayer, YEAR)).toEqual({
      contractSlice: expect.objectContaining({
        salary: 8_000_000,
        capHit: 9_000_000,
      }),
      capHit: 9_000_000,
      baseSalary: 8_000_000,
      hasCapHitAdjustment: true,
    });

    expect(getPlayerCapSheetAmountsForYear(twoWayPlayer, YEAR)).toEqual({
      contractSlice: expect.objectContaining({
        salary: 700_000,
        capHit: 700_000,
      }),
      capHit: 0,
      baseSalary: 700_000,
      hasCapHitAdjustment: true,
    });
  });

  it('TEST 17: future-only contract rows still produce future-year canonical cap truth', () => {
    const futureOnlyPlayer = {
      player_id: 'future-only-1',
      displayName: 'Future Only Big',
      contract: {
        contractType: 'Standard',
        salariesByYear: [
          { season: '2026-27', salary: 6_000_000, capHit: 6_000_000 },
          { season: '2027-28', salary: 6_500_000, capHit: 6_500_000 },
        ],
      },
    };
    const futureOnlyCurrentYearAmounts = getPlayerCapSheetAmountsForYear(
      futureOnlyPlayer,
      YEAR
    );
    const futureYearTeam = {
      players: [
        ...createPlayers(14, 1_000_000),
        futureOnlyPlayer,
      ],
      deadCap: [],
      capHolds: [],
    };
    const futureYearTotals = computeTeamCapTotals(futureYearTeam, YEAR + 1);

    expect(futureOnlyCurrentYearAmounts).toEqual({
      contractSlice: null,
      capHit: 0,
      baseSalary: 0,
      hasCapHitAdjustment: false,
    });
    expect(getPlayerCapSheetAmountsForYear(futureOnlyPlayer, YEAR + 1)).toEqual({
      contractSlice: expect.objectContaining({
        salary: 6_000_000,
        capHit: 6_000_000,
      }),
      capHit: 6_000_000,
      baseSalary: 6_000_000,
      hasCapHitAdjustment: false,
    });
    expect(futureYearTotals.playersTotal).toBe(6_000_000);
    expect(futureYearTotals.totalCapAllocations).toBe(6_000_000);
  });

  it('TEST 18: mixed future-year player-body semantics still sum to canonical playersTotal while cap holds stay outside body math', () => {
    const basePlayers = createMultiYearPlayers(12, 1_000_000, 1_000_000);
    const veteranMinimumPlayer = {
      player_id: 'mixed-future-vet-min',
      displayName: 'Mixed Future Veteran Minimum Wing',
      isMinimum: true,
      yearsOfService: 4,
      contract: {
        contractType: 'Standard',
        salariesByYear: [
          { season: '2025-26', salary: 2_200_000, capHit: 2_200_000 },
          { season: '2026-27', salary: 2_390_000, capHit: 2_390_000 },
        ],
      },
    };
    const adjustedStandardPlayer = {
      player_id: 'mixed-future-adjusted-standard',
      displayName: 'Mixed Future Cap-Hit Forward',
      contract: {
        contractType: 'Standard',
        salariesByYear: [
          { season: '2025-26', salary: 7_500_000, capHit: 7_500_000 },
          { season: '2026-27', salary: 8_000_000, capHit: 9_000_000 },
        ],
      },
    };
    const twoWayPlayer = {
      player_id: 'mixed-future-two-way',
      displayName: 'Mixed Future Two-Way Guard',
      contractType: 'two-way',
      contract: {
        contractType: 'Two-Way',
        salariesByYear: [
          { season: '2025-26', salary: 500_000, capHit: 500_000 },
          { season: '2026-27', salary: 700_000, capHit: 700_000 },
        ],
      },
    };
    const futureOnlyPlayer = {
      player_id: 'mixed-future-only',
      displayName: 'Mixed Future Only Stretch Big',
      contract: {
        contractType: 'Standard',
        salariesByYear: [
          { season: '2026-27', salary: 6_000_000, capHit: 6_000_000 },
        ],
      },
    };
    const team = {
      players: [
        ...basePlayers,
        veteranMinimumPlayer,
        adjustedStandardPlayer,
        twoWayPlayer,
        futureOnlyPlayer,
      ],
      deadCap: [],
      capHolds: [
        {
          playerId: 'mixed-future-hold',
          playerName: 'Mixed Future Hold Wing',
          amount: 4_250_000,
          season: '2026-27',
          type: 'bird',
          active: true,
          isSigned: false,
        },
      ],
    };

    const bodyPlayersTotal = team.players.reduce(
      (sum, player) =>
        sum + getPlayerCapSheetAmountsForYear(player, FUTURE_YEAR).capHit,
      0
    );
    const totals = computeTeamCapTotals(team, FUTURE_YEAR);

    // BZE-220: FUTURE_YEAR (2026-27) now resolves the official 2026-27 minimum
    // scale, so the 3+-YOS veteran-minimum cap hit is the official 2-year min
    // ($2,449,421) instead of the pre-fix 2025-26 fallback ($2,176,096).
    expect(getPlayerCapSheetAmountsForYear(veteranMinimumPlayer, FUTURE_YEAR)).toEqual({
      contractSlice: expect.objectContaining({
        salary: 2_390_000,
        capHit: 2_390_000,
      }),
      capHit: 2_449_421,
      baseSalary: 2_390_000,
      hasCapHitAdjustment: true,
    });
    expect(bodyPlayersTotal).toBe(29_449_421);
    expect(totals.playersTotal).toBe(bodyPlayersTotal);
    expect(totals.deadMoneyTotal).toBe(0);
    expect(totals.incompleteChargesTotal).toBe(0);
    expect(totals.capHoldsTotal).toBe(4_250_000);
    expect(totals.totalCapAllocations).toBe(33_699_421);
    expect(totals.totalCapAllocations! - totals.playersTotal).toBe(
      totals.capHoldsTotal
    );
  });
});
