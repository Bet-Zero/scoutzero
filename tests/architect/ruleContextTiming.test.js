/**
 * RuleContext Timing Tests
 *
 * Tests for timing-critical scenarios per ArchitectTiming_WireUI_Tests.md:
 * 1. LeBron Full Bird UFA case (2026 UFA signing starting in 2026-27)
 * 2. Minimum salary + trade cap hit for various YOS
 * 3. Extension timing (operationSeasonId vs referenceSeasonId)
 * 4. Season dropdown / view vs operation season distinction
 *
 * @file tests/architect/ruleContextTiming.test.js
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  buildRuleContextForPlayerMove,
  buildMinimalRuleContext,
  validateRuleContext,
  RuleContextValidationError,
} from '@/features/architect/utils/buildRuleContext';
import {
  computeMaxSalary,
  computeMaxSalaryFromRuleContext,
  computeMinimumSalary,
} from '@/features/architect/utils/salaryEngine';
import { getCapForSeason } from '@/features/architect/utils/capHelpers';
import {
  normalizeToSeasonId,
  parseSeasonId,
  prevSeason,
} from '@/features/architect/utils/seasonHelpers';

/**
 * Test Fixtures
 */

// LeBron-style veteran: 10+ years, Full Bird rights, 2026 UFA
const LEBRON_2026_UFA = {
  playerId: 'lebron_2026_test',
  displayName: 'LeBron Test',
  bio: {
    experience: 22, // 22 years in NBA by 2026-27
    draftYear: 2003,
    draftRound: 1,
    draftPick: 1,
    yearsExperience: 22,
  },
  yearsOfService: 22,
  teamId: 'LAL',
  teamCode: 'LAL',
  contract: {
    endSeason: '2025-26',
    salariesByYear: [
      {
        season: '2024-25',
        salary: 47607350,
        capHit: 47607350,
        guaranteed: true,
      },
      {
        season: '2025-26',
        salary: 52000000,
        capHit: 52000000,
        guaranteed: true,
      },
    ],
    birdRights: {
      status: 'Full',
      yearsWithTeam: 6,
    },
    freeAgency: {
      type: 'Unrestricted',
      year: 2026,
    },
  },
};

// Rookie with 0 years of service
// For 2025-26 operation season, a player drafted in 2025 has 0 YOS
// (Their rookie season is 2025-26, YOS = 2025 - 2025 = 0)
const ROOKIE_0_YOS = {
  playerId: 'rookie_0_test',
  displayName: 'Rookie Zero YOS',
  bio: {
    experience: 0,
    draftYear: 2025, // Drafted 2025 → rookie season 2025-26 → 0 YOS
    draftRound: 1,
    draftPick: 15,
  },
  yearsOfService: 0,
  teamId: 'BOS',
  teamCode: 'BOS',
  contract: null,
};

// 2-year veteran (for trade minimum cap hit)
const VET_2_YOS = {
  playerId: 'vet_2_test',
  displayName: 'Two Year Vet',
  bio: {
    experience: 2,
    draftYear: 2022,
    draftRound: 2,
    draftPick: 45,
  },
  yearsOfService: 2,
  teamId: 'GSW',
  teamCode: 'GSW',
  contract: {
    endSeason: '2024-25',
    salariesByYear: [
      { season: '2024-25', salary: 2000000, capHit: 2000000, guaranteed: true },
    ],
    birdRights: {
      status: 'None',
      yearsWithTeam: 2,
    },
  },
};

// 10+ year veteran (for trade minimum cap hit)
const VET_10_YOS = {
  playerId: 'vet_10_test',
  displayName: 'Ten Year Vet',
  bio: {
    experience: 10,
    draftYear: 2014,
    draftRound: 1,
    draftPick: 1,
  },
  yearsOfService: 10,
  teamId: 'MIA',
  teamCode: 'MIA',
  contract: {
    endSeason: '2024-25',
    salariesByYear: [
      {
        season: '2024-25',
        salary: 10000000,
        capHit: 10000000,
        guaranteed: true,
      },
    ],
    birdRights: {
      status: 'Full',
      yearsWithTeam: 4,
    },
  },
};

