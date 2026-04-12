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
      override: Record<string, unknown>
    ): Record<string, unknown> => ({
      ...base,
      ...override,
      bio:
        base.bio || override.bio
          ? {
              ...((base.bio as Record<string, unknown> | null | undefined) ||
                {}),
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
  buildGeneralMutationDashboardReloadTeamSnapshot,
  computeWorldMutation,
  findCommittedTeamSnapshot,
  type ArchitectMutationBirdRights,
  type ArchitectMutationContract,
  type ArchitectMutationPlayerRecord,
  type ArchitectMutationTeamRecord,
} from '@/features/architect/utils/mutationPipeline';

type ComputeArgs = Parameters<typeof computeWorldMutation>[0];
type CurrentStateInput = ComputeArgs['currentState'];
type CurrentStateTeamField = CurrentStateInput extends { team?: infer T }
  ? T
  : never;
type CurrentStatePlayerField = CurrentStateInput extends { player?: infer T }
  ? T
  : never;
type CurrentStateHomeTeamField = CurrentStateInput extends {
  homeTeam?: infer T;
}
  ? T
  : never;
type CurrentStateDestinationTeamField = CurrentStateInput extends {
  destinationTeam?: infer T;
}
  ? T
  : never;
type CurrentStateTradeEntryField = CurrentStateInput extends {
  teams?: Array<infer T>;
}
  ? T
  : never;
type CurrentStateTradeTeamField = CurrentStateTradeEntryField extends {
  team?: infer T;
}
  ? T
  : never;

const SEASON_ID = '2025-26';
const FIXED_TIMESTAMP = Date.parse('2026-04-12T12:00:00.000Z');
const FIXED_TIMESTAMP_ISO = '2026-04-12T12:00:00.000Z';
const WORLD_ID = 'world_current_state_ingress_closure';

function makeCapProjections() {
  return {
    [SEASON_ID]: {
      salaryCap: 141_000_000,
      luxuryTax: 171_000_000,
      firstApron: 179_000_000,
      secondApron: 189_000_000,
      averageSalary: 11_000_000,
      minimumSalary: 1_200_000,
    },
  };
}

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
  overrides: Partial<ArchitectMutationPlayerRecord> & Record<string, unknown> = {}
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
  overrides: Partial<ArchitectMutationTeamRecord> & Record<string, unknown> = {}
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
});

