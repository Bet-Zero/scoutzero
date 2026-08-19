/**
 * FILE: src/tests/architect/mutationPipeline.rfaContextContract.test.ts
 * PURPOSE: Guard the narrowed player-level RFA context contract through public mutation outputs.
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
import { makeGovernedOfferSheetFixture } from '../../../tests/fixtures/architect/governedOfferSheet';

const WORLD_ID = 'world_rfa_context_contract';
const SEASON_ID = '2025-26';
const FIXED_TIMESTAMP = Date.parse('2026-03-25T12:00:00.000Z');
const FIXED_TIMESTAMP_ISO = '2026-03-25T12:00:00.000Z';

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

function getWrittenPlayer(
  teamCode: string,
  playerId: string
): Record<string, unknown> | undefined {
  const playerWrite = testState.batchSet.mock.calls.find(([ref]) =>
    String(ref).includes(
      `architect_worlds/${WORLD_ID}/teams/${teamCode}/players/${playerId}`
    )
  );
  return playerWrite?.[1] as Record<string, unknown> | undefined;
}

describe('mutationPipeline rfaContext contract', () => {
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
              incomingPlayers: Array.isArray(team.receives) ? team.receives : [],
            }))
          : [],
      })
    );
  });

  it('executeTrade preserves only the narrowed rfaContext sidecar in the persisted override payload', async () => {
    const playerA = makePlayer('player_a', 'Player A', 10_000_000, 'LAL', {
      tradeTo: 'BOS',
      rfaOfferSheet: true,
      rfaOfferSheetOnly: true,
      rfaContext: {
        pendingHomeTeamCode: ' LAL ',
        offerSheetId: ' os_player_a_1 ',
        retainedUntilFinalize: true,
        audit: ['drop-me'],
        nested: { keep: false },
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

    const writtenPlayer = getWrittenPlayer('BOS', 'player_a');

    expect(writtenPlayer).toEqual(
      expect.objectContaining({
        playerId: 'player_a',
        teamCode: 'BOS',
        rfaOfferSheet: true,
        rfaOfferSheetOnly: true,
        rfaContext: {
          pendingHomeTeamCode: 'LAL',
          offerSheetId: 'os_player_a_1',
          retainedUntilFinalize: true,
        },
        isNewlySignedFA: true,
        originTeamId: 'LAL',
      })
    );
    expect(
      (writtenPlayer?.rfaContext as Record<string, unknown> | undefined)?.audit
    ).toBeUndefined();
    expect(
      (writtenPlayer?.rfaContext as Record<string, unknown> | undefined)?.nested
    ).toBeUndefined();
  });

  it('executeTrade omits rfaContext when no allowed sidecar fields survive normalization', async () => {
    const playerA = makePlayer('player_a', 'Player A', 10_000_000, 'LAL', {
      tradeTo: 'BOS',
      rfaOfferSheet: true,
      rfaOfferSheetOnly: true,
      rfaContext: {
        offerSheetId: '   ',
        retainedUntilFinalize: 'true',
        audit: ['drop-me'],
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

    const writtenPlayer = getWrittenPlayer('BOS', 'player_a');

    expect(writtenPlayer).toEqual(
      expect.objectContaining({
        playerId: 'player_a',
        teamCode: 'BOS',
        rfaOfferSheet: true,
        rfaOfferSheetOnly: true,
        isNewlySignedFA: true,
        originTeamId: 'LAL',
      })
    );
    expect(writtenPlayer).not.toHaveProperty('rfaContext');
  });

  it('finalizeMatchedOfferSheet still strips the narrowed rfaContext sidecar after resolution', async () => {
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
    testState.docsByPath.set(`architect_worlds/${WORLD_ID}`, {
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
        offerSheetId: 'os_rfa_1',
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

    const writtenPlayer = getWrittenPlayer('NYK', 'rfa_1');

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
