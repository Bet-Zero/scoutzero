import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestoreMocks = vi.hoisted(() => ({
  batchSet: vi.fn(),
  batchUpdate: vi.fn(),
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

const WORLD_ID = 'world_tm_cap_e1_paths';
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
    totals: { totalSalary, capHit: totalSalary },
  };
}

describe('TM_CAP_INTEGRATION_E1 AC2: executeTrade write-path guardrails', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const teamByCode: Record<string, any> = {
      LAL: makeTeam('LAL', [makePlayer('lal_out_18m', 18_000_000, 'LAL')]),
      BOS: makeTeam('BOS', [makePlayer('bos_out_10m', 10_000_000, 'BOS')]),
      TMA: makeTeam('TMA', [makePlayer('a_out', 10_000_000, 'TMA')]),
      TMB: makeTeam('TMB', [makePlayer('b_out', 10_000_000, 'TMB')]),
      TMC: makeTeam('TMC', [makePlayer('c_out', 10_000_000, 'TMC')]),
    };

    teamLoaderMocks.getTeam.mockImplementation(
      async (_worldId: string, teamCode: string) => {
        return teamByCode[teamCode];
      }
    );
  });

  it('persists executeTrade writes only under architect_worlds/{worldId}/... paths', async () => {
    const result = await applyWorldMutation({
      userId: 'user_tm_cap_e1_paths',
      worldId: WORLD_ID,
      seasonId: SEASON_ID,
      mutationType: 'executeTrade',
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

    if (!result.success) {
      throw new Error(
        `executeTrade failed in write-path guardrail: ${result.error}`
      );
    }

    const setPaths = firestoreMocks.batchSet.mock.calls.map(([ref]) =>
      String(ref)
    );
    const updatePaths = firestoreMocks.batchUpdate.mock.calls.map(([ref]) =>
      String(ref)
    );
    const allPaths = [...setPaths, ...updatePaths];

    expect(allPaths.length).toBeGreaterThan(0);
    expect(
      allPaths.every((path) => path.includes(`architect_worlds/${WORLD_ID}`))
    ).toBe(true);

    expect(
      allPaths.some(
        (path) =>
          path.includes('/teams/') && !path.includes('/architect_worlds/')
      )
    ).toBe(false);
    expect(
      allPaths.some((path) => path.includes('architect_basePlayers'))
    ).toBe(false);
    expect(allPaths.some((path) => path.includes('architect_baseTeams'))).toBe(
      false
    );
    expect(
      allPaths.some((path) => path.includes('architect_baseEntitlements'))
    ).toBe(false);
    expect(
      allPaths.some((path) => path.includes('architect_basePickRules'))
    ).toBe(false);
  });

  it('fails closed and opens no write batch when executeTrade routing is invalid', async () => {
    const result = await applyWorldMutation({
      userId: 'user_tm_cap_e1_paths',
      worldId: WORLD_ID,
      seasonId: SEASON_ID,
      mutationType: 'executeTrade',
      payload: {
        teams: [
          {
            teamCode: 'TMA',
            sends: [{ ...makePlayer('a_out', 10_000_000, 'TMA') }],
            entitlementsOut: [],
          },
          {
            teamCode: 'TMB',
            sends: [{ ...makePlayer('b_out', 10_000_000, 'TMB') }],
            entitlementsOut: [],
          },
          {
            teamCode: 'TMC',
            sends: [{ ...makePlayer('c_out', 10_000_000, 'TMC') }],
            entitlementsOut: [],
          },
        ],
      },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('TRADE_APPLY_ROUTING_ERROR');
    expect(firestoreMocks.batchSet).not.toHaveBeenCalled();
    expect(firestoreMocks.batchUpdate).not.toHaveBeenCalled();
    expect(firestoreMocks.batchCommit).not.toHaveBeenCalled();
  });
});
