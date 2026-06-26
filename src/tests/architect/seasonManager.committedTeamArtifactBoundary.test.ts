import { beforeEach, describe, expect, it, vi } from 'vitest';

type UnknownRecord = Record<string, unknown>;

const mocks = vi.hoisted(() => ({
  batchSet: vi.fn(),
  batchUpdate: vi.fn(),
  batchCommit: vi.fn(async (): Promise<void> => undefined),
  getLeague: vi.fn(),
  getWorldMetadata: vi.fn(),
  getDraftPositionsMap: vi.fn(),
  computeTeamCapTotals: vi.fn(),
  resolveOffseasonTransition: vi.fn(),
  assertPersistableOrThrow: vi.fn(),
  validatePostStateCapLegality: vi.fn(),
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

vi.mock('@/features/architect/utils/tradeMachine/utils/swapResolution', () => ({
  resolvePickSwap: vi.fn(),
}));

vi.mock('@/features/architect/utils/tradeMachine/utils/conveyanceResolution', () => ({
  resolveConveyanceForPick: vi.fn(),
}));

vi.mock('@/features/architect/utils/offseason', () => ({
  resolveOffseasonTransition: mocks.resolveOffseasonTransition,
}));

vi.mock('@/features/architect/utils/persistenceContracts', () => ({
  normalizeTeamTpeSchema: (team: UnknownRecord) => {
    const nextTeam = { ...team };
    const legacyTpes = Array.isArray(nextTeam.tradeExceptions)
      ? nextTeam.tradeExceptions
      : [];
    const exceptions =
      nextTeam.exceptions && typeof nextTeam.exceptions === 'object'
        ? { ...(nextTeam.exceptions as UnknownRecord) }
        : {};
    const canonicalTpes = Array.isArray(exceptions.tpe) ? exceptions.tpe : [];

    nextTeam.exceptions = {
      ...exceptions,
      tpe: canonicalTpes.length > 0 ? canonicalTpes : legacyTpes,
    };
    delete nextTeam.tradeExceptions;

    return nextTeam;
  },
  assertPersistableOrThrow: mocks.assertPersistableOrThrow,
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
  validatePostStateCapLegality: mocks.validatePostStateCapLegality,
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

import { advanceSeasonInWorld } from '@/features/architect/utils/seasonManager';

function makeCommittedBoundaryTeam(): UnknownRecord {
  return {
    id: 'hydrated-lal',
    teamCode: 'LAL',
    teamName: 'Los Angeles Lakers',
    abbreviation: 'LAL',
    city: 'Los Angeles',
    conference: 'West',
    division: 'Pacific',
    season: '2025-26',
    roster: ['keeper', 'expiring'],
    players: [
      {
        id: 'keeper',
        player_id: 'keeper',
        name: 'Rotation Keeper',
        contract: {
          salariesByYear: [{ season: '2026-27', salary: 12_000_000 }],
        },
      },
      {
        id: 'expiring',
        player_id: 'expiring',
        name: 'Expiring Veteran',
        contract: {
          salariesByYear: [{ season: '2025-26', salary: 3_000_000 }],
        },
      },
    ],
    capHolds: [],
    deadCap: [],
    exceptions: { mle: { amount: 14_000_000 }, tpe: [] },
    tradeExceptions: [{ id: 'legacy_tpe', amount: 4_000_000 }],
    exceptionHistory: [{ id: 'exception-history-1' }],
    mleHistory: [{ id: 'mle-history-1' }],
    pickLog: [{ id: 'pick-log-1' }],
    currentPicks: { 2027: { first: 'Own', second: 'Own' } },
    historyTimeline: [{ id: 'timeline-1', type: 'seasonAdvance' }],
    draftPicks: [{ id: 'LAL_2027_1', year: 2027, round: 1 }],
    draftPicksInventory: [{ id: 'inventory-1' }],
    draftPicksObligations: [{ id: 'obligation-1' }],
    draftPicksContested: [{ id: 'contested-1' }],
    entitlementIds: ['entitlement-1'],
    offerSheets: [{ id: 'offer-sheet-1' }],
    incomingOfferSheets: [{ id: 'incoming-offer-sheet-1' }],
    totals: { yearKey: 2026, totalCapAllocations: 15_000_000 },
    source: { layer: 'world' },
    lastUpdated: '2026-04-01T00:00:00.000Z',
    version: 3,
    mergedAt: '2026-04-02T00:00:00.000Z',
    _meta: { totalsSource: 'fixture' },
    hardCapLevel: 'firstApron',
    hardCapReason: 'signAndTrade',
    hardCapTriggeredBy: 'signAndTrade',
    hardCapped: true,
    activeContracts: [{ playerId: 'keeper' }],
    draftAssets: { derived: true },
    baseline: { source: 'base-doc' },
    _derivedDraftPicks: [{ id: 'derived-pick' }],
  };
}

function getTeamWrite(): [string, UnknownRecord] {
  const teamWrite = mocks.batchSet.mock.calls.find(
    ([path]) => path === 'architect_worlds/world_committed_boundary/teams/LAL'
  );
  if (!teamWrite) {
    throw new Error('Expected committed team write for LAL');
  }
  return teamWrite as [string, UnknownRecord];
}

async function runAdvance() {
  const result = await advanceSeasonInWorld('world_committed_boundary', {
    focusTeamCode: 'LAL',
    optionDecisions: {},
  });

  expect(result.success).toBe(true);
  if (!result.success) {
    throw new Error(result.error);
  }

  return result;
}

describe('seasonManager committed team artifact boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getWorldMetadata.mockResolvedValue({
      currentSeason: '2025-26',
    });
    mocks.getDraftPositionsMap.mockResolvedValue({});
    mocks.getLeague.mockResolvedValue([makeCommittedBoundaryTeam()]);
    mocks.computeTeamCapTotals.mockImplementation(
      (team: UnknownRecord, year: number) => ({
        yearKey: year,
        playersTotal: Array.isArray(team.players)
          ? team.players.length * 10_000_000
          : 0,
        deadMoneyTotal: 0,
        capHoldsTotal: Array.isArray(team.capHolds)
          ? team.capHolds.length * 1_000_000
          : 0,
        incompleteChargesTotal: 0,
        totalCapAllocations: Array.isArray(team.players)
          ? team.players.length * 10_000_000
          : 0,
        salaryCap: 141_000_000,
        luxuryTax: 170_000_000,
        firstApron: 178_000_000,
        secondApron: 188_000_000,
      })
    );
    mocks.resolveOffseasonTransition.mockImplementation(
      ({ teamCapSheet }: { teamCapSheet: UnknownRecord }) => ({
        success: true,
        nextTeamCapSheet: {
          ...teamCapSheet,
          season: '2026-27',
          players: (teamCapSheet.players as UnknownRecord[]).filter(
            (player) => player.id !== 'expiring'
          ),
          roster: ['keeper'],
          capHolds: [
            {
              playerId: 'expiring',
              playerName: 'Expiring Veteran',
              amount: 3_600_000,
              type: 'ufa',
            },
          ],
        },
        appliedChangesSummary: {
          exercisedOptions: [],
          declinedOptions: [],
          expiredContracts: [
            {
              playerId: 'expiring',
              playerName: 'Expiring Veteran',
              lastSalary: 3_000_000,
            },
          ],
          expiredTPEs: [],
          transitionedExceptions: [],
        },
      })
    );
    mocks.validatePostStateCapLegality.mockReturnValue({
      valid: true,
      violations: [],
      warnings: [],
    });
  });

  it('advances the focus team and returns committed metadata plus a dashboard reload snapshot', async () => {
    const result = await runAdvance();

    expect(result.toSeason).toBe('2026-27');
    expect(result.updatedTeams).toEqual(['LAL']);
    expect(result.summary.expiredContracts).toEqual([
      expect.objectContaining({
        playerId: 'expiring',
        playerName: 'Expiring Veteran',
      }),
    ]);
    expect(result.committedState.metadata).toEqual({
      currentSeason: '2026-27',
      currentYear: 2027,
      asOfDate: '2026-07-01',
      lastModifiedTeams: ['LAL'],
    });
    expect(result.committedState.focusTeamSnapshot).toEqual(
      expect.objectContaining({
        teamCode: 'LAL',
        season: '2026-27',
        roster: ['keeper'],
        players: [
          expect.objectContaining({
            id: 'keeper',
            name: 'Rotation Keeper',
          }),
        ],
        capHolds: [
          expect.objectContaining({
            playerId: 'expiring',
            amount: 3_600_000,
          }),
        ],
        totals: expect.objectContaining({ yearKey: 2027 }),
      })
    );
    expect(mocks.batchCommit).toHaveBeenCalledTimes(1);
  });

  it('persists a normalized committed team without hydration-only season-manager fields', async () => {
    await runAdvance();

    const [, persistedTeam] = getTeamWrite();
    expect(persistedTeam).toEqual(
      expect.objectContaining({
        teamCode: 'LAL',
        season: '2026-27',
        roster: ['keeper'],
        exceptions: expect.objectContaining({
          tpe: [expect.objectContaining({ id: 'legacy_tpe' })],
        }),
        totals: expect.objectContaining({ yearKey: 2027 }),
      })
    );
    expect(persistedTeam).not.toHaveProperty('id');
    expect(persistedTeam).not.toHaveProperty('activeContracts');
    expect(persistedTeam).not.toHaveProperty('draftAssets');
    expect(persistedTeam).not.toHaveProperty('baseline');
    expect(persistedTeam).not.toHaveProperty('_derivedDraftPicks');
    expect(persistedTeam).not.toHaveProperty('tradeExceptions');
    expect(mocks.assertPersistableOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        obj: persistedTeam,
        label: 'TEAM',
      })
    );
  });

  it('feeds post-state validation from the committed team artifact used for the write', async () => {
    await runAdvance();

    const [, persistedTeam] = getTeamWrite();
    expect(mocks.validatePostStateCapLegality).toHaveBeenCalledTimes(1);
    const validationInput = mocks.validatePostStateCapLegality.mock.calls[0][0];

    expect(validationInput.afterTeamsByCode.LAL).toEqual(persistedTeam);
    expect(validationInput.afterTotalsByTeam.LAL).toEqual(
      expect.objectContaining({
        yearKey: 2027,
        totalCapAllocations: 10_000_000,
      })
    );
  });

  it('keeps mixed preserve-only committed input out of the focus-team reload artifact', async () => {
    const result = await runAdvance();
    const [, persistedTeam] = getTeamWrite();
    const focusSnapshot = result.committedState.focusTeamSnapshot;

    expect(persistedTeam).toEqual(
      expect.objectContaining({
        city: 'Los Angeles',
        conference: 'West',
        division: 'Pacific',
        source: { layer: 'world' },
        draftPicksInventory: [{ id: 'inventory-1' }],
        entitlementIds: ['entitlement-1'],
        _meta: { totalsSource: 'fixture' },
      })
    );
    expect(focusSnapshot).toEqual(
      expect.objectContaining({
        exceptionHistory: [{ id: 'exception-history-1' }],
        mleHistory: [{ id: 'mle-history-1' }],
        pickLog: [{ id: 'pick-log-1' }],
        currentPicks: { 2027: { first: 'Own', second: 'Own' } },
        historyTimeline: [{ id: 'timeline-1', type: 'seasonAdvance' }],
      })
    );
    expect(focusSnapshot).not.toHaveProperty('city');
    expect(focusSnapshot).not.toHaveProperty('conference');
    expect(focusSnapshot).not.toHaveProperty('division');
    expect(focusSnapshot).not.toHaveProperty('source');
    expect(focusSnapshot).not.toHaveProperty('draftPicksInventory');
    expect(focusSnapshot).not.toHaveProperty('draftPicksObligations');
    expect(focusSnapshot).not.toHaveProperty('draftPicksContested');
    expect(focusSnapshot).not.toHaveProperty('entitlementIds');
    expect(focusSnapshot).not.toHaveProperty('_meta');
  });
});
