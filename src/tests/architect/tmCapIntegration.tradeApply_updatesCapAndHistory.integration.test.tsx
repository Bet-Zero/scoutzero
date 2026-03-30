import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestoreMocks = vi.hoisted(() => ({
  batchSet: vi.fn(),
  batchUpdate: vi.fn(),
  batchDelete: vi.fn(),
  batchCommit: vi.fn(async (): Promise<any> => undefined),
  getDoc: vi.fn(async (): Promise<any> => ({ exists: () => false, data: () => ({}) })),
}));

const teamLoaderMocks = vi.hoisted(() => ({
  getTeam: vi.fn(),
  getPlayer: vi.fn(),
  getLeague: vi.fn(async (): Promise<any[]> => []),
  mergePlayerOverride: vi.fn((base: any, override: any) =>
    override ? { ...base, ...override } : base
  ),
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
  updateWorldStats: vi.fn(async () => undefined),
  getWorldMetadata: vi.fn(async () => ({ parentWorldId: null as any })),
}));

vi.mock('@/features/architect/utils/capLegalityValidation', () => ({
  validateSigning: vi.fn(() => ({ valid: true, violations: [] as any[], warnings: [] as any[] })),
  validateWaive: vi.fn(() => ({ valid: true, violations: [] as any[], warnings: [] as any[] })),
  validateExtension: vi.fn(() => ({
    valid: true,
    violations: [] as any[],
    warnings: [] as any[],
  })),
  validateOptionDecision: vi.fn(() => ({
    valid: true,
    violations: [] as any[],
    warnings: [] as any[],
  })),
  validateOfferSheetResolution: vi.fn(() => ({
    valid: true,
    violations: [] as any[],
    warnings: [] as any[],
  })),
  validateRenounceRights: vi.fn(() => ({
    valid: true,
    violations: [] as any[],
    warnings: [] as any[],
  })),
  validateDeadCap: vi.fn(() => ({ violations: [] as any[], warnings: [] as any[] })),
  validateExceptions: vi.fn(() => ({ violations: [] as any[], warnings: [] as any[] })),
  isOverrideEnabled: vi.fn(() => false),
}));

vi.mock('@/features/architect/utils/tradeMachine', () => ({
  validateTrade: vi.fn(() => ({ valid: true, success: true, legal: true })),
}));

vi.mock('@/features/architect/utils/capLegality/postStateCapValidator', () => ({
  POST_STATE_CAP_VALIDATOR_VERSION: 'test-post-state-validator',
  validatePostStateCapLegality: vi.fn(() => ({
    valid: true,
    violations: [] as any[],
    warnings: [] as any[],
  })),
}));

import { applyWorldMutation } from '@/features/architect/utils/mutationPipeline';

const FIXED_TIMESTAMP = Date.UTC(2026, 2, 3, 12, 0, 0);
const WORLD_ID = 'world_tm_cap_e1';
const SEASON_ID = '2025-26';

function makePlayer(id: string, salary: number, teamCode: string) {
  return {
    id,
    player_id: id,
    name: id,
    displayName: id,
    teamCode,
    salary,
    currentSalary: salary,
    contract: {
      contractType: 'Standard',
      salariesByYear: [
        { season: SEASON_ID, salary, capHit: salary, guaranteed: true },
      ],
    },
  };
}

function makeTeam(teamCode: string, players: Array<Record<string, any>>) {
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
    teamCode,
    teamName: `Team ${teamCode}`,
    roster: players.map((player) => String(player.player_id || player.id)),
    players,
    capHolds: [] as any[],
    draftPicks: [] as any[],
    entitlementIds: [] as any[],
    tradeExceptions: [] as any[],
    exceptionHistory: [] as any[],
    exceptions: { tpe: [] as any[] },
    totals: {
      totalSalary,
      capHit: totalSalary,
      teamSalary: totalSalary,
      totalCapAllocations: totalSalary,
    },
  };
}