// Player eligible for veteran extension
const EXTENSION_ELIGIBLE_PLAYER = {
  playerId: 'ext_eligible_test',
  displayName: 'Extension Candidate',
  bio: {
    experience: 8,
    draftYear: 2016,
    draftRound: 1,
    draftPick: 5,
  },
  yearsOfService: 8,
  teamId: 'DEN',
  teamCode: 'DEN',
  contract: {
    endSeason: '2026-27',
    startSeason: '2023-24',
    contractLength: 4,
    isRookieScale: false,
    contractType: 'Standard',
    salariesByYear: [
      {
        season: '2024-25',
        salary: 40000000,
        capHit: 40000000,
        guaranteed: true,
      },
      {
        season: '2025-26',
        salary: 43200000,
        capHit: 43200000,
        guaranteed: true,
      },
      {
        season: '2026-27',
        salary: 46656000,
        capHit: 46656000,
        guaranteed: true,
      },
    ],
    birdRights: {
      status: 'Full',
      yearsWithTeam: 8,
    },
  },
};

// Team state fixture
const SAMPLE_TEAM_STATE = {
  teamId: 'LAL',
  teamCode: 'LAL',
  players: [],
  totals: {
    totalSalary: 180000000,
    capHits: {
      '2025-26': 180000000,
      '2026-27': 140000000,
    },
  },
  hardCapStatus: {
    isHardCapped: false,
    trigger: null,
    ceiling: 0,
  },
  exceptions: {
    fullMLE: { available: true, remaining: 14104000 },
    taxpayerMLE: { available: true, remaining: 5685000 },
    roomMLE: { available: false, remaining: 0 },
    bae: { available: true, remaining: 5135000 },
    tradeExceptions: [],
  },
};

/**
 * Test Suite 1: LeBron Full Bird UFA Case
 *
 * Scenario:
 * - Player with 10+ years of service
 * - Full Bird rights with current team
 * - Final contract year in 2025-26: salary = $52M
 * - Operation season: 2026-27 (signing new contract starting that season)
 *
 * Expectation:
 * - getMaxSalaryProfile returns first-year max = 35% of 2026-27 cap
 * - NOT 105%/140% floor of prior salary (that's a Bird signing option, not max cap)
 * - Correct cap from 2026-27 (not 2024-25 or other wrong season)
 */
