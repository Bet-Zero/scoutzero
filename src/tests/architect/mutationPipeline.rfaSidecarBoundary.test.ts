/**
 * FILE: src/tests/architect/mutationPipeline.rfaSidecarBoundary.test.ts
 * PURPOSE: Guard the player-side RFA sidecar normalization and persistence seam.
 * OWNERSHIP: Architect mutation pipeline
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

type DocShape = Record<string, unknown> | null;

const testState = vi.hoisted(() => ({
  docsByPath: new Map<string, DocShape>(),
  worldMetadataById: new Map<
    string,
    { parentWorldId: string | null; asOfDate: string | null }
  >(),
  batchSet: vi.fn(),
  batchUpdate: vi.fn(),
  batchDelete: vi.fn(),
  batchCommit: vi.fn(async (): Promise<void> => undefined),
  getDoc: vi.fn(async (ref: unknown) => {
    const rawPath = String(ref);
    const path = rawPath.startsWith('db/') ? rawPath.slice(3) : rawPath;
    const data = testState.docsByPath.get(path);
    return {
      exists: () => data !== null && data !== undefined,
      data: () => data || {},
    };
  }),
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
              ...((base.bio as Record<string, unknown> | null | undefined) ||
                {}),
              ...((override.bio as
                | Record<string, unknown>
                | null
                | undefined) || {}),
            }
          : undefined,
      contract:
        base.contract || override.contract
          ? {
              ...((base.contract as
                | Record<string, unknown>
                | null
                | undefined) || {}),
              ...((override.contract as
                | Record<string, unknown>
                | null
                | undefined) || {}),
            }
          : undefined,
    })
  ),
  updateWorldStats: vi.fn(async () => undefined),
  validateTrade: vi.fn(),
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
  getWorldMetadata: vi.fn(async (worldId: string) => {
    return (
      testState.worldMetadataById.get(worldId) || {
        parentWorldId: null,
        asOfDate: '2026-07-01',
      }
    );
  }),
}));

vi.mock('@/features/architect/utils/tradeMachine', () => ({
  validateTrade: testState.validateTrade,
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

import { applyWorldMutation } from '@/features/architect/utils/mutationPipeline';
import { resolveStoreOfferSheetAuthority } from '@/features/architect/utils/mutationPipeline.read.stateLoader';
import { makeGovernedOfferSheetFixture } from '../../../tests/fixtures/architect/governedOfferSheet';

const WORLD_ID = 'world_rfa_sidecar_boundary';
const PARENT_WORLD_ID = 'world_rfa_sidecar_boundary_parent';
const SEASON_ID = '2025-26';
const FIXED_TIMESTAMP = Date.parse('2026-03-25T12:00:00.000Z');
const FIXED_TIMESTAMP_ISO = '2026-03-25T12:00:00.000Z';

function seedDoc(path: string, data: DocShape): void {
  testState.docsByPath.set(path, data);
}

function seedWorldMetadata(
  worldId: string,
  {
    parentWorldId = null,
    asOfDate = '2026-07-01',
  }: { parentWorldId?: string | null; asOfDate?: string | null } = {}
): void {
  testState.worldMetadataById.set(worldId, { parentWorldId, asOfDate });
}

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
    draftPicks: [],
    entitlementIds: [],
    tradeExceptions: [],
    exceptionHistory: [],
    exceptions: { mle: null, bae: null, tpe: [] },
    deadCap: [],
    teamTotalSalary: totalSalary,
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

describe('mutationPipeline RFA sidecar boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testState.docsByPath.clear();
    testState.worldMetadataById.clear();
    testState.validateTrade.mockImplementation(
      (
        input: {
          teams?: Array<{ teamCode?: string | null; receives?: unknown[] }>;
        } = {}
      ) => ({
        legal: true,
        reason: null,
        error: null,
        violations: [],
        warnings: [],
        teamResults: Array.isArray(input.teams)
          ? input.teams.map((team) => ({
              teamCode: team.teamCode ?? null,
              legal: true,
              incomingPlayers: Array.isArray(team.receives)
                ? team.receives
                : [],
            }))
          : [],
      })
    );
  });

  it('storeOfferSheet still resolves canonical public player identity through lineage merge output', async () => {
    const governed = makeGovernedOfferSheetFixture({
      worldId: WORLD_ID,
      playerId: 'rfa_1',
      homeTeamId: 'NYK',
      offeringTeamId: 'BOS',
      salariesByYear: [
        { season: SEASON_ID, salary: 9_000_000 },
        { season: '2026-27', salary: 9_000_000 },
      ],
    });
    seedWorldMetadata(WORLD_ID, {
      parentWorldId: PARENT_WORLD_ID,
      asOfDate: governed.asOfDate,
    });
    seedDoc(`architect_worlds/${WORLD_ID}`, {
      createdBy: 'user_boundary',
      parentWorldId: PARENT_WORLD_ID,
      asOfDate: governed.asOfDate,
    });
    seedWorldMetadata(PARENT_WORLD_ID, { parentWorldId: null });

    const offeringTeam = makeTeam('BOS', []);
    const homeSnapshotPlayer = makePlayer(
      'rfa_1',
      'Snapshot Name',
      7_500_000,
      'NYK',
      {
        contract: makeContract(7_500_000, {
          freeAgency: { type: 'RFA', year: 2026 },
        }),
        rfaContext: { governedEvidence: governed.evidence },
      }
    );
    const homeTeamSnapshot = makeTeam('NYK', [homeSnapshotPlayer], {
      roster: ['rfa_1'],
      players: [homeSnapshotPlayer],
      rightsLedger: governed.rightsLedger,
    });

    seedDoc(`architect_worlds/${PARENT_WORLD_ID}/teams/NYK`, homeTeamSnapshot);
    seedDoc(`architect_worlds/${WORLD_ID}/teams/NYK`, null);
    seedDoc(`architect_worlds/${WORLD_ID}/teams/NYK/players/rfa_1`, {
      playerId: 'rfa_1',
      displayName: 'Override Name',
      bio: {
        displayName: 'Override Name',
      },
      draft: {
        round: 2,
        pick: 40,
      },
      source: {
        provider: 'override-source',
      },
    });

    testState.getTeam.mockImplementation(
      async (_worldId: string, teamCode: string) => {
        if (teamCode === 'BOS') {
          return offeringTeam;
        }
        throw new Error(`Unexpected team load: ${teamCode}`);
      }
    );

    const result = await applyWorldMutation({
      userId: 'user_boundary',
      worldId: WORLD_ID,
      seasonId: SEASON_ID,
      mutationType: 'storeOfferSheet',
      payload: {
        worldId: WORLD_ID,
        teamCode: 'BOS',
        playerId: 'rfa_1',
        contract: governed.contract,
        offerSheetProposal: governed.proposal,
        signedUsing: 'Offer Sheet',
      },
      timestamp: FIXED_TIMESTAMP,
    });

    expect(result.success, String(result.error)).toBe(true);

    const outgoingOfferSheet = result.changedTeams?.find(
      (update) => update.teamCode === 'BOS'
    )?.team?.offerSheets?.[0];
    const incomingOfferSheet = result.changedTeams?.find(
      (update) => update.teamCode === 'NYK'
    )?.team?.incomingOfferSheets?.[0];

    expect(outgoingOfferSheet).toMatchObject({
      playerId: 'rfa_1',
      playerName: 'Override Name',
      offeringTeamCode: 'BOS',
      homeTeamCode: 'NYK',
    });
    expect(incomingOfferSheet).toMatchObject({
      playerId: 'rfa_1',
      playerName: 'Override Name',
      homeTeamCode: 'NYK',
    });
  });

  it('strips governed RFA evidence authored only by a mutable player override', async () => {
    const governed = makeGovernedOfferSheetFixture({
      worldId: WORLD_ID,
      playerId: 'rfa_1',
      homeTeamId: 'NYK',
      offeringTeamId: 'BOS',
      offerSheetId: 'os_rfa_1',
      salariesByYear: [
        { season: SEASON_ID, salary: 9_000_000 },
        { season: '2026-27', salary: 9_000_000 },
      ],
    });
    seedWorldMetadata(WORLD_ID, {
      parentWorldId: PARENT_WORLD_ID,
      asOfDate: governed.asOfDate,
    });
    seedWorldMetadata(PARENT_WORLD_ID, { parentWorldId: null });

    const offeringTeam = makeTeam('BOS', []);
    const sourcePlayerWithoutEvidence = makePlayer(
      'rfa_1',
      'Source Player',
      7_500_000,
      'NYK',
      {
        contract: makeContract(7_500_000, {
          freeAgency: { type: 'RFA', year: 2026 },
        }),
      }
    );
    seedDoc(
      `architect_worlds/${PARENT_WORLD_ID}/teams/NYK`,
      makeTeam('NYK', [sourcePlayerWithoutEvidence], {
        roster: ['rfa_1'],
        players: [sourcePlayerWithoutEvidence],
        rightsLedger: governed.rightsLedger,
      })
    );
    seedDoc(`architect_worlds/${WORLD_ID}/teams/NYK`, null);
    seedDoc(`architect_worlds/${WORLD_ID}/teams/NYK/players/rfa_1`, {
      playerId: 'rfa_1',
      displayName: 'Override Player',
      rfaContext: { governedEvidence: governed.evidence },
    });
    testState.getTeam.mockImplementation(
      async (_worldId: string, teamCode: string) => {
        if (teamCode === 'BOS') return offeringTeam;
        throw new Error(`Unexpected team load: ${teamCode}`);
      }
    );

    const authority = await resolveStoreOfferSheetAuthority({
      worldId: WORLD_ID,
      offeringTeamCode: 'BOS',
      playerId: 'rfa_1',
    });

    expect(authority.player.rfaContext?.governedEvidence).toBeUndefined();
    expect(authority.player.displayName).toBe('Override Player');
  });

  it('loads immutable base evidence for cap-hold-only RFA ownership', async () => {
    const governed = makeGovernedOfferSheetFixture({
      worldId: WORLD_ID,
      playerId: 'rfa_1',
      homeTeamId: 'NYK',
      offeringTeamId: 'BOS',
      offerSheetId: 'os_rfa_1',
      salariesByYear: [
        { season: SEASON_ID, salary: 9_000_000 },
        { season: '2026-27', salary: 9_000_000 },
      ],
    });
    seedWorldMetadata(WORLD_ID, { parentWorldId: null });

    const immutableBasePlayer = makePlayer(
      'rfa_1',
      'Base Player',
      7_500_000,
      'NYK',
      {
        contract: makeContract(7_500_000, {
          freeAgency: { type: 'RFA', year: 2026 },
        }),
      }
    );
    seedDoc(
      `architect_worlds/${WORLD_ID}/teams/NYK`,
      makeTeam('NYK', [], {
        roster: [],
        players: [],
        capHolds: [{ playerId: 'rfa_1', active: true, isSigned: false }],
        rightsLedger: governed.rightsLedger,
      })
    );
    seedDoc(`architect_worlds/${WORLD_ID}/teams/NYK/players/rfa_1`, {
      playerId: 'rfa_1',
      displayName: 'Override Player',
      rfaContext: { governedEvidence: governed.evidence },
    });
    testState.getTeam.mockImplementation(
      async (_worldId: string, teamCode: string) => {
        if (teamCode === 'BOS') return makeTeam('BOS', []);
        throw new Error(`Unexpected team load: ${teamCode}`);
      }
    );
    testState.getPlayer.mockImplementation(
      async (requestedWorldId: string | null) =>
        requestedWorldId === null
          ? immutableBasePlayer
          : {
              ...immutableBasePlayer,
              rfaContext: { governedEvidence: governed.evidence },
            }
    );

    const authority = await resolveStoreOfferSheetAuthority({
      worldId: WORLD_ID,
      offeringTeamCode: 'BOS',
      playerId: 'rfa_1',
    });

    expect(testState.getPlayer).toHaveBeenCalledWith(null, 'NYK', 'rfa_1');
    expect(authority.player.rfaContext?.governedEvidence).toBeUndefined();
    expect(authority.player.displayName).toBe('Override Player');
  });

  it('executeTrade writes the normalized player-level RFA sidecar through the persisted override payload', async () => {
    const playerA = makePlayer('player_a', 'Player A', 10_000_000, 'LAL', {
      tradeTo: 'BOS',
      rfaOfferSheet: true,
      rfaOfferSheetOnly: true,
      rfaContext: {
        pendingHomeTeamCode: 'LAL',
        offerSheetId: 'os_player_a_1',
        audit: ['still', 'object-shaped'],
      },
      isNewlySignedFA: true,
      originTeamId: 'LAL',
    });
    const playerB = makePlayer('player_b', 'Player B', 10_000_000, 'BOS', {
      tradeTo: 'LAL',
    });
    const teamA = makeTeam('LAL', [playerA]);
    const teamB = makeTeam('BOS', [playerB]);

    testState.getTeam.mockImplementation(
      async (_worldId: string, teamCode: string) => {
        if (teamCode === 'LAL') return teamA;
        if (teamCode === 'BOS') return teamB;
        throw new Error(`Unexpected team load: ${teamCode}`);
      }
    );

    const result = await applyWorldMutation({
      userId: 'user_boundary',
      worldId: WORLD_ID,
      seasonId: SEASON_ID,
      mutationType: 'executeTrade',
      payload: {
        teams: [
          {
            teamCode: 'LAL',
            sends: [playerA],
            entitlementsOut: [],
          },
          {
            teamCode: 'BOS',
            sends: [playerB],
            entitlementsOut: [],
          },
        ],
        tradeCtx: { worldId: WORLD_ID },
      },
      timestamp: FIXED_TIMESTAMP,
    });

    expect(result.success).toBe(true);

    const destinationPlayerWrite = testState.batchSet.mock.calls.find(([ref]) =>
      String(ref).includes(
        `architect_worlds/${WORLD_ID}/teams/BOS/players/player_a`
      )
    );
    const writtenPlayer = destinationPlayerWrite?.[1] as
      | Record<string, unknown>
      | undefined;

    expect(writtenPlayer).toEqual(
      expect.objectContaining({
        playerId: 'player_a',
        teamCode: 'BOS',
        rfaOfferSheet: true,
        rfaOfferSheetOnly: true,
        rfaContext: expect.objectContaining({
          pendingHomeTeamCode: 'LAL',
          offerSheetId: 'os_player_a_1',
        }),
        isNewlySignedFA: true,
        originTeamId: 'LAL',
      })
    );
  });

  it('finalizeMatchedOfferSheet omits the player-level RFA sidecar from the persisted override payload', async () => {
    const governed = makeGovernedOfferSheetFixture({
      worldId: WORLD_ID,
      playerId: 'rfa_1',
      homeTeamId: 'NYK',
      offeringTeamId: 'BOS',
      offerSheetId: 'os_rfa_1',
      salariesByYear: [
        { season: SEASON_ID, salary: 9_000_000 },
        { season: '2026-27', salary: 9_000_000 },
      ],
    });
    seedWorldMetadata(WORLD_ID, { asOfDate: governed.asOfDate });
    seedDoc(`architect_worlds/${WORLD_ID}`, {
      createdBy: 'user_boundary',
      parentWorldId: null,
      asOfDate: governed.asOfDate,
    });
    const offerSheet = {
      id: 'os_rfa_1',
      dedupKey: `os:${WORLD_ID}:BOS:rfa_1:${SEASON_ID}`,
      playerId: 'rfa_1',
      playerName: 'Home Player',
      offeringTeamCode: 'BOS',
      homeTeamCode: 'NYK',
      seasonKey: SEASON_ID,
      year: 2026,
      contractYears: 2,
      totalValue: 18_000_000,
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
          salary: 9_000_000,
          capHit: 9_000_000,
          guaranteed: true,
          guaranteedAmount: 9_000_000,
        },
      ],
      status: 'MATCHED',
      createdAt: FIXED_TIMESTAMP_ISO,
      governedLifecycle: governed.lifecycle,
    };
    const homePlayer = makePlayer('rfa_1', 'Home Player', 7_500_000, 'NYK', {
      rfaOfferSheet: true,
      rfaOfferSheetOnly: true,
      rfaContext: {
        pendingHomeTeamCode: 'NYK',
        retainedUntilFinalize: true,
      },
    });
    const homeTeam = makeTeam('NYK', [homePlayer], {
      incomingOfferSheets: [offerSheet],
    });
    const offeringTeam = makeTeam('BOS', [], {
      offerSheets: [offerSheet],
    });

    testState.getTeam.mockImplementation(
      async (_worldId: string, teamCode: string) => {
        if (teamCode === 'NYK') return homeTeam;
        if (teamCode === 'BOS') return offeringTeam;
        throw new Error(`Unexpected team load: ${teamCode}`);
      }
    );

    const result = await applyWorldMutation({
      userId: 'user_boundary',
      worldId: WORLD_ID,
      seasonId: SEASON_ID,
      mutationType: 'finalizeMatchedOfferSheet',
      payload: {
        teamCode: 'NYK',
        homeTeamCode: 'NYK',
        offeringTeamCode: 'BOS',
        offerSheetId: 'os_rfa_1',
        dedupKey: `os:${WORLD_ID}:BOS:rfa_1:${SEASON_ID}`,
        offerSheetResolutionAt: governed.resolutionAt,
      },
      timestamp: FIXED_TIMESTAMP,
    });

    expect(result.success).toBe(true);

    const matchedPlayerWrite = testState.batchSet.mock.calls.find(([ref]) =>
      String(ref).includes(
        `architect_worlds/${WORLD_ID}/teams/NYK/players/rfa_1`
      )
    );
    const writtenPlayer = matchedPlayerWrite?.[1] as
      | Record<string, unknown>
      | undefined;

    expect(writtenPlayer).toEqual(
      expect.objectContaining({
        playerId: 'rfa_1',
        teamCode: 'NYK',
        contract: expect.objectContaining({
          signingTeam: 'NYK',
          signedUsing: 'Match',
        }),
      })
    );
    expect(writtenPlayer).not.toHaveProperty('rfaOfferSheet');
    expect(writtenPlayer).not.toHaveProperty('rfaOfferSheetOnly');
    expect(writtenPlayer).not.toHaveProperty('rfaContext');
  });
});
