import { describe, expect, it } from 'vitest';
import {
  computeWorldMutation,
  type ArchitectMutationSalaryRow,
  type ArchitectMutationTeamRecord,
  type NormalizedMutationSalaryRow,
} from '@/features/architect/utils/mutationPipeline';

type ComputeArgs = Parameters<typeof computeWorldMutation>[0];
type CurrentStateInput = ComputeArgs['currentState'];

const SEASON_ID = '2025-26';
const FIXED_TIMESTAMP = Date.parse('2026-04-12T16:00:00.000Z');
const FIXED_TIMESTAMP_ISO = '2026-04-12T16:00:00.000Z';

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

describe('mutationPipeline shared player normalizer closure', () => {
  it('keeps the narrowed current-contract lane working for a committed option decision flow', () => {
    const player = makePlayer('option_closure_1', 'Option Closure One', 9_500_000, 'LAL', {
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
        playerId: 'option_closure_1',
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
    expect(updatedPlayer?.contract).not.toHaveProperty('signedAt');
    expect(updatedPlayer?.contract).not.toHaveProperty('legacyContractBlob');
    expect(updatedPlayer?.contract?.salariesByYear?.[1]).not.toHaveProperty(
      'legacyRowBlob'
    );
  });

  it('keeps the narrowed future-contract lane working for a real extension flow', () => {
    const player = makePlayer('future_closure_1', 'Future Closure One', 14_000_000, 'NYK', {
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
        playerId: 'future_closure_1',
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
    expect(updatedFutureContract).not.toHaveProperty('rfaOfferSheet');
    expect(updatedFutureContract).not.toHaveProperty('rfaOfferSheetOnly');
    expect(updatedFutureContract).not.toHaveProperty('rfaOfferSheetStatus');
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

  it('still shapes persisted trade player overrides from the narrowed normalized player source', () => {
    const playerA = makePlayer('player_a', 'Player A', 10_000_000, 'LAL', {
      freeAgentYear: 2027,
      rightsRenounced: false,
      draft: {
        round: 1,
        pick: 12,
      },
      contract: makeContract(10_000_000, {
        signedAt: '2024-07-10',
        signingDate: undefined,
        birdRights: 'Early',
        freeAgency: '2028 (UFA)',
      }),
      futureContract: makeContract(22_000_000, {
        signingTeam: 'LAL',
        signedAt: '2026-07-01',
        signingDate: undefined,
        birdRights: 'Early',
        signingExecutive: 'Cap GM',
        tradeRestrictions: ['consent required'],
        startSeason: '2027-28',
        endSeason: '2028-29',
        legacyFutureBlob: { shouldDrop: true },
      }),
      lastUpdated: '2026-02-03T00:00:00.000Z',
      version: 'v1',
      isTwoWay: true,
      signedDate: '2026-02-01T00:00:00.000Z',
      isNewlySignedFA: true,
      originTeamId: 'LAL',
      rfaContext: {
        pendingHomeTeamCode: 'LAL',
        offerSheetId: 'os_player_a_1',
        retainedUntilFinalize: true,
        compatBag: { shouldDrop: true },
      },
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
        tradeCtx: { worldId: 'world_shared_player_closure' },
      },
      currentState: {
        teams: [
          { teamCode: 'LAL', team: teamA },
          { teamCode: 'BOS', team: teamB },
        ],
      } as CurrentStateInput,
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
      worldId: 'world_shared_player_closure',
    });

    expect(result.success).toBe(true);

    const movedPlayer = result.playerUpdates?.find(
      (update) => update.playerId === 'player_a'
    )?.player;
    expect(movedPlayer).toMatchObject({
      playerId: 'player_a',
      teamCode: 'BOS',
      contract: {
        signingDate: '2024-07-10',
        birdRights: { status: 'Early' },
        freeAgency: { type: 'UFA', year: 2028 },
      },
      futureContract: {
        signingDate: '2026-07-01',
        signingExecutive: 'Cap GM',
        tradeRestrictions: ['consent required'],
        startSeason: '2027-28',
        endSeason: '2028-29',
      },
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
      rfaContext: {
        pendingHomeTeamCode: 'LAL',
        offerSheetId: 'os_player_a_1',
        retainedUntilFinalize: true,
      },
    });
    expect(movedPlayer).not.toHaveProperty('player_id');
    expect(movedPlayer).not.toHaveProperty('salary');
    expect(movedPlayer).not.toHaveProperty('currentSalary');
    expect(movedPlayer).not.toHaveProperty('freeAgentYear');
    expect(movedPlayer).not.toHaveProperty('rightsRenounced');
    expect(movedPlayer).not.toHaveProperty('draft');
    expect(movedPlayer?.futureContract).not.toHaveProperty('signingTeam');
    expect(movedPlayer?.futureContract).not.toHaveProperty('birdRights');
    expect(movedPlayer?.futureContract).not.toHaveProperty('legacyFutureBlob');
    expect(movedPlayer?.rfaContext).not.toHaveProperty('compatBag');
  });

  it('still tolerates mixed public player ingress only at the outer trade boundary', () => {
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
        tradeCtx: { worldId: 'world_shared_player_mixed_closure' },
      },
      currentState: {
        teams: [
          { teamCode: 'TMA', team: teamA },
          { teamCode: 'TMB', team: teamB },
        ],
      } as CurrentStateInput,
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
      worldId: 'world_shared_player_mixed_closure',
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
