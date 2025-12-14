/**
 * Test Helper Utilities for Architect Tests
 *
 * Provides helper functions for creating mock worlds/teams/players,
 * seeding base data, and assertion helpers.
 *
 * @file tests/helpers/architectTestHelpers.js
 */

import { expect } from 'vitest';
import { seedMockData, getMockData } from '../__mocks__/firebase.js';
import {
  BASE_TEAMS,
  LAL_BASE_TEAM,
} from '../fixtures/architect/teams.js';
import { BASE_PLAYERS } from '../fixtures/architect/players.js';
import { SAMPLE_WORLD_METADATA } from '../fixtures/architect/worlds.js';

/**
 * Create a mock world with given parameters
 */
export function createMockWorld({
  worldId = `world_${Date.now()}_${Math.random().toString(36).substring(7)}`,
  worldName = 'Test World',
  description = '',
  userId = 'user_123',
  parentWorldId = null,
  currentSeason = '2025-26',
  ...overrides
} = {}) {
  return {
    ...SAMPLE_WORLD_METADATA,
    worldId,
    worldName,
    description,
    createdBy: userId,
    currentSeason,
    baselineSeason: currentSeason,
    parentWorldId,
    ...overrides,
  };
}

/**
 * Create a mock team with given parameters
 */
export function createMockTeam({
  teamCode = 'LAL',
  season = '2025-26',
  roster = [],
  players = [],
  ...overrides
} = {}) {
  const baseTeam = BASE_TEAMS[teamCode] || LAL_BASE_TEAM;

  return {
    ...baseTeam,
    teamCode,
    season,
    roster,
    players,
    ...overrides,
  };
}

/**
 * Create a mock player with given parameters
 */
export function createMockPlayer({
  playerId = 'test_player',
  displayName = 'Test Player',
  teamCode = 'LAL',
  contract = null,
  ...overrides
} = {}) {
  const basePlayer = BASE_PLAYERS[playerId] || null;

  const player = {
    playerId,
    displayName,
    teamCode,
    teamName: BASE_TEAMS[teamCode]?.teamName || 'Test Team',
    bio: {
      position: 'SF',
      age: 25,
      experience: 5,
    },
    contract: contract || {
      contractType: 'Standard',
      isExtension: false,
      isRookieScale: false,
      startSeason: '2025-26',
      endSeason: '2026-27',
      contractLength: 2,
      yearsRemaining: 2,
      totalValue: 20_000_000,
      averageAnnualValue: 10_000_000,
      guaranteedValue: 20_000_000,
      guaranteedYears: 2,
      salariesByYear: [
        {
          season: '2025-26',
          salary: 10_000_000,
          capHit: 10_000_000,
          guaranteed: true,
          guaranteedAmount: 10_000_000,
          option: null,
          optionUsed: null,
          tradeBonus: null,
        },
        {
          season: '2026-27',
          salary: 10_000_000,
          capHit: 10_000_000,
          guaranteed: true,
          guaranteedAmount: 10_000_000,
          option: null,
          optionUsed: null,
          tradeBonus: null,
        },
      ],
      noTradeClause: false,
      tradeKicker: null,
      tradeRestrictions: [],
      birdRights: {
        status: 'Full',
        yearsOfService: 5,
        yearsWithTeam: 5,
        eligibleFor: [],
      },
      freeAgency: {
        type: 'Unrestricted',
        year: 2027,
        capHold: null,
        qualifyingOffer: null,
        earlyTerminationOption: null,
      },
      tradeEligibility: {
        canBeTradedNow: null,
        restrictedUntil: null,
        reason: null,
        rules: {
          baseYearCompensation: false,
          poisonPill: false,
          aggregation: false,
        },
      },
      isMaxContract: false,
      maxType: null,
    },
    source: {
      provider: 'test',
      playerPageUrl: `https://test.com/${playerId}`,
      scrapedAt: '2025-01-01T00:00:00Z',
    },
    lastUpdated: '2025-01-01T00:00:00Z',
    version: '1.0.0',
  };

  if (basePlayer) {
    return { ...basePlayer, ...overrides };
  }

  return { ...player, ...overrides };
}

/**
 * Seed base teams and players into mock Firestore
 */
