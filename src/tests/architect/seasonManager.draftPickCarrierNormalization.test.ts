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
  createCanonicalTeamTotalsSnapshot: (team: Record<string, unknown>, year: number) => ({
    ...mocks.computeTeamCapTotals(team, year),
    teamSalary: 20_000_000,
    apronTeamSalary: 21_000_000,
    taxSalary: 22_000_000,
    totalSalary: 20_000_000,
    capHit: 20_000_000,
  }),
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
type CarrierOutput = {
  teamCode?: string | null;
  draftPicks?: unknown[];
};

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

function asCarrierOutput(result: CarrierOutput): {
  teamCode: string | null;
  draftPicks: SnapshotRecord[];
} {
  return {
    teamCode: result.teamCode ?? null,
    draftPicks: (result.draftPicks ?? []) as SnapshotRecord[],
  };
}

function expectNormalizedCarrier(
  result: CarrierOutput,
  teamCode: string,
  draftPickCount: number
): {
  teamCode: string | null;
  draftPicks: SnapshotRecord[];
} {
  expect(Object.keys(result).sort()).toEqual(['draftPicks', 'teamCode']);

  const carrier = asCarrierOutput(result);
  expect(carrier.teamCode).toBe(teamCode);
  expect(Array.isArray(carrier.draftPicks)).toBe(true);
  expect(carrier.draftPicks).toHaveLength(draftPickCount);

  return carrier;
}

function getSnapshotDraftPicks(snapshot: unknown): SnapshotRecord[] {
  if (!snapshot || typeof snapshot !== 'object') {
    return [];
  }

  const draftPicks = (snapshot as { draftPicks?: unknown }).draftPicks;
  return Array.isArray(draftPicks) ? (draftPicks as SnapshotRecord[]) : [];
}

describe('seasonManager draft-pick carrier normalization', () => {
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

  it('returns a normalized carrier for swap no-op paths', () => {
    const team = {
      teamCode: 'BOS',
      market: 'Boston',
      draftPicks: [
        {
          id: 'BOS_2026_SWAP',
          year: 2026,
          round: '1st',
          owner: 'BOS',
          currentOwner: 'BOS',
          originalTeam: 'BOS',
          isSwap: true,
          swapWithTeamId: 'LAL',
          resolved: false,
          extraField: 'drop-me',
        },
      ],
    };

    const result = resolveDraftPickSwapsForYear(team, 2026, null);
    const carrier = expectNormalizedCarrier(result, 'BOS', 1);
    const pick = carrier.draftPicks[0];

    expect(result).not.toBe(team);
    expect(result).not.toHaveProperty('market');
    expect(result).not.toHaveProperty('_derivedDraftPicks');
    expect(pick).toEqual(
      expect.objectContaining({
        id: 'BOS_2026_SWAP',
        year: 2026,
        round: 1,
        isSwap: true,
      })
    );
    expect(pick).not.toHaveProperty('extraField');
  });

  it('returns a normalized empty carrier for conveyance no-op paths', () => {
    const team = {
      teamCode: 'MEM',
      market: 'Memphis',
    };

    const result = resolveDraftPickConveyanceForYear(team, 2026, { MEM: 5 });

    expect(result).toEqual({
      teamCode: 'MEM',
      draftPicks: [],
    });
    expect(result).not.toBe(team);
    expect(result).not.toHaveProperty('market');
  });

  it('keeps mixed draft-pick ingress compatibility at the ingress edge only', () => {
    const team = {
      teamCode: 'ATL',
      market: 'Atlanta',
      _derivedDraftPicks: [
        {
          id: 'ATL_DERIVED_2026_1',
          year: 2026,
          round: '1st',
          owner: 'ATL',
          currentOwner: 'ATL',
          originalTeam: 'ATL',
          isSwap: false,
          extraField: 'drop-me',
        },
      ],
      draftPicks: [
        {
          id: 'ATL_FALLBACK_2026_1',
          year: 2026,
          round: 1,
          owner: 'BOS',
          currentOwner: 'BOS',
          originalTeam: 'ATL',
        },
      ],
    };

    const result = resolveDraftPickSwapsForYear(team, 2026, {});
    const carrier = expectNormalizedCarrier(result, 'ATL', 1);
    const pick = carrier.draftPicks[0];

    expect(result).not.toHaveProperty('market');
    expect(result).not.toHaveProperty('_derivedDraftPicks');
    expect(pick).toEqual(
      expect.objectContaining({
        id: 'ATL_DERIVED_2026_1',
        year: 2026,
        round: 1,
        owner: 'ATL',
      })
    );
    expect(pick).not.toHaveProperty('extraField');
  });

  it('preserves season-advance continuity after carrier normalization', async () => {
    const result = await advanceSeasonInWorld('world_carrier_normalization', {
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

    const picks = getSnapshotDraftPicks(result.committedState.focusTeamSnapshot);
    expect(picks).toHaveLength(3);
    expect(picks.some((pick) => pick.id === 'invalid_missing_year')).toBe(
      false
    );

    const blockedPick = picks.find((pick) => pick.id === 'LAL_2028_1');
    expect(blockedPick).toEqual(
      expect.objectContaining({
        id: 'LAL_2028_1',
        year: 2028,
        round: 1,
        stepienBlocked: true,
      })
    );
    expect(blockedPick).not.toHaveProperty('metadata');
    expect(blockedPick).not.toHaveProperty('tradeable');
    expect(blockedPick).not.toHaveProperty('via');
  });
});