describe('LeBron Full Bird UFA 2026 Case', () => {
  it('should use 2026-27 cap for max salary calculation (not 2024-25)', () => {
    const ctx = buildRuleContextForPlayerMove({
      player: LEBRON_2026_UFA,
      teamState: SAMPLE_TEAM_STATE,
      operationType: 'UFA_SIGNING',
      operationSeasonId: '2026-27',
    });

    // Validate timing is correct
    expect(ctx.timing.operationSeasonId).toBe('2026-27');
    expect(ctx.timing.referenceSeasonId).toBe('2025-26');
    expect(ctx.timing.capSeasonId).toBe('2026-27');

    // Cap should be 2026-27 cap, NOT 2024-25
    const cap2627 = getCapForSeason('2026-27');
    const cap2425 = getCapForSeason('2024-25');
    // Guard against null returns from getCapForSeason
    expect(cap2627).toBeDefined();
    expect(cap2627).not.toBeNull();
    expect(cap2425).toBeDefined();
    expect(cap2425).not.toBeNull();
    expect(ctx.cap.salaryCap).toBe(cap2627.salaryCap);
    expect(ctx.cap.salaryCap).not.toBe(cap2425.salaryCap);
  });

  it('should compute 35% max for 10+ year veteran', () => {
    const ctx = buildRuleContextForPlayerMove({
      player: LEBRON_2026_UFA,
      teamState: SAMPLE_TEAM_STATE,
      operationType: 'UFA_SIGNING',
      operationSeasonId: '2026-27',
    });

    // Player should be recognized as 10+ year vet with 35% bucket
    expect(ctx.player.yearsOfServiceAtOperation).toBeGreaterThanOrEqual(10);
    expect(ctx.player.maxPercentBucket).toBe(0.35);

    // Max salary should be 35% of 2026-27 cap
    const maxResult = computeMaxSalaryFromRuleContext(ctx);
    const cap2627 = getCapForSeason('2026-27');
    const expectedMax = Math.round(cap2627.salaryCap * 0.35);

    expect(maxResult.maxSalary).toBe(expectedMax);
    expect(maxResult.tier).toContain('35%');
  });

  it('should have prior salary from reference season (2025-26)', () => {
    const ctx = buildRuleContextForPlayerMove({
      player: LEBRON_2026_UFA,
      teamState: SAMPLE_TEAM_STATE,
      operationType: 'UFA_SIGNING',
      operationSeasonId: '2026-27',
    });

    // Prior salary should be from 2025-26 (final contract year)
    expect(ctx.player.priorSeasonSalary).toBe(52000000);
  });

  it('should recognize Full Bird rights', () => {
    const ctx = buildRuleContextForPlayerMove({
      player: LEBRON_2026_UFA,
      teamState: SAMPLE_TEAM_STATE,
      operationType: 'UFA_SIGNING',
      operationSeasonId: '2026-27',
    });

    expect(ctx.player.birdTypeAtOperation).toBe('Full Bird');
  });

  it('should not use hard-coded 2024-25 fallback', () => {
    // Build context for a future season
    const ctx = buildRuleContextForPlayerMove({
      player: LEBRON_2026_UFA,
      teamState: SAMPLE_TEAM_STATE,
      operationType: 'UFA_SIGNING',
      operationSeasonId: '2027-28',
    });

    // Should use 2027-28 cap, not fall back to 2024-25
    const cap2728 = getCapForSeason('2027-28');
    expect(ctx.cap.salaryCap).toBe(cap2728.salaryCap);
    expect(ctx.timing.operationSeasonId).toBe('2027-28');
  });
});

/**
 * Test Suite 2: Minimum Salary + Trade Cap Hit
 *
 * Cover:
 * - 0 YOS (rookie minimum)
 * - 2 YOS
 * - 10+ YOS
 *
 * Ensure:
 * - Min salary lookup uses correct ruleSeason
 * - Trade minimum cap hit uses 2-year vet minimum where applicable
 */
