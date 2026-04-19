/**
 * Test fixtures for new architect schema players
 * These players only have contract.salariesByYear data (no contract_clean)
 */

export const newSchemaPlayer = {
  id: 'test-player-new-schema',
  player_id: 'test-player-new-schema',
  displayName: 'Test Player (New Schema)',
  name: 'Test Player (New Schema)',
  position: 'SF',
  age: 25,
  contract: {
    salariesByYear: [
      {
        season: '2024-25',
        salary: 5000000,
        capHit: 5000000,
        guaranteed: true,
        option: null
      },
      {
        season: '2025-26',
        salary: 5500000,
        capHit: 5500000,
        guaranteed: true,
        option: null
      },
      {
        season: '2026-27',
        salary: 6000000,
        capHit: 6000000,
        guaranteed: true,
        option: 'Player Option'
      }
    ],
    isRookieScale: false,
    contractType: 'Standard',
    yearsRemaining: 3
  },
  bio: {
    playerId: 'test-player-new-schema',
    displayName: 'Test Player (New Schema)',
    position: 'SF',
    age: 25,
    experience: 4
  }
  // NOTE: NO contract_clean field - pure new schema
};

export const newSchemaRookiePlayer = {
  id: 'test-rookie-new-schema',
  player_id: 'test-rookie-new-schema',
  displayName: 'Test Rookie (New Schema)',
  name: 'Test Rookie (New Schema)',
  position: 'PG',
  age: 20,
  contract: {
    salariesByYear: [
      {
        season: '2024-25',
        salary: 3000000,
        capHit: 3000000,
        guaranteed: true,
        option: null
      },
      {
        season: '2025-26',
        salary: 3500000,
        capHit: 3500000,
        guaranteed: true,
        option: 'Team Option'
      }
    ],
    isRookieScale: true,
    contractType: 'Rookie Scale',
    yearsRemaining: 2
  },
  bio: {
    playerId: 'test-rookie-new-schema',
    displayName: 'Test Rookie (New Schema)',
    position: 'PG',
    age: 20,
    experience: 1
  }
  // NOTE: NO contract_clean field - pure new schema
};

export const newSchemaBYCPlayer = {
  id: 'test-byc-new-schema',
  player_id: 'test-byc-new-schema',
  displayName: 'Test BYC Player (New Schema)',
  name: 'Test BYC Player (New Schema)',
  position: 'C',
  age: 28,
  isBYC: true,
  previousSalary: 2000000,
  contract: {
    salariesByYear: [
      {
        season: '2023-24',
        salary: 2000000,
        capHit: 2000000,
        guaranteed: true
      },
      {
        season: '2024-25',
        salary: 10000000,
        capHit: 10000000,
        guaranteed: true
      },
      {
        season: '2025-26',
        salary: 11000000,
        capHit: 11000000,
        guaranteed: true
      }
    ],
    isRookieScale: false,
    contractType: 'Standard',
    yearsRemaining: 2
  },
  bio: {
    playerId: 'test-byc-new-schema',
    displayName: 'Test BYC Player (New Schema)',
    position: 'C',
    age: 28,
    experience: 6
  }
  // NOTE: NO contract_clean field - pure new schema
};

export const newSchemaTradeKickerPlayer = {
  id: 'test-kicker-new-schema',
  player_id: 'test-kicker-new-schema',
  displayName: 'Test Trade Kicker (New Schema)',
  name: 'Test Trade Kicker (New Schema)',
  position: 'SG',
  age: 30,
  tradeKickerPct: 0.15, // 15% trade kicker
  remainingGuaranteedOnCurrentContract: 20000000,
  contract: {
    salariesByYear: [
      {
        season: '2024-25',
        salary: 8000000,
        capHit: 8000000,
        guaranteed: true
      },
      {
        season: '2025-26',
        salary: 8500000,
        capHit: 8500000,
        guaranteed: true
      }
    ],
    isRookieScale: false,
    contractType: 'Standard',
    yearsRemaining: 2
  },
  bio: {
    playerId: 'test-kicker-new-schema',
    displayName: 'Test Trade Kicker (New Schema)',
    position: 'SG',
    age: 30,
    experience: 8
  }
  // NOTE: NO contract_clean field - pure new schema
};
