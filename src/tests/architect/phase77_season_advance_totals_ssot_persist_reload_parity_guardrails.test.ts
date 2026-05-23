/**
 * FILE: src/tests/architect/phase77_season_advance_totals_ssot_persist_reload_parity_guardrails.test.js
 * PURPOSE: Phase 77 guardrails for Season Advance Totals SSOT + Persist→Reload Parity
 * OWNERSHIP: Feature: architect/cap-sheet
 *
 * HISTORY:
 *  - 2026-02-01: Phase 77 - Created for Season Advance Totals SSOT + Persist→Reload Parity
 *
 * LINKS:
 *  - Master Doc: docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
 *  - Plan: Phase 77 execution prompt
 *
 * TESTS:
 * A) Source-scan / wiring guardrails:
 *    1. seasonManager.ts imports computeTeamCapTotals from capTotals
 *    2. seasonManager.ts calls computeTeamCapTotals during season transition
 *    3. seasonManager.ts does NOT reference updateTeamCapTotals (regex/substring scan)
 *
 * B) Behavioral guardrails:
 *    4. Season advance recomputes totals for the new year (correct yearKey)
 *    5. incompleteChargesTotal is present (and behaves plausibly with <14 standard players)
 *    6. Totals match computeTeamCapTotals(team, toYearKey) output
 *
 * C) Persist→Reload parity:
 *    7. Persist → reload yields identical team.totals object (deep equality)
 *    8. Persist → reload yields identical non-TPE exceptions state (Phase 76 parity)
 *    9. TPE array unchanged by non-TPE lifecycle reset (regression assertion)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Import the SSOT totals function
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals';

// Import cap rules for behavioral tests
import { getCapRulesForYear } from '@/features/architect/utils/capRulesProfile';

// Import season format helpers
import {
  toEndYear,
  toSeasonKey,
} from '@/features/architect/utils/seasonFormat';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==============================================================================
// TEST HELPERS
// ==============================================================================

const TEST_YEAR_2026 = 2026; // 2025-26 season
const TEST_YEAR_2027 = 2027; // 2026-27 season
const FROM_SEASON = '2025-26';
const TO_SEASON = '2026-27';

type CreateTeamWithContractsOptions = {
  teamCode?: string;
  playerCount?: number;
  salaryPerPlayer?: number;
  seasonKey?: string;
};

type TestContractPlayer = {
  player_id: string;
  displayName: string;
  contract: {
    salariesByYear: Array<{
      season: string;
      salary: number;
      guaranteed: boolean;
    }>;
    endSeason: string;
    yearsRemaining: number;
  };
};

type TestDeadCapEntry = {
  playerId: string;
  playerName: string;
  amountByYear: Array<{ season: string; amount: number }>;
};

type TestCapHoldEntry = {
  playerId: string;
  playerName: string;
  type: string;
  amount: number;
  season: string;
  active: boolean;
  isSigned: boolean;
};

type TestTotals = ReturnType<typeof computeTeamCapTotals> & {
  _meta?: Record<string, unknown>;
};

/**
 * Creates a minimal team with contracts for totals testing.
 */
