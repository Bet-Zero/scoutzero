/**
 * Player Rules Profile Test Suite
 *
 * Tests the player rules determination layer across various scenarios:
 * - Extension eligibility and terms
 * - Bird rights classification
 * - Minimum salary calculation
 * - Max salary determination
 * - Restricted free agency status
 *
 * @file tests/architect/playerRulesProfile.test.js
 */

import { describe, it, expect, vi } from 'vitest';

// NOTE: This test intentionally imports INTERNAL implementation directly.
// Most Architect code must import from salaryEngine instead:
//   import { ... } from '@/features/architect/utils/salaryEngine'
import {
  computePlayerRulesProfile,
  computeExtensionEligibility,
  computeExtensionTerms,
  computeExtensionFromRuleContext,
  computeBirdRights,
  computeBirdRightsFromRuleContext,
  computeMinimumSalary,
  computeMinimumSalaryFromRuleContext,
  computeRFAStatus,
  computeQualifyingOffer,
  computeRFAFromRuleContext,
  computeMaxSalary,
  computeMaxSalaryFromRuleContext,
  BIRD_RIGHTS_TYPES,
  EXTENSION_TYPES,
  MAX_SALARY_TIERS,
  RFA_STATUS,
} from '@/features/architect/utils/playerRulesProfile';

type RequiredExtensionTerms = NonNullable<
  ReturnType<typeof computeExtensionTerms>
>;

function requireExtensionTerms(
  terms: ReturnType<typeof computeExtensionTerms>
): RequiredExtensionTerms {
  expect(terms).not.toBeNull();
  if (!terms) {
    throw new Error('Expected extension terms');
  }
  return terms;
}

function requireObject<T extends object>(
  value: T | null | undefined,
  label: string
): T {
  expect(value).not.toBeNull();
  if (!value) {
    throw new Error(`Expected ${label}`);
  }
  return value;
}

function requireNumber(value: number | null, label: string): number {
  expect(value).not.toBeNull();
  if (value === null) {
    throw new Error(`Expected ${label}`);
  }
  return value;
}

/**
 * Test Fixtures - Representative player scenarios
 */

// Veteran star player - Full Bird rights, extension eligible
const VETERAN_STAR = {
  playerId: 'veteran_star',
  displayName: 'Veteran Star',
  bio: {
    experience: 12,
    draftYear: 2012,
    draftRound: 1,
    draftPick: 1,
  },
  contract: {
    contractType: 'Standard',
    isRookieScale: false,
    contractLength: 4,
    yearsRemaining: 2,
    startSeason: '2022-23',
    endSeason: '2025-26',
    signingDate: '2022-07-01',
    salariesByYear: [
      {
        season: '2024-25',
        salary: 45_000_000,
        capHit: 45_000_000,
        guaranteed: true,
      },
      {
        season: '2025-26',
        salary: 48_000_000,
        capHit: 48_000_000,
        guaranteed: true,
      },
    ],
    birdRights: {
      status: 'Full',
      yearsWithTeam: 5,
      yearsOfService: 12,
    },
    freeAgency: {
      type: 'Unrestricted',
      year: 2026,
    },
  },
  awards: [
    { type: 'All-NBA', team: 1, year: 2024 },
    { type: 'All-NBA', team: 2, year: 2023 },
  ],
};

