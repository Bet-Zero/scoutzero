import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ArchitectMutationPlayerRecord,
  ArchitectMutationTeamRecord,
} from '@/features/architect/utils/mutationPipeline';
import { withGovernedSalaryBooks } from '@/tests/fixtures/governedSalaryBookInputs';

type FirestoreDocSnapshot = {
  exists: () => boolean;
  data: () => Record<string, never>;
};

type TeamTotalsPayload = {
  totalCapAllocations?: number | string | null;
  teamSalary?: number | string | null;
  apronTeamSalary?: number | string | null;
  taxSalary?: number | string | null;
};

type MutationEventPayload = {
  mutationType?: string;
  teamCodes?: string[];
  occurredAt?: string;
  beforeTotalsByTeam?: Record<string, TeamTotalsPayload>;
  afterTotalsByTeam?: Record<string, TeamTotalsPayload>;
  diffSummary?: unknown;
  mutationMetadata?: unknown;
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
  getWorldMetadata: vi.fn(async () => ({ parentWorldId: null })),
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

vi.mock('@/features/architect/utils/tradeMachine', () => ({
  validateTrade: vi.fn(() => ({ valid: true, success: true, legal: true })),
}));

vi.mock('@/features/architect/utils/capLegality/postStateCapValidator', () => ({
  POST_STATE_CAP_VALIDATOR_VERSION: 'test-post-state-validator',
  validatePostStateCapLegality: vi.fn(() => ({
    valid: true,
    violations: [],
    warnings: [],
  })),
}));

import { applyWorldMutation } from '@/features/architect/utils/mutationPipeline';

const FIXED_TIMESTAMP = Date.UTC(2026, 2, 3, 12, 0, 0);
const WORLD_ID = 'world_tm_cap_e1';
const SEASON_ID = '2025-26';

function makePlayer(
  id: string,
  salary: number,
  teamCode: string
): ArchitectMutationPlayerRecord {
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

  return withGovernedSalaryBooks({
    teamCode,
    teamName: `Team ${teamCode}`,
    roster: players.map((player) => String(player.player_id || player.id)),
    players,
    capHolds: [],
    draftPicks: [],
    entitlementIds: [],
    tradeExceptions: [],
    exceptionHistory: [],
    exceptions: { tpe: [] },
    totals: {
      totalSalary,
      capHit: totalSalary,
      teamSalary: totalSalary,
      totalCapAllocations: totalSalary,
    },
  }, {
    salaryCapYear: 2026,
    asOfDate: new Date(FIXED_TIMESTAMP).toISOString(),
    teamSalary: totalSalary,
  }) as ArchitectMutationTeamRecord;
}

describe('TM_CAP_INTEGRATION_E1 AC1: executeTrade updates cap and history payload deterministically', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const lalOut = makePlayer('lal_out_18m', 18_000_000, 'LAL');
    const bosOut = makePlayer('bos_out_10m', 10_000_000, 'BOS');

    const teamByCode: Record<string, ArchitectMutationTeamRecord> = {
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
    expect(result.writesSummary).toBeDefined();
    expect(result.writesSummary?.eventsWritten).toBeGreaterThan(0);

    const changedTeams = result.changedTeams ?? [];
    const lalChangedTeam = changedTeams.find(
      (entry) => entry.teamCode === 'LAL'
    )?.team;
    const bosChangedTeam = changedTeams.find(
      (entry) => entry.teamCode === 'BOS'
    )?.team;

    expect(lalChangedTeam).toBeDefined();
    expect(bosChangedTeam).toBeDefined();

    const setCalls = firestoreMocks.batchSet.mock.calls;
    const eventWrite = setCalls.find(([ref]) =>
      String(ref).includes(`architect_worlds/${WORLD_ID}/events/`)
    );

    expect(eventWrite).toBeDefined();

    const eventPayload = eventWrite?.[1] as MutationEventPayload;
    const lalCapHit = Number(lalChangedTeam?.totals?.capHit ?? 0);
    const bosCapHit = Number(bosChangedTeam?.totals?.capHit ?? 0);
    const beforeLal = Number(
      eventPayload?.beforeTotalsByTeam?.LAL?.teamSalary ?? 0
    );
    const afterLal = Number(
      eventPayload?.afterTotalsByTeam?.LAL?.teamSalary ?? 0
    );
    const beforeBos = Number(
      eventPayload?.beforeTotalsByTeam?.BOS?.teamSalary ?? 0
    );
    const afterBos = Number(
      eventPayload?.afterTotalsByTeam?.BOS?.teamSalary ?? 0
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
