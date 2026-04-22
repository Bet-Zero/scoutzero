/**
 * Test Helper Utilities for Architect Tests
 *
 * Provides helper functions for creating mock worlds/teams/players,
 * seeding base data, and assertion helpers.
 *
 * @file tests/helpers/architectTestHelpers.ts
 */

import { expect } from 'vitest';
import type { TeamTotals } from '@/features/architect/types';
import type { LoadedWorldTeamCapSheet } from '@/features/architect/utils/worldTeamData';
import { seedMockData, getMockData } from '../__mocks__/firebase.js';
import {
  BASE_TEAMS,
  LAL_BASE_TEAM,
} from '../fixtures/architect/teams.js';
import { BASE_PLAYERS } from '../fixtures/architect/players.js';
import { SAMPLE_WORLD_METADATA } from '../fixtures/architect/worlds.js';

type FixtureTeamCode = keyof typeof BASE_TEAMS;
type FixturePlayerId = keyof typeof BASE_PLAYERS;
type BaseTeamFixture = (typeof BASE_TEAMS)[FixtureTeamCode];
type BasePlayerFixture = (typeof BASE_PLAYERS)[FixturePlayerId];
type BaseContractFixture = BasePlayerFixture['contract'];
type BaseBioFixture = BasePlayerFixture['bio'];
type BaseWorldFixture = typeof SAMPLE_WORLD_METADATA;
type MockTradeException = NonNullable<BaseTeamFixture['exceptions']['tpe']>[number];

export type MockDraftPositionsEntry = {
  positionsMap: Record<string, number>;
  method: string;
  updatedAtIso: string;
};

export type MockWorldStats = {
  totalTrades: number;
  totalSignings: number;
  totalWaives: number;
  teamsInvolved: number;
  totalRenounces?: number;
} & Record<string, unknown>;

export type MockWorldMetadata = Omit<
  BaseWorldFixture,
  | 'worldId'
  | 'worldName'
  | 'description'
  | 'createdBy'
  | 'currentSeason'
  | 'baselineSeason'
  | 'parentWorldId'
  | 'childWorlds'
  | 'modifiedTeams'
  | 'stats'
  | 'draftPositionsByYear'
  | 'asOfDate'
> & {
  worldId: string;
  worldName: string;
  description: string;
  createdBy: string;
  currentSeason: string;
  baselineSeason: string;
  parentWorldId: string | null;
  childWorlds: string[];
  modifiedTeams: string[];
  stats: MockWorldStats;
  draftPositionsByYear?: Record<string, MockDraftPositionsEntry>;
  asOfDate?: string | null;
};

export type MockSalaryRow = {
  season: string;
  salary: number;
  capHit: number;
  guaranteed: boolean;
  guaranteedAmount?: number | null;
  option?: string | null;
  optionUsed?: boolean | null;
  tradeBonus?: number | string | null;
};

export type MockPlayerContract = Partial<
  Omit<BaseContractFixture, 'salariesByYear'>
> & {
  salariesByYear: MockSalaryRow[];
};

export type MockPlayerBio = Partial<BaseBioFixture> & {
  position: string;
  age: number;
  experience: number;
};

export type MockPlayer = Omit<
  Partial<BasePlayerFixture>,
  | 'playerId'
  | 'displayName'
  | 'teamCode'
  | 'teamName'
  | 'bio'
  | 'contract'
  | 'source'
  | 'lastUpdated'
  | 'version'
> & {
  playerId: string;
  displayName: string;
  teamCode: string;
  teamName: string;
  bio: MockPlayerBio;
  contract: MockPlayerContract;
  source: {
    provider: string;
    playerPageUrl?: string;
    scrapedAt?: string;
  };
  lastUpdated: string;
  version: string;
};

export type MockCapHold = {
  playerId: string;
  amount: number;
  playerName?: string;
  type?: string;
  season?: string;
  expiresOn?: string;
  isSigned?: boolean;
};

export type MockDraftPick = {
  id: string;
  year: number;
  round: number;
  owner?: string;
  originalTeam?: string;
  currentOwner?: string;
  tradedTo?: string;
  status?: string;
  protection?: string;
  pick?: number | null;
  stepienEligible?: boolean;
  tradeable?: boolean;
  stepienBlocked?: boolean;
  stepienReason?: string;
  conveyance?: {
    originalYear?: number;
    currentYear?: number;
    finalYear?: number;
    conditions?: {
      protection?: string;
    };
  };
  conveyanceResult?: {
    outcome?: string;
    position?: number;
    resolvedAt?: string;
    method?: string;
    reason?: string;
    previousYear?: number;
    previousProtection?: string;
    originalRound?: number;
  };
};

export type MockTeamExceptions = BaseTeamFixture['exceptions'] & {
  tpe?: MockTradeException[];
};

