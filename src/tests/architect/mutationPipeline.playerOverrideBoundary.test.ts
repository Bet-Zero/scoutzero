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
  runTransaction: vi.fn(
    async (
      _db: unknown,
      updateFunction: (transaction: {
        get: typeof testState.getDoc;
        set: typeof testState.batchSet;
        update: typeof testState.batchUpdate;
        delete: typeof testState.batchDelete;
      }) => Promise<unknown>
    ) =>
      updateFunction({
        get: testState.getDoc,
        set: testState.batchSet,
        update: testState.batchUpdate,
        delete: testState.batchDelete,
      })
  ),
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
        asOfDate: '2026-07-08',
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
import { makeGovernedOfferSheetFixture } from '../../../tests/fixtures/architect/governedOfferSheet';
import { withGovernedSalaryBooks } from '@/tests/fixtures/governedSalaryBookInputs';

const WORLD_ID = 'world_player_override_boundary';
const PARENT_WORLD_ID = 'world_player_override_boundary_parent';
const SEASON_ID = '2025-26';
const FIXED_TIMESTAMP = Date.parse('2026-08-21T12:00:00.000Z');
const FIXED_TIMESTAMP_ISO = '2026-08-21T12:00:00.000Z';

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

  const team = {
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
  return withGovernedSalaryBooks(team, {
    salaryCapYear: 2026,
    asOfDate: '2025-07-08T09:55:00-04:00',
    teamSalary: totalSalary,
    apronTeamSalary: totalSalary + 1_000_000,
    taxSalary: totalSalary + 2_000_000,
  });
}

describe('mutationPipeline player override boundary', () => {
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

  it('signFreeAgent persists only the narrowed player override payload while keeping the public mutation flow intact', async () => {
    const team = makeTeam('LAL', []);
    const freeAgent = makePlayer('fa_1', 'Free Agent One', 0, null, {
      freeAgentYear: 2026,
      rightsRenounced: false,
      renouncedAt: '2026-01-10T00:00:00.000Z',
      draft: {
        round: 1,
        pick: 15,
        year: 2020,
      },
      contract: makeContract(0, {
        freeAgency: {
          type: 'Unrestricted',
          year: 2026,
        },
      }),
    });

    testState.getTeam.mockImplementation(
      async (_worldId: string, teamCode: string) => {
        if (teamCode === 'LAL') {
          return team;
        }
        throw new Error(`Unexpected team load: ${teamCode}`);
      }
    );
    testState.getPlayer.mockResolvedValue(freeAgent);

    const result = await applyWorldMutation({
      userId: 'user_boundary',
      worldId: WORLD_ID,
      seasonId: '2026-27',
      mutationType: 'signFreeAgent',
      payload: {
        teamCode: 'LAL',
        playerId: 'fa_1',
        contract: makeContract(8_500_000, {
          years: 2,
          contractYears: 2,
          totalValue: 17_000_000,
          salariesByYear: [
            {
              season: '2026-27',
              salary: 8_500_000,
              capHit: 8_500_000,
              guaranteed: true,
            },
            {
              season: '2027-28',
              salary: 8_500_000,
              capHit: 8_500_000,
              guaranteed: true,
            },
          ],
        }),
        signedUsing: 'Cap Space',
      },
      timestamp: FIXED_TIMESTAMP,
    });

    expect(result.success).toBe(true);
    expect(result.changedTeams?.[0]?.team?.roster).toContain('fa_1');
    expect(result.changedPlayers?.[0]?.player?.teamCode).toBe('LAL');
    expect(result.changedPlayers?.[0]?.player?.contract?.signingTeam).toBe(
      'LAL'
    );

    const playerWrite = testState.batchSet.mock.calls.find(([ref]) =>
      String(ref).includes(
        `architect_worlds/${WORLD_ID}/teams/LAL/players/fa_1`
      )
    );
    expect(playerWrite?.[1]).toMatchObject({
      playerId: 'fa_1',
      displayName: 'Free Agent One',
      teamCode: 'LAL',
      contract: expect.objectContaining({
        totalValue: 17_000_000,
        signingTeam: 'LAL',
      }),
      representation: {
        agent: 'Boundary Agent',
        agency: 'Boundary Agency',
      },
      source: expect.objectContaining({
        provider: 'test-suite',
      }),
    });
    expect(playerWrite?.[1]).not.toHaveProperty('draft');
    expect(playerWrite?.[1]).not.toHaveProperty('salary');
    expect(playerWrite?.[1]).not.toHaveProperty('currentSalary');
    expect(playerWrite?.[1]).not.toHaveProperty('freeAgentYear');
    expect(playerWrite?.[1]).not.toHaveProperty('rightsRenounced');
    expect(playerWrite?.[1]).not.toHaveProperty('renouncedAt');
  });

  it('storeOfferSheet still resolves canonical public player identity through the narrowed lineage merge boundary', async () => {
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
    testState.getPlayer.mockResolvedValue({
      ...homeSnapshotPlayer,
      displayName: 'Immutable Base Name',
      rfaContext: { governedEvidence: governed.evidence },
    });

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

  it('executeTrade persists the required carry-through player override fields while omitting removed residual fields', async () => {
    const playerA = makePlayer('player_a', 'Player A', 10_000_000, 'LAL', {
      isTwoWay: true,
      signedDate: '2026-02-01T00:00:00.000Z',
      isNewlySignedFA: true,
      originTeamId: 'LAL',
      freeAgentYear: 2027,
      rightsRenounced: false,
      renouncedAt: '2026-02-02T00:00:00.000Z',
      draft: {
        round: 1,
        pick: 12,
      },
      tradeTo: 'BOS',
      representation: {
        agent: 'Agent A',
        agency: 'Agency A',
      },
      source: {
        provider: 'legacy-import',
        playerPageUrl: '/players/a',
      },
    });
    const playerB = makePlayer('player_b', 'Player B', 10_000_000, 'BOS', {
      tradeTo: 'LAL',
    });
    const outgoingPick = {
      year: 2028,
      round: 1,
      owner: 'LAL',
    };
    const teamA = makeTeam('LAL', [playerA], {
      draftPicks: [{ year: 2028, round: 1, owner: 'LAL', pick: null }],
      exceptionHistory: [
        {
          type: 'tpe-created',
          timestamp: '2026-01-01T00:00:00.000Z',
          amountCreated: 1_000_000,
        },
      ],
    });
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
            picksOut: [outgoingPick],
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
    expect(destinationPlayerWrite?.[1]).toMatchObject({
      playerId: 'player_a',
      displayName: 'Player A',
      teamCode: 'BOS',
      contract: expect.any(Object),
      representation: {
        agent: 'Agent A',
        agency: 'Agency A',
      },
      source: {
        provider: 'legacy-import',
        playerPageUrl: '/players/a',
      },
      isTwoWay: true,
      signedDate: '2026-02-01T00:00:00.000Z',
      isNewlySignedFA: true,
      originTeamId: 'LAL',
    });
    expect(destinationPlayerWrite?.[1]).not.toHaveProperty('draft');
    expect(destinationPlayerWrite?.[1]).not.toHaveProperty('salary');
    expect(destinationPlayerWrite?.[1]).not.toHaveProperty('currentSalary');
    expect(destinationPlayerWrite?.[1]).not.toHaveProperty('freeAgentYear');
    expect(destinationPlayerWrite?.[1]).not.toHaveProperty('rightsRenounced');
    expect(destinationPlayerWrite?.[1]).not.toHaveProperty('renouncedAt');
  });
});
