import { describe, expect, it } from 'vitest';
import {
  computeWorldMutation,
  type ArchitectMutationBirdRights,
  type ArchitectMutationContract,
  type ArchitectMutationPlayerRecord,
  type ArchitectMutationTeamRecord,
} from '@/features/architect/utils/mutationPipeline';

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
      rosterCount: players.length,
      isHardCapped: false,
    },
    ...overrides,
  };
}

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

    const result = computeWorldMutation({
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
    });

    expect(result.success).toBe(true);

    const movedPlayer = result.playerUpdates.find(
      (update) => update.playerId === 'player_a'
    )?.player;
    const destinationTeam = result.teamUpdates.find(
      (update) => update.teamCode === 'TMB'
    )?.team;

    expect(destinationTeam?.roster).toContain('player_a');
    expect(movedPlayer?.teamCode).toBe('TMB');
    expect(movedPlayer?.contract?.salariesByYear?.[0]?.salary).toBe(10_000_000);
    expect(movedPlayer?.bio?.displayName).toBe('Player A Bio');
    expect(movedPlayer?.representation).toEqual({
      agent: 'Agent A',
      agency: 'Agency A',
    });
    expect(movedPlayer?.source).toMatchObject({
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

    const result = computeWorldMutation({
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
    });

    expect(result.success).toBe(true);
    expect(
      result.teamUpdates.find((update) => update.teamCode === 'TMA')?.team.roster
    ).toEqual(expect.arrayContaining(['a_keep', 'c_out']));
    expect(
      result.teamUpdates.find((update) => update.teamCode === 'TMB')?.team.roster
    ).toEqual(expect.arrayContaining(['b_keep', 'a_out']));
    expect(
      result.teamUpdates.find((update) => update.teamCode === 'TMC')?.team.roster
    ).toEqual(expect.arrayContaining(['c_keep', 'b_out']));

    const routedPlayer = result.playerUpdates.find(
      (update) => update.playerId === 'c_out'
    )?.player;
    expect(routedPlayer?.teamCode).toBe('TMA');
    expect(routedPlayer?.contract?.salariesByYear?.[0]?.salary).toBe(7_000_000);
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

    const result = computeWorldMutation({
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
        player: satPlayer,
        destinationTeam,
      },
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
      worldId: 'world_sat_contract',
    });

    expect(result.success).toBe(true);

    const sourceUpdate = result.teamUpdates.find(
      (update) => update.teamCode === 'LAL'
    )?.team;
    const destinationUpdate = result.teamUpdates.find(
      (update) => update.teamCode === 'BOS'
    )?.team;
    const satInDestination = destinationUpdate?.players?.find(
      (player) => String(player.player_id || player.id) === 'sat_player'
    );

    expect(sourceUpdate?.roster).not.toContain('sat_player');
    expect(sourceUpdate?.capHolds?.some((hold) => hold.playerId === 'sat_player')).toBe(
      false
    );
    expect(destinationUpdate?.roster).toContain('sat_player');
    expect(satInDestination?.contract?.contractType).toBe('Sign & Trade');
    expect(satInDestination?.contract?.salariesByYear?.[0]?.salary).toBe(
      15_000_000
    );
    expect(result._validatedTradeContext?._isValidatedTradeContext).toBe(true);
  });
});
