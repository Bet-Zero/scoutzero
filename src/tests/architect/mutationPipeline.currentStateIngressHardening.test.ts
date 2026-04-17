import { beforeEach, describe, expect, it, vi } from 'vitest';

type DocShape = Record<string, unknown> | null;

const testState = vi.hoisted(() => ({
  docsByPath: new Map<string, DocShape>(),
  batchSet: vi.fn(),
  batchUpdate: vi.fn(),
  batchDelete: vi.fn(),
  batchCommit: vi.fn(async (): Promise<void> => undefined),
  getDoc: vi.fn(async (): Promise<{ exists: () => boolean; data: () => DocShape }> => ({
    exists: () => false,
    data: () => null,
  })),
  getTeam: vi.fn(),
  getPlayer: vi.fn(),
  getLeague: vi.fn(async (): Promise<unknown[]> => []),
  mergePlayerOverride: vi.fn(
    (
      base: Record<string, unknown>,
      override: Record<string, unknown>
    ): Record<string, unknown> => ({
      ...base,
      ...override,
      bio:
        base.bio || override.bio
          ? {
              ...((base.bio as Record<string, unknown> | null | undefined) || {}),
              ...((override.bio as Record<string, unknown> | null | undefined) ||
                {}),
            }
          : undefined,
      contract:
        base.contract || override.contract
          ? {
              ...((base.contract as Record<string, unknown> | null | undefined) ||
                {}),
              ...((override.contract as Record<string, unknown> | null | undefined) ||
                {}),
            }
          : undefined,
    })
  ),
  updateWorldStats: vi.fn(async () => undefined),
  validateTrade: vi.fn(),
  getWorldMetadata: vi.fn(async () => ({
    parentWorldId: null,
    asOfDate: '2026-07-01',
  })),
}));

vi.mock('@/firebaseConfig', () => ({
  db: 'db',
}));

vi.mock('firebase/firestore', () => ({
  writeBatch: vi.fn(() => ({
    set: testState.batchSet,
    update: testState.batchUpdate,
    delete: testState.batchDelete,
    commit: testState.batchCommit,
  })),
  getDoc: testState.getDoc,
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  collection: vi.fn((...segments: unknown[]) => segments.map(String).join('/')),
  doc: vi.fn((...segments: unknown[]) => segments.map(String).join('/')),
}));

vi.mock('@/features/architect/utils/teamLoader', () => ({
  getTeam: testState.getTeam,
  getPlayer: testState.getPlayer,
  getLeague: testState.getLeague,
  mergePlayerOverride: testState.mergePlayerOverride,
}));

vi.mock('@/features/architect/utils/worldManager', () => ({
  updateWorldStats: testState.updateWorldStats,
  getWorldMetadata: testState.getWorldMetadata,
}));

vi.mock('@/features/architect/utils/tradeMachine', () => ({
  validateTrade: testState.validateTrade,
}));

vi.mock('@/features/architect/utils/capLegalityValidation', () => ({
  validateSigning: vi.fn(() => ({ valid: true, violations: [], warnings: [] })),
  validateWaive: vi.fn(() => ({ valid: true, violations: [], warnings: [] })),
  validateExtension: vi.fn(() => ({ valid: true, violations: [], warnings: [] })),
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

import {
  applyWorldMutation,
  computeWorldMutation,
  type ArchitectMutationContract,
} from '@/features/architect/utils/mutationPipeline';

const FIXED_TIMESTAMP = Date.parse('2026-04-10T12:00:00.000Z');
const FIXED_TIMESTAMP_ISO = '2026-04-10T12:00:00.000Z';
const SEASON_ID = '2025-26';
const WORLD_ID = 'world_current_state_ingress_hardening';

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
      yearsExperience: 4,
      display: {
        team: teamCode,
        teamId: teamCode,
        freeAgentYear: 2026,
        freeAgentType: 'UFA',
      },
    },
    representation: {
      agent: 'Boundary Agent',
      agency: 'Boundary Agency',
    },
    source: {
      provider: 'test-suite',
      generatedAt: FIXED_TIMESTAMP_ISO,
      playerPageUrl: `https://example.com/${id}`,
    },
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
    ...overrides,
  };
}