function createTeamWithContracts(
  options: CreateTeamWithContractsOptions = {}
) {
  const {
    teamCode = 'TST',
    playerCount = 10, // Less than 14 to test incomplete roster charges
    salaryPerPlayer = 5_000_000,
    seasonKey = FROM_SEASON,
  } = options;

  const players: TestContractPlayer[] = [];
  const roster: string[] = [];

  for (let i = 0; i < playerCount; i++) {
    const playerId = `player_${i + 1}`;
    roster.push(playerId);
    players.push({
      player_id: playerId,
      displayName: `Test Player ${i + 1}`,
      contract: {
        salariesByYear: [
          {
            season: seasonKey,
            salary: salaryPerPlayer,
            guaranteed: true,
          },
          {
            season: TO_SEASON,
            salary: salaryPerPlayer * 1.05, // 5% raise
            guaranteed: true,
          },
        ],
        endSeason: '2027-28',
        yearsRemaining: 3,
      },
    });
  }

  return {
    teamCode,
    teamName: 'Test Team',
    season: seasonKey,
    players,
    roster,
    capHolds: [] as TestCapHoldEntry[],
    deadCap: [] as TestDeadCapEntry[],
    exceptions: {
      biAnnual: {
        enabled: true,
        maxAmount: 4_700_000,
        usedAmount: 1_000_000,
        remainingAmount: 3_700_000,
        seasonKey,
      },
      miniMle: {
        enabled: true,
        maxAmount: 5_000_000,
        usedAmount: 0,
        remainingAmount: 5_000_000,
        seasonKey,
      },
      nonTaxpayerMle: {
        enabled: true,
        maxAmount: 12_900_000,
        usedAmount: 2_000_000,
        remainingAmount: 10_900_000,
        seasonKey,
      },
      room: {
        enabled: false, // Not under cap
        maxAmount: 0,
        usedAmount: 0,
        remainingAmount: 0,
        seasonKey,
      },
      // Include TPE to verify it's NOT touched by totals or non-TPE lifecycle
      tpe: [
        {
          id: 'tpe-001',
          amount: 10_000_000,
          remainingAmount: 10_000_000,
          expiresOn: '2027-06-15T00:00:00.000Z',
        },
      ],
    },
    totals: {
      // Old totals (should be overwritten)
      playersTotal: 40_000_000,
      yearKey: TEST_YEAR_2026,
    } as TestTotals,
  };
}

/**
 * Simulates processTeamSeasonTransitionWithOptions totals recompute behavior.
 * This mirrors the Phase 77 code path without the async/Firestore dependencies.
 */
function simulateSeasonTransitionTotalsRecompute(
  team: ReturnType<typeof createTeamWithContracts>,
  toSeason: string
) {
  const toYear = toEndYear(toSeason);
  if (toYear === null) {
    throw new Error(`Invalid season code: ${toSeason}`);
  }

  // Update team season (as done in processTeamSeasonTransitionWithOptions)
  const updatedTeam = { ...team, season: toSeason };

  // Phase 77: Recompute totals using SSOT
  updatedTeam.totals = computeTeamCapTotals(updatedTeam, toYear) as TestTotals;

  return updatedTeam;
}

// ==============================================================================
// A) SOURCE-SCAN / WIRING GUARDRAILS
// ==============================================================================

