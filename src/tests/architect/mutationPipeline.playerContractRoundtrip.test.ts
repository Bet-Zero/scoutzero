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

const FIXED_TIMESTAMP = Date.parse('2026-04-10T12:00:00.000Z');
const FIXED_TIMESTAMP_ISO = '2026-04-10T12:00:00.000Z';
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
      type: 'test',
      generatedAt: FIXED_TIMESTAMP_ISO,
    },
    ...overrides,
  } as ArchitectMutationTeamRecord;
}

describe('mutationPipeline player contract round-trip boundary', () => {
  it('keeps option-decision compute working while narrowing current-state player contract ingress', () => {
    const player = makePlayer('option_1', 'Option One', 9_500_000, 'LAL', {
      contract: makeContract(9_500_000, {
        signedAt: '2024-07-06',
        signingDate: undefined,
        birdRights: 'Full',
        freeAgency: '2027 (UFA)',
        tradeRestrictions: ['home-team approval'],
        tradeEligibility: {
          canBeTradedNow: null,
          restrictedUntil: '2026-12-15',
          reason: 'Recent signing',
          rules: {
            baseYearCompensation: false,
            poisonPill: false,
            aggregation: true,
            legacyRuleBlob: { shouldDrop: true },
          },
        },
        legacyContractBlob: { shouldDrop: true },
        salariesByYear: [
          makeSalaryRow('2025-26', 9_500_000),
          makeSalaryRow('2026-27', 10_750_000, {
            option: 'Player',
            optionUsed: 'declined',
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
    expect(updatedPlayer?.contract).not.toHaveProperty('signedAt');
    expect(updatedPlayer?.contract?.birdRights).toEqual({ status: 'Full' });
    expect(updatedPlayer?.contract?.freeAgency).toMatchObject({
      type: 'UFA',
      year: 2027,
    });
    expect(updatedPlayer?.contract?.tradeRestrictions).toEqual([
      'home-team approval',
    ]);
    expect(updatedPlayer?.contract?.tradeEligibility).toMatchObject({
      restrictedUntil: '2026-12-15',
      reason: 'Recent signing',
      rules: { aggregation: true },
    });
    expect(updatedPlayer?.contract).not.toHaveProperty('legacyContractBlob');
    expect(updatedPlayer?.contract?.salariesByYear?.[1]).toMatchObject({
      season: '2026-27',
      option: 'Player',
      optionUsed: true,
    });
    expect(updatedPlayer?.contract?.salariesByYear?.[1]).not.toHaveProperty(
      'legacyRowBlob'
    );
  });

  it('keeps extension compute working while narrowing future-contract round-trip input', () => {
    const player = makePlayer('extend_1', 'Extension One', 14_000_000, 'NYK', {
      futureContract: makeContract(22_000_000, {
        signingTeam: 'NYK',
        signedAt: '2025-07-01',
        signingDate: undefined,
        rfaOfferSheet: true,
        rfaOfferSheetOnly: true,
        rfaOfferSheetStatus: 'PENDING_MATCH',
        signingExecutive: 'Future GM',
        tradeRestrictions: ['consent required'],
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
    expect(updatedFutureContract).not.toHaveProperty('legacyFutureBlob');
    expect(updatedFutureContract).not.toHaveProperty('rfaOfferSheet');
    expect(updatedFutureContract).not.toHaveProperty('rfaOfferSheetOnly');
    expect(updatedFutureContract).not.toHaveProperty('rfaOfferSheetStatus');
    expect(
      updatedFutureContract?.salariesByYear?.find(
        (row) => row.season === '2027-28' && row.voidedByExtension === true
      )
    ).toBeDefined();
    expect(
      updatedFutureContract?.salariesByYear?.some((row) =>
        Object.prototype.hasOwnProperty.call(row, 'legacyFutureRowBlob')
      )
    ).toBe(false);
    expect(
      updatedFutureContract?.salariesByYear?.find(
        (row) => row.season === '2028-29'
      )
    ).toMatchObject({
      season: '2028-29',
      isExtensionSeason: true,
    });
  });

  it('tolerates mixed raw contract ingress only at the outer trade boundary', () => {
    const playerA = makePlayer('trade_a', 'Trade A', 10_000_000, 'TMA', {
      contract: makeContract(10_000_000, {
        signingTeam: 'TMA',
        signedAt: '2024-07-10',
        signingDate: undefined,
        birdRights: 'Early',
        freeAgency: '2028 (UFA)',
        tradeRestrictions: ['no assignment'],
        tradeEligibility: {
          canBeTradedNow: null,
          restrictedUntil: '2026-12-15',
          reason: 'Aggregation restriction',
          rules: {
            baseYearCompensation: false,
            poisonPill: false,
            aggregation: true,
          },
        },
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
    });
    const playerB = makePlayer('trade_b', 'Trade B', 10_000_000, 'TMB');
    const teamA = makeTeam('TMA', [playerA]);
    const teamB = makeTeam('TMB', [playerB]);

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
        tradeCtx: { worldId: 'world_player_contract_roundtrip' },
      },
      currentState: {
        teams: [
          { teamCode: 'TMA', team: teamA },
          { teamCode: 'TMB', team: teamB },
        ],
      } as ExecuteTradeCurrentState,
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
      worldId: 'world_player_contract_roundtrip',
    });

    expect(result.success).toBe(true);

    const movedPlayer = result.playerUpdates?.find(
      (update) => update.playerId === 'trade_a'
    )?.player;
    expect(movedPlayer?.teamCode).toBe('TMB');
    expect(movedPlayer?.contract?.signingDate).toBe('2024-07-10');
    expect(movedPlayer?.contract).not.toHaveProperty('signedAt');
    expect(movedPlayer?.contract?.birdRights).toEqual({ status: 'Early' });
    expect(movedPlayer?.contract?.freeAgency).toMatchObject({
      type: 'UFA',
      year: 2028,
    });
    expect(movedPlayer?.contract?.tradeRestrictions).toEqual([
      'no assignment',
    ]);
    expect(movedPlayer?.contract?.tradeEligibility).toMatchObject({
      restrictedUntil: '2026-12-15',
      reason: 'Aggregation restriction',
      rules: { aggregation: true },
    });
    expect(movedPlayer?.contract).not.toHaveProperty('legacyTradeContractBlob');
    expect(movedPlayer?.contract?.salariesByYear?.[1]).toMatchObject({
      season: '2026-27',
      option: 'Team',
      optionUsed: false,
    });
    expect(movedPlayer?.contract?.salariesByYear?.[1]).not.toHaveProperty(
      'legacyTradeRowBlob'
    );
  });
});