export type MockTeamTotals = TeamTotals & {
  incompleteChargesTotal?: number;
  _meta?: {
    incompleteRosterCharge?: {
      standardRosterCount?: number;
    };
  };
};

export type MockTeamSource = BaseTeamFixture['source'] & {
  type?: string;
  worldId?: string;
  provider?: string;
  season?: string;
  scrapedAt?: string;
};

export type MockTeam = Omit<
  LoadedWorldTeamCapSheet,
  | 'players'
  | 'roster'
  | 'capHolds'
  | 'draftPicks'
  | 'offerSheets'
  | 'incomingOfferSheets'
  | 'exceptions'
  | 'totals'
> & {
  teamCode: string;
  season: string;
  roster: string[];
  players: MockPlayer[];
  teamName?: string;
  capHolds?: MockCapHold[];
  draftPicks?: MockDraftPick[];
  offerSheets?: unknown[] | null;
  incomingOfferSheets?: unknown[] | null;
  tradeExceptions?: MockTradeException[];
  exceptionHistory?: unknown[];
  exceptions?: MockTeamExceptions | null;
  totals?: MockTeamTotals | null;
  source?: MockTeamSource;
  lastUpdated?: string;
  version?: string;
};
export type MockTeamSnapshot = Omit<MockTeam, 'season' | 'players'> & {
  season?: string | null;
  players?: MockPlayer[] | null;
};

type CreateMockWorldInput = Partial<MockWorldMetadata> & {
  userId?: string;
};

type CreateMockTeamInput = {
  teamCode?: string;
  season?: string;
  roster?: string[];
  players?: MockPlayer[];
  playersSalary?: number;
  draftPicks?: MockDraftPick[];
  capHolds?: MockCapHold[];
  totals?: MockTeamTotals | null;
};

type CreateMockPlayerInput = {
  playerId?: string;
  displayName?: string;
  teamCode?: string;
  contract?: MockPlayerContract | null;
};

type SeedTeamSnapshotOptions = {
  padRoster?: boolean;
};

type MockTradeDataTeam = {
  teamCode: string;
  sends: string[];
  picksOut: string[];
  cashSent: number;
};

type MockCapProjectionEntry = {
  cap: number;
  firstApron: number;
  secondApron: number;
  taxLine: number;
  fullMLE?: number;
  taxpayerMLE?: number;
  roomMLE?: number;
  bae?: number;
};

