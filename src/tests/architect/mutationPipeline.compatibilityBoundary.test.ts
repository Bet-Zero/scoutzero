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

import { applyWorldMutation } from '@/features/architect/utils/mutationPipeline';

const WORLD_ID = 'world_boundary_test';
const PARENT_WORLD_ID = 'world_boundary_parent';
const SEASON_ID = '2025-26';
const FIXED_TIMESTAMP = Date.parse('2026-03-25T12:00:00.000Z');

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
      },
    ],
    totalValue: salary,
    years: 1,
    contractYears: 1,
    birdRights: { status: 'None' },
    ...overrides,
  };
}

function makePlayer(
  id: string,
  salary: number,
  teamCode: string | null,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id,
    player_id: id,
    playerId: id,
    name: id,
    displayName: id,
    teamCode,
    teamName: teamCode ? `Team ${teamCode}` : null,
    salary,
    currentSalary: salary,
    contract: makeContract(salary, {
      signingTeam: teamCode,
    }),
    bio: {
      playerId: id,
      displayName: id,
      position: 'SF',
      yearsExperience: 4,
    },
    representation: {
      agent: 'Boundary Agent',
      agency: 'Boundary Agency',
    },
    source: {
      provider: 'test-suite',
      playerPageUrl: `https://example.com/${id}`,
      scrapedAt: '2026-03-25T12:00:00.000Z',
    },
    ...overrides,
  };
}

function makeTeam(
  teamCode: string,
  players: Array<Record<string, unknown>>,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  const totalSalary = players.reduce(
    (sum, player) =>
      sum +
      Number(
        (player.contract as Record<string, unknown> | null | undefined)
          ?.salariesByYear &&
          Array.isArray(
            (player.contract as Record<string, unknown>).salariesByYear
          )
          ? (
              (
                player.contract as Record<string, unknown>
              ).salariesByYear as Array<Record<string, unknown>>
            )[0]?.capHit ?? player.currentSalary ?? player.salary ?? 0
          : player.currentSalary ?? player.salary ?? 0
      ),
    0
  );

  return {
    id: teamCode.toLowerCase(),
    teamCode,
    teamName: `Team ${teamCode}`,
    roster: players.map((player) => String(player.player_id || player.id)),
    players,
    twoWayPlayers: players.filter((player) => player.isTwoWay === true),
    capHolds: [],
    draftPicks: [],
    entitlementIds: [],
    tradeExceptions: [],
    exceptionHistory: [],
    exceptions: { mle: null, bae: null, tpe: [] },
    deadCap: [],
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
      generatedAt: '2026-03-25T12:00:00.000Z',
    },
    ...overrides,
  };
}

function buildTradeValidationResult(
  teams: Array<Record<string, unknown> | null | undefined>,
  legal: boolean
) {
  return {
    valid: legal,
    success: legal,
    legal,
    reason: legal ? null : 'teamTotalSalary missing at trade boundary',
    teamResults: teams.map((teamTrade) => {
      const team = (teamTrade?.team as Record<string, unknown> | undefined) || {};
      const teamCode = String(teamTrade?.teamCode || team.teamCode || '');
      const totalSalary = Number(team.teamTotalSalary || 0);
      return {
        teamId: String(team.id || teamCode),
        teamCode,
        teamName: String(team.teamName || teamCode),
        legal,
        violations: [],
        warnings: [],
        rules: { tradeExceptions: {} },
        salaryOut: 0,
        salaryIn: 0,
        outgoingPlayers: [],
        incomingPlayers: [],
        calculations: {
          salaryOut: 0,
          salaryIn: 0,
          salaryMatching: {
            allowedIncoming: totalSalary,
            margin: 0,
            difference: 0,
          },
        },
        totalSalary,
        projectedSalary: totalSalary,
        capRoom: 0,
        hardCapped: false,
        apronStatus: 'Below Aprons',
        faExceptionBuckets: [],
        notes: [],
        createdTPE: null,
        details: '',
        warningDetails: '',
      };
    }),
  };
}