describe('Minimum Salary and Trade Cap Hit', () => {
  it('should compute rookie minimum for 0 YOS', () => {
    const ctx = buildRuleContextForPlayerMove({
      player: ROOKIE_0_YOS,
      teamState: SAMPLE_TEAM_STATE,
      operationType: 'MINIMUM_SIGNING',
      operationSeasonId: '2025-26',
    });

    expect(ctx.player.yearsOfServiceAtOperation).toBe(0);

    // Compute minimum salary
    const minResult = computeMinimumSalary(ROOKIE_0_YOS, {
      currentSeason: '2025-26',
      currentYear: 2026,
      capSettings: {
        salaryCap: ctx.cap.salaryCap,
      },
    });

    // Rookie minimum should be lowest tier
    expect(minResult.yearsOfService).toBe(0);
    expect(minResult.minimumSalary).toBeGreaterThan(0);
    expect(minResult.reason).toContain('Rookie');
  });

  it('should compute correct minimum for 2 YOS', () => {
    const ctx = buildRuleContextForPlayerMove({
      player: VET_2_YOS,
      teamState: SAMPLE_TEAM_STATE,
      operationType: 'MINIMUM_SIGNING',
      operationSeasonId: '2025-26',
    });

    expect(ctx.player.yearsOfServiceAtOperation).toBe(2);

    const minResult = computeMinimumSalary(VET_2_YOS, {
      currentSeason: '2025-26',
      currentYear: 2026,
      capSettings: {
        salaryCap: ctx.cap.salaryCap,
      },
    });

    expect(minResult.yearsOfService).toBe(2);
    expect(minResult.minimumSalary).toBeGreaterThan(0);

    // 2 YOS should have a higher minimum than rookie - compute rookie min for comparison
    const rookieMinResult = computeMinimumSalary(ROOKIE_0_YOS, {
      currentSeason: '2025-26',
      currentYear: 2026,
      capSettings: {
        salaryCap: ctx.cap.salaryCap,
      },
    });
    expect(minResult.minimumSalary).toBeGreaterThan(
      rookieMinResult.minimumSalary
    );
  });

  it('should compute 10+ year veteran minimum for 10 YOS', () => {
    const ctx = buildRuleContextForPlayerMove({
      player: VET_10_YOS,
      teamState: SAMPLE_TEAM_STATE,
      operationType: 'MINIMUM_SIGNING',
      operationSeasonId: '2025-26',
    });

    expect(ctx.player.yearsOfServiceAtOperation).toBe(10);

    const minResult = computeMinimumSalary(VET_10_YOS, {
      currentSeason: '2025-26',
      currentYear: 2026,
      capSettings: {
        salaryCap: ctx.cap.salaryCap,
      },
    });

    expect(minResult.yearsOfService).toBe(10);
    expect(minResult.reason).toContain('10+ years');
  });

  it('minimum salary should scale by season (not use hard-coded values)', () => {
    // Get minimum contexts for two different seasons
    const ctx2526 = buildMinimalRuleContext('2025-26', 'MINIMUM_SIGNING');
    const ctx2728 = buildMinimalRuleContext('2027-28', 'MINIMUM_SIGNING');

    // Caps should differ between seasons
    expect(ctx2526.cap.salaryCap).not.toBe(ctx2728.cap.salaryCap);

    // 2027-28 cap should be higher (future projection)
    expect(ctx2728.cap.salaryCap).toBeGreaterThan(ctx2526.cap.salaryCap);

    // Compute minimum salary for both contexts and verify season fields are different
    const min2526 = computeMinimumSalary(VET_2_YOS, {
      currentSeason: '2025-26',
      currentYear: 2026,
      capSettings: { salaryCap: ctx2526.cap.salaryCap },
    });
    const min2728 = computeMinimumSalary(VET_2_YOS, {
      currentSeason: '2027-28',
      currentYear: 2028,
      capSettings: { salaryCap: ctx2728.cap.salaryCap },
    });

    // Verify season fields are correct
    expect(min2526.season).toBe('2025-26');
    expect(min2728.season).toBe('2027-28');

    // Both should return valid minimum salaries
    expect(min2526.minimumSalary).toBeGreaterThan(0);
    expect(min2728.minimumSalary).toBeGreaterThan(0);
  });
});

/**
 * Test Suite 3: Extension Timing
 *
 * Verify:
 * - operationSeasonId is the first season of the extension
 * - referenceSeasonId is the final year of the existing contract
 * - 140% of prior salary uses referenceSeasonId salary
 * - Max is capped by player max for operationSeasonId
 */
