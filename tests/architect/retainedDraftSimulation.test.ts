import { beforeEach, describe, expect, it, vi } from 'vitest';
import { REAL_DRAFT_REVIEW_PIN } from '@/features/architect/utils/draftPickRealReviewPin';
import {
  DRAFT_SIMULATION_KIND,
  retainedSimulationEntitlement,
} from '@/features/architect/utils/draftReview/simulationInventory';
import { prepareSimulationRecord } from '@/features/architect/utils/draftReview/simulationReview';
import { decorateEntitlementForTrade } from '@/features/architect/utils/entitlements/entitlementTerms';
import { advanceConditionalDraftInWorld } from '@/features/architect/utils/seasonManager.conditionalDraft';
import {
  prepareRetainedDraftSimulation,
  requireDraftReviewCapability,
} from '@/features/architect/utils/draftReview/capability';
import { QUALIFIED_JUNE5_DRAFT_HORIZON as horizon } from '@/features/architect/utils/draftReview/horizon';

const mock = vi.hoisted(() => ({
  docs: new Map<string, any>(),
  catalogue: null as any,
  enabled: true,
}));
vi.mock('@/firebaseConfig', () => ({
  db: {},
  auth: { currentUser: { getIdToken: async () => 'test' } },
  isSyntheticDraftReviewEnvironment: () => mock.enabled,
}));
vi.mock(
  '@/features/architect/utils/draftReview/simulationInventory',
  async (original) => {
    const actual =
      await original<
        typeof import('@/features/architect/utils/draftReview/simulationInventory')
      >();
    return { ...actual, loadSimulationCatalogue: async () => mock.catalogue };
  }
);
vi.mock('@/features/architect/utils/mutationPipeline.read.stateLoader', () => ({
  loadStateForMutation: async () => ({
    teams: ['CHI', 'TOR'].map((teamCode) => ({
      teamCode,
      team: mock.docs.get(`architect_worlds/w/teams/${teamCode}`),
    })),
  }),
}));
vi.mock('firebase/firestore', () => ({
  doc: (base: any, ...parts: string[]) => ({
    path: [...(base.path ? [base.path] : []), ...parts].join('/'),
  }),
  collection: (base: any, ...parts: string[]) => ({
    path: [...(base.path ? [base.path] : []), ...parts].join('/'),
  }),
  getDoc: async (ref: any) => ({
    data: () => structuredClone(mock.docs.get(ref.path)),
    exists: () => mock.docs.has(ref.path),
  }),
  getDocs: async (ref: any) => {
    const docs = [...mock.docs]
      .filter(
        ([p]) =>
          p.startsWith(ref.path + '/') &&
          !p.slice(ref.path.length + 1).includes('/')
      )
      .map(([p, v]) => ({
        id: p.split('/').at(-1),
        ref: { path: p },
        data: () => structuredClone(v),
      }));
    return { docs, size: docs.length };
  },
}));
const codes = [
  'ATL',
  'BOS',
  'BKN',
  'CHA',
  'CHI',
  'CLE',
  'DAL',
  'DEN',
  'DET',
  'GSW',
  'HOU',
  'IND',
  'LAC',
  'LAL',
  'MEM',
  'MIA',
  'MIL',
  'MIN',
  'NOP',
  'NYK',
  'OKC',
  'ORL',
  'PHI',
  'PHX',
  'POR',
  'SAC',
  'SAS',
  'TOR',
  'UTA',
  'WAS',
];
function id(team: string, year: number) {
  return `test-${team}-${year}`;
}
function args(chiYear = 2028, torYear = 2029) {
  return {
    userId: 'u',
    worldId: 'w',
    seasonId: '2025-26',
    mutationType: 'executeTrade',
    operationId: 'op',
    payload: {
      asOfDate: '2026-06-05',
      tradeCtx: {
        worldId: 'w',
        yearKey: 2026,
        asOfDate: '2026-06-05',
        source: 'tradeMachine',
      },
      teams: ['CHI', 'TOR'].map((teamCode, i) => {
        const y = i ? torYear : chiYear;
        const outgoing = [
          {
            id: id(teamCode, y),
            kind: 'pick_ownership',
            underlyingPickId: `${teamCode}_${y}_1st`,
            seasonYear: y,
            round: 1,
            toTeamId: i ? 'CHI' : 'TOR',
          },
        ];
        return {
          teamCode,
          sends: [],
          picksOut: [],
          cashSent: 0,
          cashToTeamId: null,
          salaryMatchingElection: null,
          outgoingEntitlements: outgoing,
          entitlementsOut: outgoing,
        };
      }),
    },
  };
}
beforeEach(() => {
  mock.docs.clear();
  mock.enabled = true;
  const rows = ['CHI', 'TOR'].flatMap((team) =>
    Array.from({ length: 7 }, (_, i) => {
      const year = 2026 + i;
      return {
        entitlementId: id(team, year),
        role: 'original',
        originalPick: {
          kind: 'authenticated-original-pick',
          id: `${team}_${year}_1st`,
          originalTeam: team,
          draftYear: year,
          round: 1,
        },
        ownership: null,
        poolIds: [],
        evidence: [],
        label: `${team} ${year}`,
      };
    })
  );
  mock.catalogue = {
    data: { records: rows, unresolved: [], inventorySha256: 'a'.repeat(64) },
    release: {
      payloadSha256: 'b'.repeat(64),
      foundation: {
        release: { id: 'test-only' },
        retained: {
          entitlements: rows.map((r) => ({
            entitlementId: r.entitlementId,
            kind: 'pick_ownership',
            baselineUnderlyingAssetIdsUnchanged: [r.originalPick.id],
          })),
        },
      },
    },
  };
  mock.docs.set('architect_worlds/w', {
    createdBy: 'u',
    parentWorldId: null,
    currentSeason: '2025-26',
    asOfDate: '2026-06-05',
    draftInventoryRevision: 0,
    draftSimulationKind: DRAFT_SIMULATION_KIND,
    draftSimulationCatalogue: REAL_DRAFT_REVIEW_PIN.payloadSha256,
    draftSimulationUnresolved: [],
    draftSimulationBranches: 'unconditional',
  });
  for (const team of codes)
    mock.docs.set(`architect_worlds/w/teams/${team}`, {
      teamCode: team,
      roster: [],
      entitlementIds: rows
        .filter((r) => r.originalPick.originalTeam === team)
        .map((r) => r.entitlementId),
    });
  for (const row of rows) {
    const source = {
      id: row.entitlementId,
      kind: 'pick_ownership',
      holderTeam: row.originalPick.originalTeam,
      underlyingPickId: row.originalPick.id,
      seasonYear: row.originalPick.draftYear,
      round: 1,
    };
    mock.docs.set(`architect_baseEntitlements/${row.entitlementId}`, source);
    mock.docs.set(
      `architect_worlds/w/entitlements/${row.entitlementId}`,
      retainedSimulationEntitlement(mock.catalogue, row.entitlementId, source)
    );
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      text: async () => 'synthetic unit catalogue; never the real pin',
    }))
  );
});
describe('retained simulation proposal integration (stipulated inputs, no NBA factual acceptance)', () => {
  it('uses the existing independent components and an exact current-state capability', async () => {
    const result = await prepareRetainedDraftSimulation(args());
    expect(result.status).toBe('prepared');
    if (result.status !== 'prepared') throw new Error('expected prepared');
    const record = requireDraftReviewCapability(result.authority);
    expect(record.scope).toBe('governed-simulation-only');
    expect(record.movements).toEqual([
      {
        entitlementId: id('CHI', 2028),
        originalTeam: 'CHI',
        year: 2028,
        round: 1,
        fromTeam: 'CHI',
        toTeam: 'TOR',
      },
      {
        entitlementId: id('TOR', 2029),
        originalTeam: 'TOR',
        year: 2029,
        round: 1,
        fromTeam: 'TOR',
        toTeam: 'CHI',
      },
    ]);
    expect(record.reviews.every((r) => r.eligible)).toBe(true);
    expect(record.documentSnapshots).toHaveProperty(
      'architect_worlds/w/entitlements/test-CHI-2026'
    );
    expect(() =>
      requireDraftReviewCapability({ ...result.authority })
    ).toThrow();
  });
  it('rejects the adverse conveyance branch and permits a changed proposal retaining the needed alternate year', async () => {
    mock.docs.get('architect_worlds/w').draftSimulationBranches =
      'conditional-2027';
    const result = await prepareSimulationRecord(args());
    expect(result.status).toBe('blocked');
    expect(JSON.stringify(result)).toContain('conveys:unknown-2027/2028');
    expect((await prepareSimulationRecord(args(2030))).status).toBe('ready');
    await expect(prepareSimulationRecord(args(2027))).rejects.toThrow(
      'protection/conveyance'
    );
  });
  it.each([
    'catalogue',
    'lineage',
    'holder',
    'inventory',
    'terms',
    'branches',
    'date',
    'cash',
    'players',
  ])('fails closed on changed %s', async (kind) => {
    const a = args();
    const meta = mock.docs.get('architect_worlds/w');
    if (kind === 'catalogue') meta.draftSimulationCatalogue = 'forged';
    if (kind === 'lineage')
      meta.draftSimulationUnresolved = [{ dependencyId: 'not-waived' }];
    if (kind === 'holder')
      mock.docs.get(
        `architect_worlds/w/entitlements/${id('CHI', 2028)}`
      ).holderTeam = 'TOR';
    if (kind === 'inventory')
      mock.docs.delete(`architect_worlds/w/entitlements/${id('CHI', 2026)}`);
    if (kind === 'terms')
      mock.docs.get(
        `architect_worlds/w/entitlements/${id('CHI', 2028)}`
      ).protectionLadder = [];
    if (kind === 'branches') meta.draftSimulationBranches = 'unknown';
    if (kind === 'date') a.payload.asOfDate = '2026-06-06';
    if (kind === 'cash') a.payload.teams[0].cashSent = 100;
    if (kind === 'players')
      (a.payload.teams[0].sends as unknown[]).push({ id: 'cannot-drop-this' });
    await expect(prepareSimulationRecord(a)).rejects.toThrow();
  });
  it('keeps unresolved actions blocked even when a matching source identity exists', async () => {
    const unresolved = [
      {
        dependencyId: 'test-unresolved',
        entitlementIds: [id('TOR', 2029)],
        actions: ['transfer'],
        reason: 'Dated protection/conveyance evidence is required.',
      },
    ];
    mock.catalogue.data.unresolved = unresolved;
    mock.docs.get('architect_worlds/w').draftSimulationUnresolved = unresolved;
    await expect(prepareSimulationRecord(args())).rejects.toThrow(
      'protection/conveyance'
    );
  });
  it('rejects the production/default boundary before loading any source', async () => {
    mock.enabled = false;
    await expect(prepareRetainedDraftSimulation(args())).rejects.toThrow(
      'protected review'
    );
    await expect(
      advanceConditionalDraftInWorld('w', {
        operationId: 'draft',
        expectedRevision: 0,
        draftYear: 2026,
        positions: { CHI: 10 },
      })
    ).rejects.toThrow('protected draft');
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('complete protected-selection proposal review', () => {
  function installProgram() {
    const program = {
      id: 'conditional-test',
      originalTeam: 'CHI',
      stages: [
        { entitlementId: id('CHI', 2026), year: 2026, protectedThrough: 10 },
        { entitlementId: id('CHI', 2027), year: 2027, protectedThrough: 0 },
      ],
      results: [],
    };
    Object.assign(mock.docs.get('architect_worlds/w'), {
      draftSimulationBranches: 'protection-programs',
      draftConditionalPrograms: [program],
    });
    mock.docs.get(
      `architect_worlds/w/entitlements/${id('CHI', 2026)}`
    ).protectionLadder = [
      {
        year: 2026,
        condition: 'Top 10',
        ifTriggered: 'roll',
        rollToYear: 2027,
      },
      { year: 2027, condition: 'Unprotected', ifTriggered: 'roll' },
    ];
    return program;
  }
  it('permits trading the owned conditional selection right through the existing components', async () => {
    installProgram();
    const proposal = args(2026, 2029);
    Object.assign(
      proposal.payload.teams[0].entitlementsOut[0],
      decorateEntitlementForTrade(
        mock.docs.get(`architect_worlds/w/entitlements/${id('CHI', 2026)}`)
      )
    );
    const result = await prepareRetainedDraftSimulation(proposal);
    expect(result.status).toBe('prepared');
    if (result.status !== 'prepared') throw new Error('expected prepared');
    expect(
      requireDraftReviewCapability(result.authority).assumptions?.programs
    ).toHaveLength(1);
  });
  it('rejects a proposal with one invalid deferral branch despite its valid immediate-conveyance branch', async () => {
    installProgram();
    const proposal = args(2026, 2029);
    const extra = args(2028, 2029).payload.teams[0].entitlementsOut[0];
    proposal.payload.teams[0].entitlementsOut.push(extra);
    const result = await prepareSimulationRecord(proposal);
    expect(result.status).toBe('blocked');
    if (result.status === 'blocked')
      expect(result.reasons.join(' ')).toContain('unknown-2027/2028');
  });
  it('refuses a separately selected reserved fallback entitlement', async () => {
    installProgram();
    await expect(prepareSimulationRecord(args(2027, 2029))).rejects.toThrow(
      /reserved/
    );
  });
  it('refuses missing or inconsistent protection terms', async () => {
    const program = installProgram();
    program.stages[1].protectedThrough = 3;
    await expect(prepareSimulationRecord(args(2026, 2029))).rejects.toThrow(
      /unprotected/
    );
  });
  it('cannot review conditional terms as an unconditional inventory', async () => {
    installProgram();
    mock.docs.get('architect_worlds/w').draftSimulationBranches =
      'unconditional';
    await expect(prepareSimulationRecord(args(2026, 2029))).rejects.toThrow(
      'explicit governed review mode'
    );
  });
  it('keeps unresolved fallback evidence blocked', async () => {
    installProgram();
    const dependency = {
      dependencyId: 'fallback-evidence',
      entitlementIds: [id('CHI', 2027)],
      actions: ['conveyance'],
      reason: 'Missing fallback terms',
    };
    mock.catalogue.data.unresolved = [dependency];
    mock.docs.get('architect_worlds/w').draftSimulationUnresolved = [
      dependency,
    ];
    await expect(prepareSimulationRecord(args(2026, 2029))).rejects.toThrow(
      'unresolved evidence dependency'
    );
  });
});
