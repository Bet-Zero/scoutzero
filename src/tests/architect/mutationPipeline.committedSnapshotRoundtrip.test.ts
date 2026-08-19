import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeGovernedOfferSheetFixture } from '../../../tests/fixtures/architect/governedOfferSheet';

const harness = vi.hoisted(() => ({
  writeBatchMock: vi.fn(() => ({
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn(async (): Promise<void> => undefined),
  })),
  getDocMock: vi.fn(async () => ({
    exists: () => false,
    data: () => ({}),
  })),
  getTeamMock: vi.fn(),
  getPlayerMock: vi.fn(),
  updateWorldStatsMock: vi.fn(async (): Promise<void> => undefined),
  getWorldMetadataMock: vi.fn(async () => ({
    parentWorldId: null,
    asOfDate: '2026-07-01',
  })),
  validateTradeMock: vi.fn(),
}));

vi.mock('@/firebaseConfig', () => ({
  db: 'db',
}));

vi.mock('firebase/firestore', () => ({
  writeBatch: harness.writeBatchMock,
  getDoc: harness.getDocMock,
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  collection: vi.fn((...segments: unknown[]) => segments.map(String).join('/')),
  doc: vi.fn((...segments: unknown[]) => segments.map(String).join('/')),
}));

vi.mock('@/features/architect/utils/teamLoader', () => ({
  getTeam: harness.getTeamMock,
  getPlayer: harness.getPlayerMock,
  mergePlayerOverride: vi.fn(
    (
      base: Record<string, unknown>,
      override: Record<string, unknown>
    ): Record<string, unknown> => ({
      ...base,
      ...override,
    })
  ),
}));

vi.mock('@/features/architect/utils/worldManager', () => ({
  updateWorldStats: harness.updateWorldStatsMock,
  getWorldMetadata: harness.getWorldMetadataMock,
}));

vi.mock('@/features/architect/utils/tradeMachine', () => ({
  validateTrade: harness.validateTradeMock,
}));

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

vi.mock('@/features/architect/utils/capLegality/postStateCapValidator', () => ({
  POST_STATE_CAP_VALIDATOR_VERSION: 'test-post-state-validator',
  validatePostStateCapLegality: vi.fn(() => ({
    valid: true,
    violations: [],
    warnings: [],
  })),
}));

vi.mock('@/features/architect/utils/persistenceContracts', () => ({
  assertPersistableOrThrow: vi.fn(),
  normalizeTeamTpeSchema: vi.fn((team: unknown) => team),
  PERSISTENCE_CONTRACTS: {},
}));

vi.mock('@/features/architect/utils/leagueInvariants', () => ({
  validateMutationLeagueInvariants: vi.fn(async () => ({
    valid: true,
    violations: [],
    warnings: [],
  })),
  validateMutationEntitlementInvariants: vi.fn(async () => ({
    valid: true,
    violations: [],
    warnings: [],
  })),
  validateTradeApplyExclusivity: vi.fn(async () => ({
    valid: true,
    teamViolations: [],
  })),
}));

import { computeWorldMutation } from '@/features/architect/utils/mutationPipeline';

type ComputeArgs = Parameters<typeof computeWorldMutation>[0];
type CurrentStateInput = ComputeArgs['currentState'];

const FIXED_TIMESTAMP = Date.parse('2026-04-10T12:00:00.000Z');
const FIXED_TIMESTAMP_ISO = '2026-04-10T12:00:00.000Z';
const SEASON_ID = '2025-26';

function makeContract(
  salary: number,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
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
    totalValue: salary,
    years: 1,
    contractYears: 1,
    birdRights: { status: 'Full', yearsOfService: 5 },
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
    contract: makeContract(salary, { signingTeam: teamCode }),
    bio: {
      playerId: id,
      displayName: name,
      position: 'SF',
      yearsExperience: '4',
    },
    representation: {
      agent: 'Roundtrip Agent',
      agency: 'Roundtrip Agency',
    },
    source: {
      provider: 'test-suite',
      playerPageUrl: `https://example.com/${id}`,
      scrapedAt: FIXED_TIMESTAMP_ISO,
      rawProviderBlob: { shouldDrop: true },
    },
    matchIncoming: '999999',
    tpeId: 'legacy_tpe_input',
    ...overrides,
  };
}

