import { loadConditionalWorld } from '@/features/architect/utils/draftReview/conditionalWorld';
import { swapAssets } from '@/features/architect/utils/draftReview/swapAssets';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { REAL_DRAFT_REVIEW_PIN } from '@/features/architect/utils/draftPickRealReviewPin';
import {
  DRAFT_SIMULATION_KIND,
  retainedSimulationEntitlement,
} from '@/features/architect/utils/draftReview/simulationInventory';
import { prepareSimulationRecord } from '@/features/architect/utils/draftReview/simulationReview';
import { decorateEntitlementForTrade } from '@/features/architect/utils/entitlements/entitlementTerms';
import { advanceConditionalDraftInWorld } from '@/features/architect/utils/seasonManager.conditionalDraft';
import { mutationSnapshotDigest } from '@/features/architect/utils/mutationPipeline.snapshotDigest';
import {
  prepareRetainedDraftSimulation,
  requireDraftReviewCapability,
} from '@/features/architect/utils/draftReview/capability';
import { QUALIFIED_JUNE5_DRAFT_HORIZON as horizon } from '@/features/architect/utils/draftReview/horizon';
import { LIVE_GOVERNED_TRADE_SALARY_AUTHORITY } from '@/features/architect/utils/tradeContext/tradeContext.payloadNormalization';

