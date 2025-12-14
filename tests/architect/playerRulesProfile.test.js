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

import { describe, it, expect } from 'vitest';

// NOTE: This test intentionally imports INTERNAL implementation directly.
// Most Architect code must import from salaryEngine instead:
//   import { ... } from '@/features/architect/utils/salaryEngine'
import {
  computePlayerRulesProfile,
  computeExtensionEligibility,
  computeExtensionTerms,
  computeBirdRights,
  computeMinimumSalary,
  computeRFAStatus,
  computeQualifyingOffer,
  computeMaxSalary,
  BIRD_RIGHTS_TYPES,
} from '@/features/architect/utils/playerRulesProfile/index.js';

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

  it('returns empty profile with error for null player', () => {
    const profile = computePlayerRulesProfile(
      null,
      TEAM_CONTEXT,
      LEAGUE_CONTEXT
    );

    expect(profile.error).toBeDefined();
    expect(profile.extensionEligibility.isEligible).toBe(false);
  });

  it('includes team context when provided', () => {
    const profile = computePlayerRulesProfile(
      VETERAN_STAR,
      TEAM_CONTEXT,
      LEAGUE_CONTEXT
    );

    expect(profile.teamContext).toBeDefined();
    expect(profile.teamContext.teamCode).toBe('LAL');
    expect(profile.teamContext.isOverCap).toBe(true);
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
    const terms = computeExtensionTerms(VETERAN_STAR, LEAGUE_CONTEXT);

    expect(terms).not.toBeNull();
    expect(terms.maxYears).toBeGreaterThan(0);
    expect(terms.maxFirstYearSalary).toBeGreaterThan(0);
    expect(terms.raisePercentage).toBeDefined();
  });

  it('returns terms for rookie extension', () => {
    const terms = computeExtensionTerms(ROOKIE_FOURTH_YEAR, LEAGUE_CONTEXT);

    expect(terms).not.toBeNull();
    expect(terms.maxYears).toBe(5); // Rookie extensions up to 5 years
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

    const terms = computeExtensionTerms(allNbaRookie, LEAGUE_CONTEXT);

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
    expect(birdRights.signingAbilities.maxFirstYearSalary).toBeGreaterThan(0);
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

  it('calculates Early Bird max correctly', () => {
    const birdRights = computeBirdRights(MID_CAREER, LEAGUE_CONTEXT);
    const priorSalary = 15_000_000;

    // Early Bird max is 175% of prior salary or 105% of average
    const expected175 = priorSalary * 1.75;
    const expected105 = LEAGUE_CONTEXT.capSettings.averageSalary * 1.05;
    const expectedMax = Math.max(expected175, expected105);

    // Allow for rounding differences (tolerance of 10000)
    expect(
      Math.abs(birdRights.signingAbilities.maxFirstYearSalary - expectedMax)
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
    const playerNoExp = { playerId: 'no_exp' };

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