function makeTeam(
  teamCode: string,
  players: Array<Record<string, unknown>>,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
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
    roster: players.map((player) => String(player.player_id || player.id)),
    players,
    capHolds: [],
    deadCap: [],
    tradeExceptions: [],
    exceptionHistory: [],
    offerSheets: [],
    incomingOfferSheets: [],
    draftPicks: [],
    entitlementIds: [],
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
    legacySnapshotBag: { shouldDrop: true },
    ...overrides,
  };
}

describe('mutationPipeline committed snapshot round-trip boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps signing compute working while stripping broad team and player ingress baggage', () => {
    const team = makeTeam('LAL', []);
    const freeAgent = makePlayer('fa_1', 'Free Agent One', 0, null);

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
        team: team as CurrentStateInput['team'],
        player: freeAgent as CurrentStateInput['player'],
        teamCode: 'LAL',
      },
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
    });

    expect(result.success).toBe(true);

    const updatedTeam = result.teamUpdates?.[0]?.team;
    const updatedPlayer = result.playerUpdates?.[0]?.player;

    expect(updatedTeam?.roster).toContain('fa_1');
    expect(updatedTeam).not.toHaveProperty('legacySnapshotBag');
    expect(updatedPlayer?.teamCode).toBe('LAL');
    expect(updatedPlayer).not.toHaveProperty('matchIncoming');
    expect(updatedPlayer).not.toHaveProperty('tpeId');
    expect(updatedPlayer?.source).toMatchObject({
      provider: 'test-suite',
      playerPageUrl: 'https://example.com/fa_1',
      scrapedAt: FIXED_TIMESTAMP_ISO,
    });
    expect(updatedPlayer?.source).not.toHaveProperty('rawProviderBlob');
  });

  it('round-trips only the committed totals, draft-pick, and source slices on offer-sheet team updates', () => {
    const governed = makeGovernedOfferSheetFixture({
      worldId: 'world-committed-snapshot-roundtrip',
      playerId: 'rfa_1',
      homeTeamId: 'NYK',
      offeringTeamId: 'BOS',
      offerSheetId: 'sheet_1',
      salariesByYear: [
        { season: SEASON_ID, salary: 9_000_000 },
        { season: '2026-27', salary: 9_000_000 },
      ],
    });
    const offerSheet = {
      id: 'sheet_1',
      dedupKey: 'sheet_1::BOS::NYK::rfa_1',
      playerId: 'rfa_1',
      playerName: 'RFA One',
      offeringTeamCode: 'BOS',
      homeTeamCode: 'NYK',
      status: 'PENDING_MATCH',
      seasonKey: SEASON_ID,
      year: '2026',
      contractYears: '2',
      totalValue: '18000000',
      salariesByYear: [{ season: SEASON_ID, salary: '9000000' }],
      governedLifecycle: governed.lifecycle,
    };
    const draftPick = {
      id: 'nyk_2028_1',
      year: '2028',
      round: '1',
      pick: null,
      owner: 'NYK',
      originalTeam: 'NYK',
      protection: 'Top 4',
      protectionMeta: {
        type: 'position',
        maxPosition: '4',
        conversionTarget: { action: 'roll', toYear: '2029' },
      },
      conveyance: {
        description: 'Top 4 protected',
        conditions: {
          protection: 'Top 4',
          ifRolls: 'Rolls to 2029',
        },
        extraConveyanceBlob: { shouldDrop: true },
      },
      metadata: { scenario: 'fixture' },
      legacyPickBlob: { shouldDrop: true },
    };
    const homeTeam = makeTeam('NYK', [makePlayer('rfa_1', 'RFA One', 9_000_000, 'NYK')], {
      incomingOfferSheets: [offerSheet],
      draftPicks: [draftPick],
      totals: {
        yearKey: '2026',
        totalSalary: '123000000',
        capHit: '123000000',
        totalCapAllocations: '123000000',
        rosterCount: '12',
        isHardCapped: false,
        _meta: {
          source: 'computeTeamCapTotals',
          seasonKey: SEASON_ID,
          customMetaBlob: { shouldDrop: true },
        },
        compatTotalsBlob: { shouldDrop: true },
      },
      source: {
        provider: 'roundtrip-source',
        generatedAt: FIXED_TIMESTAMP_ISO,
        sourceBlob: { shouldDrop: true },
      },
    });
    const offeringTeam = makeTeam('BOS', [], {
      offerSheets: [offerSheet],
    });

    const result = computeWorldMutation({
      mutationType: 'matchOfferSheet',
      payload: {
        teamCode: 'NYK',
        homeTeamCode: 'NYK',
        offeringTeamCode: 'BOS',
        offerSheetId: 'sheet_1',
        offerSheetResolutionAt: governed.resolutionAt,
      },
      currentState: {
        homeTeam: homeTeam as CurrentStateInput['homeTeam'],
        offeringTeam: offeringTeam as CurrentStateInput['offeringTeam'],
        offerSheetId: 'sheet_1',
      },
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
      asOfDate: governed.asOfDate,
    });

    expect(result.success).toBe(true);

    const updatedHomeTeam = result.teamUpdates?.find(
      (update) => update.teamCode === 'NYK'
    )?.team;
    const roundTrippedPick = updatedHomeTeam?.draftPicks?.[0];

    // BZE-191: one-click match resolves atomically — the sheet is removed and
    // the home team keeps the player. The round-trip point (committed totals,
    // draft-pick, and source slices carry through while ingress blobs are
    // stripped) is verified on the surviving matched home team.
    expect(updatedHomeTeam?.incomingOfferSheets ?? []).toHaveLength(0);
    expect(
      updatedHomeTeam?.players?.some(
        (teamPlayer: { id?: string | null }) => teamPlayer?.id === 'rfa_1'
      )
    ).toBe(true);
    expect(updatedHomeTeam?.totals).toMatchObject({
      _meta: {
        source: 'computeTeamCapTotals',
        seasonKey: SEASON_ID,
      },
    });
    expect(updatedHomeTeam?.totals).not.toHaveProperty('compatTotalsBlob');
    expect(updatedHomeTeam?.totals?._meta).not.toHaveProperty('customMetaBlob');
    expect(roundTrippedPick).toMatchObject({
      id: 'nyk_2028_1',
      year: 2028,
      round: 1,
      pick: null,
      owner: 'NYK',
      protection: 'Top 4',
      protectionMeta: {
        type: 'position',
        maxPosition: 4,
        conversionTarget: { action: 'roll', toYear: 2029 },
      },
      metadata: { scenario: 'fixture' },
    });
    expect(roundTrippedPick).not.toHaveProperty('legacyPickBlob');
    expect(roundTrippedPick?.conveyance).not.toHaveProperty(
      'extraConveyanceBlob'
    );
    expect(updatedHomeTeam?.source).toMatchObject({
      provider: 'roundtrip-source',
      generatedAt: FIXED_TIMESTAMP_ISO,
      lastModifiedAt: FIXED_TIMESTAMP_ISO,
    });
    expect(updatedHomeTeam?.source).not.toHaveProperty('sourceBlob');
  });

  it('tolerates mixed raw source and numeric ingress at the normalization boundary only', () => {
    const freeAgent = makePlayer('fa_2', 'Free Agent Two', 0, null, {
      source: 'legacy-player-feed',
    });
    const team = makeTeam('DAL', [], {
      source: 'legacy-team-feed',
      capHolds: [
        {
          playerId: 'fa_2',
          playerName: 'Free Agent Two',
          amount: '4500000',
          active: true,
          rawHoldBlob: { shouldDrop: true },
        },
      ],
      totals: {
        totalSalary: '100000000',
        capHit: '100000000',
        totalCapAllocations: '100000000',
      },
    });

    const result = computeWorldMutation({
      mutationType: 'signFreeAgent',
      payload: {
        teamCode: 'DAL',
        playerId: 'fa_2',
        contract: makeContract(4_500_000),
        signedUsing: 'Cap Space',
      },
      currentState: {
        team: team as CurrentStateInput['team'],
        player: freeAgent as CurrentStateInput['player'],
        teamCode: 'DAL',
      },
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
    });

    expect(result.success).toBe(true);

    const updatedTeam = result.teamUpdates?.[0]?.team;
    const updatedPlayer = result.playerUpdates?.[0]?.player;

    expect(updatedTeam?.capHolds).toEqual([]);
    expect(updatedTeam?.source).toMatchObject({
      provider: 'legacy-team-feed',
      type: 'world-snapshot',
      lastModifiedAt: FIXED_TIMESTAMP_ISO,
    });
    expect(updatedPlayer?.source).toEqual({ provider: 'legacy-player-feed' });
  });
});