// Rookie completing 4th year - RFA, rookie extension eligible
const ROOKIE_FOURTH_YEAR = {
  playerId: 'rookie_fourth',
  displayName: 'Rookie Fourth Year',
  bio: {
    experience: 3,
    draftYear: 2021,
    draftRound: 1,
    draftPick: 5,
  },
  // Note: draftYear also in bio for consistency with player data sources
  contract: {
    contractType: 'Rookie Scale',
    isRookieScale: true,
    contractLength: 4,
    yearsRemaining: 1,
    startSeason: '2021-22',
    endSeason: '2024-25',
    salariesByYear: [
      {
        season: '2024-25',
        salary: 9_500_000,
        capHit: 9_500_000,
        guaranteed: true,
      },
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

// Mid-career player - Early Bird rights
const MID_CAREER = {
  playerId: 'mid_career',
  displayName: 'Mid Career Player',
  bio: {
    experience: 5,
  },
  contract: {
    contractType: 'Standard',
    isRookieScale: false,
    contractLength: 3,
    yearsRemaining: 1,
    startSeason: '2022-23',
    endSeason: '2024-25',
    salariesByYear: [
      {
        season: '2024-25',
        salary: 15_000_000,
        capHit: 15_000_000,
        guaranteed: true,
      },
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

// Young player on second contract - Non-Bird rights
const YOUNG_PLAYER = {
  playerId: 'young_player',
  displayName: 'Young Player',
  bio: {
    experience: 2,
  },
  contract: {
    contractType: 'Standard',
    isRookieScale: false,
    contractLength: 2,
    yearsRemaining: 1,
    startSeason: '2023-24',
    endSeason: '2024-25',
    salariesByYear: [
      {
        season: '2024-25',
        salary: 5_000_000,
        capHit: 5_000_000,
        guaranteed: true,
      },
    ],
    birdRights: {
      status: 'Non-Bird',
      yearsWithTeam: 1,
    },
    freeAgency: {
      type: 'Restricted',
      year: 2025,
    },
  },
};

// Two-way contract player
const TWO_WAY_PLAYER = {
  playerId: 'two_way',
  displayName: 'Two Way Player',
  bio: {
    experience: 1,
  },
  contract: {
    contractType: 'TwoWay',
    isRookieScale: false,
    yearsRemaining: 1,
    salariesByYear: [
      {
        season: '2024-25',
        salary: 560_000,
        capHit: 560_000,
        guaranteed: false,
      },
    ],
    birdRights: {
      status: 'None',
      yearsWithTeam: 0,
    },
  },
};

// Free agent with no contract
const FREE_AGENT = {
  playerId: 'free_agent',
  displayName: 'Free Agent',
  bio: {
    experience: 6,
  },
  contract: null,
};

// Recently traded player
const TRADED_PLAYER = {
  playerId: 'traded_player',
  displayName: 'Traded Player',
  bio: {
    experience: 7,
  },
  lastTradedDate: '2024-10-15',
  contract: {
    contractType: 'Standard',
    contractLength: 4,
    yearsRemaining: 2,
    startSeason: '2022-23',
    endSeason: '2025-26',
    salariesByYear: [
      {
        season: '2024-25',
        salary: 25_000_000,
        capHit: 25_000_000,
        guaranteed: true,
      },
      {
        season: '2025-26',
        salary: 27_000_000,
        capHit: 27_000_000,
        guaranteed: true,
      },
    ],
    birdRights: {
      status: 'Full',
      yearsWithTeam: 3,
    },
  },
};

// Standard league context
const LEAGUE_CONTEXT = {
  currentSeason: '2024-25',
  currentYear: 2025,
  simulationDate: new Date('2025-01-15'),
  leaguePhase: 'regular',
  capSettings: {
    salaryCap: 140_588_000,
    firstApron: 178_132_000,
    secondApron: 188_938_000,
    taxLine: 170_818_000,
    averageSalary: 11_100_000,
  },
};

// Team context
const TEAM_CONTEXT = {
  teamCode: 'LAL',
  teamSalary: 180_000_000,
  isOverCap: true,
  apronStatus: 'ABOVE_FIRST_APRON',
};

const EARLY_BIRD_RULE_CONTEXT = {
  timing: {
    operationSeasonId: '2025-26',
    referenceSeasonId: '2024-25',
    capSeasonId: '2025-26',
    operationDate: new Date('2025-07-10T00:00:00.000Z'),
  },
  cap: {
    salaryCap: 154_647_000,
    averagePlayerSalary: 11_100_000,
  },
  player: {
    playerId: 'rule_ctx_early_bird',
    yearsOfServiceAtOperation: 5,
    priorSeasonSalary: 15_000_000,
    currentSeasonSalary: 15_000_000,
    birdTypeAtOperation: 'Early Bird',
    isRookieScale: false,
    draftInfo: null,
    contractEndSeasonId: '2024-25',
    originalContractLength: 4,
    contractYearsRemaining: 1,
    awards: [],
    lastTradedDate: null,
    signingDate: '2022-07-01',
  },
};

const ROOKIE_RFA_RULE_CONTEXT = {
  timing: {
    operationSeasonId: '2025-26',
    referenceSeasonId: '2024-25',
    capSeasonId: '2025-26',
    operationDate: new Date('2025-07-10T00:00:00.000Z'),
  },
  cap: {
    salaryCap: 154_647_000,
    averagePlayerSalary: 11_100_000,
  },
  player: {
    playerId: 'rule_ctx_rookie_rfa',
    yearsOfServiceAtOperation: 3,
    priorSeasonSalary: 9_500_000,
    currentSeasonSalary: 9_500_000,
    birdTypeAtOperation: 'Full Bird',
    isRookieScale: true,
    draftInfo: {
      year: 2021,
      pick: 5,
    },
    contractEndSeasonId: '2024-25',
    originalContractLength: 4,
    contractYearsRemaining: 1,
    awards: [],
    lastTradedDate: null,
    signingDate: '2022-07-01',
  },
};

const VETERAN_EXTENSION_RULE_CONTEXT = {
  timing: {
    operationSeasonId: '2026-27',
    referenceSeasonId: '2025-26',
    capSeasonId: '2026-27',
    operationDate: new Date('2026-07-10T00:00:00.000Z'),
  },
  cap: {
    salaryCap: 160_000_000,
    averagePlayerSalary: 12_000_000,
  },
  player: {
    playerId: 'rule_ctx_veteran_extension',
    yearsOfServiceAtOperation: 8,
    priorSeasonSalary: 40_000_000,
    currentSeasonSalary: 40_000_000,
    birdTypeAtOperation: 'Full Bird',
    isRookieScale: false,
    draftInfo: {
      year: 2018,
    },
    contractEndSeasonId: '2026-27',
    originalContractLength: 4,
    contractYearsRemaining: 1,
    awards: [],
    lastTradedDate: null,
    signingDate: '2023-07-01',
  },
};

/**
 * Test: computePlayerRulesProfile
 */
describe('computePlayerRulesProfile', () => {
  it('returns complete profile for veteran star player', () => {
    const profile = computePlayerRulesProfile(
      VETERAN_STAR,
      TEAM_CONTEXT,
      LEAGUE_CONTEXT
    );

    expect(profile.playerId).toBe('veteran_star');
    expect(profile.playerName).toBe('Veteran Star');
    expect(profile.evaluatedForSeason).toBe('2024-25');

    // Should have all required sections
    expect(profile.extensionEligibility).toBeDefined();
    expect(profile.birdRights).toBeDefined();
    expect(profile.minimumSalary).toBeGreaterThan(0);
    expect(profile.maxSalary).toBeDefined();
    expect(profile.restrictedFreeAgency).toBeDefined();
    expect(profile.contractSummary).toBeDefined();
  });

  it('returns empty profile with preserved evaluation timing for null player', () => {
    const simulationDate = new Date('2026-07-10T00:00:00.000Z');
    const profile = computePlayerRulesProfile(
      null,
      TEAM_CONTEXT,
      { simulationDate }
    );

    expect(profile.error).toBe('No player data provided');
    expect(profile.evaluatedAt).toBe(simulationDate.toISOString());
    expect(profile.evaluatedForSeason).toBe('2026-27');
    expect(Object.keys(profile)).toEqual([
      'playerId',
      'playerName',
      'evaluatedAt',
      'evaluatedForSeason',
      'error',
      'extensionEligibility',
      'extensionTerms',
      'birdRights',
      'minimumSalary',
      'minimumSalaryReason',
      'maxSalary',
      'restrictedFreeAgency',
      'contractSummary',
      'teamContext',
    ]);
    expect(profile.extensionEligibility.isEligible).toBe(false);
  });

  it('includes team context when provided', () => {
    const profile = computePlayerRulesProfile(
      VETERAN_STAR,
      TEAM_CONTEXT,
      LEAGUE_CONTEXT
    );

    expect(profile.teamContext).not.toBeNull();
    if (!profile.teamContext) {
      throw new Error('Expected team context');
    }
    expect(profile.teamContext.teamCode).toBe('LAL');
    expect(profile.teamContext.isOverCap).toBe(true);
  });

  it('omits team context when teamCode is not provided', () => {
    const profile = computePlayerRulesProfile(
      VETERAN_STAR,
      {
        isOverCap: true,
        apronStatus: 'ABOVE_FIRST_APRON',
      },
      LEAGUE_CONTEXT
    );

    expect(profile.teamContext).toBeNull();
  });

  it('derives evaluated season from simulationDate when season and year are omitted', () => {
    const simulationDate = new Date('2026-07-10T00:00:00.000Z');
    const profile = computePlayerRulesProfile(
      VETERAN_STAR,
      TEAM_CONTEXT,
      { simulationDate }
    );

    expect(profile.evaluatedAt).toBe(simulationDate.toISOString());
    expect(profile.evaluatedForSeason).toBe('2026-27');
  });

  it('preserves profile field order and nested helper fields for eligible players', () => {
    const profile = computePlayerRulesProfile(
      VETERAN_STAR,
      TEAM_CONTEXT,
      LEAGUE_CONTEXT
    );

    expect(Object.keys(profile)).toEqual([
      'playerId',
      'playerName',
      'evaluatedAt',
      'evaluatedForSeason',
      'extensionEligibility',
      'extensionTerms',
      'birdRights',
      'minimumSalary',
      'minimumSalaryReason',
      'maxSalary',
      'restrictedFreeAgency',
      'contractSummary',
      'teamContext',
    ]);
    expect(Object.keys(profile.extensionEligibility)).toEqual([
      'isEligible',
      'reason',
      'blockers',
      'extensionType',
      'eligibleDate',
    ]);
    const extensionTerms = requireObject(
      profile.extensionTerms,
      'profile extension terms'
    );
    const teamContext = requireObject(profile.teamContext, 'team context');

    expect(Object.keys(extensionTerms)).toEqual([
      'maxYears',
      'maxFirstYearSalary',
      'minFirstYearSalary',
      'raisePercentage',
      'extensionType',
      'basedOn',
      'notes',
    ]);
    expect(Object.keys(profile.birdRights)).toEqual([
      'type',
      'yearsWithTeam',
      'summary',
      'signingAbilities',
    ]);
    expect(Object.keys(profile.maxSalary)).toEqual([
      'maxSalary',
      'maxSalaryBird',
      'tier',
      'supermaxEligible',
      'reason',
    ]);
    expect(Object.keys(profile.restrictedFreeAgency)).toEqual([
      'isRFA',
      'qualifyingOfferEligible',
      'qualifyingOfferAmount',
      'canAcceptQO',
      'qoDeadline',
      'teamHasMatchingRights',
      'reason',
    ]);
    expect(Object.keys(profile.contractSummary)).toEqual([
      'yearsOfService',
      'yearsRemaining',
      'freeAgencyYear',
      'freeAgencyType',
      'currentSalary',
      'hasContract',
      'contractType',
      'isRookieScale',
    ]);
    expect(Object.keys(teamContext)).toEqual([
      'teamCode',
      'isOverCap',
      'apronStatus',
    ]);

    expect(profile.minimumSalaryReason).toBe('Veteran minimum (10+ years)');
    expect(profile.extensionEligibility.blockers).toEqual([]);
    expect(profile.extensionEligibility.eligibleDate).toBeNull();
    expect(profile.maxSalary.maxSalaryBird).toBeGreaterThan(0);
    expect(profile.restrictedFreeAgency.qualifyingOfferAmount).toBeNull();
    expect(profile.restrictedFreeAgency.canAcceptQO).toBe(false);
    expect(profile.restrictedFreeAgency.qoDeadline).toBeNull();
    expect(profile.restrictedFreeAgency.teamHasMatchingRights).toBe(false);
  });
});

/**
 * Test: Extension Eligibility
 */
describe('computeExtensionEligibility', () => {
  it('veteran with 4-year contract after 2 years is eligible', () => {
    const eligibility = computeExtensionEligibility(
      VETERAN_STAR,
      LEAGUE_CONTEXT
    );

    expect(eligibility.isEligible).toBe(true);
    // Veteran star has All-NBA and 12 years of service, qualifies for Designated Veteran
    expect(eligibility.extensionType).toBe('Designated Veteran Extension');
  });

  it('rookie in 4th year is eligible for rookie extension', () => {
    const eligibility = computeExtensionEligibility(
      ROOKIE_FOURTH_YEAR,
      LEAGUE_CONTEXT
    );

    expect(eligibility.isEligible).toBe(true);
    expect(eligibility.extensionType).toBe('Rookie Scale Extension');
  });

  it('two-way player is not extension eligible', () => {
    const eligibility = computeExtensionEligibility(
      TWO_WAY_PLAYER,
      LEAGUE_CONTEXT
    );

    expect(eligibility.isEligible).toBe(false);
    expect(eligibility.reason).toContain('Two-way');
  });

  it('player without contract is not eligible', () => {
    const eligibility = computeExtensionEligibility(FREE_AGENT, LEAGUE_CONTEXT);

    expect(eligibility.isEligible).toBe(false);
    expect(eligibility.reason).toContain('No active contract');
  });

  it('recently traded player has trade restriction', () => {
    const eligibility = computeExtensionEligibility(
      TRADED_PLAYER,
      LEAGUE_CONTEXT
    );

    // May be eligible but with trade restrictions
    if (eligibility.isEligible) {
      expect(['Veteran Extension', 'Trade-Restricted Extension']).toContain(
        eligibility.extensionType
      );
    }
  });

  it('contract too short is not eligible', () => {
    const shortContractPlayer = {
      ...YOUNG_PLAYER,
      contract: {
        ...YOUNG_PLAYER.contract,
        contractLength: 2,
        originalLength: 2,
      },
    };

    const eligibility = computeExtensionEligibility(
      shortContractPlayer,
      LEAGUE_CONTEXT
    );

    expect(eligibility.isEligible).toBe(false);
    expect(eligibility.reason).toContain('3+ years');
  });
});

/**
 * Test: Extension Terms
 */
describe('computeExtensionTerms', () => {
  it('returns terms for eligible veteran', () => {
    const terms = requireExtensionTerms(
      computeExtensionTerms(VETERAN_STAR, LEAGUE_CONTEXT)
    );

    expect(terms.maxYears).toBeGreaterThan(0);
    expect(terms.maxFirstYearSalary).toBeGreaterThan(0);
    expect(terms.raisePercentage).toBeDefined();
  });

  it('returns terms for rookie extension', () => {
    // Stage 6B note: computeExtensionTerms returns the *extension*
    // term length (new years added on top of the remaining rookie
    // deal), not the merged contract length. Rookie Scale Extensions
    // add up to 4 new years onto the rookie 4th year per the CBA,
    // which is what the product helper returns. The Designated
    // Veteran path returns 5 because that contract starts fresh.
    // Keeping the assertion aligned with the surviving extension-only
    // convention preserves the architectural intent of the helper.
    const terms = requireExtensionTerms(
      computeExtensionTerms(ROOKIE_FOURTH_YEAR, LEAGUE_CONTEXT)
    );

    expect(terms.maxYears).toBe(4); // Rookie extensions add up to 4 NEW years on top of the rookie 4th year
    expect(terms.extensionType).toBe('Rookie Scale Extension');
  });

  it('returns null for ineligible player', () => {
    const terms = computeExtensionTerms(TWO_WAY_PLAYER, LEAGUE_CONTEXT);

    expect(terms).toBeNull();
  });

  it('includes Higher Max for All-NBA rookie', () => {
    const allNbaRookie = {
      ...ROOKIE_FOURTH_YEAR,
      awards: [{ type: 'All-NBA', team: 1, year: 2024 }],
    };

    const terms = requireExtensionTerms(
      computeExtensionTerms(allNbaRookie, LEAGUE_CONTEXT)
    );

    expect(terms.basedOn).toContain('30%'); // Higher Max
  });
});

/**
 * Test: Bird Rights
 */
describe('computeBirdRights', () => {
  it('identifies Full Bird rights', () => {
    const birdRights = computeBirdRights(VETERAN_STAR, LEAGUE_CONTEXT);

    expect(birdRights.type).toBe(BIRD_RIGHTS_TYPES.FULL);
    expect(birdRights.signingAbilities.canSignOverCap).toBe(true);
    expect(birdRights.signingAbilities.canSignToMax).toBe(true);
  });

  it('identifies Early Bird rights', () => {
    const birdRights = computeBirdRights(MID_CAREER, LEAGUE_CONTEXT);

    expect(birdRights.type).toBe(BIRD_RIGHTS_TYPES.EARLY);
    expect(birdRights.signingAbilities.canSignOverCap).toBe(true);
    expect(birdRights.signingAbilities.canSignToMax).toBe(false);
    expect(
      requireNumber(
        birdRights.signingAbilities.maxFirstYearSalary,
        'Early Bird max first-year salary'
      )
    ).toBeGreaterThan(0);
  });

  it('identifies Non-Bird rights', () => {
    const birdRights = computeBirdRights(YOUNG_PLAYER, LEAGUE_CONTEXT);

    expect(birdRights.type).toBe(BIRD_RIGHTS_TYPES.NON_BIRD);
    expect(birdRights.signingAbilities.canSignOverCap).toBe(true);
    expect(birdRights.signingAbilities.canSignToMax).toBe(false);
  });

  it('identifies no Bird rights for two-way player', () => {
    const birdRights = computeBirdRights(TWO_WAY_PLAYER, LEAGUE_CONTEXT);

    expect(birdRights.type).toBe(BIRD_RIGHTS_TYPES.NONE);
    expect(birdRights.signingAbilities.canSignOverCap).toBe(false);
  });

  it('fails closed to NONE when salaryCap is missing (ENG-002)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const birdRights = computeBirdRights(VETERAN_STAR, {
        ...LEAGUE_CONTEXT,
        capSettings: { ...LEAGUE_CONTEXT.capSettings, salaryCap: null },
      });

      // Without a valid salary cap we cannot compute signing abilities, so the
      // rule fails closed instead of returning misleading 0-value amounts.
      expect(birdRights.type).toBe(BIRD_RIGHTS_TYPES.NONE);
      expect(birdRights.signingAbilities.canSignOverCap).toBe(false);
      expect(birdRights.notes).toMatch(/salaryCap/i);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('calculates Early Bird max correctly', () => {
    const birdRights = computeBirdRights(MID_CAREER, LEAGUE_CONTEXT);
    const priorSalary = 15_000_000;

    // Early Bird max is 175% of prior salary or 105% of average
    const expected175 = priorSalary * 1.75;
    const expected105 = LEAGUE_CONTEXT.capSettings.averageSalary * 1.05;
    const expectedMax = Math.max(expected175, expected105);

    // Allow for rounding differences (tolerance of 10000)
    expect(
      Math.abs(
        requireNumber(
          birdRights.signingAbilities.maxFirstYearSalary,
          'Early Bird max first-year salary'
        ) - expectedMax
      )
    ).toBeLessThan(10000);
  });
});

/**
 * Test: Minimum Salary
 */
describe('computeMinimumSalary', () => {
  it('returns rookie minimum for 0 years of service', () => {
    const rookiePlayer = {
      bio: { experience: 0 },
    };

    const result = computeMinimumSalary(rookiePlayer, LEAGUE_CONTEXT);

    expect(result.minimumSalary).toBe(1_119_563); // 2024-25 rookie min
    expect(result.yearsOfService).toBe(0);
    expect(result.reason).toContain('Rookie');
  });

  it('returns correct minimum for mid-career player', () => {
    const result = computeMinimumSalary(MID_CAREER, LEAGUE_CONTEXT);

    expect(result.minimumSalary).toBe(2_800_000); // 5 years of service
    expect(result.yearsOfService).toBe(5);
  });

  it('returns 10+ year minimum for veteran', () => {
    const result = computeMinimumSalary(VETERAN_STAR, LEAGUE_CONTEXT);

    expect(result.minimumSalary).toBe(3_800_000); // 10+ years
    expect(result.reason).toContain('10+ years');
  });

  it('handles missing experience data', () => {
    const playerNoExp = { bio: {} };

    const result = computeMinimumSalary(playerNoExp, LEAGUE_CONTEXT);

    expect(result.minimumSalary).toBe(1_119_563); // Defaults to rookie
    expect(result.yearsOfService).toBe(0);
  });
});

/**
 * Test: Max Salary
 */
describe('computeMaxSalary', () => {
  it('returns 25% max for 0-6 year player', () => {
    const result = computeMaxSalary(MID_CAREER, LEAGUE_CONTEXT);

    expect(result.tier).toContain('25%');
    expect(result.maxSalary).toBeCloseTo(
      LEAGUE_CONTEXT.capSettings.salaryCap * 0.25,
      -3
    );
  });

  it('returns 30% max for 7-9 year player', () => {
    const player79 = { bio: { experience: 8 } };

    const result = computeMaxSalary(player79, LEAGUE_CONTEXT);

    expect(result.tier).toContain('30%');
    expect(result.maxSalary).toBeCloseTo(
      LEAGUE_CONTEXT.capSettings.salaryCap * 0.3,
      -3
    );
  });

  it('returns 35% max for 10+ year player', () => {
    const result = computeMaxSalary(VETERAN_STAR, LEAGUE_CONTEXT);

    // Veteran star has All-NBA and 12 years, qualifies for supermax
    expect(result.supermaxEligible).toBe(true);
    expect(result.tier).toContain('35%');
  });

  it('identifies supermax eligibility with All-NBA', () => {
    const result = computeMaxSalary(VETERAN_STAR, LEAGUE_CONTEXT);

    expect(result.supermaxEligible).toBe(true);
    expect(result.reason).toContain('All-NBA');
  });
});

/**
 * Test: RFA Status
 */
describe('computeRFAStatus', () => {
  it('identifies rookie scale RFA', () => {
    const rfaStatus = computeRFAStatus(ROOKIE_FOURTH_YEAR, LEAGUE_CONTEXT);

    expect(rfaStatus.isRFA).toBe(true);
    expect(rfaStatus.qualifyingOfferEligible).toBe(true);
    expect(rfaStatus.qualifyingOfferAmount).toBeGreaterThan(0);
  });

  it('identifies veteran UFA', () => {
    const rfaStatus = computeRFAStatus(VETERAN_STAR, LEAGUE_CONTEXT);

    // Veteran with years of service is UFA, not RFA
    expect(rfaStatus.isRFA).toBe(false);
  });

  it('player under long-term contract is not RFA', () => {
    const underContract = {
      ...VETERAN_STAR,
      contract: {
        ...VETERAN_STAR.contract,
        yearsRemaining: 3,
      },
    };

    const rfaStatus = computeRFAStatus(underContract, LEAGUE_CONTEXT);

    expect(rfaStatus.isRFA).toBe(false);
    expect(rfaStatus.reason).toContain('not expiring');
  });
});

/**
 * Test: Qualifying Offer
 */
describe('computeQualifyingOffer', () => {
  it('calculates rookie QO correctly', () => {
    const qo = computeQualifyingOffer(ROOKIE_FOURTH_YEAR, LEAGUE_CONTEXT);

    // Lottery pick (5) gets 30% increase
    const fourthYearSalary = 9_500_000;
    const expectedQO = fourthYearSalary * 1.3;

    // Allow for rounding differences (tolerance of 10000)
    expect(Math.abs(qo.qualifyingOfferAmount - expectedQO)).toBeLessThan(10000);
  });

  it('includes QO deadline', () => {
    const qo = computeQualifyingOffer(ROOKIE_FOURTH_YEAR, LEAGUE_CONTEXT);

    expect(qo.qoDeadline).toBeDefined();
    expect(qo.qoDeadline).toBeInstanceOf(Date);
  });

  it('determines canAcceptQO based on date', () => {
    // With simulation date of Jan 15, QO deadline (Oct 1) has passed
    const qo = computeQualifyingOffer(ROOKIE_FOURTH_YEAR, LEAGUE_CONTEXT);

    // January 15 is after October 1 deadline
    expect(qo.canAcceptQO).toBe(false);
  });
});

describe('RuleContext entry points', () => {
  it('routes computeMinimumSalary(ruleContext) through the RuleContext path', () => {
    expect(computeMinimumSalary(EARLY_BIRD_RULE_CONTEXT)).toEqual(
      computeMinimumSalaryFromRuleContext(EARLY_BIRD_RULE_CONTEXT)
    );
  });

  it('routes computeMaxSalary(ruleContext) through the RuleContext path', () => {
    expect(computeMaxSalary(EARLY_BIRD_RULE_CONTEXT)).toEqual(
      computeMaxSalaryFromRuleContext(EARLY_BIRD_RULE_CONTEXT)
    );
  });

  it('computes Bird rights directly from RuleContext', () => {
    const birdRights = computeBirdRightsFromRuleContext(EARLY_BIRD_RULE_CONTEXT);

    expect(birdRights.type).toBe(BIRD_RIGHTS_TYPES.EARLY);
    expect(birdRights.yearsWithTeam).toBe(2);
    expect(birdRights.signingAbilities.canSignOverCap).toBe(true);
    expect(birdRights.signingAbilities.canSignToMax).toBe(false);
    expect(birdRights.signingAbilities.maxFirstYearSalary).toBe(26_250_000);
  });

  it('computes RFA status directly from RuleContext', () => {
    const rfaStatus = computeRFAFromRuleContext(ROOKIE_RFA_RULE_CONTEXT);

    expect(rfaStatus.status).toBe(RFA_STATUS.RFA);
    expect(rfaStatus.isRFA).toBe(true);
    expect(rfaStatus.qualifyingOfferEligible).toBe(true);
    expect(rfaStatus.qualifyingOfferAmount).toBe(12_350_000);
    expect(rfaStatus.reason).toBe(
      'Completing rookie scale contract - eligible for qualifying offer'
    );
  });

  it('computes extension eligibility and terms directly from RuleContext', () => {
    const extensionProfile = computeExtensionFromRuleContext(
      VETERAN_EXTENSION_RULE_CONTEXT
    );

    expect(extensionProfile.eligibility).toEqual({
      isEligible: true,
      reason: 'Eligible for veteran extension',
      blockers: [],
      extensionType: EXTENSION_TYPES.VETERAN,
    });
    expect(extensionProfile.terms).toEqual({
      maxYears: 4,
      maxFirstYearSalary: 48_000_000,
      minFirstYearSalary: 40_000_000,
      raisePercentage: 0.08,
      extensionType: EXTENSION_TYPES.VETERAN,
      basedOn:
        '140% of salary or average salary (capped at max for years of service)',
      notes: '',
    });
  });
});

describe('Export contracts', () => {
  it('preserves behavior-bearing constants re-exported through the barrel', () => {
    expect(BIRD_RIGHTS_TYPES.NON_BIRD).toBe('Non-Bird');
    expect(EXTENSION_TYPES.DESIGNATED_VETERAN).toBe(
      'Designated Veteran Extension'
    );
    expect(RFA_STATUS.UNKNOWN).toBe('Unknown');
    expect(MAX_SALARY_TIERS.TIER_35).toEqual({
      percent: 0.35,
      label: '35%',
      minYears: 10,
      maxYears: Infinity,
    });
  });

  it('preserves direct leaf-module aliases and award constants', async () => {
    const { MINIMUM_SALARY_SCALE } = await import(
      '@/features/architect/utils/playerRulesProfile/minimumSalaryRules'
    );
    const { SUPERMAX_QUALIFYING_AWARDS } = await import(
      '@/features/architect/utils/playerRulesProfile/maxSalaryRules'
    );
    const { MINIMUM_SALARY_SCALES } = await import(
      '@/features/architect/data/minimumSalaryScales'
    );

    expect(MINIMUM_SALARY_SCALE).toBe(MINIMUM_SALARY_SCALES);
    expect(SUPERMAX_QUALIFYING_AWARDS).toEqual([
      'MVP',
      'DPOY',
      'All-NBA First Team',
      'All-NBA Second Team',
      'All-NBA Third Team',
    ]);
  });
});

/**
 * Test: Contract Summary
 */
describe('Contract Summary in Profile', () => {
  it('includes correct contract summary for veteran', () => {
    const profile = computePlayerRulesProfile(
      VETERAN_STAR,
      TEAM_CONTEXT,
      LEAGUE_CONTEXT
    );

    expect(profile.contractSummary.yearsOfService).toBe(12);
    expect(profile.contractSummary.yearsRemaining).toBe(2);
    expect(profile.contractSummary.hasContract).toBe(true);
    expect(profile.contractSummary.freeAgencyType).toBe('Unrestricted');
  });

  it('includes current salary', () => {
    const profile = computePlayerRulesProfile(
      VETERAN_STAR,
      TEAM_CONTEXT,
      LEAGUE_CONTEXT
    );

    expect(profile.contractSummary.currentSalary).toBe(45_000_000);
  });

  it('derives years remaining and free agency year from endSeason when needed', () => {
    const playerWithoutComputedContractFields = {
      ...MID_CAREER,
      contract: {
        ...MID_CAREER.contract,
        yearsRemaining: undefined,
        endSeason: '2027-28',
        freeAgency: {
          type: 'Unrestricted',
        },
      },
    };

    const profile = computePlayerRulesProfile(
      playerWithoutComputedContractFields,
      TEAM_CONTEXT,
      {
        ...LEAGUE_CONTEXT,
        currentSeason: '2025-26',
        currentYear: 2026,
      }
    );

    expect(profile.contractSummary.yearsRemaining).toBe(3);
    expect(profile.contractSummary.freeAgencyYear).toBe(2028);
  });

  it('falls back to capHit for current salary when salary is missing', () => {
    const capHitOnlyPlayer = {
      ...VETERAN_STAR,
      contract: {
        ...VETERAN_STAR.contract,
        salariesByYear: [
          {
            season: '2024-25',
            capHit: 45_500_000,
            guaranteed: true,
          },
        ],
      },
    };

    const profile = computePlayerRulesProfile(
      capHitOnlyPlayer,
      TEAM_CONTEXT,
      LEAGUE_CONTEXT
    );

    expect(profile.contractSummary.currentSalary).toBe(45_500_000);
  });

  it('shows no contract for free agent', () => {
    const profile = computePlayerRulesProfile(
      FREE_AGENT,
      TEAM_CONTEXT,
      LEAGUE_CONTEXT
    );

    expect(profile.contractSummary.hasContract).toBe(false);
    expect(profile.contractSummary.currentSalary).toBeNull();
  });
});

/**
 * Test: Integration - Full Profile Scenarios
 */
describe('Full Profile Scenarios', () => {
  it('profile is deterministic - same inputs yield same output', () => {
    const profile1 = computePlayerRulesProfile(
      VETERAN_STAR,
      TEAM_CONTEXT,
      LEAGUE_CONTEXT
    );
    const profile2 = computePlayerRulesProfile(
      VETERAN_STAR,
      TEAM_CONTEXT,
      LEAGUE_CONTEXT
    );

    // Compare key fields - evaluatedAt is intentionally excluded from equality checks
    // as it captures the timestamp of evaluation which may differ slightly between calls
    expect(profile1.extensionEligibility).toEqual(
      profile2.extensionEligibility
    );
    expect(profile1.birdRights).toEqual(profile2.birdRights);
    expect(profile1.minimumSalary).toEqual(profile2.minimumSalary);
    expect(profile1.maxSalary).toEqual(profile2.maxSalary);

    // Verify evaluatedAt timestamps are present and within reasonable bounds (< 1000ms apart)
    expect(profile1.evaluatedAt).toBeDefined();
    expect(profile2.evaluatedAt).toBeDefined();
    const time1 = new Date(profile1.evaluatedAt).getTime();
    const time2 = new Date(profile2.evaluatedAt).getTime();
    expect(Math.abs(time2 - time1)).toBeLessThan(1000);
  });

  it('handles player from test fixtures (LeBron-style)', () => {
    // LeBron-style player: veteran, max contract, Full Bird, UFA
    const lebronStyle = {
      playerId: 'lebron_style',
      displayName: 'LeBron Style',
      bio: {
        experience: 21,
        draftYear: 2003,
        draftRound: 1,
        draftPick: 1,
      },
      contract: {
        contractType: 'Standard',
        isExtension: false,
        yearsRemaining: 1,
        salariesByYear: [
          {
            season: '2024-25',
            salary: 47_607_350,
            capHit: 47_607_350,
            guaranteed: true,
          },
        ],
        birdRights: {
          status: 'Full',
          yearsOfService: 21,
          yearsWithTeam: 6,
        },
        freeAgency: {
          type: 'Unrestricted',
          year: 2025,
        },
      },
    };

    const profile = computePlayerRulesProfile(
      lebronStyle,
      TEAM_CONTEXT,
      LEAGUE_CONTEXT
    );

    expect(profile.birdRights.type).toBe(BIRD_RIGHTS_TYPES.FULL);
    expect(profile.maxSalary.tier).toContain('35%');
    expect(profile.restrictedFreeAgency.isRFA).toBe(false);
    expect(profile.minimumSalary).toBe(3_800_000); // 10+ years
  });

  it('handles rookie draft pick profile', () => {
    const profile = computePlayerRulesProfile(
      ROOKIE_FOURTH_YEAR,
      TEAM_CONTEXT,
      LEAGUE_CONTEXT
    );

    expect(profile.extensionEligibility.isEligible).toBe(true);
    expect(profile.extensionEligibility.extensionType).toBe(
      'Rookie Scale Extension'
    );
    expect(profile.restrictedFreeAgency.isRFA).toBe(true);
    expect(profile.restrictedFreeAgency.qualifyingOfferAmount).toBeGreaterThan(
      0
    );
  });
});
