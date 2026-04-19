/**
 * Test Fixtures: Architect Teams
 * 
 * Sample base team data matching Architect schema for testing.
 * Includes LAL, GSW, and BOS teams with rosters, players, draft picks, exceptions, and cap totals.
 * 
 * @file tests/fixtures/architect/teams.ts
 */

export const LAL_BASE_TEAM = {
  teamCode: 'LAL',
  teamName: 'Los Angeles Lakers',
  season: '2025-26',
  abbreviation: 'LAL',
  city: 'Los Angeles',
  conference: 'Western',
  division: 'Pacific',
  roster: ['lebron_james', 'anthony_davis', 'austin_reaves'],
  deadCap: [],
  capHolds: [],
  exceptions: {
    mle: {
      type: 'non-taxpayer',
      available: true,
      totalAmount: 12_860_000,
      usedAmount: 0,
      remainingAmount: 12_860_000,
    },
    bae: {
      available: true,
      totalAmount: 4_189_000,
      usedAmount: 0,
      remainingAmount: 4_189_000,
    },
    tpe: [],
  },
  draftPicks: [
    {
      id: 'lal_2026_1',
      year: 2026,
      round: 1,
      pick: null,
      owner: 'LAL',
      originalTeam: 'LAL',
      status: 'future',
      stepienEligible: true,
      tradeable: true,
    },
  ],
  totals: {
    totalSalary: 150_000_000,
    capHit: 150_000_000,
    guaranteedSalary: 140_000_000,
    nonGuaranteedSalary: 10_000_000,
    rosterCount: 3,
    guaranteedContracts: 2,
    nonGuaranteedContracts: 1,
    emptyRosterCharges: 0,
    capSpace: 0,
    isOverTax: true,
    isFirstApron: false,
    isSecondApron: false,
    isHardCapped: false,
  },
  source: {
    provider: 'test',
    scrapedAt: '2025-01-01T00:00:00Z',
    season: '2025-26',
    type: 'base',
  },
  lastUpdated: '2025-01-01T00:00:00Z',
  version: '1.0.0',
};

export const GSW_BASE_TEAM = {
  teamCode: 'GSW',
  teamName: 'Golden State Warriors',
  season: '2025-26',
  abbreviation: 'GSW',
  city: 'Golden State',
  conference: 'Western',
  division: 'Pacific',
  roster: ['stephen_curry', 'klay_thompson', 'draymond_green'],
  deadCap: [],
  capHolds: [],
  exceptions: {
    mle: {
      type: 'taxpayer',
      available: true,
      totalAmount: 5_183_000,
      usedAmount: 0,
      remainingAmount: 5_183_000,
    },
    bae: {
      available: false,
      totalAmount: 0,
      usedAmount: 0,
      remainingAmount: 0,
    },
    tpe: [],
  },
  draftPicks: [
    {
      id: 'gsw_2026_1',
      year: 2026,
      round: 1,
      pick: null,
      owner: 'GSW',
      originalTeam: 'GSW',
      status: 'future',
      stepienEligible: true,
      tradeable: true,
    },
  ],
  totals: {
    totalSalary: 180_000_000,
    capHit: 180_000_000,
    guaranteedSalary: 175_000_000,
    nonGuaranteedSalary: 5_000_000,
    rosterCount: 3,
    guaranteedContracts: 3,
    nonGuaranteedContracts: 0,
    emptyRosterCharges: 0,
    capSpace: 0,
    isOverTax: true,
    isFirstApron: true,
    isSecondApron: false,
    isHardCapped: false,
  },
  source: {
    provider: 'test',
    scrapedAt: '2025-01-01T00:00:00Z',
    season: '2025-26',
    type: 'base',
  },
  lastUpdated: '2025-01-01T00:00:00Z',
  version: '1.0.0',
};

export const BOS_BASE_TEAM = {
  teamCode: 'BOS',
  teamName: 'Boston Celtics',
  season: '2025-26',
  abbreviation: 'BOS',
  city: 'Boston',
  conference: 'Eastern',
  division: 'Atlantic',
  roster: ['jayson_tatum', 'jaylen_brown', 'kristaps_porzingis'],
  deadCap: [],
  capHolds: [
    {
      playerId: 'al_horford',
      playerName: 'Al Horford',
      amount: 12_000_000,
      type: 'Bird',
      season: '2025-26',
      isSigned: false,
    },
  ],
  exceptions: {
    mle: {
      type: 'non-taxpayer',
      available: true,
      totalAmount: 12_860_000,
      usedAmount: 0,
      remainingAmount: 12_860_000,
    },
    bae: {
      available: true,
      totalAmount: 4_189_000,
      usedAmount: 0,
      remainingAmount: 4_189_000,
    },
    tpe: [
      {
        id: 'tpe_2024_trade',
        totalAmount: 6_200_000,
        usedAmount: 0,
        remainingAmount: 6_200_000,
        createdFrom: 'trade_2024',
        createdOn: '2024-07-01T00:00:00Z',
        expiresOn: '2025-07-01T00:00:00Z',
      },
    ],
  },
  draftPicks: [
    {
      id: 'bos_2026_1',
      year: 2026,
      round: 1,
      pick: null,
      owner: 'BOS',
      originalTeam: 'BOS',
      status: 'future',
      stepienEligible: true,
      tradeable: true,
    },
    {
      id: 'bos_2027_1',
      year: 2027,
      round: 1,
      pick: null,
      owner: 'BOS',
      originalTeam: 'BOS',
      status: 'future',
      stepienEligible: true,
      tradeable: true,
    },
  ],
  totals: {
    totalSalary: 165_000_000,
    capHit: 177_000_000, // Includes cap hold
    guaranteedSalary: 165_000_000,
    nonGuaranteedSalary: 0,
    rosterCount: 3,
    guaranteedContracts: 3,
    nonGuaranteedContracts: 0,
    emptyRosterCharges: 0,
    capSpace: 0,
    isOverTax: true,
    isFirstApron: false,
    isSecondApron: false,
    isHardCapped: false,
  },
  source: {
    provider: 'test',
    scrapedAt: '2025-01-01T00:00:00Z',
    season: '2025-26',
    type: 'base',
  },
  lastUpdated: '2025-01-01T00:00:00Z',
  version: '1.0.0',
};

// Export all teams as a map for easy access
export const BASE_TEAMS = {
  LAL: LAL_BASE_TEAM,
  GSW: GSW_BASE_TEAM,
  BOS: BOS_BASE_TEAM,
};
