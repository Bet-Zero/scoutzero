import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDoc } from 'firebase/firestore';
import {
  applyWorldMutation,
  computeWorldMutation,
} from '@/features/architect/utils/mutationPipeline';
import { getMockTeamSnapshot } from '../helpers/architectTestHelpers.js';
import {
  createMockWorld,
  seedMockData,
  seedTeamSnapshot,
  seedWorldMetadata,
} from '../helpers/architectTestHelpers.js';
import { resetMockDataStore } from '../__mocks__/firebase.js';
import { getPlayer } from '@/features/architect/utils/teamLoader';
import { worldPlayerRef } from '@/features/architect/utils/architectFirestorePaths';

vi.mock('@/features/architect/utils/capLegalityValidation', () => ({
  validateSigning: vi.fn(() => ({ valid: true, violations: [], warnings: [] })),
  validateWaive: vi.fn(() => ({ valid: true, violations: [], warnings: [] })),
  validateExtension: vi.fn(() => ({
    valid: true,
    violations: [],
    warnings: [],
  })),
  validateOptionDecision: vi.fn(() => ({
    valid: true,
    violations: [],
    warnings: [],
  })),
  validateOfferSheetResolution: vi.fn(() => ({
    valid: true,
    violations: [],
    warnings: [],
  })),
  validateRenounceRights: vi.fn(() => ({
    valid: true,
    violations: [],
    warnings: [],
  })),
  validateDeadCap: vi.fn(() => ({ violations: [], warnings: [] })),
  validateExceptions: vi.fn(() => ({ violations: [], warnings: [] })),
  isOverrideEnabled: vi.fn(() => false),
}));

vi.mock('@/features/architect/utils/tradeMachine', () => ({
  validateTrade: vi.fn((input: Record<string, any>) => ({
    valid: true,
    success: true,
    legal: true,
    reason: null,
    error: null,
    warnings: [],
    violations: [],
    teamResults: Array.from(
      { length: Array.isArray(input?.teams) ? input.teams.length : 0 },
      () => ({ rules: {} })
    ),
  })),
}));

vi.mock('@/features/architect/utils/capLegality/postStateCapValidator', () => ({
  POST_STATE_CAP_VALIDATOR_VERSION: 'test-post-state-validator',
  validatePostStateCapLegality: vi.fn(() => ({
    valid: true,
    violations: [],
    warnings: [],
  })),
}));

vi.mock('@/features/architect/utils/leagueInvariants', () => ({
  validateMutationLeagueInvariants: vi.fn(async () => ({ valid: true })),
  validateMutationEntitlementInvariants: vi.fn(async () => ({ valid: true })),
  validateTradeApplyExclusivity: vi.fn(async () => ({ valid: true })),
}));

const SEASON_ID = '2025-26';
const TIMESTAMP = Date.UTC(2026, 6, 2, 12, 0, 0);
const USER_ID = 'user_trade_truth';

function makeContract(
  salary: number,
  extra: Record<string, any> = {}
): Record<string, any> {
  return {
    contractType: 'Standard',
    totalValue: salary,
    salariesByYear: [
      {
        season: SEASON_ID,
        salary,
        capHit: salary,
        guaranteed: true,
      },
    ],
    ...extra,
  };
}

function makePlayer(
  id: string,
  teamCode: string,
  salary: number,
  extra: Record<string, any> = {}
): Record<string, any> {
  return {
    id,
    playerId: id,
    player_id: id,
    name: id,
    displayName: id,
    teamCode,
    teamName: `Team ${teamCode}`,
    bio: {
      playerId: id,
      displayName: id,
      position: 'SG',
      age: 27,
      experience: 5,
    },
    contract: makeContract(salary),
    source: {
      provider: 'test',
    },
    lastUpdated: '2025-01-01T00:00:00.000Z',
    version: '1.0.0',
    ...extra,
  };
}

function makeTeam(
  teamCode: string,
  players: Array<Record<string, any>>,
  capHolds: Array<Record<string, any>> = []
): Record<string, any> {
  const totalSalary = players.reduce(
    (sum, player) =>
      sum + Number(player?.contract?.salariesByYear?.[0]?.capHit ?? 0),
    0
  );

  return {
    teamCode,
    teamName: `Team ${teamCode}`,
    season: SEASON_ID,
    roster: players.map((player) => String(player.player_id || player.id)),
    players,
    capHolds,
    draftPicks: [],
    tradeExceptions: [],
    exceptionHistory: [],
    exceptions: {},
    totals: {
      totalSalary,
      capHit: totalSalary,
    },
    source: {
      type: 'world-snapshot',
      worldId: 'seeded-world',
    },
  };
}

