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
type MatchOfferSheetCurrentState = CurrentStateFor<'matchOfferSheet'>;
type FinalizeMatchedOfferSheetCurrentState =
  CurrentStateFor<'finalizeMatchedOfferSheet'>;
type ExecuteTradeCurrentState = CurrentStateFor<'executeTrade'>;
type SignAndTradeCurrentState = CurrentStateFor<'signAndTrade'>;
type OfferSheetFixture = NonNullable<
  ArchitectMutationTeamRecord['offerSheets']
>[number];

const SEASON_ID = '2025-26';
const FIXED_TIMESTAMP = Date.parse('2026-04-12T14:00:00.000Z');
const FIXED_TIMESTAMP_ISO = '2026-04-12T14:00:00.000Z';

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
      sum +
      Number(
        player.contract?.salariesByYear?.[0]?.capHit || player.salary || 0
      ),
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
    source: {
      provider: 'test-suite',
      type: 'fixture',
      generatedAt: FIXED_TIMESTAMP_ISO,
    },
    ...overrides,
  };
}

function makeOfferSheet(
  playerId: string,
  overrides: Partial<OfferSheetFixture> = {}
): OfferSheetFixture {
  return {
    id: `sheet_${playerId}`,
    dedupKey: `os:test:${playerId}`,
    playerId,
    playerName: `Player ${playerId}`,
    offeringTeamCode: 'BOS',
    homeTeamCode: 'NYK',
    status: 'PENDING_MATCH',
    seasonKey: SEASON_ID,
    year: 2026,
    contractYears: 2,
    totalValue: 18_500_000,
    salariesByYear: [
      {
        season: SEASON_ID,
        salary: 9_000_000,
        capHit: 9_000_000,
        guaranteed: true,
        guaranteedAmount: 9_000_000,
      },
      {
        season: '2026-27',
        salary: 9_500_000,
        capHit: 9_500_000,
        guaranteed: true,
        guaranteedAmount: 9_500_000,
      },
    ],
    createdAt: FIXED_TIMESTAMP_ISO,
    ...overrides,
  };
}