describe('Phase 77: Source Scan Guardrails', () => {
  const seasonManagerPath = path.resolve(
    __dirname,
    '../../features/architect/utils/seasonManager.ts'
  );
  // Stage 6B: per-team transition logic (including the Phase 77 totals
  // recompute) was extracted into seasonManager.teamTransition.ts.
  const seasonManagerTeamTransitionPath = path.resolve(
    __dirname,
    '../../features/architect/utils/seasonManager.teamTransition.ts'
  );
  const readSeasonManagerBundle = (): string => {
    let bundle = fs.readFileSync(seasonManagerPath, 'utf8');
    if (fs.existsSync(seasonManagerTeamTransitionPath)) {
      bundle += fs.readFileSync(seasonManagerTeamTransitionPath, 'utf8');
    }
    return bundle;
  };

  it('TEST 1: seasonManager.ts imports computeTeamCapTotals from capTotals', () => {
    const content = readSeasonManagerBundle();

    // Must import computeTeamCapTotals from capTotals barrel
    expect(content).toContain(
      "import { computeTeamCapTotals } from '@/features/architect/utils/capTotals'"
    );
  });

  it('TEST 2: seasonManager.ts calls computeTeamCapTotals during season transition', () => {
    const content = readSeasonManagerBundle();

    // Must call computeTeamCapTotals with team and toYear
    expect(content).toContain('computeTeamCapTotals(updatedTeam, toYear)');

    // Must have Phase 77 comment marker
    expect(content).toMatch(/PHASE 77.*SSOT/i);
    expect(content).toMatch(/PHASE 77.*Recalculate cap totals/i);
  });

  it('TEST 3: seasonManager.ts does NOT call updateTeamCapTotals (except in comments)', () => {
    const content = fs.readFileSync(seasonManagerPath, 'utf8');

    // Remove comments to check for actual code usage
    const contentWithoutComments = content
      .replace(/\/\/.*$/gm, '') // Remove single-line comments
      .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments

    // Must NOT have actual updateTeamCapTotals function call
    expect(contentWithoutComments).not.toMatch(/updateTeamCapTotals\s*\(/);

    // Must NOT have dynamic import of updateTeamCapTotals
    expect(contentWithoutComments).not.toContain("import('./tradeManager')");
  });

  it('TEST 3b: seasonManager.ts does NOT import from tradeManager for totals', () => {
    const content = fs.readFileSync(seasonManagerPath, 'utf8');

    // Remove comments to check for actual code usage
    const contentWithoutComments = content
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');

    // Must NOT have dynamic import pattern for tradeManager
    expect(contentWithoutComments).not.toMatch(
      /await\s+import\s*\(\s*['"]\.\/tradeManager['"]\s*\)/
    );
  });
});

// ==============================================================================
// B) BEHAVIORAL GUARDRAILS
// ==============================================================================

describe('Phase 77: Season Advance Totals Behavioral Tests', () => {
  it('TEST 4: Season advance recomputes totals for the new year (correct yearKey)', () => {
    const team = createTeamWithContracts({ playerCount: 10 });

    // Pre-condition: old yearKey
    expect(team.totals.yearKey).toBe(TEST_YEAR_2026);

    // Simulate season transition
    const updatedTeam = simulateSeasonTransitionTotalsRecompute(
      team,
      TO_SEASON
    );

    // Post-condition: new yearKey
    expect(updatedTeam.totals.yearKey).toBe(TEST_YEAR_2027);
  });

  it('TEST 5: incompleteChargesTotal is present with <14 standard players', () => {
    const team = createTeamWithContracts({ playerCount: 10 }); // Less than 14

    // Simulate season transition
    const updatedTeam = simulateSeasonTransitionTotalsRecompute(
      team,
      TO_SEASON
    );

    // incompleteChargesTotal should be present
    expect(updatedTeam.totals).toHaveProperty('incompleteChargesTotal');

    // With 10 players, missing 4 slots = 4 × rookieMin
    const rules = getCapRulesForYear(TEST_YEAR_2027);
    const expectedCharge = 4 * rules.salaries.rookieMin;
    expect(updatedTeam.totals.incompleteChargesTotal).toBe(expectedCharge);
  });

  it('TEST 5b: incompleteChargesTotal is 0 with >=14 standard players', () => {
    const team = createTeamWithContracts({ playerCount: 14 });

    // Simulate season transition
    const updatedTeam = simulateSeasonTransitionTotalsRecompute(
      team,
      TO_SEASON
    );

    // With 14 players, no missing slots
    expect(updatedTeam.totals.incompleteChargesTotal).toBe(0);
  });

  it('TEST 6: Totals match computeTeamCapTotals(team, toYearKey) output', () => {
    const team = createTeamWithContracts({ playerCount: 12 });

    // Simulate season transition
    const updatedTeam = simulateSeasonTransitionTotalsRecompute(
      team,
      TO_SEASON
    );

    // Compute expected totals directly
    const expectedTotals = computeTeamCapTotals(updatedTeam, TEST_YEAR_2027);

    // Should match exactly (excluding _meta which may have timestamp differences)
    const { _meta: actualMeta, ...actualTotals } = updatedTeam.totals;
    const { _meta: expectedMeta, ...expectedTotalsClean } = expectedTotals;

    expect(actualTotals).toEqual(expectedTotalsClean);
  });

  it('TEST 6b: SSOT totals include all canonical fields', () => {
    const team = createTeamWithContracts({ playerCount: 10 });

    // Simulate season transition
    const updatedTeam = simulateSeasonTransitionTotalsRecompute(
      team,
      TO_SEASON
    );

    // Verify all SSOT canonical fields are present
    expect(updatedTeam.totals).toHaveProperty('yearKey');
    expect(updatedTeam.totals).toHaveProperty('playersTotal');
    expect(updatedTeam.totals).toHaveProperty('deadMoneyTotal');
    expect(updatedTeam.totals).toHaveProperty('capHoldsTotal');
    expect(updatedTeam.totals).toHaveProperty('incompleteChargesTotal');
    expect(updatedTeam.totals).toHaveProperty('totalCapAllocations');
    expect(updatedTeam.totals).toHaveProperty('salaryCap');
    expect(updatedTeam.totals).toHaveProperty('firstApron');
    expect(updatedTeam.totals).toHaveProperty('secondApron');
    expect(updatedTeam.totals).toHaveProperty('deltas');
  });
});

// ==============================================================================
// C) PERSIST→RELOAD PARITY
// ==============================================================================

describe('Phase 77: Persist→Reload Parity Tests', () => {
  it('TEST 7: Persist → reload yields identical team.totals object (deep equality)', () => {
    const team = createTeamWithContracts({ playerCount: 10 });

    // Simulate season transition
    const updatedTeam = simulateSeasonTransitionTotalsRecompute(
      team,
      TO_SEASON
    );

    // Simulate persist by serializing to JSON (Firestore-like behavior)
    const serialized = JSON.stringify(updatedTeam);

    // Simulate reload by parsing from JSON
    const reloaded = JSON.parse(serialized);

    // Totals should be identical
    expect(reloaded.totals).toEqual(updatedTeam.totals);

    // Verify specific SSOT fields
    expect(reloaded.totals.yearKey).toBe(TEST_YEAR_2027);
    expect(reloaded.totals.incompleteChargesTotal).toBe(
      updatedTeam.totals.incompleteChargesTotal
    );
    expect(reloaded.totals.totalCapAllocations).toBe(
      updatedTeam.totals.totalCapAllocations
    );
  });

  it('TEST 7b: Persist → reload preserves _meta if present', () => {
    const team = createTeamWithContracts({ playerCount: 12 });

    // Simulate season transition
    const updatedTeam = simulateSeasonTransitionTotalsRecompute(
      team,
      TO_SEASON
    );

    // _meta should exist from SSOT
    expect(updatedTeam.totals._meta).toBeDefined();
    expect(updatedTeam.totals._meta.source).toBe('computeTeamCapTotals');

    // Simulate persist → reload
    const serialized = JSON.stringify(updatedTeam);
    const reloaded = JSON.parse(serialized);

    // _meta should survive
    expect(reloaded.totals._meta).toEqual(updatedTeam.totals._meta);
  });

  it('TEST 8: Persist → reload yields identical non-TPE exceptions state (Phase 76 parity)', () => {
    const team = createTeamWithContracts({ playerCount: 10 });

    // Simulate season transition (totals part)
    const updatedTeam = simulateSeasonTransitionTotalsRecompute(
      team,
      TO_SEASON
    );

    // Simulate persist → reload
    const serialized = JSON.stringify(updatedTeam);
    const reloaded = JSON.parse(serialized);

    // Non-TPE exceptions should be identical
    expect(reloaded.exceptions.biAnnual).toEqual(
      updatedTeam.exceptions.biAnnual
    );
    expect(reloaded.exceptions.miniMle).toEqual(updatedTeam.exceptions.miniMle);
    expect(reloaded.exceptions.nonTaxpayerMle).toEqual(
      updatedTeam.exceptions.nonTaxpayerMle
    );
    expect(reloaded.exceptions.room).toEqual(updatedTeam.exceptions.room);
  });

  it('TEST 9: TPE array unchanged by totals recompute (regression)', () => {
    const team = createTeamWithContracts({ playerCount: 10 });

    // Snapshot TPE array before transition
    const tpeBefore = JSON.stringify(team.exceptions.tpe);

    // Simulate season transition (totals part only)
    const updatedTeam = simulateSeasonTransitionTotalsRecompute(
      team,
      TO_SEASON
    );

    // TPE array should be unchanged
    const tpeAfter = JSON.stringify(updatedTeam.exceptions.tpe);
    expect(tpeAfter).toBe(tpeBefore);

    // Verify specific TPE properties
    expect(updatedTeam.exceptions.tpe).toHaveLength(1);
    expect(updatedTeam.exceptions.tpe[0].id).toBe('tpe-001');
    expect(updatedTeam.exceptions.tpe[0].remainingAmount).toBe(10_000_000);
  });

  it('TEST 9b: Non-TPE reset does not affect TPE array (Phase 76 regression)', () => {
    const team = createTeamWithContracts({ playerCount: 10 });

    // The totals recompute should not touch exceptions at all
    // This is a regression test to ensure Phase 77 doesn't accidentally
    // break Phase 76 invariants by modifying exception state during totals calc

    // Snapshot full exceptions before
    const exceptionsBefore = JSON.stringify(team.exceptions);

    // Simulate season transition (totals part only, not full transition)
    const updatedTeam = simulateSeasonTransitionTotalsRecompute(
      team,
      TO_SEASON
    );

    // Exceptions should be completely unchanged by totals recompute
    // (Phase 76's resetTeamNonTpeExceptionsForNewSeason is a separate step)
    const exceptionsAfter = JSON.stringify(updatedTeam.exceptions);
    expect(exceptionsAfter).toBe(exceptionsBefore);
  });
});

// ==============================================================================
// D) EDGE CASES
// ==============================================================================

describe('Phase 77: Edge Cases', () => {
  it('TEST 10: Handles team with empty roster', () => {
    const team = createTeamWithContracts({ playerCount: 0 });

    // Simulate season transition
    const updatedTeam = simulateSeasonTransitionTotalsRecompute(
      team,
      TO_SEASON
    );

    // Should have incomplete roster charges for all 14 missing slots
    const rules = getCapRulesForYear(TEST_YEAR_2027);
    const expectedCharge = 14 * rules.salaries.rookieMin;
    expect(updatedTeam.totals.incompleteChargesTotal).toBe(expectedCharge);

    // playersTotal should be 0
    expect(updatedTeam.totals.playersTotal).toBe(0);
  });

  it('TEST 11: Handles team with no existing totals', () => {
    const team = createTeamWithContracts({ playerCount: 5 });
    delete (team as { totals?: unknown }).totals; // Remove existing totals

    // Simulate season transition
    const updatedTeam = simulateSeasonTransitionTotalsRecompute(
      team,
      TO_SEASON
    );

    // Should still compute totals correctly
    expect(updatedTeam.totals).toBeDefined();
    expect(updatedTeam.totals.yearKey).toBe(TEST_YEAR_2027);
    expect(updatedTeam.totals.totalCapAllocations).toBeGreaterThan(0);
  });

  it('TEST 12: Handles team with dead cap entries', () => {
    const team = createTeamWithContracts({ playerCount: 10 });
    team.deadCap = [
      {
        playerId: 'dead_player_1',
        playerName: 'Dead Player',
        amountByYear: [
          { season: TO_SEASON, amount: 5_000_000 },
          { season: '2027-28', amount: 3_000_000 },
        ],
      },
    ];

    // Simulate season transition
    const updatedTeam = simulateSeasonTransitionTotalsRecompute(
      team,
      TO_SEASON
    );

    // deadMoneyTotal should include the dead cap
    expect(updatedTeam.totals.deadMoneyTotal).toBe(5_000_000);

    // totalCapAllocations should include dead money
    expect(updatedTeam.totals.totalCapAllocations).toBeGreaterThan(
      updatedTeam.totals.playersTotal +
        updatedTeam.totals.incompleteChargesTotal
    );
  });

  it('TEST 13: Handles team with cap holds', () => {
    const team = createTeamWithContracts({ playerCount: 10 });
    team.capHolds = [
      {
        playerId: 'fa_player_1',
        playerName: 'Free Agent',
        type: 'bird',
        amount: 15_000_000,
        season: '2026-27', // Format: "YYYY-YY" matching TO_SEASON
        active: true,
        isSigned: false,
      },
    ];

    // Simulate season transition
    const updatedTeam = simulateSeasonTransitionTotalsRecompute(
      team,
      TO_SEASON
    );

    // capHoldsTotal should include the hold
    expect(updatedTeam.totals.capHoldsTotal).toBe(15_000_000);

    // totalCapAllocations should include cap holds
    expect(updatedTeam.totals.totalCapAllocations).toBeGreaterThan(
      updatedTeam.totals.playersTotal +
        updatedTeam.totals.incompleteChargesTotal
    );
  });
});

// ==============================================================================
// E) ORDERING INVARIANTS
// ==============================================================================

describe('Phase 77: Ordering Invariants', () => {
  it('TEST 14: Source confirms totals recompute runs AFTER OSTE (which handles TPE expiry)', () => {
    // Stage 6B: per-team transition was extracted into the
    // seasonManager.teamTransition.ts sub-module.
    const seasonManagerPath = path.resolve(
      __dirname,
      '../../features/architect/utils/seasonManager.ts'
    );
    const seasonManagerTeamTransitionPath = path.resolve(
      __dirname,
      '../../features/architect/utils/seasonManager.teamTransition.ts'
    );
    let content = fs.readFileSync(seasonManagerPath, 'utf8');
    if (fs.existsSync(seasonManagerTeamTransitionPath)) {
      content += fs.readFileSync(seasonManagerTeamTransitionPath, 'utf8');
    }

    // Find processTeamSeasonTransitionWithOptions function to scope our search
    const functionStart = content.indexOf(
      'async function processTeamSeasonTransitionWithOptions('
    );
    expect(functionStart).toBeGreaterThan(-1);

    // Get the content of just this function (roughly - up to next function definition)
    const functionContent = content.slice(functionStart);

    // TPE expiry is now delegated to OSTE (resolveOffseasonTransition)
    const ostePos = functionContent.indexOf('resolveOffseasonTransition(');
    const phase77TotalsPos = functionContent.indexOf(
      'PHASE 77: Recalculate cap totals'
    );

    // Both should exist in this function
    expect(ostePos).toBeGreaterThan(-1);
    expect(phase77TotalsPos).toBeGreaterThan(-1);

    // OSTE (which processes TPE expiry) should come before totals recompute
    expect(ostePos).toBeLessThan(phase77TotalsPos);
  });

  it('TEST 15: Source confirms totals recompute runs AFTER OSTE (which handles non-TPE reset)', () => {
    // Stage 6B: per-team transition was extracted into the
    // seasonManager.teamTransition.ts sub-module.
    const seasonManagerPath = path.resolve(
      __dirname,
      '../../features/architect/utils/seasonManager.ts'
    );
    const seasonManagerTeamTransitionPath = path.resolve(
      __dirname,
      '../../features/architect/utils/seasonManager.teamTransition.ts'
    );
    let content = fs.readFileSync(seasonManagerPath, 'utf8');
    if (fs.existsSync(seasonManagerTeamTransitionPath)) {
      content += fs.readFileSync(seasonManagerTeamTransitionPath, 'utf8');
    }

    // Find processTeamSeasonTransitionWithOptions function to scope our search
    const functionStart = content.indexOf(
      'async function processTeamSeasonTransitionWithOptions('
    );
    expect(functionStart).toBeGreaterThan(-1);

    // Get the content of just this function
    const functionContent = content.slice(functionStart);

    // Non-TPE reset is now delegated to OSTE (resolveOffseasonTransition)
    const ostePos = functionContent.indexOf(
      'resolveOffseasonTransition('
    );
    const phase77TotalsPos = functionContent.indexOf(
      'PHASE 77: Recalculate cap totals'
    );

    // Both should exist in this function
    expect(ostePos).toBeGreaterThan(-1);
    expect(phase77TotalsPos).toBeGreaterThan(-1);

    // OSTE (which handles exception resets) should come before totals recompute
    expect(ostePos).toBeLessThan(phase77TotalsPos);
  });

  it('TEST 16: Source confirms totals recompute comment references Phase 77', () => {
    // Stage 6B: per-team transition was extracted into the
    // seasonManager.teamTransition.ts sub-module; the Phase 77 comment
    // block lives there now.
    const seasonManagerPath = path.resolve(
      __dirname,
      '../../features/architect/utils/seasonManager.ts'
    );
    const seasonManagerTeamTransitionPath = path.resolve(
      __dirname,
      '../../features/architect/utils/seasonManager.teamTransition.ts'
    );
    let content = fs.readFileSync(seasonManagerPath, 'utf8');
    if (fs.existsSync(seasonManagerTeamTransitionPath)) {
      content += fs.readFileSync(seasonManagerTeamTransitionPath, 'utf8');
    }

    // Should have Phase 77 comment block
    expect(content).toContain('PHASE 77');
    expect(content).toMatch(/PHASE 77.*SSOT/i);

    // Should reference the ordering explicitly
    expect(content).toContain('AFTER TPE expiry');
    expect(content).toContain('non-TPE reset');
  });
});
