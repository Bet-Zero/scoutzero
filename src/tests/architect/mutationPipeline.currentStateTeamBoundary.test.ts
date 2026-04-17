import { beforeEach, describe, expect, it, vi } from 'vitest';

const testState = vi.hoisted(() => ({
  batchSet: vi.fn(),
  batchUpdate: vi.fn(),
  batchDelete: vi.fn(),
  batchCommit: vi.fn(async (): Promise<void> => undefined),
  getDoc: vi.fn(async () => ({
    exists: () => false,
    data: () => null,
  })),
  getTeam: vi.fn(),
  getPlayer: vi.fn(),
  mergePlayerOverride: vi.fn(
    (
      base: Record<string, unknown>,
      override: Record<string, unknown> | null | undefined
    ): Record<string, unknown> => (override ? { ...base, ...override } : base)
  ),
  updateWorldStats: vi.fn(async () => undefined),
  getWorldMetadata: vi.fn(async () => ({
    parentWorldId: null,
    asOfDate: '2026-07-01',
  })),
  validateTrade: vi.fn(() => ({
    valid: true,
    success: true,
    legal: true,
    reason: null,
    violations: [],
    warnings: [],
    teamResults: [],
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
  buildGeneralMutationDashboardReloadTeamSnapshot,
  computeWorldMutation,
  findCommittedTeamSnapshot,
  type ArchitectMutationBirdRights,
  type ArchitectMutationContract,
  type ArchitectMutationPlayerRecord,
  type ArchitectMutationTeamRecord,
} from '@/features/architect/utils/mutationPipeline';

type ComputeArgs = Parameters<typeof computeWorldMutation>[0];

const SEASON_ID = '2025-26';
const FIXED_TIMESTAMP = Date.parse('2026-04-16T14:00:00.000Z');
const FIXED_TIMESTAMP_ISO = '2026-04-16T14:00:00.000Z';
const WORLD_ID = 'world_current_state_team_boundary';

function makeBirdRights(
  overrides: Partial<ArchitectMutationBirdRights> = {}
): ArchitectMutationBirdRights {
  return {
    status: 'Full',
    type: 'Full Bird',
    yearsOfService: 6,
    yearsWithTeam: 3,
    ...overrides,
  };
}

function makeContract(
  salary: number,
  overrides: Partial<ArchitectMutationContract> = {}
): ArchitectMutationContract {
  return {
    contractType: 'Standard',
    years: 1,
    contractYears: 1,
    totalValue: salary,
    salariesByYear: [
      {
        season: SEASON_ID,
        salary,
        capHit: salary,
        guaranteed: true,
        guaranteedAmount: salary,
      },
    ],
    ...overrides,
  };
}

function makePlayer(
  id: string,
  name: string,
  salary: number,
  teamCode: string | null,
  overrides: Partial<ArchitectMutationPlayerRecord> &
    Record<string, unknown> = {}
): ArchitectMutationPlayerRecord & Record<string, unknown> {
  return {
    player_id: id,
    id,
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
      displayName: name,
      playerId: id,
      position: 'SF',
      age: 27,
      display: {
        team: teamCode,
        teamId: teamCode,
        freeAgentYear: 2026,
        freeAgentType: teamCode ? null : 'UFA',
      },
    },
    birdRights: makeBirdRights(),
    representation: {
      agent: `${name} Agent`,
      agency: 'Agency',
    },
    source: {
      provider: 'test-suite',
      type: 'fixture',
      generatedAt: FIXED_TIMESTAMP_ISO,
    },
    ...overrides,
  };
}

function makeTeam(
  teamCode: string,
  players: Array<ArchitectMutationPlayerRecord & Record<string, unknown>>,
  overrides: Partial<ArchitectMutationTeamRecord> &
    Record<string, unknown> = {}
): ArchitectMutationTeamRecord & Record<string, unknown> {
  const totalSalary = players.reduce(
    (sum, player) =>
      sum +
      Number(
        player.contract?.salariesByYear?.[0]?.capHit ??
          player.currentSalary ??
          player.salary ??
          0
      ),
    0
  );

  return {
    id: teamCode.toLowerCase(),
    teamCode,
    teamName: `Team ${teamCode}`,
    players,
    roster: players.map((player) => String(player.player_id || player.id)),
    twoWayPlayers: players.filter((player) => player.isTwoWay === true),
    capHolds: [],
    deadCap: [],
    draftPicks: [],
    entitlementIds: [],
    tradeExceptions: [],
    exceptionHistory: [],
    offerSheets: [],
    incomingOfferSheets: [],
    cashLedger: { totalOut: 0 },
    exceptions: { room: null, mle: null, bae: null, tpe: [] },
    totals: {
      totalSalary,
      capHit: totalSalary,
      totalCapAllocations: totalSalary,
      rosterCount: players.length,
      isHardCapped: false,
    },
    teamTotalSalary: totalSalary,
    source: {
      provider: 'test-suite',
      type: 'test',
      generatedAt: FIXED_TIMESTAMP_ISO,
    },
    ...overrides,
  };
}

function getPersistedTeamWrite(teamCode: string): Record<string, unknown> {
  const match = testState.batchSet.mock.calls.find(([path]) =>
    String(path).includes(`/teams/${teamCode}`)
  );

  if (!match) {
    throw new Error(`Missing persisted team write for ${teamCode}`);
  }

  return match[1] as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  testState.batchCommit.mockResolvedValue(undefined);
  testState.getDoc.mockResolvedValue({
    exists: () => false,
    data: () => null,
  });
  testState.getWorldMetadata.mockResolvedValue({
    parentWorldId: null,
    asOfDate: '2026-07-01',
  });
  testState.validateTrade.mockReturnValue({
    valid: true,
    success: true,
    legal: true,
    reason: null,
    violations: [],
    warnings: [],
    teamResults: [],
  });
});

describe('mutationPipeline current-state team boundary', () => {
  it('keeps executeTrade behavior through the narrowed trade-lane team boundary', () => {
    const lakersOutgoing = makePlayer(
      'lal_out',
      'Lakers Out',
      10_000_000,
      'LAL'
    );
    const celticsOutgoing = makePlayer(
      'bos_out',
      'Celtics Out',
      10_000_000,
      'BOS'
    );
    const lakers = makeTeam('LAL', [lakersOutgoing], {
      teamTotalSalary: undefined,
      totals: {
        totalSalary: 120_000_000,
        capHit: 120_000_000,
        totalCapAllocations: 120_000_000,
        rosterCount: 1,
        isHardCapped: false,
      },
      draftPicks: [{ id: 'lal_2029_1', year: 2029, round: 1, owner: 'LAL' }],
      entitlementIds: ['ent_lal_keep'],
      cashLedger: { totalOut: 1_000_000 },
      tradeExceptions: [
        {
          id: 'tpe_lal_keep',
          amount: 5_000_000,
          totalAmount: 5_000_000,
          remainingAmount: 5_000_000,
          usedAmount: 0,
          createdSeason: 2025,
        },
      ],
      exceptionHistory: [{ historyKey: 'hist_lal_keep', type: 'tpe-created' }],
      legacyTeamCompatibilityBlob: { shouldDrop: true },
    });
    const celtics = makeTeam('BOS', [celticsOutgoing], {
      teamTotalSalary: undefined,
      totals: {
        totalSalary: 121_000_000,
        capHit: 121_000_000,
        totalCapAllocations: 121_000_000,
        rosterCount: 1,
        isHardCapped: false,
      },
      cashLedger: { totalOut: 500_000 },
      legacyTeamCompatibilityBlob: { shouldDrop: true },
    });

    const result = computeWorldMutation({
      mutationType: 'executeTrade',
      payload: {
        teams: [
          {
            teamCode: 'LAL',
            sends: [{ player_id: 'lal_out', name: 'Lakers Out', tradeTo: 'BOS' }],
            entitlementsOut: [],
          },
          {
            teamCode: 'BOS',
            sends: [
              { player_id: 'bos_out', name: 'Celtics Out', tradeTo: 'LAL' },
            ],
            entitlementsOut: [],
          },
        ],
        tradeCtx: { worldId: WORLD_ID },
      },
      currentState: {
        teams: [
          { teamCode: 'LAL', team: lakers },
          { teamCode: 'BOS', team: celtics },
        ],
      },
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);

    const updatedCeltics = result.teamUpdates?.find(
      (update) => update.teamCode === 'BOS'
    )?.team;
    const updatedLakers = result.teamUpdates?.find(
      (update) => update.teamCode === 'LAL'
    )?.team;

    expect(updatedCeltics?.roster).toContain('lal_out');
    expect(updatedCeltics?.cashLedger).toEqual({ totalOut: 500_000 });
    expect(updatedLakers?.teamTotalSalary).toBe(120_000_000);
    expect(updatedLakers?.draftPicks).toEqual([
      { id: 'lal_2029_1', year: 2029, round: 1, pick: null, owner: 'LAL' },
    ]);
    expect(updatedLakers?.entitlementIds).toEqual(['ent_lal_keep']);
    expect(updatedLakers).not.toHaveProperty('legacyTeamCompatibilityBlob');
    expect(updatedCeltics).not.toHaveProperty('legacyTeamCompatibilityBlob');
  });

  it('keeps manual-cap mutations on a non-trade lane without carrying trade-only fields forward', () => {
    const twoWayPlayer = makePlayer('two_way', 'Two Way', 500_000, 'LAL', {
      isTwoWay: true,
    });
    const team = makeTeam('LAL', [], {
      twoWayPlayers: [twoWayPlayer],
      teamTotalSalary: 99_999_999,
      tradeExceptions: [
        {
          id: 'tpe_keep',
          amount: 1_500_000,
          totalAmount: 1_500_000,
          remainingAmount: 1_500_000,
          usedAmount: 0,
          createdSeason: 2026,
        },
      ],
      cashLedger: { totalOut: 250_000 },
      draftPicks: [{ id: 'lal_2028_1', year: 2028, round: 1, owner: 'LAL' }],
      entitlementIds: ['ent_keep'],
      legacyTradeOnlyBlob: { shouldDrop: true },
    });

    const result = computeWorldMutation({
      mutationType: 'setExceptions',
      payload: {
        teamCode: 'LAL',
        exceptions: {
          room: {
            enabled: true,
            totalAmount: 6_000_000,
            remainingAmount: 6_000_000,
            usedAmount: 0,
          },
        },
        exceptionChanges: ['Room Exception updated'],
      },
      currentState: {
        team: team as ComputeArgs['currentState']['team'],
        teamCode: 'LAL',
      } as Extract<ComputeArgs, { mutationType: 'setExceptions' }>['currentState'],
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
    });

    expect(result.success).toBe(true);

    const updatedTeam = result.teamUpdates?.[0]?.team;
    expect(updatedTeam?.exceptions).toMatchObject({
      room: {
        totalAmount: 6_000_000,
        remainingAmount: 6_000_000,
        usedAmount: 0,
      },
    });
    expect(updatedTeam?.tradeExceptions).toEqual([
      expect.objectContaining({ id: 'tpe_keep', amount: 1_500_000 }),
    ]);
    expect(updatedTeam?.cashLedger).toEqual({ totalOut: 250_000 });
    expect(updatedTeam?.draftPicks).toEqual([
      { id: 'lal_2028_1', year: 2028, round: 1, pick: null, owner: 'LAL' },
    ]);
    expect(updatedTeam?.entitlementIds).toEqual(['ent_keep']);
    expect(updatedTeam).not.toHaveProperty('teamTotalSalary');
    expect(updatedTeam).not.toHaveProperty('twoWayPlayers');
    expect(updatedTeam).not.toHaveProperty('legacyTradeOnlyBlob');
  });

  it('keeps committed team, persistence, and dashboard reload snapshots continuous', async () => {
    const team = makeTeam('LAL', [], {
      draftPicks: [{ id: 'lal_2030_2', year: 2030, round: 2, owner: 'LAL' }],
      entitlementIds: ['ent_reload_keep'],
      exceptionHistory: [
        { historyKey: 'hist_reload_keep', type: 'exception-adjusted' },
      ],
      cashLedger: { totalOut: 700_000 },
      teamTotalSalary: 50_000_000,
    });

    testState.getTeam.mockResolvedValue(team);

    const result = await applyWorldMutation({
      userId: 'user_current_state_team_boundary',
      worldId: WORLD_ID,
      seasonId: SEASON_ID,
      mutationType: 'setExceptions',
      payload: {
        teamCode: 'LAL',
        exceptions: {
          room: {
            enabled: true,
            totalAmount: 7_000_000,
            remainingAmount: 7_000_000,
            usedAmount: 0,
          },
        },
        exceptionChanges: ['Room Exception committed'],
      },
      timestamp: FIXED_TIMESTAMP,
    });

    expect(result.success).toBe(true);

    const committedTeam = findCommittedTeamSnapshot(result.changedTeams, 'LAL');
    if (!committedTeam) {
      throw new Error('Expected committed LAL snapshot');
    }

    const reloadTeam =
      buildGeneralMutationDashboardReloadTeamSnapshot(committedTeam);
    const persistedTeam = getPersistedTeamWrite('LAL');

    expect(committedTeam.exceptions).toMatchObject({
      room: {
        totalAmount: 7_000_000,
        remainingAmount: 7_000_000,
        usedAmount: 0,
      },
    });
    expect(committedTeam.draftPicks).toEqual([
      { id: 'lal_2030_2', year: 2030, round: 2, pick: null, owner: 'LAL' },
    ]);
    expect(reloadTeam.draftPicks).toEqual(committedTeam.draftPicks);
    expect(reloadTeam.entitlementIds).toEqual(['ent_reload_keep']);
    expect(reloadTeam.exceptionHistory).toEqual(committedTeam.exceptionHistory);
    expect(persistedTeam.exceptions).toEqual(committedTeam.exceptions);
    expect(persistedTeam.draftPicks).toEqual(committedTeam.draftPicks);
    expect(persistedTeam.entitlementIds).toEqual(committedTeam.entitlementIds);
    expect(persistedTeam).not.toHaveProperty('teamTotalSalary');
  });

  it('tolerates mixed legacy compute snapshots only at the public current-state boundary', () => {
    const freeAgent = makePlayer('fa_mixed', 'Mixed Boundary FA', 0, null, {
      contract: null,
      freeAgency: 'UFA',
    });
    const initialTeam = makeTeam('LAL', [], {
      draftPicks: [{ id: 'lal_2027_2', year: 2027, round: 2, owner: 'LAL' }],
      legacyRawLoaderBlob: { shouldDrop: true },
    });

    const signingResult = computeWorldMutation({
      mutationType: 'signFreeAgent',
      payload: {
        teamCode: 'LAL',
        playerId: 'fa_mixed',
        contract: makeContract(3_000_000),
        signedUsing: 'Minimum',
      },
      currentState: {
        team: initialTeam,
        player: freeAgent,
        teamCode: 'LAL',
      },
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
    });

    expect(signingResult.success).toBe(true);

    const computedTeam = signingResult.teamUpdates?.[0]?.team;
    const mixedLegacyTeam = {
      ...computedTeam,
      teamTotalSalary: 123_000_000,
      twoWayPlayers: [makePlayer('legacy_two_way', 'Legacy Two Way', 0, 'LAL')],
      legacyComputedSnapshotBlob: { shouldDrop: true },
    };

    const result = computeWorldMutation({
      mutationType: 'setExceptions',
      payload: {
        teamCode: 'LAL',
        exceptions: {
          room: {
            enabled: true,
            totalAmount: 5_000_000,
            remainingAmount: 5_000_000,
            usedAmount: 0,
          },
        },
        exceptionChanges: ['Room Exception after mixed snapshot'],
      },
      currentState: {
        team: mixedLegacyTeam,
        teamCode: 'LAL',
      } as Extract<ComputeArgs, { mutationType: 'setExceptions' }>['currentState'],
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
    });

    expect(result.success).toBe(true);

    const updatedTeam = result.teamUpdates?.[0]?.team;
    expect(updatedTeam?.roster).toContain('fa_mixed');
    expect(updatedTeam?.draftPicks).toEqual([
      { id: 'lal_2027_2', year: 2027, round: 2, pick: null, owner: 'LAL' },
    ]);
    expect(updatedTeam?.exceptions).toMatchObject({
      room: {
        totalAmount: 5_000_000,
        remainingAmount: 5_000_000,
        usedAmount: 0,
      },
    });
    expect(updatedTeam).not.toHaveProperty('teamTotalSalary');
    expect(updatedTeam).not.toHaveProperty('twoWayPlayers');
    expect(updatedTeam).not.toHaveProperty('legacyRawLoaderBlob');
    expect(updatedTeam).not.toHaveProperty('legacyComputedSnapshotBlob');
  });
});