describe('mutationPipeline current-state ingress closure', () => {
  it('keeps sign-free-agent compute on the lane-owned team/player slice while tolerating outer-edge trade baggage', () => {
    const freeAgent = makePlayer('fa_outer', 'Free Agent Outer', 0, null);
    const team = makeTeam('LAL', []);
    const ignoredTradeTeam = makeTeam(
      'BAD',
      [makePlayer('bad_1', 'Bad Player', 4_000_000, 'BAD')],
      {
        offerSheets: [{ id: 'ignored_os', playerId: 'bad_1' }],
        incomingOfferSheets: [{ id: 'ignored_ios', playerId: 'bad_1' }],
        legacyTradeIngressBlob: { shouldDrop: true },
      }
    );

    const result = computeWorldMutation({
      mutationType: 'signFreeAgent',
      payload: {
        teamCode: 'LAL',
        playerId: 'fa_outer',
        contract: makeContract(2_000_000, { totalValue: 2_000_000 }),
        signedUsing: 'Minimum',
      },
      currentState: {
        team: team as CurrentStateTeamField,
        player: freeAgent as CurrentStatePlayerField,
        teamCode: 'LAL',
        teams: [
          {
            teamCode: 'BAD',
            team: ignoredTradeTeam as CurrentStateTradeTeamField,
          },
        ],
        destinationTeam: ignoredTradeTeam as CurrentStateDestinationTeamField,
        destinationTeamCode: 'BAD',
      } as CurrentStateInput,
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
    expect(result.teamUpdates?.map((update) => update.teamCode)).toEqual(['LAL']);
    expect(result.teamUpdates?.[0]?.team?.roster).toContain('fa_outer');
    expect(result.playerUpdates?.[0]?.player?.teamCode).toBe('LAL');
  });

  it('keeps team-only exception edits on the manual-cap slice and preserves team round-trip material', () => {
    const preservedHistory = [
      {
        historyKey: 'hist_keep',
        type: 'TPE_CREATED',
        teamCode: 'LAL',
        tpeId: 'tpe_keep',
        timestamp: FIXED_TIMESTAMP_ISO,
      },
    ];
    const ignoredTradeTeam = makeTeam('BAD', []);
    const ignoredPlayer = makePlayer('ignored_1', 'Ignored One', 3_000_000, 'BAD');
    const team = makeTeam('LAL', [], {
      tradeExceptions: [
        {
          id: 'tpe_keep',
          amount: 1_500_000,
          totalAmount: 1_500_000,
          remainingAmount: 1_500_000,
          usedAmount: 0,
          createdSeason: 2026,
          expiresOn: '2026-07-01',
        },
      ],
      exceptionHistory: preservedHistory,
      draftPicks: [
        {
          year: 2029,
          round: 1,
          pick: null,
          owner: 'LAL',
        },
      ],
      entitlementIds: ['ent_keep'],
      cashLedger: { totalOut: 500_000 },
      exceptions: {
        room: {
          enabled: true,
          totalAmount: 5_000_000,
          remainingAmount: 5_000_000,
          usedAmount: 0,
        },
        tpe: [{ id: 'tpe_keep', amount: 1_500_000 }],
        customBucket: { keep: true },
      },
      legacyTeamIngressBlob: { shouldDrop: true },
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
        team: team as CurrentStateTeamField,
        player: ignoredPlayer as CurrentStatePlayerField,
        homeTeam: ignoredTradeTeam as CurrentStateHomeTeamField,
        teams: [
          {
            teamCode: 'BAD',
            team: ignoredTradeTeam as CurrentStateTradeTeamField,
          },
        ],
        destinationTeam: ignoredTradeTeam as CurrentStateDestinationTeamField,
        teamCode: 'LAL',
      } as CurrentStateInput,
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
      tpe: [{ id: 'tpe_keep', amount: 1_500_000 }],
      customBucket: { keep: true },
    });
    expect(updatedTeam?.tradeExceptions).toEqual([
      expect.objectContaining({ id: 'tpe_keep', amount: 1_500_000 }),
    ]);
    expect(updatedTeam?.exceptionHistory).toEqual(preservedHistory);
    expect(updatedTeam?.draftPicks).toEqual([
      expect.objectContaining({ year: 2029, round: 1, owner: 'LAL' }),
    ]);
    expect(updatedTeam?.entitlementIds).toEqual(['ent_keep']);
    expect(updatedTeam?.cashLedger).toMatchObject({ totalOut: 500_000 });
    expect(updatedTeam).not.toHaveProperty('legacyTeamIngressBlob');
  });

  it('keeps execute-trade on the teams lane without pulling in signing-only baggage', () => {
    const playerA = makePlayer('a_trade', 'A Trade', 9_000_000, 'TMA');
    const playerB = makePlayer('b_trade', 'B Trade', 9_000_000, 'TMB');
    const teamA = makeTeam('TMA', [playerA], {
      offerSheets: [{ id: 'ignored_a', playerId: 'ghost_a' }],
      incomingOfferSheets: [{ id: 'ignored_in_a', playerId: 'ghost_a' }],
      legacyTradeIngressBlob: { shouldDrop: true },
    });
    const teamB = makeTeam('TMB', [playerB], {
      offerSheets: [{ id: 'ignored_b', playerId: 'ghost_b' }],
      incomingOfferSheets: [{ id: 'ignored_in_b', playerId: 'ghost_b' }],
      legacyTradeIngressBlob: { shouldDrop: true },
    });
    const ignoredSigningTeam = makeTeam('IGN', []);
    const ignoredPlayer = makePlayer('ignored_trade', 'Ignored Trade', 5_000_000, 'IGN');

    const result = computeWorldMutation({
      mutationType: 'executeTrade',
      payload: {
        teams: [
          {
            teamCode: 'TMA',
            sends: [
              {
                player_id: 'a_trade',
                id: 'a_trade',
                playerId: 'a_trade',
                name: 'A Trade',
                matchOutgoing: 9_000_000,
                tradeTo: 'TMB',
              },
            ],
            entitlementsOut: [],
          },
          {
            teamCode: 'TMB',
            sends: [
              {
                player_id: 'b_trade',
                id: 'b_trade',
                playerId: 'b_trade',
                name: 'B Trade',
                matchOutgoing: 9_000_000,
                tradeTo: 'TMA',
              },
            ],
            entitlementsOut: [],
          },
        ],
        capProjections: makeCapProjections(),
        tradeCtx: {
          worldId: 'world_trade_ingress_closure',
          source: 'tradeMachine',
          offseason: true,
        },
      },
      currentState: {
        teams: [
          {
            teamCode: 'TMA',
            team: teamA as CurrentStateTradeTeamField,
          },
          {
            teamCode: 'TMB',
            team: teamB as CurrentStateTradeTeamField,
          },
        ],
        team: ignoredSigningTeam as CurrentStateTeamField,
        player: ignoredPlayer as CurrentStatePlayerField,
        homeTeam: ignoredSigningTeam as CurrentStateHomeTeamField,
        destinationTeamCode: 'IGN',
      } as CurrentStateInput,
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
      worldId: 'world_trade_ingress_closure',
    });

    expect(result.success).toBe(true);

    const destinationTeam = result.teamUpdates?.find(
      (update) => update.teamCode === 'TMB'
    )?.team;
    const movedPlayer = result.playerUpdates?.find(
      (update) => update.playerId === 'a_trade'
    )?.player;

    expect(destinationTeam?.roster).toContain('a_trade');
    expect(movedPlayer?.teamCode).toBe('TMB');
    expect(destinationTeam?.offerSheets).toBeUndefined();
    expect(destinationTeam?.incomingOfferSheets).toBeUndefined();
  });

  it('preserves committed-team reload and persisted writes after ingress narrowing', async () => {
    const existingPlayer = makePlayer(
      'starter_1',
      'Starter One',
      10_000_000,
      'LAL'
    );
    const freeAgent = makePlayer('fa_boundary', 'Boundary Free Agent', 0, null, {
      contract: null,
      freeAgency: 'UFA',
      birdRights: { status: 'Full' },
    });
    const initialTeam = makeTeam('LAL', [existingPlayer], {
      capHolds: [
        {
          playerId: 'fa_boundary',
          playerName: 'Boundary Free Agent',
          amount: 4_000_000,
          type: 'FA Cap Hold',
          season: SEASON_ID,
          active: true,
        },
      ],
      tradeExceptions: [
        {
          id: 'tpe_keep',
          amount: 5_000_000,
          totalAmount: 5_000_000,
          remainingAmount: 5_000_000,
          createdSeason: 2025,
        },
      ],
      cashLedger: { totalOut: 1_000_000 },
      exceptionHistory: [
        {
          historyKey: 'history_keep',
          type: 'tpe-created',
        },
      ],
      draftPicks: [{ id: 'pick_keep', year: 2028, round: 1, owner: 'LAL' }],
      entitlementIds: ['entitlement_keep'],
    });

    testState.getTeam.mockResolvedValue(initialTeam);
    testState.getPlayer.mockResolvedValue(freeAgent);

    const result = await applyWorldMutation({
      userId: 'user_current_state_ingress_closure',
      worldId: WORLD_ID,
      seasonId: SEASON_ID,
      mutationType: 'signFreeAgent',
      payload: {
        teamCode: 'LAL',
        playerId: 'fa_boundary',
        contract: makeContract(6_000_000, {
          years: 2,
          contractYears: 2,
          totalValue: 12_000_000,
        }),
        signedUsing: 'Cap Space',
      },
      timestamp: FIXED_TIMESTAMP,
    });

    expect(result.success).toBe(true);

    const committedTeam = findCommittedTeamSnapshot(result.changedTeams, 'LAL');
    expect(committedTeam?.players?.map((player) => player.playerId)).toContain(
      'fa_boundary'
    );
    expect(committedTeam?.capHolds).toEqual([]);
    expect(committedTeam?.draftPicks).toEqual([
      { id: 'pick_keep', year: 2028, round: 1, pick: null, owner: 'LAL' },
    ]);
    expect(committedTeam?.entitlementIds).toEqual(['entitlement_keep']);

    const reloadTeam =
      committedTeam &&
      buildGeneralMutationDashboardReloadTeamSnapshot(committedTeam);
    expect(reloadTeam?.players?.map((player) => player.playerId)).toContain(
      'fa_boundary'
    );
    expect(reloadTeam?.capHolds).toEqual([]);
    expect(reloadTeam?.draftPicks).toEqual(committedTeam?.draftPicks);

    const persistedTeam = getPersistedTeamWrite('LAL');
    expect(persistedTeam.players).toEqual(committedTeam?.players);
    expect(persistedTeam.draftPicks).toEqual(committedTeam?.draftPicks);
    expect(persistedTeam.entitlementIds).toEqual(committedTeam?.entitlementIds);
    expect(persistedTeam.cashLedger).toEqual({ totalOut: 1_000_000 });
    expect(persistedTeam.tradeExceptions).toEqual([
      {
        id: 'tpe_keep',
        amount: 5_000_000,
        totalAmount: 5_000_000,
        remainingAmount: 5_000_000,
        createdSeason: 2025,
      },
    ]);
  });
});
