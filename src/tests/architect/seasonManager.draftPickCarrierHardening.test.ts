import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  batchSet: vi.fn(),
  batchUpdate: vi.fn(),
  batchCommit: vi.fn(async (): Promise<void> => undefined),
  getLeague: vi.fn(),
  getWorldMetadata: vi.fn(),
  getDraftPositionsMap: vi.fn(),
  computeTeamCapTotals: vi.fn(),
  resolveOffseasonTransition: vi.fn(),
}));

vi.mock('@/firebaseConfig', () => ({
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  writeBatch: vi.fn(() => ({
    set: mocks.batchSet,
    update: mocks.batchUpdate,
    commit: mocks.batchCommit,
  })),
  doc: vi.fn((_db: unknown, ...pathParts: string[]) => pathParts.join('/')),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  increment: vi.fn((n: number) => n),
}));

vi.mock('@/features/architect/utils/teamLoader', () => ({
  getLeague: mocks.getLeague,
}));

vi.mock('@/features/architect/utils/worldManager', () => ({
  getWorldMetadata: mocks.getWorldMetadata,
  getDraftPositionsMap: mocks.getDraftPositionsMap,
}));

vi.mock('@/features/architect/utils/seasonFormat', () => ({
  toEndYear: (season: string) => Number(season.split('-')[0]) + 1,
  toSeasonCode: (year: number) => `${year - 1}-${String(year).slice(2)}`,
  getSeasonAdvanceDraftContext: (season: string) => {
    const startYear = Number(season.split('-')[0]);
    return {
      authoritativeSeason: season,
      nextUsedDraftYear: startYear + 1,
      nextSeason: `${startYear + 1}-${String(startYear + 2).slice(2)}`,
    };
  },
}));

vi.mock('@/features/architect/utils/architectFirestorePaths', () => ({
  worldTeamRef: vi.fn(
    (worldId: string, teamCode: string) =>
      `architect_worlds/${worldId}/teams/${teamCode}`
  ),
  worldMetadataRef: vi.fn((worldId: string) => `architect_worlds/${worldId}`),
}));

vi.mock('@/features/architect/utils/tradeMachine/utils/capSettingsProvider', () => ({
  getCapSettings: vi.fn(() => ({
    settings: {
      floor: 120_000_000,
      salaryCap: 141_000_000,
      luxuryTax: 170_000_000,
      firstApron: 178_000_000,
      secondApron: 188_000_000,
    },
    source: 'test',
  })),
}));

vi.mock('@/features/architect/utils/offseason', () => ({
  resolveOffseasonTransition: mocks.resolveOffseasonTransition,
}));

vi.mock('@/features/architect/utils/persistenceContracts', () => ({
  normalizeTeamTpeSchema: (team: unknown) => team,
  assertPersistableOrThrow: vi.fn(() => undefined),
  PERSISTENCE_CONTRACTS: {
    TEAM: {},
    EVENT: {},
  },
}));

vi.mock('@/features/architect/utils/persistenceContracts/enforcement', () => ({
  sanitizeTransientFieldsForPersistence: (value: unknown) => value,
}));

vi.mock('@/features/architect/utils/capLegality/postStateCapValidator', () => ({
  POST_STATE_CAP_VALIDATOR_VERSION: 'test-v1',
  validatePostStateCapLegality: vi.fn(() => ({
    valid: true,
    violations: [],
    warnings: [],
  })),
}));

vi.mock('@/features/architect/utils/capTotals', () => ({
  computeTeamCapTotals: mocks.computeTeamCapTotals,
}));

vi.mock('@/features/architect/utils/entitlements/entitlementResolver', () => ({
  resolveEntitlementsForTeam: vi.fn(async () => []),
}));

vi.mock('@/features/architect/utils/entitlements/pickRulesResolver', () => ({
  resolvePickRulesByIds: vi.fn(async () => new Map()),
  pickRulesMapToObject: vi.fn(() => ({})),
}));