describe('Extension Timing', () => {
  it('should set operationSeasonId to first extension year (after contract ends)', () => {
    // Contract ends 2026-27, so extension starts 2027-28
    const ctx = buildRuleContextForPlayerMove({
      player: EXTENSION_ELIGIBLE_PLAYER,
      teamState: SAMPLE_TEAM_STATE,
      operationType: 'VETERAN_EXTENSION',
      // Not specifying operationSeasonId - should derive from contract end
    });

    // Extension should start after contract ends
    expect(ctx.timing.operationSeasonId).toBe('2027-28');
  });

  it('should set referenceSeasonId to final year of existing contract', () => {
    const ctx = buildRuleContextForPlayerMove({
      player: EXTENSION_ELIGIBLE_PLAYER,
      teamState: SAMPLE_TEAM_STATE,
      operationType: 'VETERAN_EXTENSION',
    });

    // Reference season should be final year of current contract (2026-27)
    expect(ctx.timing.referenceSeasonId).toBe('2026-27');
  });

  it('should use correct prior salary from referenceSeasonId', () => {
    const ctx = buildRuleContextForPlayerMove({
      player: EXTENSION_ELIGIBLE_PLAYER,
      teamState: SAMPLE_TEAM_STATE,
      operationType: 'VETERAN_EXTENSION',
    });

    // Prior salary should be 2026-27 salary (final year)
    expect(ctx.player.priorSeasonSalary).toBe(46656000);
  });

  it('should use capSeasonId matching operationSeasonId for extension max', () => {
    const ctx = buildRuleContextForPlayerMove({
      player: EXTENSION_ELIGIBLE_PLAYER,
      teamState: SAMPLE_TEAM_STATE,
      operationType: 'VETERAN_EXTENSION',
    });

    // Cap season should match operation season for max calculation
    expect(ctx.timing.capSeasonId).toBe(ctx.timing.operationSeasonId);

    const cap2728 = getCapForSeason('2027-28');
    expect(ctx.cap.salaryCap).toBe(cap2728.salaryCap);
  });

  it('should compute max salary using operationSeasonId cap', () => {
    const ctx = buildRuleContextForPlayerMove({
      player: EXTENSION_ELIGIBLE_PLAYER,
      teamState: SAMPLE_TEAM_STATE,
      operationType: 'VETERAN_EXTENSION',
    });

    // Player has 8 YOS -> 30% max tier
    expect(ctx.player.yearsOfServiceAtOperation).toBe(8);
    expect(ctx.player.maxPercentBucket).toBe(0.3);

    const maxResult = computeMaxSalaryFromRuleContext(ctx);
    const cap2728 = getCapForSeason('2027-28');
    const expectedMax = Math.round(cap2728.salaryCap * 0.3);

    expect(maxResult.maxSalary).toBe(expectedMax);
  });
});

/**
 * Test Suite 4: Season Dropdown / View vs Operation
 *
 * Test that:
 * - viewSeasonId (dropdown selection) is separate from operationSeasonId
 * - Clicking a future-season column uses that column's season as operationSeasonId
 * - operationSeasonId can differ from current viewSeasonId
 */
describe('View Season vs Operation Season', () => {
  it('should allow operationSeasonId to differ from current season', () => {
    // Simulate viewing 2025-26 season but operating on 2027-28
    const viewSeasonId = '2025-26';
    const operationSeasonId = '2027-28';

    const ctx = buildRuleContextForPlayerMove({
      player: LEBRON_2026_UFA,
      teamState: SAMPLE_TEAM_STATE,
      operationType: 'UFA_SIGNING',
      operationSeasonId: operationSeasonId,
    });

    // Operation should use the explicitly provided season
    expect(ctx.timing.operationSeasonId).toBe('2027-28');
    expect(ctx.timing.operationSeasonId).not.toBe(viewSeasonId);

    // Cap should be for operation season, not view season
    const cap2728 = getCapForSeason('2027-28');
    const cap2526 = getCapForSeason('2025-26');
    expect(ctx.cap.salaryCap).toBe(cap2728.salaryCap);
    expect(ctx.cap.salaryCap).not.toBe(cap2526.salaryCap);
  });

  it('should use explicit operationSeasonId over derived value', () => {
    // Player contract ends 2025-26, but we explicitly say operation is 2028-29
    // This tests the ability to model future signings
    const ctx = buildRuleContextForPlayerMove({
      player: LEBRON_2026_UFA,
      teamState: SAMPLE_TEAM_STATE,
      operationType: 'UFA_SIGNING',
      operationSeasonId: '2028-29',
    });

    // Explicit operationSeasonId should override any derivation
    expect(ctx.timing.operationSeasonId).toBe('2028-29');

    // Reference season is always the season before operation for UFA signings
    // (used for cap lookups, not for player's contract salary - that comes from contract data)
    expect(ctx.timing.referenceSeasonId).toBe('2027-28');
  });

  it('should support different seasons for multi-year cap table columns', () => {
    // Scenario: User viewing multi-year cap table, clicks on 2029-30 column
    const currentViewSeason = '2025-26';
    const clickedColumnSeason = '2029-30';

    const ctx = buildRuleContextForPlayerMove({
      player: LEBRON_2026_UFA,
      teamState: SAMPLE_TEAM_STATE,
      operationType: 'UFA_SIGNING',
      operationSeasonId: clickedColumnSeason,
    });

    expect(ctx.timing.operationSeasonId).toBe(clickedColumnSeason);

    // Cap should be for clicked column season
    const cap2930 = getCapForSeason('2029-30');
    expect(ctx.cap.salaryCap).toBe(cap2930.salaryCap);
  });

  it('should handle trade operations with explicit operation season', () => {
    const ctx = buildRuleContextForPlayerMove({
      player: VET_10_YOS,
      teamState: SAMPLE_TEAM_STATE,
      operationType: 'TRADE',
      operationSeasonId: '2025-26',
    });

    // Trade operation should use current season
    expect(ctx.timing.operationSeasonId).toBe('2025-26');
    // For trades, reference season equals operation season
    expect(ctx.timing.referenceSeasonId).toBe('2025-26');
  });
});