const mock = vi.hoisted(() => ({
  docs: new Map<string, any>(),
  catalogue: null as any,
  enabled: true,
}));
vi.mock('@/firebaseConfig', () => ({
  db: {},
  auth: { currentUser: { uid: 'u', getIdToken: async () => 'test' } },
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
  loadStateForMutation: async (
    _world: string,
    _kind: string,
    payload: any
  ) => ({
    teams: payload.teams.map(({ teamCode }: any) => ({
      teamCode,
      team: mock.docs.get(`architect_worlds/w/teams/${teamCode}`),
    })),
  }),
}));
vi.mock('firebase/firestore', () => ({
  serverTimestamp: () => 'test-server-time',
  runTransaction: async (_db: unknown, callback: any) => {
    const writes: (() => void)[] = [];
    const result = await callback({
      get: async (ref: any) => ({
        exists: () => mock.docs.has(ref.path),
        data: () => structuredClone(mock.docs.get(ref.path)),
      }),
      update: (ref: any, value: any) =>
        writes.push(() =>
          mock.docs.set(ref.path, { ...mock.docs.get(ref.path), ...value })
        ),
      set: (ref: any, value: any) =>
        writes.push(() => mock.docs.set(ref.path, structuredClone(value))),
    });
    writes.forEach((write) => write());
    return result;
  },
  doc: (base: any, ...parts: string[]) => ({
    path: [...(base.path ? [base.path] : []), ...parts].join('/'),
  }),
  collection: (base: any, ...parts: string[]) => ({
    path: [...(base.path ? [base.path] : []), ...parts].join('/'),
  }),
  getDoc: async (ref: any) => ({
    id: ref.path.split('/').at(-1),
    ref,
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
function routingArgs() {
  mock.docs.get('architect_worlds/w').draftSimulationTeams = [
    'CHI',
    'TOR',
    'SAS',
  ];
  const a = args();
  const extra = {
    ...a.payload.teams[0].entitlementsOut[0],
    id: id('CHI', 2030),
    underlyingPickId: 'CHI_2030_1st',
    seasonYear: 2030,
    toTeamId: 'SAS',
  };
  a.payload.teams[0].entitlementsOut.push(extra);
  const outgoing = [
    {
      ...extra,
      id: id('SAS', 2029),
      underlyingPickId: 'SAS_2029_1st',
      seasonYear: 2029,
      toTeamId: 'TOR',
    },
  ];
  a.payload.teams.push({
    ...a.payload.teams[1],
    teamCode: 'SAS',
    entitlementsOut: outgoing,
    outgoingEntitlements: outgoing,
  });
  return a;
}
beforeEach(() => {
  mock.docs.clear();
  mock.enabled = true;
  const rows = ['CHI', 'TOR', 'SAS'].flatMap((team) =>
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
  it('rejects duplicate or out-of-contract team counts', async () => {
    const metadata = mock.docs.get('architect_worlds/w');
    for (const scope of [
      ['CHI', 'CHI'],
      ['CHI', 'TOR', 'SAS', 'BKN'],
    ]) {
      metadata.draftSimulationTeams = scope;
      await expect(
        loadConditionalWorld('w', { allowUnconditionalInventory: true })
      ).rejects.toThrow(/distinct league teams/);
    }
  });
  it('admits a three-team inventory without requiring players', async () => {
    mock.docs.get('architect_worlds/w').draftSimulationTeams = [
      'CHI',
      'TOR',
      'SAS',
    ];
    expect(
      (await loadConditionalWorld('w', { allowUnconditionalInventory: true }))
        .teams.SAS
    ).toBeDefined();
  });
  it('evaluates split destinations as one complete trade, independent of participant order', async () => {
    const a = routingArgs();
    const result = await prepareSimulationRecord(a);
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error(JSON.stringify(result));
    expect(
      result.record.movements
        .filter((m) => m.fromTeam === 'CHI')
        .map((m) => m.toTeam)
    ).toEqual(['TOR', 'SAS']);
    expect(result.record.reviews).toHaveLength(3);
    for (const review of result.record.reviews)
      expect(review.eligible).toBe(true);
    const before = JSON.stringify([...mock.docs]);
    a.payload.teams.reverse();
    a.payload.teams.forEach((s) => s.entitlementsOut.reverse());
    const reordered = await prepareSimulationRecord(a);
    expect(reordered.status).toBe('ready');
    if (reordered.status !== 'ready') throw new Error('expected ready');
    expect(
      [...reordered.record.movements].sort((a, b) =>
        a.entitlementId.localeCompare(b.entitlementId)
      )
    ).toEqual(
      [...result.record.movements].sort((a, b) =>
        a.entitlementId.localeCompare(b.entitlementId)
      )
    );
    expect(JSON.stringify([...mock.docs])).toBe(before);
  });
  it.each([
    'self',
    'missing-route',
    'outside',
    'duplicate',
    'neutral',
    'fourth',
    'third-stepien',
  ])('rejects the complete routing proposal for %s', async (mode) => {
    const a = routingArgs();
    if (mode === 'self') a.payload.teams[0].entitlementsOut[1].toTeamId = 'CHI';
    if (mode === 'missing-route')
      delete (a.payload.teams[0].entitlementsOut[1] as any).toTeamId;
    if (mode === 'outside')
      a.payload.teams[0].entitlementsOut[1].toTeamId = 'BOS';
    if (mode === 'duplicate')
      a.payload.teams[0].entitlementsOut.push(
        a.payload.teams[0].entitlementsOut[0]
      );
    if (mode === 'neutral') a.payload.teams[2].entitlementsOut.splice(0);
    if (mode === 'fourth')
      a.payload.teams.push({ ...a.payload.teams[2], teamCode: 'BOS' });
    if (mode === 'third-stepien') {
      const pick = {
        ...a.payload.teams[2].entitlementsOut[0],
        id: id('SAS', 2028),
        underlyingPickId: 'SAS_2028_1st',
        seasonYear: 2028,
      };
      a.payload.teams[2].entitlementsOut.push(pick);
      // Sending 2028 and 2029 leaves a missing 2027/2028 witness only if 2027 also leaves.
      a.payload.teams[2].entitlementsOut.push({
        ...pick,
        id: id('SAS', 2027),
        underlyingPickId: 'SAS_2027_1st',
        seasonYear: 2027,
      });
    }
    const before = JSON.stringify([...mock.docs]);
    const result = await prepareSimulationRecord(a).catch((e) => ({
      status: 'error',
      reason: e.message,
    }));
    expect(result.status).not.toBe('ready');
    expect(JSON.stringify([...mock.docs])).toBe(before);
  });
  it('projects original holdings only with explicit read-only admission and still rejects corrupt inventories', async () => {
    await expect(loadConditionalWorld('w')).rejects.toThrow(
      /owned conditional/
    );
    const state = await loadConditionalWorld('w', {
      allowUnconditionalInventory: true,
    });
    expect(swapAssets(state, 'CHI', 2026)).toMatchObject({
      status: 'available',
      firstRoundCount: 7,
    });
    mock.docs.get(
      `architect_worlds/w/entitlements/${id('CHI', 2028)}`
    ).holderTeam = 'TOR';
    await expect(
      loadConditionalWorld('w', { allowUnconditionalInventory: true })
    ).rejects.toThrow();
    mock.enabled = false;
    await expect(
      loadConditionalWorld('w', { allowUnconditionalInventory: true })
    ).rejects.toThrow(/protected/);
  });
  it.each([1, 2, 3, 5])(
    'accounts for %i players and a first together, fencing every player document destination',
    async (count) => {
      const a: any = args();
      const team = mock.docs.get('architect_worlds/w/teams/CHI');
      team.roster = ['player'];
      team.players = [
        {
          id: 'player',
          playerId: 'player',
          contract: {},
          governedTradeSalaryBasis: {
            authorityVersion: 1,
            status: 'ready',
            worldId: 'w',
            teamId: 'CHI',
            playerId: 'player',
            contractId: 'contract',
            asOfDate: '2026-06-05',
            salaryCapYear: 2026,
            method: 'postseason-lesser-of',
            currentSalary: 5_000_000,
            outgoingSalary: 5_000_000,
            incomingSalary: 5_000_000,
            poisonPillIncomingSalary: null,
            canonLeafIds: ['CBA2-A03.3'],
            reasons: [],
            proof: {
              ledgerId: 'l',
              ledgerVersion: 1,
              contractVersion: 1,
              stateDigest: 'fnv1a64:aaaaaaaaaaaaaaaa',
              calendarRecordId: 'calendar',
              calendarRecordVersion: 1,
              calendarSourceRecordId: 'source',
              calendarSourceRecordVersion: 1,
            },
          },
        },
      ];
      for (let i = 1; i < count; i++) {
        const p = structuredClone(team.players[0]);
        p.id = p.playerId = `player-${i}`;
        p.governedTradeSalaryBasis.playerId = p.id;
        p.governedTradeSalaryBasis.contractId = `contract-${i}`;
        team.players.push(p);
        team.roster.push(p.id);
      }
      Object.defineProperty(team, LIVE_GOVERNED_TRADE_SALARY_AUTHORITY, {
        value: true,
      });
      a.payload.teams[0].sends = team.players.map((p: any) => ({
        id: p.id,
        tradeTo: 'TOR',
      }));
      a.payload.teams[0].salaryMatchingElection = {
        version: 1,
        path: count > 1 ? 'AGGREGATED_STANDARD_TPE' : 'STANDARD_TPE',
        postAssignmentApronTeamSalary: 170000000,
        tradedPlayerPreTradeSalaries: Object.fromEntries(
          team.players.map((p: any) => [p.id, 5000000])
        ),
      };
      a.payload.teams[1].salaryMatchingElection = {
        version: 1,
        path: 'STANDARD_TPE',
        postAssignmentApronTeamSalary: 170000000,
        tradedPlayerPreTradeSalaries: {},
      };
      const result = await prepareRetainedDraftSimulation(a);
      expect(result.status).toBe('prepared');
      if (result.status !== 'prepared') throw new Error('expected prepared');
      const record = requireDraftReviewCapability(result.authority);
      expect(record.reviews.every((r) => r.eligible)).toBe(true);
      expect(record.payloadSnapshot).toContain('player');
      expect(
        record.documentSnapshots['architect_worlds/w/teams/CHI/players/player']
      ).toBeNull();
      expect(
        record.documentSnapshots['architect_worlds/w/teams/TOR/players/player']
      ).toBeNull();
      for (const p of team.players) {
        expect(record.payloadSnapshot).toContain(p.id);
        for (const code of ['CHI', 'TOR'])
          expect(
            record.documentSnapshots[
              `architect_worlds/w/teams/${code}/players/${p.id}`
            ]
          ).toBeNull();
      }
      mock.docs.set('architect_worlds/w/teams/TOR/players/player', {
        conflicting: 'destination',
      });
      const again = await prepareRetainedDraftSimulation(a);
      if (again.status !== 'prepared') throw new Error('expected prepared');
      expect(
        requireDraftReviewCapability(again.authority).documentSnapshots[
          'architect_worlds/w/teams/TOR/players/player'
        ]
      ).toContain('destination');
    }
  );
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
  it('admits an ordinary Contract with firsts in the legacy 2027 conditional family and keeps its Stepien branches (V1 B4)', async () => {
    mock.docs.get('architect_worlds/w').draftSimulationBranches =
      'conditional-2027';
    const withPlayer = (year?: number) => {
      const a: any = year === undefined ? args() : args(year);
      const team = mock.docs.get('architect_worlds/w/teams/CHI');
      team.roster = ['player'];
      team.players = [
        {
          id: 'player',
          playerId: 'player',
          contract: {},
          governedTradeSalaryBasis: {
            authorityVersion: 1,
            status: 'ready',
            worldId: 'w',
            teamId: 'CHI',
            playerId: 'player',
            contractId: 'contract',
            asOfDate: '2026-06-05',
            salaryCapYear: 2026,
            method: 'postseason-lesser-of',
            currentSalary: 5_000_000,
            outgoingSalary: 5_000_000,
            incomingSalary: 5_000_000,
            poisonPillIncomingSalary: null,
            canonLeafIds: ['CBA2-A03.3'],
            reasons: [],
            proof: {
              ledgerId: 'l',
              ledgerVersion: 1,
              contractVersion: 1,
              stateDigest: 'fnv1a64:aaaaaaaaaaaaaaaa',
              calendarRecordId: 'calendar',
              calendarRecordVersion: 1,
              calendarSourceRecordId: 'source',
              calendarSourceRecordVersion: 1,
            },
          },
        },
      ];
      Object.defineProperty(team, LIVE_GOVERNED_TRADE_SALARY_AUTHORITY, {
        value: true,
        configurable: true,
      });
      a.payload.teams[0].sends = [{ id: 'player', tradeTo: 'TOR' }];
      a.payload.teams[0].salaryMatchingElection = {
        version: 1,
        path: 'STANDARD_TPE',
        postAssignmentApronTeamSalary: 170000000,
        tradedPlayerPreTradeSalaries: { player: 5000000 },
      };
      a.payload.teams[1].salaryMatchingElection = {
        version: 1,
        path: 'STANDARD_TPE',
        postAssignmentApronTeamSalary: 170000000,
        tradedPlayerPreTradeSalaries: {},
      };
      return a;
    };
    // A player does not change the conditional Stepien result.
    const adverse = await prepareSimulationRecord(withPlayer());
    expect(adverse.status).toBe('blocked');
    expect(JSON.stringify(adverse)).toContain('conveys:unknown-2027/2028');
    const ready = await prepareSimulationRecord(withPlayer(2030));
    expect(ready.status).toBe('ready');
    if (ready.status !== 'ready') throw new Error('expected ready');
    expect(ready.record.assumptions.branchMode).toBe('conditional-2027');
    expect(ready.record.payloadSnapshot).toContain('player');
    expect(ready.record.reviews.every((r) => r.eligible)).toBe(true);
    // The conditional 2027 first itself still cannot be traded.
    await expect(prepareSimulationRecord(withPlayer(2027))).rejects.toThrow(
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
  it.each([10, 11])(
    'indexes draft outcome %i for a third participant without changing its holdings',
    async (position) => {
      installProgram();
      const meta = mock.docs.get('architect_worlds/w');
      meta.draftSimulationTeams = ['CHI', 'TOR', 'SAS'];
      meta.draftSimulationCalendar = [{ year: 2026, date: '2026-06-30' }];
      const key = id('CHI', 2026);
      mock.docs.get(`architect_worlds/w/entitlements/${key}`).holderTeam =
        'TOR';
      const chi = mock.docs.get('architect_worlds/w/teams/CHI');
      chi.entitlementIds = chi.entitlementIds.filter(
        (id: string) => id !== key
      );
      mock.docs.get('architect_worlds/w/teams/TOR').entitlementIds.push(key);
      const third = structuredClone(
        mock.docs.get('architect_worlds/w/teams/SAS')
      );
      const state = await loadConditionalWorld('w');
      await advanceConditionalDraftInWorld('w', {
        operationId: 'draft',
        expectedRevision: 0,
        draftYear: 2026,
        positions: { CHI: position },
        expectedDraftStateDigest: mutationSnapshotDigest(state.snapshots),
      });
      const event = mock.docs.get(
        'architect_worlds/w/events/conditionalDraft__2026'
      );
      expect(event.teamCodes).toEqual(['CHI', 'TOR', 'SAS']);
      expect(
        event.metadata.conditionalDraftReceipt.after[0].results[0]
      ).toEqual({
        year: 2026,
        position,
        outcome: position === 10 ? 'deferred' : 'conveyed',
      });
      expect(mock.docs.get('architect_worlds/w/teams/SAS')).toEqual(third);
      expect(mock.docs.get('architect_worlds/w').lastModifiedTeams).toEqual([
        'CHI',
        'TOR',
      ]);
    }
  );
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
  it('checks both split destinations together against all conditional outcomes', async () => {
    installProgram();
    const a = routingArgs();
    const first = a.payload.teams[0].entitlementsOut[0];
    Object.assign(first, {
      id: id('CHI', 2026),
      underlyingPickId: 'CHI_2026_1st',
      seasonYear: 2026,
    });
    Object.assign(a.payload.teams[0].entitlementsOut[1], {
      id: id('CHI', 2028),
      underlyingPickId: 'CHI_2028_1st',
      seasonYear: 2028,
    });
    const blocked = await prepareSimulationRecord(a);
    expect(blocked.status).toBe('blocked');
    expect(JSON.stringify(blocked)).toContain('unknown-2027/2028');
    a.payload.teams[1].entitlementsOut.push({
      ...args(2026, 2027).payload.teams[1].entitlementsOut[0],
    });
    // TOR's incoming 2027 first protects CHI in the adverse fallback outcome.
    expect((await prepareSimulationRecord(a)).status).toBe('ready');
  });
  it('checks the original obligor when a held conditional right is retraded by other teams', async () => {
    installProgram();
    mock.docs.get('architect_worlds/w').draftSimulationTeams = [
      'CHI',
      'TOR',
      'SAS',
    ];
    for (const year of [2026, 2028]) {
      const key = id('CHI', year);
      mock.docs.get(`architect_worlds/w/entitlements/${key}`).holderTeam =
        'TOR';
      const chi = mock.docs.get('architect_worlds/w/teams/CHI');
      chi.entitlementIds = chi.entitlementIds.filter(
        (id: string) => id !== key
      );
      mock.docs.get('architect_worlds/w/teams/TOR').entitlementIds.push(key);
    }
    const a = args(2026, 2029);
    a.payload.teams[0].teamCode = 'TOR';
    a.payload.teams[0].entitlementsOut[0].toTeamId = 'SAS';
    a.payload.teams[1].teamCode = 'SAS';
    Object.assign(a.payload.teams[1].entitlementsOut[0], {
      id: id('SAS', 2029),
      underlyingPickId: 'SAS_2029_1st',
      toTeamId: 'TOR',
    });
    const result = await prepareSimulationRecord(a);
    expect(result.status).toBe('blocked');
    expect(JSON.stringify(result)).toContain('CHI: stepien:');
    expect(JSON.stringify(result)).toContain('unknown-2027/2028');
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
  it.each(['valid', 'missing', 'operation', 'terms', 'date', 'catalogue'])(
    'requires matching committed conditional receipts: %s',
    async (kind) => {
      const program = installProgram();
      const after = {
        ...program,
        results: [{ year: 2026, position: 11, outcome: 'conveyed' }],
      };
      Object.assign(mock.docs.get('architect_worlds/w'), {
        asOfDate: '2026-06-30',
        draftSimulationCalendar: [{ year: 2026, date: '2026-06-30' }],
        draftConditionalPrograms: [after],
      });
      const entitlement = mock.docs.get(
        `architect_worlds/w/entitlements/${id('CHI', 2026)}`
      );
      delete entitlement.protectionLadder;
      const receipt = {
        scope: 'governed-simulation-only',
        worldId: 'w',
        operationId: 'resolved',
        catalogueSha256: REAL_DRAFT_REVIEW_PIN.payloadSha256,
        before: [structuredClone(program)],
        after: [structuredClone(after)],
        movements: [],
        positions: { CHI: 11 },
        draftYear: 2026,
        date: '2026-06-30',
      };
      if (kind === 'operation') receipt.operationId = 'forged';
      if (kind === 'terms') receipt.before[0].stages[0].protectedThrough = 9;
      if (kind === 'date') receipt.date = '2026-06-29';
      if (kind === 'catalogue') receipt.catalogueSha256 = 'a'.repeat(64);
      if (kind !== 'missing')
        mock.docs.set('architect_worlds/w/events/conditionalDraft__2026', {
          operationId: 'resolved',
          metadata: { conditionalDraftReceipt: receipt },
        });
      if (kind === 'valid')
        expect((await loadConditionalWorld('w')).snapshots).toHaveProperty(
          'architect_worlds/w/events/conditionalDraft__2026'
        );
      else
        await expect(loadConditionalWorld('w')).rejects.toThrow(
          /committed draft receipts/
        );
    }
  );
});
