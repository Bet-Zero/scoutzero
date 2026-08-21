import { describe, expect, it, vi } from 'vitest';
import {
  computeWorldMutation,
  type ArchitectMutationBirdRights,
  type ArchitectMutationContract,
  type ArchitectMutationPlayerRecord,
  type ArchitectMutationResult,
  type ArchitectMutationTeamUpdate,
  type ArchitectMutationTeamRecord,
} from '@/features/architect/utils/mutationPipeline';

vi.mock(
  '@/features/architect/utils/capTotals/computeTeamCapTotals',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@/features/architect/utils/capTotals/computeTeamCapTotals')
      >();
    const snapshot = (
      team: Parameters<typeof actual.computeTeamCapTotals>[0],
      year: number
    ) => {
      const legacy = actual.computeTeamCapTotals(team, year);
      const totals = team?.totals as Record<string, unknown> | null | undefined;
      return {
        ...legacy,
        teamSalary:
          typeof totals?.teamSalary === 'number' ? totals.teamSalary : null,
        apronTeamSalary:
          typeof totals?.apronTeamSalary === 'number'
            ? totals.apronTeamSalary
            : null,
        taxSalary:
          typeof totals?.taxSalary === 'number' ? totals.taxSalary : null,
      };
    };

    return {
      ...actual,
      createCanonicalTeamTotalsSnapshot: vi.fn(snapshot),
      synchronizeTeamTotalsSnapshot: vi.fn((team, year) => ({
        ...team,
        totals: snapshot(team, year),
      })),
    };
  }
);

const SEASON_ID = '2025-26';
const FIXED_TIMESTAMP = Date.parse('2026-04-11T15:00:00.000Z');

function makeCapProjections() {
  return {
    [SEASON_ID]: {
      salaryCap: 141_000_000,
      luxuryTax: 171_000_000,
      firstApron: 179_000_000,
      secondApron: 189_000_000,
      averageSalary: 11_000_000,
      minimumSalary: 1_200_000,
    },
  };
}

function makeContract(
  salary: number,
  overrides: Partial<ArchitectMutationContract> = {}
): ArchitectMutationContract {
  return {
    contractType: 'Standard',
    years: 1,
    contractYears: 1,
    totalValue: salary,
    salariesByYear: [
      {
        season: SEASON_ID,
        salary,
        capHit: salary,
        guaranteed: true,
        guaranteedAmount: salary,
      },
    ],
    ...overrides,
  };
}

function makeBirdRights(
  overrides: Partial<ArchitectMutationBirdRights> = {}
): ArchitectMutationBirdRights {
  return {
    status: 'Full',
    type: 'Full Bird',
    yearsOfService: 6,
    yearsWithTeam: 3,
    ...overrides,
  };
}

function makePlayer(
  id: string,
  name: string,
  salary: number,
  teamCode: string | null,
  overrides: Partial<ArchitectMutationPlayerRecord> = {}
): ArchitectMutationPlayerRecord {
  return {
    player_id: id,
    id,
    playerId: id,
    name,
    displayName: name,
    playerName: name,
    teamCode,
    teamName: teamCode ? `Team ${teamCode}` : null,
    salary,
    currentSalary: salary,
    contract: makeContract(salary),
    bio: {
      displayName: name,
      playerId: id,
      position: 'SF',
      age: 27,
    },
    birdRights: makeBirdRights(),
    representation: {
      agent: `${name} Agent`,
      agency: 'Agency',
    },
    source: {
      provider: 'test-suite',
      type: 'fixture',
      generatedAt: '2026-04-11T15:00:00.000Z',
    },
    ...overrides,
  };
}

function makeTeam(
  teamCode: string,
  players: ArchitectMutationPlayerRecord[],
  overrides: Partial<ArchitectMutationTeamRecord> = {}
): ArchitectMutationTeamRecord {
  const totalSalary = players.reduce(
    (sum, player) =>
      sum + Number(player.contract?.salariesByYear?.[0]?.capHit || player.salary || 0),
    0
  );

  return {
    id: teamCode,
    teamCode,
    teamName: `Team ${teamCode}`,
    players,
    roster: players.map((player) => String(player.player_id || player.id)),
    twoWayPlayers: players.filter((player) => player.isTwoWay === true),
    capHolds: [],
    deadCap: [],
    draftPicks: [],
    entitlementIds: [],
    tradeExceptions: [],
    exceptionHistory: [],
    exceptions: { tpe: [] },
    totals: {
      totalSalary,
      capHit: totalSalary,
      teamSalary: totalSalary,
      apronTeamSalary: totalSalary,
      taxSalary: totalSalary,
      rosterCount: players.length,
      isHardCapped: false,
    },
    ...overrides,
  };
}

type SuccessfulMutationResult = ArchitectMutationResult & {
  teamUpdates: ArchitectMutationTeamUpdate[];
  playerUpdates: NonNullable<ArchitectMutationResult['playerUpdates']>;
};
type SignAndTradeArgs = Extract<
  Parameters<typeof computeWorldMutation>[0],
  { mutationType: 'signAndTrade' }