export function seedBaseData(teams = ['LAL', 'GSW', 'BOS'], players = null) {
  // Seed base teams
  for (const teamCode of teams) {
    const baseTeam = BASE_TEAMS[teamCode];
    if (baseTeam) {
      const teamPath = `architect_baseTeams/${teamCode}`;
      seedMockData(teamPath, baseTeam);
    }
  }

  // Seed base players
  const playersToSeed = players || Object.keys(BASE_PLAYERS);
  for (const playerId of playersToSeed) {
    const basePlayer = BASE_PLAYERS[playerId];
    if (basePlayer) {
      const playerPath = `architect_basePlayers/${playerId}`;
      seedMockData(playerPath, basePlayer);
    }
  }
}

/**
 * Seed world metadata into mock Firestore
 * Path: architect_worlds/{worldId}
 */
export function seedWorldMetadata(worldId, metadata) {
  const worldPath = `architect_worlds/${worldId}`;
  seedMockData(worldPath, metadata);
}

/**
 * Seed team snapshot into mock Firestore
 * Path: architect_worlds/{worldId}/teams/{teamCode}
 */
export function seedTeamSnapshot(worldId, teamCode, teamData) {
  const snapshotPath = `architect_worlds/${worldId}/teams/${teamCode}`;
  seedMockData(snapshotPath, teamData);
}

/**
 * Assert team snapshot structure
 */
export function _assertTeamSnapshot(teamData) {
  expect(teamData).toBeDefined();
  expect(teamData.teamCode).toBeDefined();
  expect(teamData.season).toBeDefined();
  expect(Array.isArray(teamData.roster)).toBe(true);
  expect(Array.isArray(teamData.players)).toBe(true);
  expect(teamData.totals).toBeDefined();
  expect(teamData.source).toBeDefined();
  expect(teamData.source.type).toBe('world-snapshot');
  expect(teamData.source.worldId).toBeDefined();
}

/**
 * Assert world metadata structure
 */
export function _assertWorldMetadata(metadata) {
  expect(metadata).toBeDefined();
  expect(metadata.worldId).toBeDefined();
  expect(metadata.worldName).toBeDefined();
  expect(metadata.createdBy).toBeDefined();
  expect(metadata.currentSeason).toBeDefined();
  expect(metadata.baselineSeason).toBeDefined();
  expect(Array.isArray(metadata.childWorlds)).toBe(true);
  expect(Array.isArray(metadata.modifiedTeams)).toBe(true);
  expect(metadata.stats).toBeDefined();
  expect(typeof metadata.stats.totalTrades).toBe('number');
  expect(typeof metadata.stats.totalSignings).toBe('number');
  expect(typeof metadata.stats.totalWaives).toBe('number');
}

/**
 * Get team from mock Firestore
 */
export function getMockTeam(teamCode) {
  const teamPath = `architect_baseTeams/${teamCode}`;
  return getMockData(teamPath);
}

/**
 * Get player from mock Firestore
 */
export function getMockPlayer(playerId) {
  const playerPath = `architect_basePlayers/${playerId}`;
  return getMockData(playerPath);
}

/**
 * Get world metadata from mock Firestore
 * Path: architect_worlds/{worldId}
 */
export function getMockWorldMetadata(worldId) {
  const worldPath = `architect_worlds/${worldId}`;
  return getMockData(worldPath);
}

/**
 * Get team snapshot from mock Firestore
 * Path: architect_worlds/{worldId}/teams/{teamCode}
 */
export function getMockTeamSnapshot(worldId, teamCode) {
  const snapshotPath = `architect_worlds/${worldId}/teams/${teamCode}`;
  return getMockData(snapshotPath);
}

/**
 * Create a valid trade data structure for testing
 */
export function createMockTradeData({
  teams = [
    {
      teamCode: 'LAL',
      sends: [],
      picksOut: [],
      cashSent: 0,
    },
    {
      teamCode: 'GSW',
      sends: [],
      picksOut: [],
      cashSent: 0,
    },
  ],
  capProjections = {
    '2025-26': {
      cap: 141_000_000,
      firstApron: 178_132_000,
      secondApron: 188_938_000,
      taxLine: 170_818_000,
    },
  },
  currentYear = 2025,
} = {}) {
  return {
    teams,
    capProjections,
    currentYear,
  };
}

/**
 * Create mock cap projections
 */
export function createMockCapProjections(season = '2025-26') {
  return {
    [season]: {
      cap: 141_000_000,
      firstApron: 178_132_000,
      secondApron: 188_938_000,
      taxLine: 170_818_000,
      fullMLE: 12_860_000,
      taxpayerMLE: 5_183_000,
      roomMLE: 8_008_000,
      bae: 4_189_000,
    },
  };
}
