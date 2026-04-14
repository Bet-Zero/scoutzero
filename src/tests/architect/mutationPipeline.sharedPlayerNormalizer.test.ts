import { describe, expect, it } from 'vitest';
import {
  computeWorldMutation,
  type ArchitectMutationSalaryRow,
  type ArchitectMutationTeamRecord,
  type NormalizedMutationSalaryRow,
} from '@/features/architect/utils/mutationPipeline';

type ComputeArgs = Parameters<typeof computeWorldMutation>[0];
type CurrentStateInput = ComputeArgs['currentState'];
type ExecuteTradeCurrentState = Extract<
  ComputeArgs,
  { mutationType: 'executeTrade' }
>['currentState'];

const FIXED_TIMESTAMP = Date.parse('2026-04-12T14:00:00.000Z');
const FIXED_TIMESTAMP_ISO = '2026-04-12T14:00:00.000Z';
const SEASON_ID = '2025-26';

function makeCapProjections() {
  return {
    [SEASON_ID]: {
      salaryCap: 141_000_000,
      luxuryTax: 170_000_000,
      firstApron: 178_000_000,
      secondApron: 188_000_000,
      minSalary: 1_164_000,
      maxSalary: 52_750_000,
    },
  };
}

function makeSalaryRow(
  season: string,
  salary: number,
  overrides: Record<string, unknown> = {}
): ArchitectMutationSalaryRow & Record<string, unknown> {
  return {
    season,
    salary,
    capHit: salary,
    guaranteed: true,
    guaranteedAmount: salary,
    option: null,
    ...overrides,
  };
}

function makeNormalizedSalaryRow(
  season: string,
  salary: number,
  overrides: Partial<NormalizedMutationSalaryRow> = {}
): NormalizedMutationSalaryRow {
  return {
    season,
    salary,
    capHit: salary,
    guaranteed: true,
    guaranteedAmount: salary,
    option: null,
    ...overrides,
  };
}

function makeContract(
  salary: number,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    contractType: 'Standard',
    isExtension: false,
    isRookieScale: false,
    signingTeam: 'LAL',
    signingDate: '2024-07-01',
    startSeason: SEASON_ID,
    endSeason: SEASON_ID,
    contractLength: 1,
    years: 1,
    yearsRemaining: 1,
    totalValue: salary,
    averageAnnualValue: salary,
    guaranteedValue: salary,
    guaranteedYears: 1,
    noTradeClause: false,
    tradeKicker: null,
    tradeRestrictions: [],
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
    salariesByYear: [makeSalaryRow(SEASON_ID, salary)],
    birdRights: { status: 'Full', yearsOfService: 5 },
    freeAgency: { type: 'UFA', year: 2027 },
    ...overrides,
  };
}

function makePlayer(
  id: string,
  name: string,
  salary: number,
  teamCode: string | null,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
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
    contract: makeContract(salary, { signingTeam: teamCode }),
    bio: {
      displayName: name,
      playerId: id,
      position: 'SF',
      yearsExperience: 4,
    },
    birdRights: {
      status: 'Full',
      type: 'Full Bird',
      yearsOfService: 5,
      yearsWithTeam: 3,
    },
    representation: {
      agent: `${name} Agent`,
      agency: 'Agency',
    },
    source: {
      provider: 'test-suite',
      type: 'fixture',
      generatedAt: FIXED_TIMESTAMP_ISO,
    },
    ...overrides,
  };
}

function makeTeam(
  teamCode: string,
  players: Array<Record<string, unknown>>,
  overrides: Partial<ArchitectMutationTeamRecord> = {}
): ArchitectMutationTeamRecord {
  const totalSalary = players.reduce((sum, player) => {
    const contract = player.contract as
      | { salariesByYear?: Array<{ capHit?: number | string | null }> }
      | undefined;

    return (
      sum +
      Number(
        contract?.salariesByYear?.[0]?.capHit ??
          player.currentSalary ??
          player.salary ??
          0
      )
    );
  }, 0);

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
    offerSheets: [],
    incomingOfferSheets: [],
    exceptions: { mle: null, bae: null, tpe: [] },
    totals: {
      totalSalary,
      capHit: totalSalary,
      totalCapAllocations: totalSalary,
      rosterCount: players.length,
      isHardCapped: false,
    },
    source: {
      provider: 'test-suite',
      type: 'fixture',
      generatedAt: FIXED_TIMESTAMP_ISO,
    },
    ...overrides,
  } as ArchitectMutationTeamRecord;
}