describe('mutationPipeline compatibility boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testState.docsByPath.clear();
    testState.worldMetadataById.clear();
    seedWorldMetadata(WORLD_ID);
    seedWorldMetadata(PARENT_WORLD_ID);

    testState.validateTrade.mockImplementation((input?: { teams?: unknown[] }) => {
      const teams = Array.isArray(input?.teams)
        ? (input.teams as Array<Record<string, unknown> | null | undefined>)
        : [];
      const legal =
        teams.length > 0 &&
        teams.every((teamTrade) => {
          const team = (teamTrade?.team as Record<string, unknown> | undefined) || {};
          return Number(team.teamTotalSalary || 0) > 0;
        });
      return buildTradeValidationResult(teams, legal);
    });
  });

  it('applies signFreeAgent through the narrowed current-state adapters and persists the public result', async () => {
    const team = makeTeam('LAL', []);
    const freeAgent = makePlayer('fa_1', 0, null, {
      displayName: 'Free Agent One',
      contract: makeContract(0, {
        freeAgency: {
          type: 'UFA',
          year: 2026,
          capHold: null,
          qualifyingOffer: null,
          earlyTerminationOption: null,
          hasOption: false,
          optionYear: null,
          optionType: null,
        },
      }),
      matchIncoming: 99,
      tpeId: 'legacy_tpe_input',
    });

    testState.getTeam.mockImplementation(async (_worldId: string, teamCode: string) => {
      if (teamCode === 'LAL') {
        return team;
      }
      throw new Error(`Unexpected team load: ${teamCode}`);
    });
    testState.getPlayer.mockResolvedValue(freeAgent);

    const result = await applyWorldMutation({
      userId: 'user_boundary',
      worldId: WORLD_ID,
      seasonId: SEASON_ID,
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
      timestamp: FIXED_TIMESTAMP,
    });

    expect(result.success).toBe(true);
    expect(result.changedTeams).toHaveLength(1);
    expect(result.changedPlayers).toHaveLength(1);
    expect(result.changedTeams?.[0]?.team?.roster).toContain('fa_1');
    expect(result.changedPlayers?.[0]?.player?.teamCode).toBe('LAL');
    expect(result.changedPlayers?.[0]?.player?.representation?.agent).toBe(
      'Boundary Agent'
    );
    expect(result.changedPlayers?.[0]?.player?.contract?.totalValue).toBe(
      17_000_000
    );

    const setPaths = testState.batchSet.mock.calls.map(([ref]) => String(ref));
    const updatePaths = testState.batchUpdate.mock.calls.map(([ref]) => String(ref));

    expect(
      setPaths.some((path) => path.includes(`architect_worlds/${WORLD_ID}/teams/LAL`))
    ).toBe(true);
    expect(
      setPaths.some((path) =>
        path.includes(`architect_worlds/${WORLD_ID}/teams/LAL/players/fa_1`)
      )
    ).toBe(true);
    expect(
      setPaths.some((path) =>
        path.includes(`architect_worlds/${WORLD_ID}/events/signFreeAgent_`)
      )
    ).toBe(true);
    expect(
      updatePaths.some((path) => path.endsWith(`architect_worlds/${WORLD_ID}`))
    ).toBe(true);
  });

  it('applies executeTrade with synthesized teamTotalSalary and preserves live player metadata through result and writes', async () => {
    const playerA = makePlayer('player_a', 10_000_000, 'LAL', {
      displayName: 'Player A',
      isTwoWay: true,
      signedDate: '2026-02-01T00:00:00.000Z',
      isNewlySignedFA: true,
      originTeamId: 'LAL',
      tradeTo: 'BOS',
    });
    const playerB = makePlayer('player_b', 10_000_000, 'BOS', {
      displayName: 'Player B',
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

    testState.getTeam.mockImplementation(async (_worldId: string, teamCode: string) => {
      if (teamCode === 'LAL') return teamA;
      if (teamCode === 'BOS') return teamB;
      throw new Error(`Unexpected team load: ${teamCode}`);
    });

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
    expect(result.changedTeams).toHaveLength(2);

    const bostonTeam = result.changedTeams?.find(
      (update) => update.teamCode === 'BOS'
    )?.team;
    const movedPlayer = bostonTeam?.players?.find(
      (player) => player.playerId === 'player_a' || player.player_id === 'player_a'
    );

    expect(movedPlayer?.signedDate).toBe('2026-02-01T00:00:00.000Z');
    expect(movedPlayer?.isNewlySignedFA).toBe(true);
    expect(movedPlayer?.originTeamId).toBe('LAL');
    expect(movedPlayer?.isTwoWay).toBe(true);
    expect(bostonTeam?.draftPicks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          year: 2028,
          round: 1,
          owner: 'LAL',
        }),
      ])
    );

    const lakersTeam = result.changedTeams?.find(
      (update) => update.teamCode === 'LAL'
    )?.team;
    expect(lakersTeam?.exceptionHistory).toHaveLength(1);

    const destinationPlayerWrite = testState.batchSet.mock.calls.find(([ref]) =>
      String(ref).includes(`architect_worlds/${WORLD_ID}/teams/BOS/players/player_a`)
    );
    expect(destinationPlayerWrite?.[1]).toMatchObject({
      playerId: 'player_a',
      teamCode: 'BOS',
      signedDate: '2026-02-01T00:00:00.000Z',
      isNewlySignedFA: true,
      originTeamId: 'LAL',
      isTwoWay: true,
    });

    const deletePaths = testState.batchDelete.mock.calls.map(([ref]) => String(ref));
    expect(
      deletePaths.some((path) =>
        path.includes(`architect_worlds/${WORLD_ID}/teams/LAL/players/player_a`)
      )
    ).toBe(true);
  });

  it('applies storeOfferSheet from lineage snapshots and surfaces merged canonical player identity in the public result', async () => {
    seedWorldMetadata(WORLD_ID, { parentWorldId: PARENT_WORLD_ID });
    seedWorldMetadata(PARENT_WORLD_ID, { parentWorldId: null });

    const offeringTeam = makeTeam('BOS', []);
    const homeSnapshotPlayer = makePlayer('rfa_1', 7_500_000, 'NYK', {
      displayName: 'Snapshot Name',
      contract: makeContract(7_500_000, {
        freeAgency: { type: 'RFA', year: 2026 },
      }),
    });
    const homeTeamSnapshot = makeTeam('NYK', [homeSnapshotPlayer], {
      roster: ['rfa_1'],
      players: [homeSnapshotPlayer],
    });

    seedDoc(
      `architect_worlds/${PARENT_WORLD_ID}/teams/NYK`,
      homeTeamSnapshot
    );
    seedDoc(`architect_worlds/${WORLD_ID}/teams/NYK`, null);
    seedDoc(
      `architect_worlds/${WORLD_ID}/teams/NYK/players/rfa_1`,
      {
        playerId: 'rfa_1',
        displayName: 'Override Name',
        bio: {
          displayName: 'Override Name',
        },
      }
    );

    testState.getTeam.mockImplementation(async (_worldId: string, teamCode: string) => {
      if (teamCode === 'BOS') {
        return offeringTeam;
      }
      throw new Error(`Unexpected team load: ${teamCode}`);
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
        contract: makeContract(9_000_000, {
          years: 2,
          contractYears: 2,
          totalValue: 18_000_000,
          freeAgency: {
            type: 'RFA',
            year: 2026,
            capHold: null,
            qualifyingOffer: null,
            earlyTerminationOption: null,
            hasOption: false,
            optionYear: null,
            optionType: null,
          },
          rfaOfferSheet: true,
          rfaOfferSheetOnly: true,
        }),
        signedUsing: 'Offer Sheet',
      },
      timestamp: FIXED_TIMESTAMP,
    });

    expect(result.success).toBe(true);
    expect(result.changedTeams).toHaveLength(2);

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
      dedupKey: `os:${WORLD_ID}:BOS:rfa_1:${SEASON_ID}`,
    });
    expect(incomingOfferSheet).toMatchObject({
      playerId: 'rfa_1',
      playerName: 'Override Name',
      homeTeamCode: 'NYK',
    });

    const setPaths = testState.batchSet.mock.calls.map(([ref]) => String(ref));
    expect(
      setPaths.some((path) => path.includes(`architect_worlds/${WORLD_ID}/teams/BOS`))
    ).toBe(true);
    expect(
      setPaths.some((path) => path.includes(`architect_worlds/${WORLD_ID}/teams/NYK`))
    ).toBe(true);
    expect(
      setPaths.some((path) =>
        path.includes(`architect_worlds/${WORLD_ID}/events/storeOfferSheet_`)
      )
    ).toBe(true);
  });
});