>;
type SignAndTradeCurrentStatePlayer = NonNullable<
  SignAndTradeArgs['currentState']['player']
>;

const requireSuccessfulMutationResult = (
  result: ArchitectMutationResult
): SuccessfulMutationResult => {
  expect(result.success, String(result.error)).toBe(true);
  expect(result.teamUpdates).toBeDefined();
  expect(result.playerUpdates).toBeDefined();
  if (!result.teamUpdates || !result.playerUpdates) {
    throw new Error('Expected mutation result to include update arrays');
  }
  return result as SuccessfulMutationResult;
};

const requireTeamUpdate = (
  result: SuccessfulMutationResult,
  teamCode: string
) => {
  const update = result.teamUpdates.find(
    (candidate) => candidate.teamCode === teamCode
  );
  expect(update?.team).toBeDefined();
  if (!update?.team) {
    throw new Error(`Expected team update for ${teamCode}`);
  }
  return update.team;
};

const requirePlayerUpdate = (
  result: SuccessfulMutationResult,
  playerId: string
) => {
  const update = result.playerUpdates.find(
    (candidate) => candidate.playerId === playerId
  );
  expect(update?.player).toBeDefined();
  if (!update?.player) {
    throw new Error(`Expected player update for ${playerId}`);
  }
  return update.player;
};