describe('mutationPipeline shared player normalizer boundary', () => {
  it('keeps a real current-player mutation flow working while dropping dead shared player carry-through fields', () => {
    const player = makePlayer('option_1', 'Option One', 9_500_000, 'LAL', {
      freeAgentYear: 2027,
      rightsRenounced: false,
      contract: makeContract(9_500_000, {
        signedAt: '2024-07-06',
        signingDate: undefined,
        birdRights: 'Full',
        freeAgency: '2027 (UFA)',
        legacyContractBlob: { shouldDrop: true },
        salariesByYear: [
          makeSalaryRow('2025-26', 9_500_000),
          makeSalaryRow('2026-27', 10_750_000, {
            option: 'Player',
            optionUsed: 'accepted',
            legacyRowBlob: { shouldDrop: true },
          }),
        ],
      }),
    });
    const team = makeTeam('LAL', [player]);

    const result = computeWorldMutation({
      mutationType: 'optionDecision',
      payload: {
        teamCode: 'LAL',
        playerId: 'option_1',
        accepted: true,
        targetYear: 2027,
      },
      currentState: {
        team: team as CurrentStateInput['team'],
        player: player as CurrentStateInput['player'],
        teamCode: 'LAL',
      },
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
    });

    expect(result.success).toBe(true);

    const updatedPlayer = result.playerUpdates?.[0]?.player;
    expect(updatedPlayer?.contract?.signingDate).toBe('2024-07-06');
    expect(updatedPlayer?.contract?.birdRights).toEqual({ status: 'Full' });
    expect(updatedPlayer?.contract?.freeAgency).toMatchObject({
      type: 'UFA',
      year: 2027,
    });
    expect(updatedPlayer?.contract?.salariesByYear?.[1]).toMatchObject({
      season: '2026-27',
      option: 'Player',
      optionUsed: true,
    });
    expect(updatedPlayer?.contract?.salariesByYear?.[1]).not.toHaveProperty(
      'legacyRowBlob'
    );
    expect(updatedPlayer).not.toHaveProperty('salary');
    expect(updatedPlayer).not.toHaveProperty('currentSalary');
    expect(updatedPlayer).not.toHaveProperty('freeAgentYear');
    expect(updatedPlayer).not.toHaveProperty('rightsRenounced');
  });

  it('keeps future-contract normalization working for a real extension flow', () => {
    const player = makePlayer('extend_1', 'Extension One', 14_000_000, 'NYK', {
      futureContract: makeContract(22_000_000, {
        signingTeam: 'NYK',
        signedAt: '2025-07-01',
        signingDate: undefined,
        birdRights: 'Early',
        years: 2,
        contractYears: 2,
        firstYearGuaranteed: true,
        exceptionType: 'Early Bird',
        originalLength: 2,
        firstYearSalary: 22_000_000,
        year1Salary: 22_000_000,
        signingExecutive: 'Future GM',
        tradeRestrictions: ['consent required'],
        rfaOfferSheet: true,
        rfaOfferSheetOnly: true,
        rfaOfferSheetStatus: 'PENDING_MATCH',
        startSeason: '2027-28',
        endSeason: '2028-29',
        noTradeClause: true,
        tradeKicker: '15',
        legacyFutureBlob: { shouldDrop: true },
        salariesByYear: [
          makeSalaryRow('2027-28', 22_000_000, {
            legacyFutureRowBlob: { shouldDrop: true },
          }),
        ],
      }),
    });
    const team = makeTeam('NYK', [player]);

    const result = computeWorldMutation({
      mutationType: 'extendPlayer',
      payload: {
        teamCode: 'NYK',
        playerId: 'extend_1',
        extension: {
          years: 2,
          contractYears: 2,
          salariesByYear: [
            makeNormalizedSalaryRow('2027-28', 24_000_000, {
              optionUsed: true,
            }),
            makeNormalizedSalaryRow('2028-29', 26_000_000),
          ],
        },
      },
      currentState: {
        team: team as CurrentStateInput['team'],
        player: player as CurrentStateInput['player'],
        teamCode: 'NYK',
      },
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
    });

    expect(result.success).toBe(true);

    const updatedFutureContract = result.playerUpdates?.[0]?.player?.futureContract;
    expect(updatedFutureContract?.isExtension).toBe(true);
    expect(updatedFutureContract?.signingDate).toBe(FIXED_TIMESTAMP_ISO);
    expect(updatedFutureContract?.signingExecutive).toBe('Future GM');
    expect(updatedFutureContract?.tradeRestrictions).toEqual([
      'consent required',
    ]);
    expect(updatedFutureContract?.startSeason).toBe('2027-28');
    expect(updatedFutureContract?.endSeason).toBe('2028-29');
    expect(updatedFutureContract?.noTradeClause).toBe(true);
    expect(updatedFutureContract?.tradeKicker).toBe(15);
    expect(updatedFutureContract).not.toHaveProperty('signingTeam');
    expect(updatedFutureContract).not.toHaveProperty('birdRights');
    expect(updatedFutureContract).not.toHaveProperty('years');
    expect(updatedFutureContract).not.toHaveProperty('contractYears');
    expect(updatedFutureContract).not.toHaveProperty('firstYearGuaranteed');
    expect(updatedFutureContract).not.toHaveProperty('exceptionType');
    expect(updatedFutureContract).not.toHaveProperty('originalLength');
    expect(updatedFutureContract).not.toHaveProperty('firstYearSalary');
    expect(updatedFutureContract).not.toHaveProperty('year1Salary');
  });

  it('still shapes persisted player overrides from the narrow carry-through sidecar only', () => {
    const playerA = makePlayer('player_a', 'Player A', 10_000_000, 'LAL', {
      freeAgentYear: 2027,
      rightsRenounced: false,
      draft: {
        round: 1,
        pick: 12,
      },
      lastUpdated: '2026-02-03T00:00:00.000Z',
      version: 'v1',
      isTwoWay: true,
      signedDate: '2026-02-01T00:00:00.000Z',
      isNewlySignedFA: true,
      originTeamId: 'LAL',
      representation: {
        agent: 'Agent A',
        agency: 'Agency A',
      },
      source: {
        provider: 'legacy-import',
        playerPageUrl: '/players/a',
        generatedAt: FIXED_TIMESTAMP_ISO,
      },
      tradeTo: 'BOS',
    });
    const playerB = makePlayer('player_b', 'Player B', 10_000_000, 'BOS', {
      tradeTo: 'LAL',
    });
    const teamA = makeTeam('LAL', [playerA]);
    const teamB = makeTeam('BOS', [playerB]);

    const result = computeWorldMutation({
      mutationType: 'executeTrade',
      payload: {
        teams: [
          {
            teamCode: 'LAL',
            sends: [{ ...playerA, matchOutgoing: 10_000_000 }],
            entitlementsOut: [],
          },
          {
            teamCode: 'BOS',
            sends: [{ ...playerB, matchOutgoing: 10_000_000 }],
            entitlementsOut: [],
          },
        ],
        capProjections: makeCapProjections(),
        tradeCtx: { worldId: 'world_shared_player_normalizer' },
      },
      currentState: {
        teams: [
          { teamCode: 'LAL', team: teamA },
          { teamCode: 'BOS', team: teamB },
        ],
      } as ExecuteTradeCurrentState,
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
      worldId: 'world_shared_player_normalizer',
    });

    expect(result.success).toBe(true);

    const movedPlayer = result.playerUpdates?.find(
      (update) => update.playerId === 'player_a'
    )?.player;
    expect(movedPlayer).toMatchObject({
      playerId: 'player_a',
      teamCode: 'BOS',
      representation: {
        agent: 'Agent A',
        agency: 'Agency A',
      },
      source: {
        provider: 'legacy-import',
        playerPageUrl: '/players/a',
      },
      lastUpdated: '2026-02-03T00:00:00.000Z',
      version: 'v1',
      isTwoWay: true,
      signedDate: '2026-02-01T00:00:00.000Z',
      isNewlySignedFA: true,
      originTeamId: 'LAL',
    });
    expect(movedPlayer).not.toHaveProperty('player_id');
    expect(movedPlayer).not.toHaveProperty('salary');
    expect(movedPlayer).not.toHaveProperty('currentSalary');
    expect(movedPlayer).not.toHaveProperty('freeAgentYear');
    expect(movedPlayer).not.toHaveProperty('rightsRenounced');
    expect(movedPlayer).not.toHaveProperty('draft');
  });

  it('still tolerates mixed public player ingress only at the outer normalization boundary', () => {
    const playerA = makePlayer('trade_a', 'Trade A', 10_000_000, 'TMA', {
      source: 'legacy-import',
      contract: makeContract(10_000_000, {
        signingTeam: 'TMA',
        signedAt: '2024-07-10',
        signingDate: undefined,
        birdRights: 'Early',
        freeAgency: '2028 (UFA)',
        legacyTradeContractBlob: { shouldDrop: true },
        salariesByYear: [
          makeSalaryRow('2025-26', 10_000_000),
          makeSalaryRow('2026-27', 11_000_000, {
            option: 'Team',
            optionUsed: 'declined',
            legacyTradeRowBlob: { shouldDrop: true },
          }),
        ],
      }),
      tradeTo: 'TMB',
    });
    const playerB = makePlayer('trade_b', 'Trade B', 10_000_000, 'TMB', {
      tradeTo: 'TMA',
    });
    const teamA = makeTeam('TMA', [playerA]);
    const teamB = makeTeam('TMB', [playerB]);

    const result = computeWorldMutation({
      mutationType: 'executeTrade',
      payload: {
        teams: [
          {
            teamCode: 'TMA',
            sends: [{ ...playerA, matchOutgoing: 10_000_000 }],
            entitlementsOut: [],
          },
          {
            teamCode: 'TMB',
            sends: [{ ...playerB, matchOutgoing: 10_000_000 }],
            entitlementsOut: [],
          },
        ],
        capProjections: makeCapProjections(),
        tradeCtx: { worldId: 'world_shared_player_mixed_ingress' },
      },
      currentState: {
        teams: [
          { teamCode: 'TMA', team: teamA },
          { teamCode: 'TMB', team: teamB },
        ],
      } as ExecuteTradeCurrentState,
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
      worldId: 'world_shared_player_mixed_ingress',
    });

    expect(result.success).toBe(true);

    const movedPlayer = result.playerUpdates?.find(
      (update) => update.playerId === 'trade_a'
    )?.player;
    expect(movedPlayer?.source).toEqual({ provider: 'legacy-import' });
    expect(movedPlayer?.contract?.signingDate).toBe('2024-07-10');
    expect(movedPlayer?.contract).not.toHaveProperty('signedAt');
    expect(movedPlayer?.contract?.birdRights).toEqual({ status: 'Early' });
    expect(movedPlayer?.contract?.freeAgency).toMatchObject({
      type: 'UFA',
      year: 2028,
    });
    expect(movedPlayer?.contract?.salariesByYear?.[1]).toMatchObject({
      season: '2026-27',
      option: 'Team',
      optionUsed: false,
    });
    expect(movedPlayer?.contract).not.toHaveProperty('legacyTradeContractBlob');
    expect(movedPlayer?.contract?.salariesByYear?.[1]).not.toHaveProperty(
      'legacyTradeRowBlob'
    );
  });
});