describe('mutationPipeline shared team normalizer closure', () => {
  it('keeps signFreeAgent working through the signing lane while preserving sidecar team fields', () => {
    const freeAgent = makePlayer('fa_lane', 'Free Agent Lane', 0, null, {
      contract: null,
      teamName: null,
      teamCode: null,
    });
    const team = makeTeam('LAL', [makePlayer('keep_lal', 'Keep LAL', 6_000_000, 'LAL')], {
      incomingOfferSheets: [
        makeOfferSheet('keep_rfa', {
          id: 'ios_keep',
          dedupKey: 'ios_keep',
          homeTeamCode: 'LAL',
        }),
      ],
      tradeExceptions: [
        {
          id: 'tpe_keep',
          amount: 1_500_000,
          totalAmount: 1_500_000,
          remainingAmount: 1_500_000,
          usedAmount: 0,
          createdSeason: 2026,
        },
      ],
      draftPicks: [{ year: 2029, round: 1, pick: null, owner: 'LAL' }],
      entitlementIds: ['ent_keep'],
      cashLedger: { totalOut: 225_000 },
      legacySigningLaneBlob: { shouldDrop: true },
    });
    const ignoredTradeTeam = makeTeam('BAD', [], {
      offerSheets: [makeOfferSheet('ignored_bad')],
      incomingOfferSheets: [makeOfferSheet('ignored_bad_in')],
    });

    const result = computeWorldMutation({
      mutationType: 'signFreeAgent',
      payload: {
        teamCode: 'LAL',
        playerId: 'fa_lane',
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
            team: ignoredTradeTeam as NonNullable<
              NonNullable<ExecuteTradeCurrentState['teams']>[number]
            >['team'],
          },
        ],
        destinationTeam:
          ignoredTradeTeam as SignAndTradeCurrentState['destinationTeam'],
      } as unknown as SignFreeAgentCurrentState,
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
    });

    expect(result.success).toBe(true);
    expect(result.teamUpdates?.map((update) => update.teamCode)).toEqual(['LAL']);

    const updatedTeam = result.teamUpdates?.[0]?.team;
    expect(updatedTeam?.roster).toContain('fa_lane');
    expect(updatedTeam?.incomingOfferSheets).toEqual([
      expect.objectContaining({ id: 'ios_keep', homeTeamCode: 'LAL' }),
    ]);
    expect(updatedTeam?.tradeExceptions).toEqual([
      expect.objectContaining({ id: 'tpe_keep', amount: 1_500_000 }),
    ]);
    expect(updatedTeam?.draftPicks).toEqual([
      expect.objectContaining({ year: 2029, round: 1, owner: 'LAL' }),
    ]);
    expect(updatedTeam?.entitlementIds).toEqual(['ent_keep']);
    expect(updatedTeam?.cashLedger).toMatchObject({ totalOut: 225_000 });
    expect(updatedTeam).not.toHaveProperty('legacySigningLaneBlob');
  });

  it('preserves roster and offer-sheet state through the manual-cap lane', () => {
    const keptPlayer = makePlayer('lal_core', 'LAL Core', 8_000_000, 'LAL');
    const team = makeTeam('LAL', [keptPlayer], {
      offerSheets: [makeOfferSheet('lal_offer', { id: 'os_keep', dedupKey: 'os_keep' })],
      incomingOfferSheets: [
        makeOfferSheet('lal_incoming', {
          id: 'ios_keep',
          dedupKey: 'ios_keep',
          homeTeamCode: 'LAL',
        }),
      ],
      legacyManualCapBlob: { shouldDrop: true },
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
    expect(updatedTeam?.roster).toEqual(['lal_core']);
    expect(updatedTeam?.offerSheets).toEqual([
      expect.objectContaining({ id: 'os_keep' }),
    ]);
    expect(updatedTeam?.incomingOfferSheets).toEqual([
      expect.objectContaining({ id: 'ios_keep', homeTeamCode: 'LAL' }),
    ]);
    expect(updatedTeam?.exceptions).toMatchObject({
      room: {
        enabled: true,
        totalAmount: 6_000_000,
        remainingAmount: 6_000_000,
        usedAmount: 0,
      },
    });
    expect(updatedTeam).not.toHaveProperty('legacyManualCapBlob');
  });

  it('keeps offer-sheet mirror updates working while preserving roster and exception state', () => {
    const governed = makeGovernedOfferSheetFixture({
      worldId: 'world-shared-team-normalizer',
      playerId: 'rfa_match',
      homeTeamId: 'NYK',
      offeringTeamId: 'BOS',
      offerSheetId: 'sheet_match',
      salariesByYear: [
        { season: SEASON_ID, salary: 9_000_000 },
        { season: '2026-27', salary: 9_500_000 },
      ],
    });
    const homePlayer = makePlayer('rfa_match', 'RFA Match', 7_000_000, 'NYK');
    const offerSheet = makeOfferSheet('rfa_match', {
      id: 'sheet_match',
      dedupKey: 'sheet_match',
      homeTeamCode: 'NYK',
      offeringTeamCode: 'BOS',
      status: 'PENDING_MATCH',
      governedLifecycle: governed.lifecycle,
    });
    const homeTeam = makeTeam('NYK', [homePlayer], {
      incomingOfferSheets: [offerSheet],
      draftPicks: [{ year: 2030, round: 1, pick: null, owner: 'NYK' }],
      exceptions: {
        room: {
          enabled: true,
          totalAmount: 5_000_000,
          remainingAmount: 5_000_000,
          usedAmount: 0,
        },
        tpe: [{ id: 'nyk_tpe', amount: 500_000 }],
      },
      legacyMirrorBlob: { shouldDrop: true },
    });
    const offeringTeam = makeTeam('BOS', [], {
      offerSheets: [offerSheet],
      exceptions: {
        room: null,
        tpe: [{ id: 'bos_tpe', amount: 750_000 }],
      },
    });

    const result = computeWorldMutation({
      mutationType: 'matchOfferSheet',
      payload: {
        teamCode: 'NYK',
        homeTeamCode: 'NYK',
        offeringTeamCode: 'BOS',
        offerSheetId: 'sheet_match',
        offerSheetResolutionAt: governed.resolutionAt,
      },
      currentState: {
        homeTeam: homeTeam as MatchOfferSheetCurrentState['homeTeam'],
        offeringTeam:
          offeringTeam as MatchOfferSheetCurrentState['offeringTeam'],
        offerSheetId: 'sheet_match',
      } as MatchOfferSheetCurrentState,
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
      asOfDate: governed.asOfDate,
    });

    expect(result.success).toBe(true);

    const updatedHomeTeam = result.teamUpdates?.find(
      (update) => update.teamCode === 'NYK'
    )?.team;
    const updatedOfferingTeam = result.teamUpdates?.find(
      (update) => update.teamCode === 'BOS'
    )?.team;

    // BZE-191: one-click match resolves atomically — the sheet is removed from
    // BOTH teams and the home team keeps the player. There is no surviving
    // MATCHED-status mirror; the lane's real point (roster + exception +
    // sidecar preservation, mirror-blob stripping) is verified on the surviving
    // home team that retained the matched player.
    expect(updatedHomeTeam?.incomingOfferSheets ?? []).toHaveLength(0);
    expect(updatedOfferingTeam?.offerSheets ?? []).toHaveLength(0);
    expect(updatedHomeTeam?.roster).toEqual(['rfa_match']);
    expect(updatedHomeTeam?.exceptions).toMatchObject({
      room: {
        enabled: true,
        totalAmount: 5_000_000,
        remainingAmount: 5_000_000,
        usedAmount: 0,
      },
      tpe: [{ id: 'nyk_tpe', amount: 500_000 }],
    });
    expect(updatedHomeTeam?.draftPicks).toEqual([
      expect.objectContaining({ year: 2030, round: 1, owner: 'NYK' }),
    ]);
    expect(updatedHomeTeam).not.toHaveProperty('legacyMirrorBlob');
  });

  it('keeps offer-sheet finalization working after the resolution-lane split', () => {
    const governed = makeGovernedOfferSheetFixture({
      worldId: 'world-shared-team-normalizer',
      playerId: 'rfa_finalize',
      homeTeamId: 'NYK',
      offeringTeamId: 'BOS',
      offerSheetId: 'sheet_finalize',
      salariesByYear: [
        { season: SEASON_ID, salary: 9_000_000 },
        { season: '2026-27', salary: 9_500_000 },
      ],
    });
    const homePlayer = makePlayer('rfa_finalize', 'RFA Finalize', 7_000_000, 'NYK');
    const matchedOfferSheet = makeOfferSheet('rfa_finalize', {
      id: 'sheet_finalize',
      dedupKey: 'sheet_finalize',
      homeTeamCode: 'NYK',
      offeringTeamCode: 'BOS',
      status: 'MATCHED',
      matchedAt: FIXED_TIMESTAMP_ISO,
      governedLifecycle: governed.lifecycle,
    });
    const homeTeam = makeTeam('NYK', [homePlayer], {
      incomingOfferSheets: [matchedOfferSheet],
      capHolds: [
        {
          playerId: 'rfa_finalize',
          playerName: 'RFA Finalize',
          amount: 3_000_000,
          type: 'FA Cap Hold',
          season: '2026-27',
          isSigned: false,
          active: true,
        },
      ],
      exceptions: {
        room: {
          enabled: true,
          totalAmount: 5_000_000,
          remainingAmount: 5_000_000,
          usedAmount: 0,
        },
        tpe: [{ id: 'nyk_tpe_keep', amount: 400_000 }],
      },
    });
    const offeringTeam = makeTeam('BOS', [], {
      offerSheets: [matchedOfferSheet],
      exceptions: {
        room: null,
        tpe: [{ id: 'bos_tpe_keep', amount: 600_000 }],
      },
    });

    const result = computeWorldMutation({
      mutationType: 'finalizeMatchedOfferSheet',
      payload: {
        teamCode: 'NYK',
        homeTeamCode: 'NYK',
        offeringTeamCode: 'BOS',
        offerSheetId: 'sheet_finalize',
        dedupKey: 'sheet_finalize',
        offerSheetResolutionAt: governed.resolutionAt,
      },
      currentState: {
        homeTeam:
          homeTeam as FinalizeMatchedOfferSheetCurrentState['homeTeam'],
        offeringTeam:
          offeringTeam as FinalizeMatchedOfferSheetCurrentState['offeringTeam'],
        offerSheetId: 'sheet_finalize',
      } as FinalizeMatchedOfferSheetCurrentState,
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
      asOfDate: governed.asOfDate,
    });

    expect(result.success).toBe(true);

    const updatedHomeTeam = result.teamUpdates?.find(
      (update) => update.teamCode === 'NYK'
    )?.team;
    const updatedOfferingTeam = result.teamUpdates?.find(
      (update) => update.teamCode === 'BOS'
    )?.team;
    const updatedPlayer = result.playerUpdates?.find(
      (update) => update.playerId === 'rfa_finalize'
    )?.player;

    expect(updatedHomeTeam?.incomingOfferSheets).toEqual([]);
    expect(
      updatedHomeTeam?.capHolds?.some((hold) => hold.playerId === 'rfa_finalize')
    ).toBe(false);
    expect(updatedHomeTeam?.players?.[0]?.contract?.salariesByYear?.[0]?.salary).toBe(
      9_000_000
    );
    expect(updatedPlayer?.teamCode).toBe('NYK');
    expect(updatedOfferingTeam?.offerSheets).toEqual([]);
    expect(updatedOfferingTeam?.exceptions).toMatchObject({
      tpe: [{ id: 'bos_tpe_keep', amount: 600_000 }],
    });
  });
});