describe('mutationPipeline current-state ingress hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testState.docsByPath.clear();

    testState.getWorldMetadata.mockResolvedValue({
      parentWorldId: null,
      asOfDate: '2026-07-01',
    });
  });

  it('keeps the committed match-offer-sheet flow working while stripping team-side compatibility bags at ingress', async () => {
    const mirroredOfferSheet = {
      id: 'offer_sheet_1',
      dedupKey: 'offer_sheet_1::BOS::NYK::rfa_1',
      playerId: 'rfa_1',
      playerName: 'RFA One',
      offeringTeamCode: 'BOS',
      homeTeamCode: 'NYK',
      status: 'PENDING_MATCH',
      seasonKey: SEASON_ID,
      year: '2026',
      contractYears: '2',
      totalValue: '18000000',
      salariesByYear: [
        {
          season: SEASON_ID,
          salary: '9000000',
          guaranteed: true,
          compatRow: { shouldDrop: true },
        },
      ],
      createdAt: FIXED_TIMESTAMP_ISO,
      compatBag: { shouldDrop: true },
    };
    const homeTeam = makeTeam('NYK', [
      makePlayer('rfa_1', 'RFA One', 9_000_000, 'NYK'),
    ], {
      incomingOfferSheets: [{ ...mirroredOfferSheet }],
    });
    const offeringTeam = makeTeam('BOS', [], {
      offerSheets: [{ ...mirroredOfferSheet }],
    });

    testState.getTeam.mockImplementation(async (_worldId: string, teamCode: string) => {
      if (teamCode === 'NYK') return homeTeam;
      if (teamCode === 'BOS') return offeringTeam;
      throw new Error(`Unexpected team load: ${teamCode}`);
    });

    const result = await applyWorldMutation({
      userId: 'user_ingress_hardening',
      worldId: WORLD_ID,
      seasonId: SEASON_ID,
      mutationType: 'matchOfferSheet',
      payload: {
        teamCode: 'NYK',
        homeTeamCode: 'NYK',
        offeringTeamCode: 'BOS',
        offerSheetId: 'offer_sheet_1',
      },
      timestamp: FIXED_TIMESTAMP,
    });

    expect(result.success).toBe(true);

    const updatedOfferingSheet = result.changedTeams?.find(
      (update) => update.teamCode === 'BOS'
    )?.team?.offerSheets?.[0];
    const updatedHomeSheet = result.changedTeams?.find(
      (update) => update.teamCode === 'NYK'
    )?.team?.incomingOfferSheets?.[0];

    expect(updatedOfferingSheet?.status).toBe('MATCHED');
    expect(updatedHomeSheet?.status).toBe('MATCHED');
    expect(updatedOfferingSheet).not.toHaveProperty('compatBag');
    expect(updatedHomeSheet).not.toHaveProperty('compatBag');
    expect(updatedOfferingSheet?.salariesByYear?.[0]).not.toHaveProperty(
      'compatRow'
    );
    expect(updatedHomeSheet?.salariesByYear?.[0]).not.toHaveProperty(
      'compatRow'
    );
  });

  it('preserves the consumed top-level bird-rights compatibility field on the option-decline player path', async () => {
    const player = makePlayer('option_1', 'Option Player', 12_000_000, 'LAL', {
      contract: {
        contractType: 'Standard',
        years: 2,
        contractYears: 2,
        salariesByYear: [
          {
            season: '2024-25',
            salary: 10_000_000,
            capHit: 10_000_000,
            guaranteed: true,
          },
          {
            season: SEASON_ID,
            salary: 12_000_000,
            capHit: 12_000_000,
            guaranteed: true,
            option: 'PO',
          },
        ],
      },
      birdRights: { status: 'Early Bird', compatBag: { shouldDrop: true } },
      bio: {
        playerId: 'option_1',
        displayName: 'Option Player',
        yearsExperience: '4',
      },
    });
    const team = makeTeam('LAL', [player]);

    testState.getTeam.mockResolvedValue(team);
    testState.getPlayer.mockResolvedValue(player);

    const result = await applyWorldMutation({
      userId: 'user_ingress_hardening',
      worldId: WORLD_ID,
      seasonId: SEASON_ID,
      mutationType: 'optionDecision',
      payload: {
        teamCode: 'LAL',
        playerId: 'option_1',
        accepted: false,
        targetYear: 2026,
      },
      timestamp: FIXED_TIMESTAMP,
    });

    expect(result.success).toBe(true);

    const updatedTeam = result.changedTeams?.[0]?.team;
    const createdCapHold = updatedTeam?.capHolds?.find(
      (hold) => hold.playerId === 'option_1'
    );

    expect(createdCapHold).toMatchObject({
      playerId: 'option_1',
      playerName: 'Option Player',
      amount: 13_000_000,
      type: 'FA Cap Hold',
    });
    expect(createdCapHold?.notes).toBeUndefined();
    expect(
      updatedTeam?.players?.some((teamPlayer) => teamPlayer.player_id === 'option_1')
    ).toBe(false);
  });

  it('tolerates mixed raw current-state ingress but only carries normalized team objects into compute output', () => {
    const team = makeTeam('BOS', [], {
      capHolds: [
        {
          playerId: 'fa_compat',
          playerName: 'Compat Free Agent',
          amount: '5000000',
          type: 'Bird rights cap hold',
          season: SEASON_ID,
          active: true,
          isSigned: false,
          compatBag: { shouldDrop: true },
        },
      ],
      offerSheets: [
        {
          id: 'sheet_keep',
          playerId: 'other_player',
          playerName: 'Other Player',
          offeringTeamCode: 'BOS',
          homeTeamCode: 'DAL',
          status: 'PENDING_MATCH',
          seasonKey: SEASON_ID,
          year: '2026',
          contractYears: '2',
          totalValue: '7000000',
          salariesByYear: [
            {
              season: SEASON_ID,
              salary: '3500000',
              guaranteed: true,
              compatRow: { shouldDrop: true },
            },
          ],
          compatBag: { shouldDrop: true },
        },
      ],
    });
    const player = makePlayer('fa_compat', 'Compat Free Agent', 0, null, {
      source: {
        provider: 'legacy-import',
        playerPageUrl: '/players/fa_compat',
        legacyTag: 'keep-me',
      },
    });

    const result = computeWorldMutation({
      mutationType: 'signFreeAgent',
      payload: {
        teamCode: 'BOS',
        playerId: 'fa_compat',
        contract: makeContract(5_000_000, {
          years: 2,
          contractYears: 2,
          totalValue: 10_000_000,
        }) as ArchitectMutationContract,
        signedUsing: 'Cap Space',
      },
      currentState: {
        team,
        player,
        teamCode: 'BOS',
      },
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
    });

    expect(result.success).toBe(true);

    const updatedTeam = result.teamUpdates?.[0]?.team;
    const updatedPlayer = result.playerUpdates?.[0]?.player;

    expect(updatedTeam?.capHolds).toHaveLength(0);
    expect(updatedTeam?.offerSheets?.[0]).not.toHaveProperty('compatBag');
    expect(updatedTeam?.offerSheets?.[0]?.salariesByYear?.[0]).not.toHaveProperty(
      'compatRow'
    );
    expect(updatedPlayer?.source).toMatchObject({
      provider: 'legacy-import',
    });
  });
});
