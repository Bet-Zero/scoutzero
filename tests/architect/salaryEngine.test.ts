/**
 * Salary Engine Test Suite
 *
 * Tests the centralized Salary Engine entry points for:
 * - getSalaryProfile (complete profile)
 * - getMaxSalaryProfile (max salary by YOS/supermax)
 * - getMinSalaryProfile (minimum salary by YOS)
 * - getBirdRightsProfile (Bird rights classification)
 * - getExtensionProfile (extension eligibility/terms)
 * - getRFAProfile (RFA status and qualifying offer)
 *
 * All tests use RuleContext for consistent timing and cap handling.
 *
 * @file tests/architect/salaryEngine.test.js
 */

import { describe, it, expect } from 'vitest';
import {
  getSalaryProfile,
  getMaxSalaryProfile,
  getMinSalaryProfile,
  getBirdRightsProfile,
  getExtensionProfile,
  getRFAProfile,
  buildRuleContextForPlayerMove,
  buildMinimalRuleContext,
} from '@/features/architect/utils/salaryEngine';
import { getCapForSeason } from '@/features/architect/utils/capHelpers';

/**
 * Test Fixtures
 */

// LeBron-style veteran: 10+ years, Full Bird rights, 2026 UFA
const LEBRON_STYLE_VETERAN = {
  playerId: 'lebron_style_test',
  displayName: 'LeBron Style Test',
  bio: {
    experience: 22,
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
      { season: '2024-25', salary: 47607350, capHit: 47607350, guaranteed: true },
      { season: '2025-26', salary: 52000000, capHit: 52000000, guaranteed: true },
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

// Early Bird player: 2 years with team
const EARLY_BIRD_PLAYER = {
  playerId: 'early_bird_test',
  displayName: 'Early Bird Test',
  bio: {
    experience: 5,
    draftYear: 2019,
    draftRound: 1,
    draftPick: 10,
  },
  yearsOfService: 5,
  teamId: 'BOS',
  teamCode: 'BOS',
  contract: {
    endSeason: '2024-25',
    salariesByYear: [
      { season: '2024-25', salary: 15000000, capHit: 15000000, guaranteed: true },
    ],
    birdRights: {
      status: 'Early',
      yearsWithTeam: 2,
    },
    freeAgency: {
      type: 'Unrestricted',
      year: 2025,
    },
  },
};

// Non-Bird player: 1 year with team
const NON_BIRD_PLAYER = {
  playerId: 'non_bird_test',
  displayName: 'Non-Bird Test',
  bio: {
    experience: 3,
    draftYear: 2021,
    draftRound: 2,
    draftPick: 35,
  },
  yearsOfService: 3,
  teamId: 'MIA',
  teamCode: 'MIA',
  contract: {
    endSeason: '2024-25',
    salariesByYear: [
      { season: '2024-25', salary: 5000000, capHit: 5000000, guaranteed: true },
    ],
    birdRights: {
      status: 'Non-Bird',
      yearsWithTeam: 1,
    },
    freeAgency: {
      type: 'Unrestricted',
      year: 2025,
    },
  },
};

// Rookie on 4th year - RFA eligible
const ROOKIE_FOURTH_YEAR = {
  playerId: 'rookie_4th_test',
  displayName: 'Rookie Fourth Year Test',
  bio: {
    experience: 3,
    draftYear: 2021,
    draftRound: 1,
    draftPick: 5,
  },
  yearsOfService: 3,
  teamId: 'OKC',
  teamCode: 'OKC',
  contract: {
    contractType: 'Rookie Scale',
    isRookieScale: true,
    endSeason: '2024-25',
    salariesByYear: [
      { season: '2024-25', salary: 9500000, capHit: 9500000, guaranteed: true },
    ],
    birdRights: {
      status: 'Full',
      yearsWithTeam: 4,
    },
    freeAgency: {
      type: 'Restricted',
      year: 2025,
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
 * Test Suite: getSalaryProfile
 */
describe('getSalaryProfile', () => {
  it('returns complete profile with all sections for veteran', () => {
    const ctx = buildRuleContextForPlayerMove({
      player: LEBRON_STYLE_VETERAN,
      teamState: SAMPLE_TEAM_STATE,
      operationType: 'UFA_SIGNING',
      operationSeasonId: '2026-27',
    });

    const profile = getSalaryProfile(ctx);

    // Should have all profile sections
    expect(profile.maxSalary).toBeDefined();
    expect(profile.minSalary).toBeDefined();
    expect(profile.birdRights).toBeDefined();
    expect(profile.extension).toBeDefined();
    expect(profile.rfa).toBeDefined();

    // Max salary should be 35% tier
    expect(profile.maxSalary.tier).toContain('35%');
    expect(profile.maxSalary.maxSalary).toBeGreaterThan(0);

    // Min salary should be for 10+ YOS
    expect(profile.minSalary.reason).toContain('10+ years');

    // Bird rights should be Full
    expect(profile.birdRights.type).toBe('Full Bird');
  });

  it('uses correct season cap for calculations', () => {
    const ctx = buildRuleContextForPlayerMove({
      player: LEBRON_STYLE_VETERAN,
      teamState: SAMPLE_TEAM_STATE,
      operationType: 'UFA_SIGNING',
      operationSeasonId: '2026-27',
    });

    const profile = getSalaryProfile(ctx);
    const cap2627 = getCapForSeason('2026-27');

    // Max salary should be 35% of 2026-27 cap
    expect(cap2627).not.toBeNull();
    const expectedMax = Math.round((cap2627?.salaryCap ?? 0) * 0.35);
    expect(profile.maxSalary.maxSalary).toBe(expectedMax);
  });
});

/**
 * Test Suite: getMaxSalaryProfile
 */
describe('getMaxSalaryProfile', () => {
  it('returns 35% max for 10+ year veteran', () => {
    const ctx = buildRuleContextForPlayerMove({
      player: LEBRON_STYLE_VETERAN,
      teamState: SAMPLE_TEAM_STATE,
      operationType: 'UFA_SIGNING',
      operationSeasonId: '2026-27',
    });

    const maxInfo = getMaxSalaryProfile(ctx);

    expect(maxInfo.yearsOfService).toBeGreaterThanOrEqual(10);
    expect(maxInfo.tier).toContain('35%');
    expect(maxInfo.maxSalary).toBeGreaterThan(0);
  });

  it('returns 25% max for 0-6 year player', () => {
    const ctx = buildRuleContextForPlayerMove({
      player: EARLY_BIRD_PLAYER,
      teamState: SAMPLE_TEAM_STATE,
      operationType: 'UFA_SIGNING',
      operationSeasonId: '2025-26',
    });

    const maxInfo = getMaxSalaryProfile(ctx);

    expect(maxInfo.yearsOfService).toBeLessThan(7);
    expect(maxInfo.tier).toContain('25%');
  });

  it('includes prior salary consideration (105% Bird max)', () => {
    const ctx = buildRuleContextForPlayerMove({
      player: LEBRON_STYLE_VETERAN,
      teamState: SAMPLE_TEAM_STATE,
      operationType: 'UFA_SIGNING',
      operationSeasonId: '2026-27',
    });

    const maxInfo = getMaxSalaryProfile(ctx);

    // maxSalaryBird should be at least max or 105% of prior
    expect(maxInfo.maxSalaryBird).toBeDefined();
    expect(maxInfo.maxSalaryBird).toBeGreaterThanOrEqual(maxInfo.maxSalary);
  });
});

/**
 * Test Suite: getMinSalaryProfile
 */
describe('getMinSalaryProfile', () => {
  it('returns correct minimum for rookie (0 YOS)', () => {
    const ctx = buildMinimalRuleContext('2025-26', 'MINIMUM_SIGNING');

    // Override the player context for 0 YOS
    ctx.player.yearsOfServiceAtOperation = 0;

    const minInfo = getMinSalaryProfile(ctx);

    expect(minInfo.yearsOfService).toBe(0);
    expect(minInfo.reason).toContain('Rookie');
    expect(minInfo.minimumSalary).toBeGreaterThan(0);
  });

  it('returns correct minimum for 10+ year veteran', () => {
    const ctx = buildRuleContextForPlayerMove({
      player: LEBRON_STYLE_VETERAN,
      teamState: SAMPLE_TEAM_STATE,
      operationType: 'MINIMUM_SIGNING',
      operationSeasonId: '2025-26',
    });

    const minInfo = getMinSalaryProfile(ctx);

    expect(minInfo.yearsOfService).toBeGreaterThanOrEqual(10);
    expect(minInfo.reason).toContain('10+ years');
  });

  it('uses correct season for minimum salary scale', () => {
    const ctx2526 = buildMinimalRuleContext('2025-26', 'MINIMUM_SIGNING');
    const ctx2627 = buildMinimalRuleContext('2026-27', 'MINIMUM_SIGNING');

    const min2526 = getMinSalaryProfile(ctx2526);
    const min2627 = getMinSalaryProfile(ctx2627);

    // Both should return valid minimums
    expect(min2526.minimumSalary).toBeGreaterThan(0);
    expect(min2627.minimumSalary).toBeGreaterThan(0);
    expect(min2526.season).toBe('2025-26');
    expect(min2627.season).toBe('2026-27');
  });
});

/**
 * Test Suite: getBirdRightsProfile
 */
describe('getBirdRightsProfile', () => {
  it('identifies Full Bird rights correctly', () => {
    const ctx = buildRuleContextForPlayerMove({
      player: LEBRON_STYLE_VETERAN,
      teamState: SAMPLE_TEAM_STATE,
      operationType: 'UFA_SIGNING',
      operationSeasonId: '2026-27',
    });

    const birdInfo = getBirdRightsProfile(ctx);

    expect(birdInfo.type).toBe('Full Bird');
    expect(birdInfo.signingAbilities.canSignOverCap).toBe(true);
    expect(birdInfo.signingAbilities.canSignToMax).toBe(true);
    expect(birdInfo.config.maxContractYears).toBe(5);
    expect(birdInfo.config.raisePercentage).toBe(0.08);
  });

  it('identifies Early Bird rights correctly', () => {
    const ctx = buildRuleContextForPlayerMove({
      player: EARLY_BIRD_PLAYER,
      teamState: SAMPLE_TEAM_STATE,
      operationType: 'UFA_SIGNING',
      operationSeasonId: '2025-26',
    });

    const birdInfo = getBirdRightsProfile(ctx);

    expect(birdInfo.type).toBe('Early Bird');
    expect(birdInfo.signingAbilities.canSignOverCap).toBe(true);
    expect(birdInfo.signingAbilities.canSignToMax).toBe(false);
    expect(birdInfo.signingAbilities.maxFirstYearSalary).toBeGreaterThan(0);
    expect(birdInfo.config.maxContractYears).toBe(4);
  });

  it('identifies Non-Bird rights correctly', () => {
    const ctx = buildRuleContextForPlayerMove({
      player: NON_BIRD_PLAYER,
      teamState: SAMPLE_TEAM_STATE,
      operationType: 'UFA_SIGNING',
      operationSeasonId: '2025-26',
    });

    const birdInfo = getBirdRightsProfile(ctx);

    expect(birdInfo.type).toBe('Non-Bird');
    expect(birdInfo.signingAbilities.canSignOverCap).toBe(true);
    expect(birdInfo.signingAbilities.canSignToMax).toBe(false);
    expect(birdInfo.config.raisePercentage).toBe(0.05);
  });

  it('calculates Early Bird max correctly (175% prior or 105% avg)', () => {
    const ctx = buildRuleContextForPlayerMove({
      player: EARLY_BIRD_PLAYER,
      teamState: SAMPLE_TEAM_STATE,
      operationType: 'UFA_SIGNING',
      operationSeasonId: '2025-26',
    });

    const birdInfo = getBirdRightsProfile(ctx);
    const cap = getCapForSeason('2025-26');

    // Early Bird max should be max of 175% prior or 105% avg
    const priorSalary = ctx.player.priorSeasonSalary || 15000000;
    const expected175 = priorSalary * 1.75;
    expect(cap).not.toBeNull();
    const expected105 = (cap?.averagePlayerSalary ?? 0) * 1.05;
    const expectedMax = Math.max(expected175, expected105);

    // Allow for rounding differences (tolerance of 10000)
    expect(
      Math.abs((birdInfo.signingAbilities.maxFirstYearSalary ?? 0) - expectedMax)
    ).toBeLessThan(10000);
  });
});

/**
 * Test Suite: getExtensionProfile
 */
describe('getExtensionProfile', () => {
  it('returns eligibility and terms for extension check', () => {
    const ctx = buildRuleContextForPlayerMove({
      player: LEBRON_STYLE_VETERAN,
      teamState: SAMPLE_TEAM_STATE,
      operationType: 'VETERAN_EXTENSION',
    });

    const extProfile = getExtensionProfile(ctx);

    expect(extProfile.eligibility).toBeDefined();
    expect(extProfile.eligibility.isEligible).toBeDefined();
    expect(extProfile.eligibility.reason).toBeDefined();
    expect(extProfile.eligibility.extensionType).toBeDefined();
  });

  it('returns ineligible for context without contract', () => {
    const ctx = buildMinimalRuleContext('2025-26', 'VETERAN_EXTENSION');

    const extProfile = getExtensionProfile(ctx);

    // Minimal context has no contract info
    expect(extProfile.eligibility.isEligible).toBe(false);
    expect(extProfile.terms).toBeNull();
  });
});

/**
 * Test Suite: getRFAProfile
 */
describe('getRFAProfile', () => {
  it('identifies RFA for rookie completing 4th year', () => {
    const ctx = buildRuleContextForPlayerMove({
      player: ROOKIE_FOURTH_YEAR,
      teamState: SAMPLE_TEAM_STATE,
      operationType: 'QUALIFYING_OFFER',
      operationSeasonId: '2025-26',
    });

    const rfaInfo = getRFAProfile(ctx);

    // Should be RFA eligible
    expect(rfaInfo.isRFA).toBe(true);
    expect(rfaInfo.qualifyingOfferEligible).toBe(true);
  });

  it('identifies UFA for veteran', () => {
    const ctx = buildRuleContextForPlayerMove({
      player: LEBRON_STYLE_VETERAN,
      teamState: SAMPLE_TEAM_STATE,
      operationType: 'UFA_SIGNING',
      operationSeasonId: '2026-27',
    });

    const rfaInfo = getRFAProfile(ctx);

    // Veteran with 22 YOS should not be RFA
    expect(rfaInfo.isRFA).toBe(false);
  });
});

/**
 * Test Suite: Integration - Full Profile Flow
 */
describe('Full Profile Flow Integration', () => {
  it('profile is deterministic - same inputs yield same output', () => {
    const ctx = buildRuleContextForPlayerMove({
      player: LEBRON_STYLE_VETERAN,
      teamState: SAMPLE_TEAM_STATE,
      operationType: 'UFA_SIGNING',
      operationSeasonId: '2026-27',
    });

    const profile1 = getSalaryProfile(ctx);
    const profile2 = getSalaryProfile(ctx);

    expect(profile1.maxSalary).toEqual(profile2.maxSalary);
    expect(profile1.minSalary).toEqual(profile2.minSalary);
    expect(profile1.birdRights).toEqual(profile2.birdRights);
  });

  it('uses operationSeasonId for cap lookups, not current date', () => {
    // Build context for future season
    const ctx = buildRuleContextForPlayerMove({
      player: LEBRON_STYLE_VETERAN,
      teamState: SAMPLE_TEAM_STATE,
      operationType: 'UFA_SIGNING',
      operationSeasonId: '2029-30',
    });

    const profile = getSalaryProfile(ctx);
    const cap2930 = getCapForSeason('2029-30');

    // Max should use 2029-30 cap
    expect(cap2930).not.toBeNull();
    const expectedMax = Math.round((cap2930?.salaryCap ?? 0) * 0.35);
    expect(profile.maxSalary.maxSalary).toBe(expectedMax);
  });

  it('handles different operation types correctly', () => {
    // UFA signing
    const ufaCtx = buildRuleContextForPlayerMove({
      player: EARLY_BIRD_PLAYER,
      teamState: SAMPLE_TEAM_STATE,
      operationType: 'UFA_SIGNING',
      operationSeasonId: '2025-26',
    });

    // Minimum signing
    const minCtx = buildRuleContextForPlayerMove({
      player: EARLY_BIRD_PLAYER,
      teamState: SAMPLE_TEAM_STATE,
      operationType: 'MINIMUM_SIGNING',
      operationSeasonId: '2025-26',
    });

    const ufaProfile = getSalaryProfile(ufaCtx);
    const minProfile = getSalaryProfile(minCtx);

    // Both should return valid profiles
    expect(ufaProfile.maxSalary.maxSalary).toBeGreaterThan(0);
    expect(minProfile.minSalary.minimumSalary).toBeGreaterThan(0);
  });
});
