import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ArchitectMutationPlayerRecord,
  ArchitectMutationTeamRecord,
} from '@/features/architect/utils/mutationPipeline';

type FirestoreDocSnapshot = {
  exists: () => boolean;
  data: () => Record<string, never>;
};

const firestoreMocks = vi.hoisted(() => ({
  batchSet: vi.fn(),
  batchUpdate: vi.fn(),
  batchDelete: vi.fn(),
  batchCommit: vi.fn(async (): Promise<void> => undefined),
  getDoc: vi.fn(
    async (): Promise<FirestoreDocSnapshot> => ({
      exists: () => false,
      data: () => ({}),
    })
  ),
}));

const teamLoaderMocks = vi.hoisted(() => ({
  getTeam: vi.fn(),
  getPlayer: vi.fn(),
  getLeague: vi.fn(async (): Promise<unknown[]> => []),
  mergePlayerOverride: vi.fn(
    (
      base: Record<string, unknown>,
      override: Record<string, unknown> | null | undefined
    ) =>
      override ? { ...base, ...override } : base
  ),
}));

const worldManagerMocks = vi.hoisted(() => ({
  updateWorldStats: vi.fn(async () => undefined),
  getWorldMetadata: vi.fn(async () => ({ parentWorldId: null, asOfDate: '2026-07-01' })),
}));

vi.mock('@/firebaseConfig', () => ({
  db: 'db',
}));

vi.mock('firebase/firestore', () => ({
  writeBatch: vi.fn(() => ({
    set: firestoreMocks.batchSet,
    update: firestoreMocks.batchUpdate,
    delete: firestoreMocks.batchDelete,
    commit: firestoreMocks.batchCommit,
  })),
  getDoc: firestoreMocks.getDoc,
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  collection: vi.fn((...segments: unknown[]) => segments.map(String).join('/')),
  doc: vi.fn((...segments: unknown[]) => segments.map(String).join('/')),
}));

vi.mock('@/features/architect/utils/teamLoader', () => ({
  getTeam: teamLoaderMocks.getTeam,
  getPlayer: teamLoaderMocks.getPlayer,
  getLeague: teamLoaderMocks.getLeague,
  mergePlayerOverride: teamLoaderMocks.mergePlayerOverride,
}));

vi.mock('@/features/architect/utils/worldManager', () => ({
  updateWorldStats: worldManagerMocks.updateWorldStats,
  getWorldMetadata: worldManagerMocks.getWorldMetadata,
}));

