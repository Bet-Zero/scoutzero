import { describe, expect, it } from 'vitest';
import {
  buildPostTradeTeamsSnapshot,
  computeWorldMutation,
  type ArchitectMutationContract,
  type ArchitectMutationTeamRecord,
} from '@/features/architect/utils/mutationPipeline';

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

function makeContract(salary: number): ArchitectMutationContract {
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
  };
}

function makePlayer(
  id: string,
  name: string,
  salary: number,
  teamCode: string | null,
  overrides: Record<string, unknown> = {}
) {
  return {
    player_id: id,
    id,
    playerId: id,
    name,
    teamCode,
    salary,
    currentSalary: salary,
    contract: makeContract(salary),
    bio: {
      displayName: name,
      playerId: id,
      position: 'SF',
      age: 27,
    },
    ...overrides,
  };
}

function makeTeam(
  teamCode: string,
  totalSalary: number,
  players: ReturnType<typeof makePlayer>[],
  overrides: Partial<ArchitectMutationTeamRecord> = {}
): ArchitectMutationTeamRecord {
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
  } as ArchitectMutationTeamRecord;
}

describe('mutationPipeline live boundary narrowing', () => {
  it('signFreeAgent updates roster and player snapshots through the public compute result', () => {
    const team = makeTeam('LAL', 120_000_000, []);
    const freeAgent = makePlayer('fa_1', 'Free Agent One', 0, null, {
      displayName: 'Free Agent One',
      freeAgency: { type: 'Unrestricted', year: 2026 },
    });

    const result = computeWorldMutation({
      mutationType: 'signFreeAgent',
      payload: {
        teamCode: 'LAL',
        playerId: 'fa_1',
        contract: {
          ...makeContract(8_500_000),
          contractYears: 2,
          years: 2,
          totalValue: 17_000_000,
        },
        signedUsing: 'Cap Space',
      },
      currentState: {
        team,
        player: freeAgent,
        teamCode: 'LAL',
      },
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
    });

    expect(result.success).toBe(true);

    const updatedTeam = result.teamUpdates?.[0]?.team;
    expect(updatedTeam?.roster).toContain('fa_1');
    expect(
      updatedTeam?.players?.some((player) => String(player.player_id || player.id) === 'fa_1')
    ).toBe(true);

    const updatedPlayer = result.playerUpdates?.[0]?.player;
    expect(updatedPlayer?.teamCode).toBe('LAL');
    expect(updatedPlayer?.contract?.signingTeam).toBe('LAL');
  });

  it('executeTrade preserves object-shaped player metadata in the public player updates', () => {
    const playerA = makePlayer('player_a', 'Player A', 10_000_000, 'TMA', {
      displayName: undefined,
      bio: {
        displayName: 'Player A Bio Name',
        playerId: 'player_a',
        position: 'SG',
      },
      representation: {
        agent: 'Agent A',
        agency: 'Agency A',
      },
      source: {
        provider: 'legacy-import',
        playerPageUrl: '/players/a',
        legacyTag: 'preserve-me',
      },
    });
    const playerB = makePlayer('player_b', 'Player B', 10_000_000, 'TMB');

    const teamA = makeTeam('TMA', 120_000_000, [playerA]);
    const teamB = makeTeam('TMB', 120_000_000, [playerB]);

    const result = computeWorldMutation({
      mutationType: 'executeTrade',
      payload: {
        teams: [
          {
            team: teamA,
            teamCode: 'TMA',
            sends: [{ ...playerA, matchOutgoing: 10_000_000 }],
            receives: [{ ...playerB, matchIncoming: 10_000_000 }],
            picksOut: [],
            picksIn: [],
            cashSent: 0,
            cashReceived: 0,
          },
          {
            team: teamB,
            teamCode: 'TMB',
            sends: [{ ...playerB, matchOutgoing: 10_000_000 }],
            receives: [{ ...playerA, matchIncoming: 10_000_000 }],
            picksOut: [],
            picksIn: [],
            cashSent: 0,
            cashReceived: 0,
          },
        ],
        capProjections: makeCapProjections(),
        tradeCtx: { worldId: 'world_live_boundary' },
      },
      currentState: {
        teams: [
          { teamCode: 'TMA', team: teamA },
          { teamCode: 'TMB', team: teamB },
        ],
      },
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
      worldId: 'world_live_boundary',
    });

    expect(result.success).toBe(true);

    const movedPlayerUpdate = result.playerUpdates?.find(
      (update) => update.playerId === 'player_a'
    )?.player;
    expect(movedPlayerUpdate?.teamCode).toBe('TMB');
    expect(movedPlayerUpdate?.displayName).toBe('Player A');
    expect(movedPlayerUpdate?.bio?.displayName).toBe('Player A Bio Name');
    expect(movedPlayerUpdate?.source).toMatchObject({
      provider: 'legacy-import',
      legacyTag: 'preserve-me',
    });
    expect(movedPlayerUpdate?.representation).toEqual({
      agent: 'Agent A',
      agency: 'Agency A',
    });
  });

  it('buildPostTradeTeamsSnapshot keeps routed 3-team roster destinations unchanged', () => {
    const playerA = makePlayer('a_out', 'A Out', 10_000_000, 'TMA', {
      tradeTo: 'TMB',
    });
    const playerB = makePlayer('b_out', 'B Out', 11_000_000, 'TMB', {
      tradeTo: 'TMC',
    });
    const playerC = makePlayer('c_out', 'C Out', 12_000_000, 'TMC', {
      tradeTo: 'TMA',
    });

    const teamA = makeTeam('TMA', 120_000_000, [
      playerA,
      makePlayer('a_keep', 'A Keep', 4_000_000, 'TMA'),
    ]);
    const teamB = makeTeam('TMB', 120_000_000, [
      playerB,
      makePlayer('b_keep', 'B Keep', 4_000_000, 'TMB'),
    ]);
    const teamC = makeTeam('TMC', 120_000_000, [
      playerC,
      makePlayer('c_keep', 'C Keep', 4_000_000, 'TMC'),
    ]);

    const snapshot = buildPostTradeTeamsSnapshot({
      payload: {
        teams: [
          { teamCode: 'TMA', sends: [playerA], entitlementsOut: [] },
          { teamCode: 'TMB', sends: [playerB], entitlementsOut: [] },
          { teamCode: 'TMC', sends: [playerC], entitlementsOut: [] },
        ],
        tradeCtx: { worldId: 'world_routing' },
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
    });

    const postTeamA = snapshot.teamUpdates.find((entry) => entry.teamCode === 'TMA')?.team;
    const postTeamB = snapshot.teamUpdates.find((entry) => entry.teamCode === 'TMB')?.team;
    const postTeamC = snapshot.teamUpdates.find((entry) => entry.teamCode === 'TMC')?.team;

    expect(postTeamA?.roster).toContain('c_out');
    expect(postTeamA?.roster).toContain('a_keep');
    expect(postTeamA?.roster).not.toContain('a_out');

    expect(postTeamB?.roster).toContain('a_out');
    expect(postTeamB?.roster).toContain('b_keep');
    expect(postTeamB?.roster).not.toContain('b_out');

    expect(postTeamC?.roster).toContain('b_out');
    expect(postTeamC?.roster).toContain('c_keep');
    expect(postTeamC?.roster).not.toContain('c_out');
  });
});