type CreateMockTradeDataInput = {
  teams?: MockTradeDataTeam[];
  capProjections?: Record<string, MockCapProjectionEntry>;
  currentYear?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getFixtureTeam(teamCode: string): BaseTeamFixture | null {
  return teamCode in BASE_TEAMS
    ? BASE_TEAMS[teamCode as FixtureTeamCode]
    : null;
}

function getFixturePlayer(playerId: string): BasePlayerFixture | null {
  return playerId in BASE_PLAYERS
    ? BASE_PLAYERS[playerId as FixturePlayerId]
    : null;
}

function isMockWorldMetadata(value: unknown): value is MockWorldMetadata {
  return (
    isRecord(value) &&
    typeof value.worldId === 'string' &&
    typeof value.worldName === 'string' &&
    typeof value.createdBy === 'string' &&
    typeof value.currentSeason === 'string' &&
    typeof value.baselineSeason === 'string' &&
    Array.isArray(value.childWorlds) &&
    Array.isArray(value.modifiedTeams)
  );
}

function isMockTeam(value: unknown): value is MockTeam {
  return (
    isRecord(value) &&
    typeof value.teamCode === 'string' &&
    typeof value.season === 'string' &&
    Array.isArray(value.roster) &&
    Array.isArray(value.players)
  );
}

function isMockTeamSnapshot(value: unknown): value is MockTeamSnapshot {
  return (
    isRecord(value) &&
    typeof value.teamCode === 'string' &&
    (value.season === undefined || value.season === null || typeof value.season === 'string') &&
    Array.isArray(value.roster) &&
    (value.players === undefined || value.players === null || Array.isArray(value.players))
  );
}

function isMockPlayer(value: unknown): value is MockPlayer {
  return (
    isRecord(value) &&
    typeof value.playerId === 'string' &&
    typeof value.displayName === 'string' &&
    typeof value.teamCode === 'string' &&
    isRecord(value.bio) &&
    isRecord(value.contract) &&
    Array.isArray(value.contract.salariesByYear) &&
    isRecord(value.source)
  );
}

function readMockDataWithGuard<T>(
  path: string,
  guard: (value: unknown) => value is T,
  label: string
): T | undefined {
  const value = getMockData(path);
  if (value === undefined) {
    return undefined;
  }
  if (!guard(value)) {
    throw new Error(`${label} at ${path} does not match the expected test shape`);
  }
  return value;
}

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
}: CreateMockWorldInput = {}): MockWorldMetadata {
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
  playersSalary,
  draftPicks,
  capHolds,
  totals,
  ...overrides
}: CreateMockTeamInput = {}): MockTeam {
  const baseTeam = getFixtureTeam(teamCode) ?? LAL_BASE_TEAM;
  const nextTotals =
    totals ??
    (playersSalary === undefined
      ? (baseTeam.totals as MockTeamTotals | undefined)
      : ({
          ...(baseTeam.totals as MockTeamTotals | undefined),
          totalSalary: playersSalary,
          capHit: playersSalary,
        } satisfies MockTeamTotals));

  return {
    ...baseTeam,
    teamCode,
    season,
    roster,
    players,
    draftPicks: draftPicks ?? (baseTeam.draftPicks as MockDraftPick[] | undefined),
    capHolds: capHolds ?? (baseTeam.capHolds as MockCapHold[] | undefined),
    totals: nextTotals,
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
}: CreateMockPlayerInput = {}): MockPlayer {
  const basePlayer = getFixturePlayer(playerId);
  const teamName = getFixtureTeam(teamCode)?.teamName ?? 'Test Team';

  const player: MockPlayer = {
    playerId,
    displayName,
    teamCode,
    teamName,
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

function createFillerPlayer(playerId: string, teamCode: string): MockPlayer {
  return {
    playerId,
    displayName: `Filler ${playerId}`,
    teamCode,
    teamName: getFixtureTeam(teamCode)?.teamName ?? `${teamCode} Team`,
    bio: {
      position: 'SG',
      age: 25,
      experience: 3,
    },
    contract: {
      contractType: 'Standard',
      startSeason: '2025-26',
      endSeason: '2027-28',
      salariesByYear: [
        {
          season: '2025-26',
          salary: 2_000_000,
          capHit: 2_000_000,
          guaranteed: true,
        },
        {
          season: '2026-27',
          salary: 2_000_000,
          capHit: 2_000_000,
          guaranteed: true,
        },
        {
          season: '2027-28',
          salary: 2_000_000,
          capHit: 2_000_000,
          guaranteed: true,
        },
      ],
    },
    source: {
      provider: 'test',
      playerPageUrl: `https://test.com/${playerId}`,
      scrapedAt: '2025-01-01T00:00:00Z',
    },
    lastUpdated: '2025-01-01T00:00:00Z',
    version: '1.0.0',
  };
}

/**
 * All 30 NBA team codes
 */
const ALL_TEAM_CODES = [
  'ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GSW',
  'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NOP', 'NYK',
  'OKC', 'ORL', 'PHI', 'PHX', 'POR', 'SAC', 'SAS', 'TOR', 'UTA', 'WAS',
] as const;

// CBA minimum is 13 standard players; pad to 15 to absorb contract expirations during transitions
const MIN_ROSTER_PAD_TARGET = 15;

/**
 * Seed base teams and players into mock Firestore
 * @param {string[]|'all'} teams - Array of team codes or 'all' for all 30 teams
 * @param {string[]|null} players - Array of player IDs or null for all
 */
export function seedBaseData(
  teams: readonly string[] | 'all' = ['LAL', 'GSW', 'BOS'],
  players: readonly string[] | null = null
): void {
  const teamCodesToSeed = teams === 'all' ? ALL_TEAM_CODES : teams;
  
  // Seed base teams
  for (const teamCode of teamCodesToSeed) {
    const baseTeam = getFixtureTeam(teamCode);
    const teamPath = `architect_baseTeams/${teamCode}`;

    if (baseTeam) {
      // Pad fixture teams to meet CBA minimum offseason roster (13 standard players)
      const existingRoster = baseTeam.roster || [];
      const baseTeamPlayers = (baseTeam as Partial<MockTeam>).players;
      const existingPlayers = Array.isArray(baseTeamPlayers)
        ? baseTeamPlayers
        : [];
      const needed = Math.max(0, MIN_ROSTER_PAD_TARGET - existingRoster.length);
      if (needed > 0) {
        const fillerRoster = Array.from({ length: needed }, (_, i) => `${teamCode.toLowerCase()}_filler_${i + 1}`);
        const fillerPlayers = fillerRoster.map((playerId) =>
          createFillerPlayer(playerId, teamCode)
        );
        const paddedTeam = {
          ...baseTeam,
          roster: [...existingRoster, ...fillerRoster],
          players: [...existingPlayers, ...fillerPlayers],
        };
        seedMockData(teamPath, paddedTeam);
      } else {
        seedMockData(teamPath, baseTeam);
      }
    } else {
      // Create minimal team data for teams not in fixtures.
      // Include filler players to meet CBA minimum offseason roster.
      const fillerRoster = Array.from({ length: MIN_ROSTER_PAD_TARGET }, (_, i) => `${teamCode.toLowerCase()}_filler_${i + 1}`);
      const fillerPlayers = fillerRoster.map((playerId) =>
        createFillerPlayer(playerId, teamCode)
      );
      seedMockData(teamPath, {
        teamCode,
        teamName: `${teamCode} Team`,
        season: '2025-26',
        roster: fillerRoster,
        players: fillerPlayers,
        totals: {
          totalSalary: 26_000_000,
          capHit: 26_000_000,
          rosterCount: MIN_ROSTER_PAD_TARGET,
        },
        source: { type: 'base', provider: 'test' },
      });
    }
  }

  // Seed base players
  const playersToSeed = players || Object.keys(BASE_PLAYERS);
  for (const playerId of playersToSeed) {
    const basePlayer = getFixturePlayer(playerId);
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
export function seedWorldMetadata(
  worldId: string,
  metadata: MockWorldMetadata
): void {
  const worldPath = `architect_worlds/${worldId}`;
  seedMockData(worldPath, metadata);
}

/**
 * Seed team snapshot into mock Firestore
 * Path: architect_worlds/{worldId}/teams/{teamCode}
 */
export function seedTeamSnapshot(
  worldId: string,
  teamCode: string,
  teamData: MockTeam,
  { padRoster = true }: SeedTeamSnapshotOptions = {}
): void {
  const snapshotPath = `architect_worlds/${worldId}/teams/${teamCode}`;
  // Pad team snapshot to meet CBA minimum offseason roster (15 standard players)
  // unless padRoster is explicitly false
  const existingRoster = teamData.roster || [];
  const existingPlayers = teamData.players || [];
  const needed = padRoster ? Math.max(0, MIN_ROSTER_PAD_TARGET - existingRoster.length) : 0;
  if (needed > 0) {
    const fillerRoster = Array.from({ length: needed }, (_, i) => `${teamCode.toLowerCase()}_snap_filler_${i + 1}`);
    const fillerPlayers = fillerRoster.map((playerId) =>
      createFillerPlayer(playerId, teamCode)
    );
    seedMockData(snapshotPath, {
      ...teamData,
      roster: [...existingRoster, ...fillerRoster],
      players: [...existingPlayers, ...fillerPlayers],
    });
  } else {
    seedMockData(snapshotPath, teamData);
  }
}

/**
 * Assert team snapshot structure
 */
export function _assertTeamSnapshot(teamData: MockTeam): void {
  expect(teamData).toBeDefined();
  expect(teamData.teamCode).toBeDefined();
  expect(teamData.season).toBeDefined();
  expect(Array.isArray(teamData.roster)).toBe(true);
  expect(Array.isArray(teamData.players)).toBe(true);
  expect(teamData.totals).toBeDefined();
  expect(teamData.source).toBeDefined();
  if (!teamData.source) {
    throw new Error('team snapshot missing source');
  }
  expect(teamData.source.type).toBe('world-snapshot');
  expect(teamData.source.worldId).toBeDefined();
}

/**
 * Assert world metadata structure
 */
export function _assertWorldMetadata(metadata: MockWorldMetadata): void {
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
export function getMockTeam(teamCode: string): MockTeam | undefined {
  const teamPath = `architect_baseTeams/${teamCode}`;
  return readMockDataWithGuard(teamPath, isMockTeam, 'mock team');
}

/**
 * Get player from mock Firestore
 */
export function getMockPlayer(playerId: string): MockPlayer | undefined {
  const playerPath = `architect_basePlayers/${playerId}`;
  return readMockDataWithGuard(playerPath, isMockPlayer, 'mock player');
}

/**
 * Get world metadata from mock Firestore
 * Path: architect_worlds/{worldId}
 */
export function getMockWorldMetadata(
  worldId: string
): MockWorldMetadata | undefined {
  const worldPath = `architect_worlds/${worldId}`;
  return readMockDataWithGuard(worldPath, isMockWorldMetadata, 'mock world metadata');
}

/**
 * Get team snapshot from mock Firestore
 * Path: architect_worlds/{worldId}/teams/{teamCode}
 */
export function getMockTeamSnapshot(
  worldId: string,
  teamCode: string
): MockTeamSnapshot | undefined {
  const snapshotPath = `architect_worlds/${worldId}/teams/${teamCode}`;
  return readMockDataWithGuard(
    snapshotPath,
    isMockTeamSnapshot,
    'mock team snapshot'
  );
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
}: CreateMockTradeDataInput = {}) {
  return {
    teams,
    capProjections,
    currentYear,
  };
}

/**
 * Create mock cap projections
 */
export function createMockCapProjections(
  season = '2025-26'
): Record<string, MockCapProjectionEntry> {
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

// Re-export seedMockData for direct use in tests
export { seedMockData, getMockData };