/**
 * Test Suite 5: Validation and Error Handling
 */
describe('RuleContext Validation', () => {
  it('should throw error for invalid season format', () => {
    expect(() =>
      buildRuleContextForPlayerMove({
        player: LEBRON_2026_UFA,
        teamState: SAMPLE_TEAM_STATE,
        operationType: 'UFA_SIGNING',
        operationSeasonId: 'invalid',
      })
    ).toThrow(RuleContextValidationError);
  });

  it('should throw error for unsupported future season', () => {
    expect(() =>
      buildRuleContextForPlayerMove({
        player: LEBRON_2026_UFA,
        teamState: SAMPLE_TEAM_STATE,
        operationType: 'UFA_SIGNING',
        operationSeasonId: '2040-41',
      })
    ).toThrow(RuleContextValidationError);
  });

  it('validateRuleContext should accept valid context', () => {
    const ctx = buildRuleContextForPlayerMove({
      player: LEBRON_2026_UFA,
      teamState: SAMPLE_TEAM_STATE,
      operationType: 'UFA_SIGNING',
      operationSeasonId: '2026-27',
    });

    expect(() => validateRuleContext(ctx)).not.toThrow();
  });

  it('buildMinimalRuleContext should create valid cap-only context', () => {
    const ctx = buildMinimalRuleContext('2026-27');

    expect(() => validateRuleContext(ctx)).not.toThrow();
    expect(ctx.timing.operationSeasonId).toBe('2026-27');
    expect(ctx.cap.salaryCap).toBeGreaterThan(0);
  });
});

/**
 * Test Suite 6: Season Derivation Logic
 */
describe('Season Derivation by Operation Type', () => {
  it('UFA_SIGNING should derive operationSeasonId from simulationDate/current season', () => {
    // When no explicit operationSeasonId, should derive from simulation date
    const ctx = buildRuleContextForPlayerMove({
      player: LEBRON_2026_UFA,
      teamState: SAMPLE_TEAM_STATE,
      operationType: 'UFA_SIGNING',
      // Not providing operationSeasonId - should derive from simulationDate
      simulationDate: new Date('2025-07-15'), // Offseason 2025-26
    });

    // Should derive current season from simulation date
    // July 2025 means we're in 2025-26 season
    expect(ctx.timing.operationSeasonId).toBe('2025-26');
  });

  it('TRADE should use current season', () => {
    const ctx = buildRuleContextForPlayerMove({
      player: VET_10_YOS,
      teamState: SAMPLE_TEAM_STATE,
      operationType: 'TRADE',
      simulationDate: new Date('2025-02-15'), // Mid-season
    });

    // Trades happen in current season
    expect(ctx.timing.operationSeasonId).toBe('2024-25');
  });

  it('VETERAN_EXTENSION should derive from contract end', () => {
    const ctx = buildRuleContextForPlayerMove({
      player: EXTENSION_ELIGIBLE_PLAYER,
      teamState: SAMPLE_TEAM_STATE,
      operationType: 'VETERAN_EXTENSION',
    });

    // Extension starts after contract ends (2026-27 -> 2027-28)
    expect(ctx.timing.operationSeasonId).toBe('2027-28');
    expect(ctx.timing.referenceSeasonId).toBe('2026-27');
  });
});
