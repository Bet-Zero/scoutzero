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
  getDraftYearForSeasonAdvance: (season: string) =>
    Number(season.split('-')[0]) + 1,
  getSeasonAdvanceDraftContext: (season: string) => ({
    authoritativeSeason: season,
    nextUsedDraftYear: Number(season.split('-')[0]) + 1,
    nextSeason: `${Number(season.split('-')[0]) + 1}-${String(
      Number(season.split('-')[0]) + 2
    ).slice(2)}`,
  }),
  toSeasonCode: (year: number) => `${year - 1}-${String(year).slice(2)}`,
}));

vi.mock('@/features/architect/utils/architectFirestorePaths', () => ({
  worldTeamRef: vi.fn((worldId: string, teamCode: string) => `architect_worlds/${worldId}/teams/${teamCode}`),
  worldMetadataRef: vi.fn((worldId: string) => `architect_worlds/${worldId}`),
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

vi.mock('@/features/architect/utils/offseason', () => ({
  resolveOffseasonTransition: mocks.resolveOffseasonTransition,
}));

vi.mock('@/features/architect/utils/tradeMachine/utils/capSettingsProvider', () => ({
  getCapSettings: vi.fn(() => ({
    settings: {
      floor: 120000000,
      salaryCap: 141000000,
      luxuryTax: 170000000,
      firstApron: 178000000,
      secondApron: 188000000,
    },
    source: 'test',
  })),
}));

vi.mock('@/features/architect/utils/persistenceContracts', () => ({
  normalizeTeamTpeSchema: (team: Record<string, unknown>) => team,
  getTeamTpeList: (): unknown[] => [],
  assertPersistableOrThrow: vi.fn((): void => undefined),
  PERSISTENCE_CONTRACTS: {
    TEAM: {},
    EVENT: {},
  },
}));

vi.mock('@/features/architect/utils/persistenceContracts/enforcement', () => ({
  sanitizeTransientFieldsForPersistence: (value: Record<string, unknown>) => value,
}));

vi.mock('@/features/architect/utils/salaryEngine', () => ({
  getMinimumSalaryScale: vi.fn(() => [1000000]),
}));

vi.mock('@/features/architect/utils/capHoldTransitionHelpers', () => ({
  computeExpectedCapHoldAmount: vi.fn(() => 0),
  deriveFreeAgencyYearFromOptionSeason: vi.fn(() => 2027),
  getRightsTypeFromPlayer: vi.fn(() => 'Bird'),
}));

vi.mock('@/features/architect/utils/tradeMachine/utils/swapResolution', () => ({
  resolvePickSwap: vi.fn(),
}));

vi.mock('@/features/architect/utils/tradeMachine/utils/conveyanceResolution', () => ({
  resolveConveyanceForPick: vi.fn(),
}));

vi.mock('@/features/architect/utils/tpeLifecycle', () => ({
  processTradeExceptions: vi.fn(() => ({
    activeTPEs: [] as unknown[],
    expiredTPEs: [] as unknown[],
    hasChanges: false,
  })),
  getTpeExpiryISO: vi.fn(() => '2027-07-01T00:00:00.000Z'),
}));

vi.mock('@/features/architect/utils/exceptionHistory/historyHelpers', () => ({
  appendExceptionHistory: vi.fn((): unknown[] => []),
  createTpeExpiryHistoryEntry: vi.fn((): Record<string, never> => ({})),
}));

vi.mock('@/features/architect/utils/exceptions', () => ({
  resetTeamNonTpeExceptionsForNewSeason: vi.fn(
    (): { exceptions: Record<string, unknown>; hasChanges: boolean } => ({
      exceptions: {},
      hasChanges: false,
    })
  ),
}));

vi.mock('@/features/architect/utils/entitlements/entitlementResolver', () => ({
  resolveEntitlementsForTeam: vi.fn(async (): Promise<unknown[]> => []),
}));

vi.mock('@/features/architect/utils/entitlements/pickRulesResolver', () => ({
  resolvePickRulesByIds: vi.fn(async () => new Map()),
  pickRulesMapToObject: vi.fn(() => ({})),
}));

vi.mock('@/features/architect/utils/entitlements/seasonManagerProjection', () => ({
  projectEntitlementsToSeasonManagerView: vi.fn((): unknown[] => []),
  logDerivedPicksCreation: vi.fn((): void => undefined),
}));

vi.mock('@/features/architect/utils/entitlements/dare', () => ({
  resolveAllDraftAssets: vi.fn(async () => ({
    success: true,
    entitlementDocWrites: [] as unknown[],
    teamEntitlementIdUpdates: [] as unknown[],
    resolutionReceipt: { totalResolutions: 0, entries: [] as unknown[] },
  })),
  applyGatedDAREResultsToBatch: vi.fn(() => ({ ok: true, writeCount: 0 })),
  formatReceiptAsSummary: vi.fn(() => 'none'),
}));

import { advanceSeasonInWorld } from '@/features/architect/utils/seasonManager';

describe('Season Advance Post-State Validator Fail-Close', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getWorldMetadata.mockResolvedValue({
      currentSeason: '2025-26',
    });
    mocks.getDraftPositionsMap.mockResolvedValue({});
    mocks.getLeague.mockResolvedValue([
      {
        teamCode: 'BOS',
        season: '2025-26',
        players: [],
        roster: [],
        capHolds: [],
        deadCap: [],
        exceptions: { tpe: [] },
        totals: {},
      },
    ]);
    mocks.resolveOffseasonTransition.mockImplementation(({ teamCapSheet }) => ({
      success: true,
      nextTeamCapSheet: { ...teamCapSheet, season: '2026-27' },
      appliedChangesSummary: {
        exercisedOptions: [],
        declinedOptions: [],
        expiredContracts: [],
        expiredTPEs: [],
        transitionedExceptions: [],
      },
    }));
    mocks.computeTeamCapTotals.mockImplementation(
      (_team: Record<string, unknown>, year: number) => ({
        yearKey: year,
        playersTotal: year === 2027 ? Number.NaN : 0,
        deadMoneyTotal: 0,
        capHoldsTotal: 0,
        incompleteChargesTotal: 0,
        totalCapAllocations: 0,
        salaryCap: 141000000,
        luxuryTax: 170000000,
        firstApron: 178000000,
        secondApron: 188000000,
      })
    );
  });

  it('returns failure and does not commit batch when validator reports violations', async () => {
    const result = await advanceSeasonInWorld('world_fail_close', {
      optionDecisions: {},
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Post-state cap validation failed');
    expect(Array.isArray(result.violations)).toBe(true);
    expect(
      (result.violations || []).some(
        (violation: { code?: string }) => violation.code === 'TOTALS_NON_FINITE'
      )
    ).toBe(true);
    expect(mocks.getDraftPositionsMap).toHaveBeenCalledWith(
      'world_fail_close',
      2026
    );
    expect(mocks.batchCommit).not.toHaveBeenCalled();
  });
});
