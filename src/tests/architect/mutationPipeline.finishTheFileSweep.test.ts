import { describe, expect, it } from 'vitest';
import {
  computeWorldMutation,
  type ArchitectMutationContract,
  type ArchitectMutationTeamRecord,
} from '@/features/architect/utils/mutationPipeline';
import type { DraftPick } from '@/schemas/architect';

type ComputeArgs = Parameters<typeof computeWorldMutation>[0];
type SignFreeAgentCurrentState = Extract<
  ComputeArgs,
  { mutationType: 'signFreeAgent' }
>['currentState'];
type ExecuteTradeCurrentState = Extract<
  ComputeArgs,
  { mutationType: 'executeTrade' }
>['currentState'];
type SetExceptionsCurrentState = Extract<
  ComputeArgs,
  { mutationType: 'setExceptions' }
>['currentState'];

const FIXED_TIMESTAMP = Date.parse('2026-03-25T12:00:00.000Z');
const FIXED_TIMESTAMP_ISO = '2026-03-25T12:00:00.000Z';
const SEASON_ID = '2025-26';

function makeCapProjections() {
  return {
    '2025-26': {
      salaryCap: 141_000_000,
      luxuryTax: 170_000_000,
      firstApron: 178_000_000,
      secondApron: 188_000_000,
      minSalary: 1_164_000,
      maxSalary: 52_750_000,
    },
  };
}

function makeContract(
  salary: number,
  overrides: Partial<ArchitectMutationContract> = {}
): ArchitectMutationContract {
  return {
    contractType: 'Standard',
    salariesByYear: [
      {
        season: SEASON_ID,
        salary,
        capHit: salary,
        guaranteed: true,
        guaranteedAmount: salary,
      },
    ],
    birdRights: { status: 'Full', yearsOfService: 5 },
    freeAgency: { type: 'Unrestricted', year: 2027 },
    totalValue: salary,
    years: 1,
    contractYears: 1,
    ...overrides,
  };
}

function makeRawPlayer(
  id: string,
  name: string,
  salary: number,
  teamCode: string | null,
  overrides: Record<string, unknown> = {}
) {
  return {
    id,
    player_id: id,
    playerId: id,
    name,
    displayName: name,
    playerName: name,
    teamCode,
    teamName: teamCode ? `Team ${teamCode}` : null,
    salary,
    currentSalary: salary,
    contract: makeContract(salary, {
      signingTeam: teamCode,
    }),
    bio: {
      displayName: name,
      playerId: id,
      position: 'SF',
      yearsExperience: 4,
    },
    representation: {
      agent: 'Test Agent',
      agency: 'Test Agency',
    },
    source: {
      provider: 'test-suite',
      playerPageUrl: `https://example.com/${id}`,
      scrapedAt: FIXED_TIMESTAMP_ISO,
    },
    ...overrides,
  };
}

function makeRawTeam(
  teamCode: string,
  totalSalary: number,
  players: ReturnType<typeof makeRawPlayer>[],
  overrides: Partial<ArchitectMutationTeamRecord> & Record<string, unknown> = {}
): ArchitectMutationTeamRecord & Record<string, unknown> {
  return {
    id: teamCode.toLowerCase(),
    teamCode,
    teamName: `Team ${teamCode}`,
    teamTotalSalary: totalSalary,
    players,
    roster: players.map((player) => String(player.player_id || player.id)),
    tradeExceptions: [],
    exceptionHistory: [],
    entitlementIds: [],
    draftPicks: [],
    capHolds: [],
    deadCap: [],
    exceptions: { mle: null, bae: null, tpe: [] },
    totals: {
      teamSalary: totalSalary,
      totalSalary,
      capHit: totalSalary,
      rosterCount: players.length,
      isOverTax: totalSalary > 170_000_000,
      isFirstApron: totalSalary > 178_000_000,
      isSecondApron: totalSalary > 188_000_000,
      isHardCapped: false,
    },
    source: {
      provider: 'test-suite',
      type: 'test',
      generatedAt: FIXED_TIMESTAMP_ISO,
    },
    ...overrides,
  };
}