vi.mock('@/features/architect/utils/entitlements/seasonManagerProjection', () => ({
  projectEntitlementsToSeasonManagerView: vi.fn(() => []),
  logDerivedPicksCreation: vi.fn(),
}));

vi.mock('@/features/architect/utils/entitlements/dare', () => ({
  resolveAllDraftAssets: vi.fn(async () => ({
    success: true,
    entitlementDocWrites: [],
    teamEntitlementIdUpdates: [],
    resolutionReceipt: { totalResolutions: 0, entries: [] },
  })),
  applyGatedDAREResultsToBatch: vi.fn(() => ({ ok: true, writeCount: 0 })),
  formatReceiptAsSummary: vi.fn(() => '0 resolutions'),
}));

vi.mock('@/constants/collections', () => ({
  ARCHITECT_WORLDS_COLLECTION: 'architect_worlds',
  ARCHITECT_WORLD_EVENTS_SUBCOLLECTION: 'events',
}));

import {
  advanceSeasonInWorld,
  resolveDraftPickConveyanceForYear,
  resolveDraftPickSwapsForYear,
} from '@/features/architect/utils/seasonManager';

type SnapshotRecord = Record<string, unknown>;

function makeSeasonAdvanceTeam() {
  return {
    teamCode: 'LAL',
    teamName: 'Los Angeles Lakers',
    season: '2025-26',
    players: [],
    roster: [],
    capHolds: [],
    deadCap: [],
    exceptions: { tpe: [] },
    totals: {},
    draftPicks: [
      {
        id: 'LAL_2027_1_OUT',
        year: 2027,
        round: 1,
        owner: 'BOS',
        currentOwner: 'BOS',
        originalTeam: 'LAL',
        tradedTo: 'BOS',
        status: 'future',
        metadata: { shouldNotCarry: true },
      },
      {
        id: 'LAL_2028_1',
        year: 2028,
        round: '1st',
        owner: 'LAL',
        currentOwner: 'LAL',
        originalTeam: 'LAL',
        status: 'future',
        tradeable: true,
        via: 'LAL',
        metadata: { shouldNotCarry: true },
      },
      {
        id: 'LAL_2029_1_OUT',
        year: 2029,
        round: 1,
        owner: 'BOS',
        currentOwner: 'BOS',
        originalTeam: 'LAL',
        tradedTo: 'BOS',
        status: 'future',
      },
      {
        id: 'invalid_missing_year',
        owner: 'LAL',
        arbitrary: true,
      },
      'not-a-pick',
    ],
  };
}

function getSnapshotDraftPicks(snapshot: unknown): SnapshotRecord[] {
  if (!snapshot || typeof snapshot !== 'object') {
    return [];
  }

  const draftPicks = (snapshot as { draftPicks?: unknown }).draftPicks;
  return Array.isArray(draftPicks)
    ? (draftPicks as SnapshotRecord[])
    : [];
}

