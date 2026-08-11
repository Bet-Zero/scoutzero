/**
 * FILE: src/tests/architect/mutationPipeline.playerContractIngressSlice.test.ts
 * PURPOSE: Behavioral proofs for the narrowed current/future player-contract ingress slices in mutationPipeline.
 * HISTORY:
 *  - 2026-04-11: Added for MUTATION_PIPELINE_PLAYER_CONTRACT_INGRESS_SLICE_PASS
 */

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
    tradeRestrictions: [],
    noTradeClause: false,
    tradeKicker: null,
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

describe('mutationPipeline player contract ingress slice', () => {
  it('rejects ungoverned current-contract option ingress before any baggage can be persisted', () => {
    const player = makePlayer('option_ingress_1', 'Option Ingress One', 9_500_000, 'LAL', {
      contract: makeContract(9_500_000, {
        signedAt: '2024-07-06',
        signingDate: undefined,
        birdRights: 'Full',
        freeAgency: '2027 (UFA)',
        signedByCurrentTeam: true,
        isMaxContract: true,
        maxType: 'Designated Veteran',
        estimatedCapPercentage: '35',
        supersededIn: '2028-29',
        supersededByContractRef: 'superseded_contract_1',
        legacyCurrentContractBlob: { shouldDrop: true },
        salariesByYear: [
          makeSalaryRow('2025-26', 9_500_000),
          makeSalaryRow('2026-27', 10_750_000, {
            option: 'Player',
            optionUsed: 'accepted',
            legacyCurrentRowBlob: { shouldDrop: true },
          }),
        ],
      }),
    });
    const team = makeTeam('LAL', [player]);

    const result = computeWorldMutation({
      mutationType: 'optionDecision',
      payload: {
        teamCode: 'LAL',
        playerId: 'option_ingress_1',
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

    expect(result.success).toBe(false);
    expect(result.error).toContain('Governed option decision requires');
    expect(result.teamUpdates).toBeUndefined();
    expect(result.playerUpdates).toBeUndefined();
  });

  it('keeps future-contract mutation compute working while using the smaller future-contract ingress slice', () => {
    const player = makePlayer('future_ingress_1', 'Future Ingress One', 14_000_000, 'NYK', {
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
        isMaxContract: true,
        maxType: 'Designated Veteran',
        estimatedCapPercentage: '30',
        supersededIn: '2030-31',
        supersededByContractRef: 'future_superseded_1',
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
        playerId: 'future_ingress_1',
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
    expect(updatedFutureContract?.contractType).toBe('Standard');
    expect(updatedFutureContract?.yearsRemaining).toBe(1);
    expect(updatedFutureContract?.totalValue).toBe(22_000_000);
    expect(updatedFutureContract?.averageAnnualValue).toBe(22_000_000);
    expect(updatedFutureContract?.guaranteedValue).toBe(22_000_000);
    expect(updatedFutureContract?.guaranteedYears).toBe(1);
    expect(updatedFutureContract?.freeAgency).toMatchObject({
      type: 'UFA',
      year: 2027,
    });
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
    expect(updatedFutureContract).not.toHaveProperty('rfaOfferSheet');
    expect(updatedFutureContract).not.toHaveProperty('rfaOfferSheetOnly');
    expect(updatedFutureContract).not.toHaveProperty('rfaOfferSheetStatus');
    expect(updatedFutureContract).not.toHaveProperty('isMaxContract');
    expect(updatedFutureContract).not.toHaveProperty('maxType');
    expect(updatedFutureContract).not.toHaveProperty(
      'estimatedCapPercentage'
    );
    expect(updatedFutureContract).not.toHaveProperty('supersededIn');
    expect(updatedFutureContract).not.toHaveProperty(
      'supersededByContractRef'
    );
    expect(updatedFutureContract).not.toHaveProperty('legacyFutureBlob');
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
  });

  it('tolerates mixed raw contract ingress only at the outer committed boundary', () => {
    const playerA = makePlayer('trade_ingress_a', 'Trade Ingress A', 10_000_000, 'TMA', {
      contract: makeContract(10_000_000, {
        signingTeam: 'TMA',
        signedAt: '2024-07-10',
        signingDate: undefined,
        birdRights: 'Early',
        freeAgency: '2028 (UFA)',
        signedByCurrentTeam: true,
        estimatedCapPercentage: '28',
        supersededIn: '2027-28',
        supersededByContractRef: 'superseded_trade_contract',
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
    const playerB = makePlayer('trade_ingress_b', 'Trade Ingress B', 10_000_000, 'TMB');
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
        tradeCtx: { worldId: 'world_player_contract_ingress_slice' },
      },
      currentState: {
        teams: [
          { teamCode: 'TMA', team: teamA },
          { teamCode: 'TMB', team: teamB },
        ],
      } as ExecuteTradeCurrentState,
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
      worldId: 'world_player_contract_ingress_slice',
    });

    expect(result.success).toBe(true);

    const movedPlayer = result.playerUpdates?.find(
      (update) => update.playerId === 'trade_ingress_a'
    )?.player;
    expect(movedPlayer?.teamCode).toBe('TMB');
    expect(movedPlayer?.contract?.signingDate).toBe('2024-07-10');
    expect(movedPlayer?.contract?.birdRights).toEqual({ status: 'Early' });
    expect(movedPlayer?.contract?.freeAgency).toMatchObject({
      type: 'UFA',
      year: 2028,
    });
    expect(movedPlayer?.contract).not.toHaveProperty('signedByCurrentTeam');
    expect(movedPlayer?.contract).not.toHaveProperty(
      'estimatedCapPercentage'
    );
    expect(movedPlayer?.contract).not.toHaveProperty('supersededIn');
    expect(movedPlayer?.contract).not.toHaveProperty(
      'supersededByContractRef'
    );
    expect(movedPlayer?.contract).not.toHaveProperty(
      'legacyTradeContractBlob'
    );
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