function makeOfferSheet(
  overrides: Record<string, any> = {}
): Record<string, any> {
  return {
    id: 'os_default',
    dedupKey: 'os:world_default:LAL:player_default:2025-26',
    playerId: 'player_default',
    playerName: 'Offer Sheet Fragment Name',
    offeringTeamCode: 'LAL',
    homeTeamCode: 'BOS',
    seasonKey: SEASON_ID,
    year: 2026,
    status: 'PENDING_MATCH',
    contractYears: 4,
    totalValue: 72_000_000,
    salariesByYear: [
      {
        season: SEASON_ID,
        salary: 18_000_000,
        capHit: 18_000_000,
        guaranteed: true,
      },
      {
        season: '2026-27',
        salary: 18_900_000,
        capHit: 18_900_000,
        guaranteed: true,
      },
      {
        season: '2027-28',
        salary: 19_845_000,
        capHit: 19_845_000,
        guaranteed: true,
      },
      {
        season: '2028-29',
        salary: 20_837_250,
        capHit: 20_837_250,
        guaranteed: true,
      },
    ],
    ...overrides,
  };
}

function seedBasePlayer(player: Record<string, any>) {
  seedMockData(`architect_basePlayers/${player.playerId}`, player);
}

function seedPlayerOverride(
  worldId: string,
  teamCode: string,
  player: Record<string, any>
) {
  seedMockData(`architect_worlds/${worldId}/teams/${teamCode}/players/${player.playerId}`, {
    playerId: player.playerId,
    displayName: player.displayName,
    teamCode: player.teamCode,
    teamName: player.teamName,
    contract: player.contract,
    source: {
      type: 'world-override',
      worldId,
    },
    lastUpdated: '2026-07-01T00:00:00.000Z',
    version: 'override-1',
  });
}

