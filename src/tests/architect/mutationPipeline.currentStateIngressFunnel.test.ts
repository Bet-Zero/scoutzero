import { describe, expect, it } from 'vitest';
import {
  computeWorldMutation,
  type ArchitectMutationBirdRights,
  type ArchitectMutationContract,
  type ArchitectMutationPlayerRecord,
  type ArchitectMutationTeamRecord,
} from '@/features/architect/utils/mutationPipeline';
import { makeGovernedOfferSheetFixture } from '../../../tests/fixtures/architect/governedOfferSheet';

type ComputeArgs = Parameters<typeof computeWorldMutation>[0];
type CurrentStateFor<TMutationType extends ComputeArgs['mutationType']> =
  Extract<ComputeArgs, { mutationType: TMutationType }>['currentState'];
type SignFreeAgentCurrentState = CurrentStateFor<'signFreeAgent'>;
type SetExceptionsCurrentState = CurrentStateFor<'setExceptions'>;
type StoreOfferSheetCurrentState = CurrentStateFor<'storeOfferSheet'>;
type ExecuteTradeCurrentState = CurrentStateFor<'executeTrade'>;
type SignAndTradeCurrentState = CurrentStateFor<'signAndTrade'>;
type ExecuteTradeTeamEntry = NonNullable<ExecuteTradeCurrentState['teams']>[number];

const SEASON_ID = '2025-26';
const FIXED_TIMESTAMP = Date.parse('2026-04-11T17:00:00.000Z');
const FIXED_TIMESTAMP_ISO = '2026-04-11T17:00:00.000Z';

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

function makePlayer(
  id: string,
  name: string,
  salary: number,
  teamCode: string | null,
  overrides: Partial<ArchitectMutationPlayerRecord> & Record<string, unknown> = {}
): ArchitectMutationPlayerRecord & Record<string, unknown> {
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
      generatedAt: FIXED_TIMESTAMP_ISO,
    },
    ...overrides,
  };
}

function makeTeam(
  teamCode: string,
  players: Array<ArchitectMutationPlayerRecord & Record<string, unknown>>,
  overrides: Partial<ArchitectMutationTeamRecord> & Record<string, unknown> = {}
): ArchitectMutationTeamRecord & Record<string, unknown> {
  const totalSalary = players.reduce(
    (sum, player) =>
      sum + Number(player.contract?.salariesByYear?.[0]?.capHit || player.salary || 0),
    0
  );

  return {
    id: teamCode.toLowerCase(),
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
    offerSheets: [],
    incomingOfferSheets: [],
    cashLedger: { totalOut: 0 },
    exceptions: { room: null, mle: null, bae: null, tpe: [] },
    totals: {
      totalSalary,
      capHit: totalSalary,
      totalCapAllocations: totalSalary,
      rosterCount: players.length,
      isHardCapped: false,
    },
    teamTotalSalary: totalSalary,
    ...overrides,
  };
}