describe('mutationPipeline trade/SAT handoff contract', () => {
  it('commits a two-team trade from minimal send payloads while preserving authoritative player state', () => {
    const playerA = makePlayer('player_a', 'Player A', 10_000_000, 'TMA', {
      bio: {
        displayName: 'Player A Bio',
        playerId: 'player_a',
        position: 'SG',
      },
      representation: {
        agent: 'Agent A',
        agency: 'Agency A',
      },
      source: {
        provider: 'legacy-import',
        type: 'fixture',
        generatedAt: '2026-04-11T15:00:00.000Z',
      },
    });
    const playerB = makePlayer('player_b', 'Player B', 10_000_000, 'TMB');
    const teamA = makeTeam('TMA', [playerA]);
    const teamB = makeTeam('TMB', [playerB]);

    const result = requireSuccessfulMutationResult(computeWorldMutation({
      mutationType: 'executeTrade',
      payload: {
        teams: [
          {
            teamCode: 'TMA',
            sends: [
              {
                player_id: 'player_a',
                id: 'player_a',
                playerId: 'player_a',
                name: 'Player A',
                matchOutgoing: 10_000_000,
                tradeTo: 'TMB',
              },
            ],
            entitlementsOut: [],
          },
          {
            teamCode: 'TMB',
            sends: [
              {
                player_id: 'player_b',
                id: 'player_b',
                playerId: 'player_b',
                name: 'Player B',
                matchOutgoing: 10_000_000,
                tradeTo: 'TMA',
              },
            ],
            entitlementsOut: [],
          },
        ],
        capProjections: makeCapProjections(),
        tradeCtx: {
          worldId: 'world_trade_contract',
          source: 'tradeMachine',
          offseason: true,
        },
      },
      currentState: {
        teams: [
          { teamCode: 'TMA', team: teamA },
          { teamCode: 'TMB', team: teamB },
        ],
      },
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
      worldId: 'world_trade_contract',
    }));

    const movedPlayer = requirePlayerUpdate(result, 'player_a');
    const destinationTeam = requireTeamUpdate(result, 'TMB');

    expect(destinationTeam.roster).toContain('player_a');
    expect(movedPlayer.teamCode).toBe('TMB');
    expect(movedPlayer.contract?.salariesByYear?.[0]?.salary).toBe(10_000_000);
    expect(movedPlayer.bio?.displayName).toBe('Player A Bio');
    expect(movedPlayer.representation).toEqual({
      agent: 'Agent A',
      agency: 'Agency A',
    });
    expect(movedPlayer.source).toMatchObject({
      provider: 'legacy-import',
    });
  });

  it('keeps three-team routing intact without relying on receives payload bags', () => {
    const playerA = makePlayer('a_out', 'A Out', 9_000_000, 'TMA');
    const playerB = makePlayer('b_out', 'B Out', 8_000_000, 'TMB');
    const playerC = makePlayer('c_out', 'C Out', 7_000_000, 'TMC');
    const teamA = makeTeam('TMA', [
      playerA,
      makePlayer('a_keep', 'A Keep', 4_000_000, 'TMA'),
    ]);
    const teamB = makeTeam('TMB', [
      playerB,
      makePlayer('b_keep', 'B Keep', 4_000_000, 'TMB'),
    ]);
    const teamC = makeTeam('TMC', [
      playerC,
      makePlayer('c_keep', 'C Keep', 4_000_000, 'TMC'),
    ]);

    const result = requireSuccessfulMutationResult(computeWorldMutation({
      mutationType: 'executeTrade',
      payload: {
        teams: [
          {
            teamCode: 'TMA',
            sends: [{ player_id: 'a_out', id: 'a_out', name: 'A Out', tradeTo: 'TMB' }],
            entitlementsOut: [],
          },
          {
            teamCode: 'TMB',
            sends: [{ player_id: 'b_out', id: 'b_out', name: 'B Out', tradeTo: 'TMC' }],
            entitlementsOut: [],
          },
          {
            teamCode: 'TMC',
            sends: [{ player_id: 'c_out', id: 'c_out', name: 'C Out', tradeTo: 'TMA' }],
            entitlementsOut: [],
          },
        ],
        capProjections: makeCapProjections(),
        tradeCtx: {
          worldId: 'world_trade_routing',
          source: 'tradeMachine',
          offseason: true,
        },
      },
      currentState: {
        teams: [
          { teamCode: 'TMA', team: teamA },
          { teamCode: 'TMB', team: teamB },
          { teamCode: 'TMC', team: teamC },
        ],
      },
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
      worldId: 'world_trade_routing',
    }));

    expect(requireTeamUpdate(result, 'TMA').roster).toEqual(
      expect.arrayContaining(['a_keep', 'c_out'])
    );
    expect(requireTeamUpdate(result, 'TMB').roster).toEqual(
      expect.arrayContaining(['b_keep', 'a_out'])
    );
    expect(requireTeamUpdate(result, 'TMC').roster).toEqual(
      expect.arrayContaining(['c_keep', 'b_out'])
    );

    const routedPlayer = requirePlayerUpdate(result, 'c_out');
    expect(routedPlayer.teamCode).toBe('TMA');
    expect(routedPlayer.contract?.salariesByYear?.[0]?.salary).toBe(7_000_000);
  });

  it('completes sign-and-trade through the narrowed SAT handoff and preserves contract application', () => {
    const satPlayer = makePlayer('sat_player', 'SAT Player', 0, null, {
      contract: {
        contractType: 'Free Agent',
      },
      freeAgency: {
        type: 'Unrestricted',
        year: 2026,
      },
      birdRights: makeBirdRights(),
    });
    const satCurrentStatePlayer = {
      player_id: 'sat_player',
      id: 'sat_player',
      playerId: 'sat_player',
      name: 'SAT Player',
      displayName: 'SAT Player',
      playerName: 'SAT Player',
      teamCode: null,
      teamName: null,
      contract: {
        contractType: 'Free Agent',
      },
      birdRights: makeBirdRights(),
    } satisfies SignAndTradeCurrentStatePlayer;
    const sourceTeam = makeTeam('LAL', [], {
      capHolds: [
        {
          playerId: 'sat_player',
          playerName: 'SAT Player',
          season: SEASON_ID,
          amount: 12_000_000,
          active: true,
          isSigned: false,
        },
      ],
    });
    const destinationTeam = makeTeam('BOS', [
      makePlayer('counter', 'Counter Player', 14_000_000, 'BOS'),
    ]);

    const result = requireSuccessfulMutationResult(computeWorldMutation({
      mutationType: 'signAndTrade',
      payload: {
        teamCode: 'LAL',
        destinationTeamCode: 'BOS',
        playerId: 'sat_player',
        signedUsing: 'Bird Rights',
        contract: makeContract(15_000_000, {
          contractType: 'Sign & Trade',
          years: 3,
          contractYears: 3,
          totalValue: 47_250_000,
          salariesByYear: [
            {
              season: SEASON_ID,
              salary: 15_000_000,
              capHit: 15_000_000,
              guaranteed: true,
              guaranteedAmount: 15_000_000,
            },
            {
              season: '2026-27',
              salary: 15_750_000,
              capHit: 15_750_000,
              guaranteed: true,
              guaranteedAmount: 15_750_000,
            },
            {
              season: '2027-28',
              salary: 16_500_000,
              capHit: 16_500_000,
              guaranteed: true,
              guaranteedAmount: 16_500_000,
            },
          ],
        }),
      },
      currentState: {
        team: sourceTeam,
        player: satCurrentStatePlayer,
        destinationTeam,
      },
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
      worldId: 'world_sat_contract',
    }));

    const sourceUpdate = requireTeamUpdate(result, 'LAL');
    const destinationUpdate = requireTeamUpdate(result, 'BOS');
    const satInDestination = destinationUpdate.players?.find(
      (player) => String(player.player_id || player.id) === 'sat_player'
    );

    expect(sourceUpdate.roster).not.toContain('sat_player');
    expect(sourceUpdate.capHolds?.some((hold) => hold.playerId === 'sat_player')).toBe(
      false
    );
    expect(destinationUpdate.roster).toContain('sat_player');
    expect(satInDestination?.contract?.contractType).toBe('Sign & Trade');
    expect(satInDestination?.contract?.salariesByYear?.[0]?.salary).toBe(
      15_000_000
    );
    expect(result._validatedTradeContext?._isValidatedTradeContext).toBe(true);
  });
});