function hasOwn(record: SnapshotRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

describe('seasonManager draft-pick carrier hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getWorldMetadata.mockResolvedValue({
      currentSeason: '2025-26',
    });
    mocks.getDraftPositionsMap.mockResolvedValue({});
    mocks.getLeague.mockResolvedValue([makeSeasonAdvanceTeam()]);
    mocks.computeTeamCapTotals.mockImplementation(
      (_team: SnapshotRecord, year: number) => ({
        yearKey: year,
        playersTotal: 0,
        deadMoneyTotal: 0,
        capHoldsTotal: 0,
        incompleteChargesTotal: 0,
        totalCapAllocations: 0,
        salaryCap: 141_000_000,
        luxuryTax: 170_000_000,
        firstApron: 178_000_000,
        secondApron: 188_000_000,
      })
    );
    mocks.resolveOffseasonTransition.mockImplementation(
      ({ teamCapSheet }: { teamCapSheet: SnapshotRecord }) => ({
        success: true,
        nextTeamCapSheet: {
          ...teamCapSheet,
          season: '2026-27',
        },
        appliedChangesSummary: {
          exercisedOptions: [],
          declinedOptions: [],
          expiredContracts: [],
          expiredTPEs: [],
          transitionedExceptions: [],
        },
      })
    );
  });

  it('advances a real team path while normalizing mixed draft-pick ingress and reporting Stepien updates', async () => {
    const result = await advanceSeasonInWorld('world_pick_hardening', {
      focusTeamCode: 'LAL',
      optionDecisions: {},
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(result.error);
    }

    expect(result.updatedTeams).toEqual(['LAL']);
    expect(result.summary.stepienUpdates).toEqual([
      expect.objectContaining({
        pickId: 'LAL_2028_1',
        year: 2028,
        status: 'blocked',
      }),
    ]);
    expect(mocks.batchCommit).toHaveBeenCalledTimes(1);

    const snapshot = result.committedState.focusTeamSnapshot;
    const picks = getSnapshotDraftPicks(snapshot);
    expect(picks).toHaveLength(3);
    expect(picks.some((pick) => pick.id === 'invalid_missing_year')).toBe(false);

    const blockedPick = picks.find((pick) => pick.id === 'LAL_2028_1');
    expect(blockedPick).toEqual(
      expect.objectContaining({
        id: 'LAL_2028_1',
        year: 2028,
        round: 1,
        stepienBlocked: true,
      })
    );
    expect(blockedPick ? hasOwn(blockedPick, 'metadata') : true).toBe(false);
    expect(blockedPick ? hasOwn(blockedPick, 'tradeable') : true).toBe(false);
    expect(blockedPick ? hasOwn(blockedPick, 'via') : true).toBe(false);
  });

  it('resolves conveyance on the narrowed carrier without broad pick baggage', () => {
    const result = resolveDraftPickConveyanceForYear(
      {
        teamCode: 'MEM',
        draftPicks: [
          {
            id: 'MEM_2026_1',
            year: 2026,
            round: 1,
            owner: 'BOS',
            currentOwner: 'BOS',
            originalTeam: 'MEM',
            protection: 'Top 14 protected',
            conveyance: {
              currentYear: 2026,
              finalYear: 2028,
              conditions: {
                protection: 'Top 14 protected',
                ifRolls: 'Top 10 protected in 2027',
              },
            },
            status: 'future',
          },
        ],
      },
      2026,
      { MEM: 5 },
      {
        nowIso: '2026-04-01T00:00:00.000Z',
        method: 'season_advance',
      }
    );

    const pick = result.draftPicks?.[0];
    expect(pick).toEqual(
      expect.objectContaining({
        id: 'MEM_2026_1',
        year: 2027,
        round: 1,
        protection: 'Top 10',
        status: 'rolled',
      })
    );
    expect(pick?.conveyance?.conditions.protection).toBe('Top 10');
    expect(pick?.conveyanceResult).toEqual(
      expect.objectContaining({
        outcome: 'rolled',
        position: 5,
        previousYear: 2026,
        previousProtection: 'Top 14 protected',
      })
    );
  });

  it('resolves swaps on the same narrowed carrier contract', () => {
    const nowIso = '2026-04-01T00:00:00.000Z';
    const result = resolveDraftPickSwapsForYear(
      {
        teamCode: 'LAL',
        draftPicks: [
          {
            id: 'LAL_2026_SWAP',
            year: 2026,
            round: 1,
            owner: 'LAL',
            currentOwner: 'LAL',
            originalTeam: 'LAL',
            isSwap: true,
            swapType: 'best_of',
            swapWithTeamId: 'BOS',
            resolved: false,
          },
        ],
      },
      2026,
      { LAL: 3, BOS: 10 },
      { nowIso, method: 'season_advance' }
    );

    const pick = result.draftPicks?.[0];
    expect(pick).toEqual(
      expect.objectContaining({
        id: 'LAL_2026_SWAP',
        resolved: true,
        resolvedOwner: 'LAL',
        resolvedPosition: 3,
      })
    );
    expect(pick?.resolutionMeta).toEqual(
      expect.objectContaining({
        resolvedAt: nowIso,
        method: 'season_advance',
        positions: { LAL: 3, BOS: 10 },
      })
    );
  });
});