describe('mutationPipeline current-state ingress funnel', () => {
  it('keeps mixed public ingress tolerance at the outer boundary for signings', () => {
    const freeAgent = makePlayer('fa_outer', 'Free Agent Outer', 0, null);
    const team = makeTeam('LAL', []);
    const ignoredTradeTeam = makeTeam('BAD', [
      makePlayer('bad_1', 'Bad Player', 4_000_000, 'BAD'),
    ], {
      offerSheets: [{ id: 'ignored_os', playerId: 'bad_1' }],
      incomingOfferSheets: [{ id: 'ignored_ios', playerId: 'bad_1' }],
      legacyTradeIngressBlob: { shouldDrop: true },
    });

    const result = computeWorldMutation({
      mutationType: 'signFreeAgent',
      payload: {
        teamCode: 'LAL',
        playerId: 'fa_outer',
        contract: makeContract(2_000_000, { totalValue: 2_000_000 }),
        signedUsing: 'Minimum',
      },
      currentState: {
        team: team as SignFreeAgentCurrentState['team'],
        player: freeAgent as SignFreeAgentCurrentState['player'],
        teamCode: 'LAL',
        teams: [
          {
            teamCode: 'BAD',
            team: ignoredTradeTeam as ExecuteTradeTeamEntry['team'],
          },
        ],
        destinationTeam:
          ignoredTradeTeam as SignAndTradeCurrentState['destinationTeam'],
      } as unknown as SignFreeAgentCurrentState,
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
      worldId: 'world_ingress_outer_boundary',
    });

    expect(result.success).toBe(true);
    expect(result.teamUpdates?.map((update) => update.teamCode)).toEqual(['LAL']);
    expect(result.teamUpdates?.[0]?.team?.roster).toContain('fa_outer');
    expect(result.playerUpdates?.[0]?.player?.teamCode).toBe('LAL');
  });

  it('preserves round-trip team baggage for base-team exception edits', () => {
    const preservedHistory = [
      {
        historyKey: 'hist_keep',
        type: 'TPE_CREATED',
        teamCode: 'LAL',
        tpeId: 'tpe_keep',
        timestamp: FIXED_TIMESTAMP_ISO,
        legacyPayload: { keep: true },
      },
    ];
    const team = makeTeam('LAL', [], {
      tradeExceptions: [
        {
          id: 'tpe_keep',
          amount: 1_500_000,
          totalAmount: 1_500_000,
          remainingAmount: 1_500_000,
          usedAmount: 0,
          createdSeason: 2026,
          expiresOn: '2026-07-01',
        },
      ],
      exceptionHistory: preservedHistory,
      draftPicks: [
        {
          year: 2029,
          round: 1,
          pick: null,
          owner: 'LAL',
          metadata: { keep: true },
        },
      ],
      entitlementIds: ['ent_keep'],
      cashLedger: { totalOut: 500_000 },
      exceptions: {
        room: {
          enabled: true,
          totalAmount: 5_000_000,
          remainingAmount: 5_000_000,
          usedAmount: 0,
        },
        tpe: [{ id: 'tpe_keep', amount: 1_500_000 }],
        customBucket: { keep: true },
      },
      legacyTeamIngressBlob: { shouldDrop: true },
    });

    const result = computeWorldMutation({
      mutationType: 'setExceptions',
      payload: {
        teamCode: 'LAL',
        exceptions: {
          room: {
            enabled: true,
            totalAmount: 6_000_000,
            remainingAmount: 6_000_000,
            usedAmount: 0,
          },
        },
        exceptionChanges: ['Room Exception updated'],
      },
      currentState: {
        team: team as SetExceptionsCurrentState['team'],
        teamCode: 'LAL',
      } as SetExceptionsCurrentState,
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
    });

    expect(result.success).toBe(true);

    const updatedTeam = result.teamUpdates?.[0]?.team;
    expect(updatedTeam?.exceptions).toMatchObject({
      room: {
        totalAmount: 6_000_000,
        remainingAmount: 6_000_000,
        usedAmount: 0,
      },
      tpe: [{ id: 'tpe_keep', amount: 1_500_000 }],
      customBucket: { keep: true },
    });
    expect(updatedTeam?.tradeExceptions).toEqual([
      expect.objectContaining({ id: 'tpe_keep', amount: 1_500_000 }),
    ]);
    expect(updatedTeam?.exceptionHistory).toEqual(preservedHistory);
    expect(updatedTeam?.draftPicks).toEqual([
      expect.objectContaining({ year: 2029, round: 1, owner: 'LAL' }),
    ]);
    expect(updatedTeam?.entitlementIds).toEqual(['ent_keep']);
    expect(updatedTeam?.cashLedger).toMatchObject({ totalOut: 500_000 });
    expect(updatedTeam).not.toHaveProperty('legacyTeamIngressBlob');
  });

  it('keeps offer-sheet family normalization working after the funnel split', () => {
    const governed = makeGovernedOfferSheetFixture({
      worldId: 'world_offer_sheet',
      playerId: 'rfa_1',
      homeTeamId: 'LAL',
      offeringTeamId: 'BOS',
      salariesByYear: [
        { season: '2025-26', salary: 8_000_000 },
        { season: '2026-27', salary: 8_400_000 },
      ],
    });
    const homePlayer = makePlayer('rfa_1', 'Offer Sheet Player', 7_000_000, 'LAL');
    const homeTeam = makeTeam('LAL', [homePlayer], {
      rightsLedger: governed.rightsLedger,
    });
    const offeringTeam = makeTeam('BOS', []);

    const result = computeWorldMutation({
      mutationType: 'storeOfferSheet',
      payload: {
        teamCode: 'BOS',
        playerId: 'rfa_1',
        worldId: 'world_offer_sheet',
        contract: governed.contract,
        offerSheetProposal: governed.proposal,
        signedUsing: 'TPMLE',
      },
      currentState: {
        team: offeringTeam as StoreOfferSheetCurrentState['team'],
        player: {
          ...homePlayer,
          teamCode: 'LAL',
          teamName: 'Team LAL',
          rfaContext: { governedEvidence: governed.evidence },
        } as StoreOfferSheetCurrentState['player'],
        homeTeam: homeTeam as StoreOfferSheetCurrentState['homeTeam'],
        teamCode: 'BOS',
      } as StoreOfferSheetCurrentState,
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
      asOfDate: governed.asOfDate,
    });

    expect(result.success).toBe(true);

    const updatedOfferingTeam = result.teamUpdates?.find(
      (update) => update.teamCode === 'BOS'
    )?.team;
    const updatedHomeTeam = result.teamUpdates?.find(
      (update) => update.teamCode === 'LAL'
    )?.team;

    expect(updatedOfferingTeam?.offerSheets).toHaveLength(1);
    expect(updatedHomeTeam?.incomingOfferSheets).toHaveLength(1);
    expect(updatedOfferingTeam?.offerSheets?.[0]?.dedupKey).toBe(
      'os:world_offer_sheet:BOS:rfa_1:2025-26'
    );
    expect(updatedHomeTeam?.incomingOfferSheets?.[0]?.playerId).toBe('rfa_1');
  });

  it('keeps trade-family normalization on the trade lane only', () => {
    const playerA = makePlayer('a_trade', 'A Trade', 9_000_000, 'TMA');
    const playerB = makePlayer('b_trade', 'B Trade', 9_000_000, 'TMB');
    const teamA = makeTeam('TMA', [playerA], {
      offerSheets: [{ id: 'ignored_a', playerId: 'ghost_a' }],
      incomingOfferSheets: [{ id: 'ignored_in_a', playerId: 'ghost_a' }],
      legacyTradeIngressBlob: { shouldDrop: true },
    });
    const teamB = makeTeam('TMB', [playerB], {
      offerSheets: [{ id: 'ignored_b', playerId: 'ghost_b' }],
      incomingOfferSheets: [{ id: 'ignored_in_b', playerId: 'ghost_b' }],
      legacyTradeIngressBlob: { shouldDrop: true },
    });

    const result = computeWorldMutation({
      mutationType: 'executeTrade',
      payload: {
        teams: [
          {
            teamCode: 'TMA',
            sends: [
              {
                player_id: 'a_trade',
                id: 'a_trade',
                playerId: 'a_trade',
                name: 'A Trade',
                matchOutgoing: 9_000_000,
                tradeTo: 'TMB',
              },
            ],
            entitlementsOut: [],
          },
          {
            teamCode: 'TMB',
            sends: [
              {
                player_id: 'b_trade',
                id: 'b_trade',
                playerId: 'b_trade',
                name: 'B Trade',
                matchOutgoing: 9_000_000,
                tradeTo: 'TMA',
              },
            ],
            entitlementsOut: [],
          },
        ],
        capProjections: makeCapProjections(),
        tradeCtx: {
          worldId: 'world_trade_ingress_funnel',
          source: 'tradeMachine',
          offseason: true,
        },
      },
      currentState: {
        teams: [
          {
            teamCode: 'TMA',
            team: teamA as ExecuteTradeTeamEntry['team'],
          },
          {
            teamCode: 'TMB',
            team: teamB as ExecuteTradeTeamEntry['team'],
          },
        ],
      } as ExecuteTradeCurrentState,
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
      worldId: 'world_trade_ingress_funnel',
    });

    expect(result.success).toBe(true);

    const destinationTeam = result.teamUpdates?.find(
      (update) => update.teamCode === 'TMB'
    )?.team;
    const movedPlayer = result.playerUpdates?.find(
      (update) => update.playerId === 'a_trade'
    )?.player;

    expect(destinationTeam?.roster).toContain('a_trade');
    expect(movedPlayer?.teamCode).toBe('TMB');
    expect(destinationTeam?.offerSheets).toBeUndefined();
    expect(destinationTeam?.incomingOfferSheets).toBeUndefined();
  });
});