describe('TM_CAP_INTEGRATION_E1 AC1: executeTrade updates cap and history payload deterministically', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const lalOut = makePlayer('lal_out_18m', 18_000_000, 'LAL');
    const bosOut = makePlayer('bos_out_10m', 10_000_000, 'BOS');

    const teamByCode: Record<string, any> = {
      LAL: makeTeam('LAL', [lalOut]),
      BOS: makeTeam('BOS', [bosOut]),
    };

    teamLoaderMocks.getTeam.mockImplementation(
      async (_worldId: string, teamCode: string) => {
        return teamByCode[teamCode];
      }
    );
  });

  it('applies executeTrade in world mode, changes cap totals, and emits Team History-compatible event payload', async () => {
    const result = await applyWorldMutation({
      userId: 'user_tm_cap_e1',
      worldId: WORLD_ID,
      seasonId: SEASON_ID,
      mutationType: 'executeTrade',
      timestamp: FIXED_TIMESTAMP,
      payload: {
        teams: [
          {
            teamCode: 'LAL',
            sends: [
              {
                ...makePlayer('lal_out_18m', 18_000_000, 'LAL'),
                tradeTo: 'BOS',
              },
            ],
            entitlementsOut: [],
          },
          {
            teamCode: 'BOS',
            sends: [
              {
                ...makePlayer('bos_out_10m', 10_000_000, 'BOS'),
                tradeTo: 'LAL',
              },
            ],
            entitlementsOut: [],
          },
        ],
        tradeCtx: {
          worldId: WORLD_ID,
          seasonId: SEASON_ID,
          source: 'tradeMachine',
        },
      },
    });

    expect(result.success).toBe(true);
    expect(result.persistedToWorld).toBe(true);
    expect(result.writesSummary.eventsWritten).toBeGreaterThan(0);

    const lalChangedTeam = result.changedTeams.find(
      (entry: any) => entry.teamCode === 'LAL'
    )?.team;
    const bosChangedTeam = result.changedTeams.find(
      (entry: any) => entry.teamCode === 'BOS'
    )?.team;

    expect(lalChangedTeam).toBeDefined();
    expect(bosChangedTeam).toBeDefined();

    const setCalls = firestoreMocks.batchSet.mock.calls;
    const eventWrite = setCalls.find(([ref]) =>
      String(ref).includes(`architect_worlds/${WORLD_ID}/events/`)
    );

    expect(eventWrite).toBeDefined();

    const eventPayload = eventWrite?.[1] as Record<string, any>;
    const lalCapHit = Number(lalChangedTeam?.totals?.capHit ?? 0);
    const bosCapHit = Number(bosChangedTeam?.totals?.capHit ?? 0);
    const beforeLal = Number(
      eventPayload?.beforeTotalsByTeam?.LAL?.totalCapAllocations ?? 0
    );
    const afterLal = Number(
      eventPayload?.afterTotalsByTeam?.LAL?.totalCapAllocations ?? 0
    );
    const beforeBos = Number(
      eventPayload?.beforeTotalsByTeam?.BOS?.totalCapAllocations ?? 0
    );
    const afterBos = Number(
      eventPayload?.afterTotalsByTeam?.BOS?.totalCapAllocations ?? 0
    );

    expect(lalCapHit).toBe(afterLal);
    expect(bosCapHit).toBe(afterBos);
    expect(afterLal).toBeLessThan(beforeLal);
    expect(afterBos).toBeGreaterThan(beforeBos);

    expect(eventPayload?.mutationType).toBe('executeTrade');
    expect(eventPayload?.teamCodes).toEqual(
      expect.arrayContaining(['LAL', 'BOS'])
    );
    expect(eventPayload?.occurredAt).toBe(
      new Date(FIXED_TIMESTAMP).toISOString()
    );
    expect(eventPayload?.beforeTotalsByTeam).toHaveProperty('LAL');
    expect(eventPayload?.afterTotalsByTeam).toHaveProperty('LAL');
    expect(eventPayload?.diffSummary).toBeDefined();
    expect(eventPayload?.mutationMetadata).toBeDefined();
  });
});
