import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestoreMocks = vi.hoisted(() => {
  const commit = vi.fn(async () => undefined);
  return {
    commit,
    writeBatch: vi.fn(() => ({
      set: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      commit,
    })),
    getDoc: vi.fn(async () => ({
      exists: () => false,
      data: () => ({}),
    })),
  };
});

const teamLoaderMocks = vi.hoisted(() => ({
  getTeam: vi.fn(),
  getPlayer: vi.fn(),
  getLeague: vi.fn(async () => []),
  mergePlayerOverride: vi.fn((base, override) =>
    override ? { ...base, ...override } : base
  ),
}));

vi.mock('@/firebaseConfig', () => ({
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  writeBatch: firestoreMocks.writeBatch,
  getDoc: firestoreMocks.getDoc,
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  collection: vi.fn((_db: unknown, ...pathParts: string[]) => ({
    _path: pathParts.join('/'),
  })),
  doc: vi.fn((_db: unknown, ...pathParts: string[]) => ({
    _path: pathParts.join('/'),
  })),
}));

vi.mock('@/features/architect/utils/teamLoader', () => ({
  getTeam: teamLoaderMocks.getTeam,
  getPlayer: teamLoaderMocks.getPlayer,
  getLeague: teamLoaderMocks.getLeague,
  mergePlayerOverride: teamLoaderMocks.mergePlayerOverride,
}));

vi.mock('@/features/architect/utils/worldManager', () => ({
  updateWorldStats: vi.fn(async () => undefined),
  getWorldMetadata: vi.fn(async () => ({ parentWorldId: null })),
}));

import {
  applyWorldMutation,
  computeWorldMutation,
  type ArchitectMutationContract,
  type ArchitectMutationPlayerRecord,
  type ArchitectMutationTeamRecord,
} from '@/features/architect/utils/mutationPipeline';

const CURRENT_YEAR = 2026;
const SEASON_ID = '2025-26';
const SEASON = '2025-26';
const FIXED_TIMESTAMP = Date.UTC(2026, 6, 1, 12, 0, 0);

function makeSatContract(firstYearSalary: number): ArchitectMutationContract {
  return {
    contractType: 'Sign & Trade',
    contractYears: 3,
    firstYearGuaranteed: true,
    salariesByYear: [
      {
        season: SEASON,
        salary: firstYearSalary,
        capHit: firstYearSalary,
        guaranteed: true,
      },
      {
        season: '2026-27',
        salary: Math.round(firstYearSalary * 1.05),
        capHit: Math.round(firstYearSalary * 1.05),
        guaranteed: true,
      },
      {
        season: '2027-28',
        salary: Math.round(firstYearSalary * 1.1),
        capHit: Math.round(firstYearSalary * 1.1),
        guaranteed: true,
      },
    ],
  };
}

function makePlayer(
  id: string,
  salary: number,
  extra: Partial<ArchitectMutationPlayerRecord> = {}
): ArchitectMutationPlayerRecord {
  return {
    id,
    player_id: id,
    name: id,
    freeAgentYear: CURRENT_YEAR,
    contract: {
      salariesByYear: [
        { season: SEASON, salary, capHit: salary, guaranteed: true },
      ],
    },
    ...extra,
  };
}

function makeTeam(
  teamCode: string,
  players: ArchitectMutationPlayerRecord[],
  capHolds: NonNullable<ArchitectMutationTeamRecord['capHolds']> = []
): ArchitectMutationTeamRecord {
  const totalSalary = players.reduce(
    (sum, player) =>
      sum +
      Number(
        player.contract?.salariesByYear?.[0]?.capHit || player.salary || 0
      ),
    0
  );

  return {
    id: teamCode,
    teamCode,
    teamName: `Team ${teamCode}`,
    roster: players.map((player) => String(player.player_id || player.id)),
    players,
    capHolds,
    draftPicks: [],
    tradeExceptions: [],
    exceptions: {},
    totals: {
      teamSalary: totalSalary,
      apronTeamSalary: totalSalary,
      taxSalary: totalSalary,
      totalSalary,
      capHit: totalSalary,
    },
  };
}

describe('executeTrade sign-and-trade apply semantics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fails closed with no writes when sign-and-trade contract payload is missing', async () => {
    teamLoaderMocks.getTeam.mockImplementation(async (_worldId, teamCode) => {
      if (teamCode === 'LAL') {
        return makeTeam(
          'LAL',
          [
            makePlayer('sat_player', 0, {
              contract: {
                salariesByYear: [{ season: SEASON, salary: 0, capHit: 0 }],
              },
            }),
          ],
          [
            {
              playerId: 'sat_player',
              playerName: 'sat_player',
              season: SEASON,
              active: true,
              isSigned: false,
            },
          ]
        );
      }
      return makeTeam('BOS', [makePlayer('counter', 15_000_000)]);
    });

    const result = await applyWorldMutation({
      userId: 'user_1',
      worldId: 'world_1',
      seasonId: SEASON_ID,
      mutationType: 'executeTrade',
      payload: {
        teams: [
          {
            teamCode: 'LAL',
            sends: [
              {
                ...makePlayer('sat_player', 0, {
                  contract: {
                    salariesByYear: [{ season: SEASON, salary: 0, capHit: 0 }],
                  },
                }),
                signAndTrade: true,
                tradeTo: 'BOS',
              },
            ],
            entitlementsOut: [],
          },
          {
            teamCode: 'BOS',
            sends: [makePlayer('counter', 15_000_000, { tradeTo: 'LAL' })],
            entitlementsOut: [],
          },
        ],
      },
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/sign-and-trade|S&T/i);
    expect(firestoreMocks.writeBatch).not.toHaveBeenCalled();
    expect(firestoreMocks.commit).not.toHaveBeenCalled();
  });

  it('rejects the legacy compute-only S&T path without saved-world authority', () => {
    const satPlayer = makePlayer('sat_player', 0, {
      freeAgentYear: CURRENT_YEAR,
      contract: {
        salariesByYear: [{ season: SEASON, salary: 0, capHit: 0 }],
      },
      signAndTrade: true,
      signAndTradeContract: makeSatContract(15_000_000),
      tradeTo: 'BOS',
    });
    const counterPlayer = makePlayer('counter', 15_000_000, {
      tradeTo: 'LAL',
    });

    const sourceTeam = makeTeam(
      'LAL',
      [satPlayer],
      [
        {
          playerId: 'sat_player',
          playerName: 'sat_player',
          season: SEASON,
          amount: 12_000_000,
          active: true,
          isSigned: false,
        },
      ]
    );
    const destinationTeam = makeTeam('BOS', [counterPlayer]);

    const result = computeWorldMutation({
      mutationType: 'executeTrade',
      payload: {
        teams: [
          {
            teamCode: 'LAL',
            sends: [satPlayer],
            entitlementsOut: [],
          },
          {
            teamCode: 'BOS',
            sends: [counterPlayer],
            entitlementsOut: [],
          },
        ],
        tradeCtx: { source: 'tradeMachine', offseason: true },
      },
      currentState: {
        teams: [
          { teamCode: 'LAL', team: sourceTeam },
          { teamCode: 'BOS', team: destinationTeam },
        ],
      },
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
      worldId: 'world_test',
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(
      /governed sign-and-trade.*saved-world evidence/i
    );
    expect(result.teamUpdates).toBeUndefined();
  });
});