vi.mock('@/features/architect/utils/tradeMachine', () => ({
  validateTrade: vi.fn(() => ({ valid: true, success: true, legal: true })),
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

import {
  applyWorldMutation,
  buildWorldMutationEventPayload,
} from '@/features/architect/utils/mutationPipeline';

const WORLD_ID = 'world_bridge_test';
const SEASON_ID = '2025-26';
const FIXED_TIMESTAMP = Date.parse('2026-03-25T12:00:00.000Z');

function makeContract(
  salary: number,
  overrides: Record<string, unknown> = {}
) {
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
    ...overrides,
  };
}

function makePlayer(
  id: string,
  salary: number,
  teamCode: string | null,
  overrides: Record<string, unknown> = {}
): ArchitectMutationPlayerRecord {
  return {
    id,
    player_id: id,
    playerId: id,
    name: id,
    displayName: id,
    teamCode,
    salary,
    currentSalary: salary,
    contract: makeContract(salary),
    bio: {
      playerId: id,
      displayName: id,
      position: 'SF',
    },
    ...overrides,
  };
}

function makeTeam(
  teamCode: string,
  players: ArchitectMutationPlayerRecord[]
): ArchitectMutationTeamRecord {
  const totalSalary = players.reduce(
    (sum, player) =>
      sum +
      Number(
        player?.contract?.salariesByYear?.[0]?.capHit ??
          player?.currentSalary ??
          player?.salary ??
          0
      ),
    0
  );

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
  };
}

describe('mutationPipeline compute result bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    worldManagerMocks.getWorldMetadata.mockResolvedValue({
      parentWorldId: null,
      asOfDate: '2026-07-01',
    });
  });

  it('applyWorldMutation(signFreeAgent) returns changed team/player results and persists world writes', async () => {
    const team = makeTeam('LAL', []);
    const freeAgent = makePlayer('fa_1', 0, null, {
      displayName: 'Free Agent One',
      freeAgency: { type: 'Unrestricted', year: 2026 },
    });

    teamLoaderMocks.getTeam.mockImplementation(async (_worldId: string, teamCode: string) => {
      if (teamCode === 'LAL') {
        return team;
      }
      throw new Error(`Unexpected team load: ${teamCode}`);
    });
    teamLoaderMocks.getPlayer.mockResolvedValue(freeAgent);

    const result = await applyWorldMutation({
      userId: 'user_bridge',
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

    const setPaths = firestoreMocks.batchSet.mock.calls.map(([ref]) => String(ref));
    const updatePaths = firestoreMocks.batchUpdate.mock.calls.map(([ref]) => String(ref));

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

  it('applyWorldMutation(executeTrade) persists player updates, deletes, entitlement patches, and event-backed world writes', async () => {
    const playerA = makePlayer('player_a', 10_000_000, 'LAL', { tradeTo: 'BOS' });
    const playerB = makePlayer('player_b', 10_000_000, 'BOS', { tradeTo: 'LAL' });
    const teamA = makeTeam('LAL', [playerA]);
    const teamB = makeTeam('BOS', [playerB]);

    teamLoaderMocks.getTeam.mockImplementation(async (_worldId: string, teamCode: string) => {
      if (teamCode === 'LAL') return teamA;
      if (teamCode === 'BOS') return teamB;
      throw new Error(`Unexpected team load: ${teamCode}`);
    });

    const result = await applyWorldMutation({
      userId: 'user_bridge',
      worldId: WORLD_ID,
      seasonId: SEASON_ID,
      mutationType: 'executeTrade',
      payload: {
        teams: [
          {
            teamCode: 'LAL',
            sends: [playerA],
            entitlementsOut: [
              {
                entitlementId: 'pick_lal_2028_1st',
                toTeamId: 'BOS',
              },
            ],
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
    expect(result.changedPlayers?.some((update) => update.playerId === 'player_a')).toBe(true);

    const setPaths = firestoreMocks.batchSet.mock.calls.map(([ref]) => String(ref));
    const deletePaths = firestoreMocks.batchDelete.mock.calls.map(([ref]) => String(ref));
    const updatePaths = firestoreMocks.batchUpdate.mock.calls.map(([ref]) => String(ref));

    expect(
      setPaths.some((path) =>
        path.includes(`architect_worlds/${WORLD_ID}/teams/BOS/players/player_a`)
      )
    ).toBe(true);
    expect(
      deletePaths.some((path) =>
        path.includes(`architect_worlds/${WORLD_ID}/teams/LAL/players/player_a`)
      )
    ).toBe(true);
    expect(
      setPaths.some((path) =>
        path.includes(
          `architect_worlds/${WORLD_ID}/entitlements/pick_lal_2028_1st`
        )
      )
    ).toBe(true);
    expect(
      setPaths.some((path) =>
        path.includes(`architect_worlds/${WORLD_ID}/events/executeTrade_`)
      )
    ).toBe(true);
    expect(
      updatePaths.some((path) => path.endsWith(`architect_worlds/${WORLD_ID}`))
    ).toBe(true);
  });

  it('buildWorldMutationEventPayload keeps the event envelope concrete while preserving heterogeneous metadata at the metadata edge', () => {
    const event = buildWorldMutationEventPayload({
      mutationType: 'executeTrade',
      eventId: 'evt_bridge_trade',
      seasonId: SEASON_ID,
      worldId: WORLD_ID,
      timestamp: FIXED_TIMESTAMP,
      computeResult: {
        metadata: {
          summary: 'Trade completed',
          playerId: 'player_a',
          playerName: 'Player A',
          signedUsing: 'Bird',
          contract: {
            years: 2,
            firstYearSalary: 12_000_000,
          },
          entitlementsTraded: {
            LAL: { out: ['pick_lal_2028_1st'], in: [] },
            BOS: { out: [], in: ['pick_lal_2028_1st'] },
          },
          extraRuntimeField: { kept: true },
        },
        teamUpdates: [{ teamCode: 'LAL' }, { teamCode: 'BOS' }],
        playerUpdates: [{ playerId: 'player_a' }],
        playerDeletes: [],
      },
      auditContext: {
        operationId: 'op_bridge_trade',
        beforeTotalsByTeam: { LAL: { totalCapAllocations: 150_000_000 } },
        afterTotalsByTeam: { LAL: { totalCapAllocations: 149_000_000 } },
        diffSummary: {
          playersMoved: 1,
          deadCapChanged: 0,
          exceptionsChanged: 0,
          teamsTouched: 2,
        },
      },
    });

    expect(event.eventId).toBe('evt_bridge_trade');
    expect(event.mutationType).toBe('executeTrade');
    expect(event.teamCodes).toEqual(['LAL', 'BOS']);
    expect(event.playerIds).toEqual(['player_a']);
    expect(event.metadata.entitlementsTraded).toEqual({
      LAL: { out: ['pick_lal_2028_1st'], in: [] },
      BOS: { out: [], in: ['pick_lal_2028_1st'] },
    });
    expect(event.metadata.extraRuntimeField).toEqual({ kept: true });
    expect(event.mutationMetadata.contractSummary.firstYearSalary).toBe(12_000_000);
    expect(event.mutationMetadata.summary).toBe('Trade completed');
    expect(event.diffSummary.picksMoved).toContain('LAL: out pick_lal_2028_1st');
  });
});