describe('mutationPipeline finish-the-file sweep', () => {
  it('signFreeAgent still succeeds through the public ingress shape', () => {
    const team = makeRawTeam('LAL', 120_000_000, [], {
      legacyNoise: 'ignored-at-ingress',
    });
    const freeAgent = makeRawPlayer('fa_1', 'Free Agent One', 0, null, {
      freeAgentYear: '2026',
      freeAgency: { type: 'Unrestricted', year: 2026 },
      legacyNoise: 'ignored-at-ingress',
    });

    const result = computeWorldMutation({
      mutationType: 'signFreeAgent',
      payload: {
        teamCode: 'LAL',
        playerId: 'fa_1',
        contract: makeContract(8_500_000, {
          years: 2,
          contractYears: 2,
          totalValue: 17_000_000,
        }),
        signedUsing: 'Cap Space',
      },
      currentState: {
        team,
        player: freeAgent,
        teamCode: 'LAL',
        destinationTeamCode: 'IGNORED_PUBLIC_INGRESS_FIELD',
      } as unknown as SignFreeAgentCurrentState,
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
    });

    expect(result.success).toBe(true);

    const updatedTeam = result.teamUpdates?.[0]?.team;
    const updatedPlayer = result.playerUpdates?.[0]?.player;

    expect(updatedTeam?.roster).toContain('fa_1');
    expect(
      updatedTeam?.players?.some(
        (player) => String(player.player_id || player.id) === 'fa_1'
      )
    ).toBe(true);
    expect(updatedPlayer?.teamCode).toBe('LAL');
    expect(updatedPlayer?.contract?.signingTeam).toBe('LAL');
  });

  it('executeTrade still moves the player and preserves carried-forward team state from currentState.teams[]', () => {
    const carriedPick: DraftPick = {
      year: 2028,
      round: 1,
      pick: null,
      owner: 'TMA',
    };

    const playerA = makeRawPlayer('player_a', 'Player A', 10_000_000, 'TMA');
    const playerB = makeRawPlayer('player_b', 'Player B', 10_000_000, 'TMB');

    const teamA = makeRawTeam('TMA', 120_000_000, [playerA], {
      entitlementIds: ['ent_keep_a'],
      draftPicks: [carriedPick],
      legacyNoise: 'ignored-at-ingress',
    });
    const teamB = makeRawTeam('TMB', 120_000_000, [playerB], {
      entitlementIds: ['ent_keep_b'],
    });

    const result = computeWorldMutation({
      mutationType: 'executeTrade',
      payload: {
        teams: [
          {
            teamCode: 'TMA',
            team: teamA,
            sends: [{ ...playerA, matchOutgoing: 10_000_000 }],
            receives: [{ ...playerB, matchIncoming: 10_000_000 }],
            picksOut: [],
            picksIn: [],
            cashSent: 0,
            cashReceived: 0,
          },
          {
            teamCode: 'TMB',
            team: teamB,
            sends: [{ ...playerB, matchOutgoing: 10_000_000 }],
            receives: [{ ...playerA, matchIncoming: 10_000_000 }],
            picksOut: [],
            picksIn: [],
            cashSent: 0,
            cashReceived: 0,
          },
        ],
        capProjections: makeCapProjections(),
        tradeCtx: { worldId: 'world_finish_the_file' },
      },
      currentState: {
        teams: [
          { teamCode: 'TMA', team: teamA },
          { teamCode: 'TMB', team: teamB },
        ],
      } as ExecuteTradeCurrentState,
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
      worldId: 'world_finish_the_file',
    });

    expect(result.success).toBe(true);

    const movedPlayer = result.playerUpdates?.find(
      (update) => update.playerId === 'player_a'
    )?.player;
    const updatedTeamA = result.teamUpdates?.find(
      (update) => update.teamCode === 'TMA'
    )?.team;

    expect(movedPlayer?.teamCode).toBe('TMB');
    expect(updatedTeamA?.roster).not.toContain('player_a');
    expect(updatedTeamA?.entitlementIds).toEqual(['ent_keep_a']);
    expect(updatedTeamA?.draftPicks).toEqual([carriedPick]);
  });

  it('setExceptions preserves a non-canonical exception bucket through the public compute result', () => {
    const team = makeRawTeam('NYK', 121_000_000, []);

    const result = computeWorldMutation({
      mutationType: 'setExceptions',
      payload: {
        teamCode: 'NYK',
        exceptions: {
          tpe: [],
          customRoomAlias: {
            enabled: true,
            totalAmount: 2_500_000,
          },
        },
      },
      currentState: { team } as SetExceptionsCurrentState,
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
    });

    expect(result.success).toBe(true);

    const updatedTeam = result.teamUpdates?.[0]?.team;
    const customBucket = updatedTeam?.exceptions?.customRoomAlias as
      | { enabled?: boolean | null; totalAmount?: number | string | null }
      | undefined;

    expect(customBucket).toMatchObject({
      enabled: true,
      totalAmount: 2_500_000,
    });
  });
});