describe('mutationPipeline trade persistence truth', () => {
  beforeEach(() => {
    resetMockDataStore();
    vi.clearAllMocks();
  });

  it('persists standard trade destination overrides and deletes superseded source overrides', async () => {
    const worldId = 'world_trade_truth_standard';
    seedWorldMetadata(
      worldId,
      createMockWorld({ worldId, userId: USER_ID, currentSeason: SEASON_ID })
    );

    const lalOut = makePlayer('lal_out_18m', 'LAL', 18_000_000);
    const bosOut = makePlayer('bos_out_10m', 'BOS', 10_000_000);

    seedBasePlayer(lalOut);
    seedBasePlayer(bosOut);
    seedTeamSnapshot(worldId, 'LAL', makeTeam('LAL', [lalOut]), {
      padRoster: false,
    });
    seedTeamSnapshot(worldId, 'BOS', makeTeam('BOS', [bosOut]), {
      padRoster: false,
    });
    seedPlayerOverride(worldId, 'LAL', lalOut);
    seedPlayerOverride(worldId, 'BOS', bosOut);

    const result = await applyWorldMutation({
      userId: USER_ID,
      worldId,
      seasonId: SEASON_ID,
      mutationType: 'executeTrade',
      timestamp: TIMESTAMP,
      payload: {
        teams: [
          {
            teamCode: 'LAL',
            sends: [{ ...lalOut, tradeTo: 'BOS' }],
            entitlementsOut: [],
          },
          {
            teamCode: 'BOS',
            sends: [{ ...bosOut, tradeTo: 'LAL' }],
            entitlementsOut: [],
          },
        ],
        tradeCtx: {
          source: 'tradeMachine',
        },
      },
    });

    expect(result.success).toBe(true);
    expect(result.changedPlayers?.map((entry) => entry.playerId).sort()).toEqual(
      ['bos_out_10m', 'lal_out_18m']
    );

    const lalSnapshot = getMockTeamSnapshot(worldId, 'LAL');
    const bosSnapshot = getMockTeamSnapshot(worldId, 'BOS');
    expect(lalSnapshot.roster).toContain('bos_out_10m');
    expect(lalSnapshot.roster).not.toContain('lal_out_18m');
    expect(bosSnapshot.roster).toContain('lal_out_18m');
    expect(bosSnapshot.roster).not.toContain('bos_out_10m');

    const deletedSourceOverride = await getDoc(
      worldPlayerRef(worldId, 'LAL', 'lal_out_18m')
    );
    const destinationOverride = await getDoc(
      worldPlayerRef(worldId, 'BOS', 'lal_out_18m')
    );
    expect(deletedSourceOverride.exists()).toBe(false);
    expect(destinationOverride.exists()).toBe(true);

    const movedPlayer = await getPlayer(worldId, 'BOS', 'lal_out_18m');
    expect(movedPlayer.teamCode).toBe('BOS');
    expect(movedPlayer.contract?.salariesByYear?.[0]?.salary).toBe(18_000_000);
  });

  it('persists sign-and-trade destination overrides with the signed contract and deletes source overrides', async () => {
    const worldId = 'world_trade_truth_sat';
    seedWorldMetadata(
      worldId,
      createMockWorld({ worldId, userId: USER_ID, currentSeason: SEASON_ID })
    );

    const satBasePlayer = makePlayer('sat_player', 'LAL', 0, {
      freeAgentYear: 2026,
      contract: makeContract(0, {
        contractType: 'Free Agent',
      }),
    });
    const bosKeeper = makePlayer('bos_keeper', 'BOS', 8_000_000);

    seedBasePlayer(satBasePlayer);
    seedBasePlayer(bosKeeper);
    seedTeamSnapshot(
      worldId,
      'LAL',
      makeTeam('LAL', [satBasePlayer], [
        {
          playerId: 'sat_player',
          playerName: 'sat_player',
          season: SEASON_ID,
          amount: 12_000_000,
          active: true,
          isSigned: false,
        },
      ]),
      { padRoster: false }
    );
    seedTeamSnapshot(worldId, 'BOS', makeTeam('BOS', [bosKeeper]), {
      padRoster: false,
    });
    seedPlayerOverride(worldId, 'LAL', satBasePlayer);

    const satContract = {
      contractType: 'Sign & Trade',
      signAndTrade: true,
      contractYears: 3,
      firstYearGuaranteed: true,
      salariesByYear: [
        { season: SEASON_ID, salary: 15_000_000, capHit: 15_000_000, guaranteed: true },
        { season: '2026-27', salary: 15_750_000, capHit: 15_750_000, guaranteed: true },
        { season: '2027-28', salary: 16_537_500, capHit: 16_537_500, guaranteed: true },
      ],
    };

    const result = await applyWorldMutation({
      userId: USER_ID,
      worldId,
      seasonId: SEASON_ID,
      mutationType: 'signAndTrade',
      timestamp: TIMESTAMP,
      payload: {
        teamCode: 'LAL',
        destinationTeamCode: 'BOS',
        playerId: 'sat_player',
        contract: satContract,
        signedUsing: 'Bird Rights',
      },
    });

    expect(result.success).toBe(true);

    const sourceOverride = await getDoc(
      worldPlayerRef(worldId, 'LAL', 'sat_player')
    );
    const destinationOverride = await getDoc(
      worldPlayerRef(worldId, 'BOS', 'sat_player')
    );
    expect(sourceOverride.exists()).toBe(false);
    expect(destinationOverride.exists()).toBe(true);

    const movedPlayer = await getPlayer(worldId, 'BOS', 'sat_player');
    expect(movedPlayer.teamCode).toBe('BOS');
    expect(movedPlayer.contract?.contractType).toBe('Sign & Trade');
    expect(movedPlayer.contract?.salariesByYear?.[0]?.salary).toBe(15_000_000);
    expect(movedPlayer.contract?.signingTeam).toBe('LAL');
  });

  it('persists finalizeMatchedOfferSheet as a same-team canonical upsert with no delete path', async () => {
    const worldId = 'world_offer_sheet_matched_truth';
    seedWorldMetadata(
      worldId,
      createMockWorld({ worldId, userId: USER_ID, currentSeason: SEASON_ID })
    );

    const matchedPlayer = makePlayer('matched_rfa', 'BOS', 9_000_000, {
      displayName: 'Canonical Matched Player',
      contract: makeContract(9_000_000, {
        contractType: 'Standard',
        signingTeam: 'BOS',
      }),
    });
    const lalKeeper = makePlayer('lal_keeper', 'LAL', 7_000_000);
    const matchedOfferSheet = makeOfferSheet({
      id: 'os_match_truth',
      dedupKey: `os:${worldId}:LAL:matched_rfa:${SEASON_ID}`,
      playerId: 'matched_rfa',
      playerName: 'Offer Sheet Fragment Name',
      offeringTeamCode: 'LAL',
      homeTeamCode: 'BOS',
      status: 'MATCHED',
      totalValue: 77_582_250,
    });

    seedBasePlayer(matchedPlayer);
    seedBasePlayer(lalKeeper);
    seedTeamSnapshot(
      worldId,
      'BOS',
      {
        ...makeTeam('BOS', [matchedPlayer], [
          {
            playerId: 'matched_rfa',
            playerName: 'Canonical Matched Player',
            season: SEASON_ID,
            amount: 14_000_000,
            active: true,
            isSigned: false,
          },
        ]),
        incomingOfferSheets: [matchedOfferSheet],
      },
      { padRoster: false }
    );
    seedTeamSnapshot(
      worldId,
      'LAL',
      {
        ...makeTeam('LAL', [lalKeeper]),
        offerSheets: [matchedOfferSheet],
      },
      { padRoster: false }
    );
    seedPlayerOverride(worldId, 'BOS', matchedPlayer);

    const result = await applyWorldMutation({
      userId: USER_ID,
      worldId,
      seasonId: SEASON_ID,
      mutationType: 'finalizeMatchedOfferSheet',
      timestamp: TIMESTAMP,
      payload: {
        teamCode: 'BOS',
        offeringTeamCode: 'LAL',
        offerSheetId: matchedOfferSheet.id,
      },
    });

    expect(result.success).toBe(true);
    expect(result.changedPlayers?.map((entry) => entry.playerId)).toEqual([
      'matched_rfa',
    ]);
    expect(result.writesSummary?.playersPatched).toBe(1);

    const homeSnapshot = getMockTeamSnapshot(worldId, 'BOS');
    const offeringSnapshot = getMockTeamSnapshot(worldId, 'LAL');
    expect(homeSnapshot.incomingOfferSheets || []).toHaveLength(0);
    expect(offeringSnapshot.offerSheets || []).toHaveLength(0);
    expect(
      (homeSnapshot.capHolds || []).some(
        (hold: Record<string, any>) => hold.playerId === 'matched_rfa'
      )
    ).toBe(false);

    const homeOverride = await getDoc(
      worldPlayerRef(worldId, 'BOS', 'matched_rfa')
    );
    const unexpectedOfferingOverride = await getDoc(
      worldPlayerRef(worldId, 'LAL', 'matched_rfa')
    );
    expect(homeOverride.exists()).toBe(true);
    expect(unexpectedOfferingOverride.exists()).toBe(false);

    const persistedPlayer = await getPlayer(worldId, 'BOS', 'matched_rfa');
    expect(persistedPlayer.teamCode).toBe('BOS');
    expect(persistedPlayer.displayName).toBe('Canonical Matched Player');
    expect(persistedPlayer.contract?.signedUsing).toBe('Match');
    expect(persistedPlayer.contract?.signingTeam).toBe('BOS');
    expect(persistedPlayer.contract?.contractLength).toBe(4);
    expect(persistedPlayer.contract?.salariesByYear?.[0]?.salary).toBe(18_000_000);
  });

  it('persists finalizeDeclinedOfferSheet as canonical movement with destination upsert and source delete', async () => {
    const worldId = 'world_offer_sheet_declined_truth';
    seedWorldMetadata(
      worldId,
      createMockWorld({ worldId, userId: USER_ID, currentSeason: SEASON_ID })
    );

    const declinedPlayer = makePlayer('declined_rfa', 'BOS', 8_000_000, {
      displayName: 'Canonical Declined Player',
      contract: makeContract(8_000_000, {
        contractType: 'Standard',
        signingTeam: 'BOS',
      }),
    });
    const lalKeeper = makePlayer('lal_keeper_2', 'LAL', 6_500_000);
    const declinedOfferSheet = makeOfferSheet({
      id: 'os_decline_truth',
      dedupKey: `os:${worldId}:LAL:declined_rfa:${SEASON_ID}`,
      playerId: 'declined_rfa',
      playerName: 'Fragment-Only Name',
      offeringTeamCode: 'LAL',
      homeTeamCode: 'BOS',
      status: 'DECLINED',
      totalValue: 77_582_250,
    });

    seedBasePlayer(declinedPlayer);
    seedBasePlayer(lalKeeper);
    seedTeamSnapshot(
      worldId,
      'BOS',
      {
        ...makeTeam('BOS', [declinedPlayer], [
          {
            playerId: 'declined_rfa',
            playerName: 'Canonical Declined Player',
            season: SEASON_ID,
            amount: 13_500_000,
            active: true,
            isSigned: false,
          },
        ]),
        incomingOfferSheets: [declinedOfferSheet],
      },
      { padRoster: false }
    );
    seedTeamSnapshot(
      worldId,
      'LAL',
      {
        ...makeTeam('LAL', [lalKeeper], [
          {
            playerId: 'declined_rfa',
            playerName: 'Canonical Declined Player',
            season: SEASON_ID,
            amount: 3_500_000,
            active: true,
            isSigned: false,
          },
        ]),
        offerSheets: [declinedOfferSheet],
      },
      { padRoster: false }
    );
    seedPlayerOverride(worldId, 'BOS', declinedPlayer);

    const result = await applyWorldMutation({
      userId: USER_ID,
      worldId,
      seasonId: SEASON_ID,
      mutationType: 'finalizeDeclinedOfferSheet',
      timestamp: TIMESTAMP,
      payload: {
        teamCode: 'LAL',
        homeTeamCode: 'BOS',
        offeringTeamCode: 'LAL',
        offerSheetId: declinedOfferSheet.id,
        dedupKey: declinedOfferSheet.dedupKey,
      },
    });

    expect(result.success).toBe(true);
    expect(result.changedPlayers?.map((entry) => entry.playerId)).toEqual([
      'declined_rfa',
    ]);

    const homeSnapshot = getMockTeamSnapshot(worldId, 'BOS');
    const offeringSnapshot = getMockTeamSnapshot(worldId, 'LAL');
    expect(homeSnapshot.roster).not.toContain('declined_rfa');
    expect(offeringSnapshot.roster).toContain('declined_rfa');
    expect(homeSnapshot.incomingOfferSheets || []).toHaveLength(0);
    expect(offeringSnapshot.offerSheets || []).toHaveLength(0);
    expect(
      (homeSnapshot.capHolds || []).some(
        (hold: Record<string, any>) => hold.playerId === 'declined_rfa'
      )
    ).toBe(false);
    expect(
      (offeringSnapshot.capHolds || []).some(
        (hold: Record<string, any>) => hold.playerId === 'declined_rfa'
      )
    ).toBe(false);

    const deletedSourceOverride = await getDoc(
      worldPlayerRef(worldId, 'BOS', 'declined_rfa')
    );
    const destinationOverride = await getDoc(
      worldPlayerRef(worldId, 'LAL', 'declined_rfa')
    );
    expect(deletedSourceOverride.exists()).toBe(false);
    expect(destinationOverride.exists()).toBe(true);

    const movedPlayer = await getPlayer(worldId, 'LAL', 'declined_rfa');
    expect(movedPlayer.teamCode).toBe('LAL');
    expect(movedPlayer.displayName).toBe('Canonical Declined Player');
    expect(movedPlayer.displayName).not.toBe('Fragment-Only Name');
    expect(movedPlayer.contract?.signedUsing).toBe('Offer Sheet');
    expect(movedPlayer.contract?.signingTeam).toBe('LAL');
    expect(movedPlayer.contract?.contractLength).toBe(4);
    expect(movedPlayer.contract?.salariesByYear?.[0]?.salary).toBe(18_000_000);
  });

  it('fails closed when duplicate move candidates resolve to conflicting destinations', () => {
    const duplicatePlayer = makePlayer('dup_player', 'LAL', 9_000_000);
    const currentState = {
      teams: [
        { teamCode: 'LAL', team: makeTeam('LAL', [duplicatePlayer]) },
        { teamCode: 'BOS', team: makeTeam('BOS', []) },
        { teamCode: 'NYK', team: makeTeam('NYK', []) },
      ],
    };

    const result = computeWorldMutation({
      mutationType: 'executeTrade',
      payload: {
        teams: [
          {
            teamCode: 'LAL',
            sends: [
              { ...duplicatePlayer, tradeTo: 'BOS' },
              { ...duplicatePlayer, tradeTo: 'NYK' },
            ],
            entitlementsOut: [],
          },
          { teamCode: 'BOS', sends: [], entitlementsOut: [] },
          { teamCode: 'NYK', sends: [], entitlementsOut: [] },
        ],
      },
      currentState,
      seasonId: SEASON_ID,
      timestamp: TIMESTAMP,
      worldId: 'world_conflict_trade_truth',
    });

    expect(result.success).toBe(false);
    expect(String(result.error)).toContain('conflicting destinations');
  });

  it('does not emit playerDeletes for non-trade contract mutations', () => {
    const player = makePlayer('extend_player', 'LAL', 12_000_000, {
      futureContract: {
        salariesByYear: [],
      },
    });
    const currentState = {
      team: makeTeam('LAL', [player]),
      player,
      teamCode: 'LAL',
    };

    const result = computeWorldMutation({
      mutationType: 'extendPlayer',
      payload: {
        teamCode: 'LAL',
        playerId: 'extend_player',
        extension: {
          salariesByYear: [
            { season: '2027-28', salary: 14_000_000, capHit: 14_000_000 },
          ],
        },
      },
      currentState,
      seasonId: SEASON_ID,
      timestamp: TIMESTAMP,
    });

    expect(result.success).toBe(true);
    expect(result.playerDeletes).toEqual([]);
    expect(result.playerUpdates?.[0]?.playerId).toBe('extend_player');
  });
});
