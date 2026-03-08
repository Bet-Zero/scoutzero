import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestoreMocks = vi.hoisted(() => {
  const commit = vi.fn(async () => undefined);
  return {
    commit,
    writeBatch: vi.fn(() => ({
      set: vi.fn(),
      update: vi.fn(),
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
} from '@/features/architect/utils/mutationPipeline';

const CURRENT_YEAR = 2026;
const SEASON_ID = '2025-26';
const SEASON = '2025-26';
const FIXED_TIMESTAMP = Date.UTC(2026, 6, 1, 12, 0, 0);

function makeSatContract(firstYearSalary: number) {
  return {
    contractType: 'Sign & Trade',
    contractYears: 3,
    firstYearGuaranteed: true,
    salariesByYear: [
      { season: SEASON, salary: firstYearSalary, capHit: firstYearSalary, guaranteed: true },
      { season: '2026-27', salary: Math.round(firstYearSalary * 1.05), capHit: Math.round(firstYearSalary * 1.05), guaranteed: true },
      { season: '2027-28', salary: Math.round(firstYearSalary * 1.1), capHit: Math.round(firstYearSalary * 1.1), guaranteed: true },
    ],
  };
}

function makePlayer(
  id: string,
  salary: number,
  extra: Record<string, any> = {}
) {
  return {
    id,
    player_id: id,
    name: id,
    freeAgentYear: CURRENT_YEAR,
    contract: {
      salariesByYear: [{ season: SEASON, salary, capHit: salary, guaranteed: true }],
    },
    ...extra,
  };
}

function makeTeam(teamCode: string, players: Array<Record<string, any>>, capHolds: any[] = []) {
  const totalSalary = players.reduce(
    (sum, player) =>
      sum +
      Number(player.contract?.salariesByYear?.[0]?.capHit || player.salary || 0),
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
    totals: { totalSalary, capHit: totalSalary },
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
          [makePlayer('sat_player', 0, { contract: { salariesByYear: [{ season: SEASON, salary: 0, capHit: 0 }] } })],
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
                  contract: { salariesByYear: [{ season: SEASON, salary: 0, capHit: 0 }] },
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

  it('persists S&T contract, removes source cap hold, and hard-caps receiver in executeTrade', () => {
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

    const sourceTeam = makeTeam('LAL', [satPlayer], [
      {
        playerId: 'sat_player',
        playerName: 'sat_player',
        season: SEASON,
        amount: 12_000_000,
        active: true,
        isSigned: false,
      },
    ]);
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

    expect(result.success).toBe(true);

    const validatedReceiver =
      result._validatedTradeContext?._rawValidation?.teamResults?.find(
        (entry: any) => entry.teamId === 'BOS'
      );
    const sourceUpdate = result.teamUpdates.find((entry) => entry.teamCode === 'LAL');
    const destinationUpdate = result.teamUpdates.find((entry) => entry.teamCode === 'BOS');

    expect(sourceUpdate).toBeDefined();
    expect(destinationUpdate).toBeDefined();
    expect(result._validatedTradeContext?._isValidatedTradeContext).toBe(true);
    expect(validatedReceiver?.rules?.signAndTrade?.passed).toBe(true);
    expect(validatedReceiver?.rules?.signAndTrade?.hardCapped).toBe(true);
    expect(validatedReceiver?.hardCapped).toBe(true);

    const playerInDestination = destinationUpdate?.team.players?.find(
      (player: any) => (player.player_id || player.id) === 'sat_player'
    );
    expect(playerInDestination).toBeDefined();
    expect(playerInDestination.contract?.contractType).toBe('Sign & Trade');
    expect(playerInDestination.contract?.salariesByYear?.[0]?.salary).toBe(
      15_000_000
    );

    expect(
      (sourceUpdate?.team.capHolds || []).some(
        (hold: any) => hold.playerId === 'sat_player'
      )
    ).toBe(false);

    expect(destinationUpdate?.team.hardCapTriggeredBy).toBe('signAndTrade');
    expect(destinationUpdate?.team.hardCapReason).toBe(
      'Triggered by receiving sign-and-trade player'
    );
    expect(destinationUpdate?.team.totals?.isHardCapped).toBe(true);
    expect(destinationUpdate?.team.totals?.hardCapLevel).toBe('firstApron');
  });
});
