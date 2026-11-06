import { describe, it, expect } from 'vitest';
import {
  DraftNativePoolProgramZ,
  type DraftNativePoolProgram,
} from '@/schemas/draftNativePool';
import {
  resolveDraftClaimProgram,
  swapProgram,
} from '@/features/architect/utils/draftReview/swapProgram';
import { DraftSwapReceiptZ } from '@/schemas/draftSwapReceipt';
import { deriveDraftAssetDelta } from '@/features/architect/comparison/deriveDraftAssetDelta';
import { REAL_DRAFT_REVIEW_PIN } from '@/features/architect/utils/draftPickRealReviewPin';
import type { SimulationCatalogue } from '@/features/architect/utils/draftReview/simulationInventory';
import type { ComparisonEventRow } from '@/features/architect/comparison/deriveComparisonViewModel';

// Independent software analogue. The three selections are not three new rights.
const program: DraftNativePoolProgram = {
  kind: 'native-ranked-pool-v1',
  year: 2029,
  slots: ['AAA', 'BBB', 'CCC'].map((originalTeam) => ({
    entitlementId: originalTeam,
    originalTeam,
    holderTeam: originalTeam,
    protectedThrough: 0,
  })),
  nativePool: {
    clauseIds: ['native-pool'],
    sourceRefs: ['software-terms'],
    dependencyIds: ['pool-terms'],
    archivalIds: ['archival'],
    beneficiaryTeam: 'DDD',
    residualTeam: 'EEE',
    ranks: [1, 2],
    residualRank: 3,
    priority: 'ranked-claim-before-residual',
    conditions: 'all-three-unprotected',
    election: 'exercise-only',
  },
  result: null,
};
function input() {
  const records = program.slots.map((s) => ({
    entitlementId: s.entitlementId,
    role: 'original',
    originalPick: {
      id: `${s.originalTeam}_2029_1st`,
      originalTeam: s.originalTeam,
      draftYear: 2029,
      round: 1,
    },
  }));
  const catalogue = {
    data: {
      records: [
        ...records,
        {
          entitlementId: 'archival',
          role: 'generated-alias',
          poolIds: ['native-pool'],
        },
      ],
      unresolved: [],
    },
    release: {
      foundation: {
        retained: {
          dependencies: [
            { id: 'pool-terms', entitlementIds: ['AAA', 'BBB', 'CCC'] },
          ],
        },
      },
    },
  } as unknown as SimulationCatalogue;
  const entitlements: Record<
    string,
    Record<string, unknown>
  > = Object.fromEntries(
    program.slots.map((s) => [
      s.entitlementId,
      {
        kind: 'pick_ownership',
        holderTeam: s.holderTeam,
        underlyingPickId: `${s.originalTeam}_2029_1st`,
      },
    ])
  );
  entitlements.archival = {
    kind: 'swap_right',
    holderTeam: 'AAA',
    poolUnderlyingPickIds: records.map((r) => r.originalPick.id),
  };
  return { catalogue, entitlements };
}
const cases = [
  [['AAA', 'BBB', 'CCC'], { AAA: 'DDD', BBB: 'DDD', CCC: 'EEE' }],
  [['AAA', 'CCC', 'BBB'], { AAA: 'DDD', BBB: 'EEE', CCC: 'DDD' }],
  [['BBB', 'AAA', 'CCC'], { AAA: 'DDD', BBB: 'DDD', CCC: 'EEE' }],
  [['BBB', 'CCC', 'AAA'], { AAA: 'EEE', BBB: 'DDD', CCC: 'DDD' }],
  [['CCC', 'AAA', 'BBB'], { AAA: 'DDD', BBB: 'EEE', CCC: 'DDD' }],
  [['CCC', 'BBB', 'AAA'], { AAA: 'EEE', BBB: 'DDD', CCC: 'DDD' }],
] as const;
describe('native mixed rank claims', () => {
  it.each(cases)(
    'allocates ranking %j without changing position or minting aliases',
    (order, expected) => {
      const positions = Object.fromEntries(
        order.map((t, i) => [t, [3, 14, 27][i]])
      );
      const before = structuredClone(program);
      const result = resolveDraftClaimProgram(program, positions, {
        exercisePool: true,
      });
      expect(result.result?.allocation).toEqual(expected);
      expect(result.result?.positions).toEqual(positions);
      expect(Object.keys(result.result!.allocation).sort()).toEqual([
        'AAA',
        'BBB',
        'CCC',
      ]);
      expect(program).toEqual(before);
    }
  );
  it.each([
    { AAA: 1, BBB: 2 },
    { AAA: 1, BBB: 2, CCC: 2 },
    { AAA: 0, BBB: 2, CCC: 30 },
    { AAA: 1, BBB: 2, CCC: 31 },
    { AAA: 1, BBB: 2, CCC: 2.5 },
    { AAA: 1, BBB: 2, CCC: 3, DDD: 4 },
  ])('rejects incomplete/tied/invalid positions %j', (positions) => {
    expect(() =>
      resolveDraftClaimProgram(program, positions, { exercisePool: true })
    ).toThrow();
  });
  it.each([
    {},
    { exercisePool: false },
    { exercisePool: true, archival: true },
  ])('does not invent waiver or alias elections %j', (elections) => {
    expect(() =>
      resolveDraftClaimProgram(program, { AAA: 1, BBB: 2, CCC: 3 }, elections)
    ).toThrow(/exercise/);
  });
  it('requires complete protection, priority, recipient and evidence terms', () => {
    for (const key of [
      'clauseIds',
      'sourceRefs',
      'dependencyIds',
      'conditions',
      'priority',
      'election',
      'beneficiaryTeam',
    ] as const) {
      const p = structuredClone(program);
      Reflect.deleteProperty(p.nativePool, key);
      expect(() => DraftNativePoolProgramZ.parse(p)).toThrow();
    }
    expect(() =>
      DraftNativePoolProgramZ.parse({
        ...program,
        slots: program.slots.map((s) => ({ ...s, protectedThrough: 1 })),
      })
    ).toThrow();
    expect(() =>
      DraftNativePoolProgramZ.parse({
        ...program,
        nativePool: { ...program.nativePool, ranks: [1, 3] },
      })
    ).toThrow();
  });
  it('preserves archival records but rejects live competing claims and unresolved originals', () => {
    const { catalogue, entitlements } = input();
    expect(swapProgram(program, catalogue, entitlements)).toEqual(program);
    const before = structuredClone(entitlements);
    const native = catalogue.data.records.find(
      (r) => r.entitlementId === 'archival'
    )!;
    native.role = 'source-native';
    expect(() => swapProgram(program, catalogue, entitlements)).toThrow(
      /competing/
    );
    native.role = 'generated-alias';
    catalogue.data.unresolved.push({
      dependencyId: 'missing-protection',
      entitlementIds: ['AAA'],
      actions: ['allocate'],
      occurrenceIds: [],
      reason: 'missing',
      missingSource: 'missing',
      sourceRefs: [],
    });
    expect(() => swapProgram(program, catalogue, entitlements)).toThrow(
      /unresolved/
    );
    expect(entitlements).toEqual(before);
  });
  it('refuses unknown lineage, incomplete coverage and an archival record as a selection', () => {
    const { catalogue, entitlements } = input();
    expect(() =>
      swapProgram(
        { ...program, nativePool: { ...program.nativePool, archivalIds: [] } },
        catalogue,
        entitlements
      )
    ).toThrow(/disposition/);
    expect(() =>
      swapProgram(
        {
          ...program,
          nativePool: { ...program.nativePool, dependencyIds: ['unknown'] },
        },
        catalogue,
        entitlements
      )
    ).toThrow(/lineage/);
    expect(() =>
      swapProgram(
        {
          ...program,
          nativePool: { ...program.nativePool, clauseIds: ['unknown'] },
        },
        catalogue,
        entitlements
      )
    ).toThrow();
    expect(() =>
      swapProgram(
        {
          ...program,
          slots: program.slots.map((s, i) =>
            i ? s : { ...s, entitlementId: 'archival' }
          ),
        },
        catalogue,
        entitlements
      )
    ).toThrow();
  });
  it('detects forged saved outcomes, wrong holders and repeated resolution', () => {
    const { catalogue, entitlements } = input();
    const resolved = resolveDraftClaimProgram(
      program,
      { AAA: 1, BBB: 2, CCC: 3 },
      { exercisePool: true }
    );
    for (const [id, holder] of Object.entries(resolved.result!.allocation))
      entitlements[id].holderTeam = holder;
    expect(swapProgram(resolved, catalogue, entitlements)).toEqual(resolved);
    expect(() =>
      resolveDraftClaimProgram(
        resolved,
        { AAA: 1, BBB: 2, CCC: 3 },
        { exercisePool: true }
      )
    ).toThrow(/already/);
    resolved.result!.allocation.CCC = 'DDD';
    entitlements.CCC.holderTeam = 'DDD';
    expect(() => swapProgram(resolved, catalogue, entitlements)).toThrow(
      /contradicts/
    );
    entitlements.AAA.holderTeam = 'EEE';
    expect(() => swapProgram(program, catalogue, entitlements)).toThrow(
      /ownership/
    );
  });
  it('uses the existing receipt/Compare path for recipients and original teams', () => {
    const after = resolveDraftClaimProgram(
      program,
      { AAA: 3, BBB: 14, CCC: 27 },
      { exercisePool: true }
    );
    const movements = program.slots.map((s) => ({
      entitlementId: s.entitlementId,
      originalTeam: s.originalTeam,
      year: 2029,
      round: 1 as const,
      fromTeam: s.holderTeam,
      toTeam: after.result!.allocation[s.entitlementId],
      assetKind: 'pick_ownership' as const,
    }));
    const receipt = DraftSwapReceiptZ.parse({
      scope: 'governed-simulation-only',
      worldId: 'world',
      operationId: 'op',
      catalogueSha256: REAL_DRAFT_REVIEW_PIN.payloadSha256,
      before: program,
      after,
      movements,
      draftYear: 2029,
      date: '2029-06-30',
    });
    const row = {
      mutationType: 'draftConveyance',
      raw: { operationId: 'op', metadata: { swapDraftReceipt: receipt } },
    } as ComparisonEventRow;
    expect(
      deriveDraftAssetDelta([row], 'world', 'DDD')?.additions
    ).toHaveLength(2);
    expect(
      deriveDraftAssetDelta([row], 'world', 'EEE')?.additions
    ).toHaveLength(1);
    expect(deriveDraftAssetDelta([row], 'world', 'AAA')?.removals).toHaveLength(
      1
    );
    expect(
      deriveDraftAssetDelta([row], 'world', 'DDD')?.restrictions
    ).toContain('AAA 2029 first: final pick 3 · held by DDD');
    const forged = structuredClone(row);
    Reflect.get(
      forged.raw!.metadata!,
      'swapDraftReceipt'
    ).after.result.positions.AAA = 29;
    expect(deriveDraftAssetDelta([forged], 'world', 'DDD')).toBeNull();
  });
});

// Subsequent transactions retain the original resolution, while ownership advances.
import {
  nativeSelectionHolders,
  nativeTradeDate,
  nativeRetainedWitnesses,
} from '@/features/architect/utils/draftReview/nativeTrading';
import type {
  NativeDraftLifecycle,
  NativeSelectionTransfer,
} from '@/schemas/draftNativeTrading';
import { DraftReviewMutationReceiptZ } from '@/schemas/draftPickReviewMutation';
const lifecycle: NativeDraftLifecycle = {
  kind: 'governed-pre-draft-native-selections-v1',
  claimsEffectiveDate: '2029-06-20',
  selections: 'unconsumed-before-draft',
  tradingWindow: {
    kind: 'governed-test-seven-draft-window',
    asOf: '2029-06-20T12:00:00Z',
    previousDraftCompletedAt: '2028-06-30T23:59:59Z',
    firstFutureDraftStartsAt: '2029-06-30T00:00:00Z',
    firstYear: 2029,
    lastYear: 2035,
  },
  retainedFirstIds: [],
  softwareRetainedFirsts: [],
};
function resolved() {
  return resolveDraftClaimProgram(
    program,
    { AAA: 3, BBB: 14, CCC: 27 },
    { exercisePool: true }
  );
}
function transfer(operationId = 'trade-one'): NativeSelectionTransfer {
  return {
    operationId,
    asOfDate: '2029-06-21',
    movements: [
      {
        entitlementId: 'AAA',
        assetKind: 'pick_ownership',
        originalTeam: 'AAA',
        year: 2029,
        round: 1,
        fromTeam: 'DDD',
        toTeam: 'EEE',
      },
      {
        entitlementId: 'CCC',
        assetKind: 'pick_ownership',
        originalTeam: 'CCC',
        year: 2029,
        round: 1,
        fromTeam: 'EEE',
        toTeam: 'DDD',
      },
    ],
  };
}
function tradeReceipt(
  p = resolved(),
  history: NativeSelectionTransfer[] = [],
  move = transfer(),
  admittedLifecycle = lifecycle
) {
  return DraftReviewMutationReceiptZ.parse({
    scope: 'governed-simulation-only',
    worldId: 'world',
    operationId: move.operationId,
    releaseId: 'software-release',
    releaseSha256: REAL_DRAFT_REVIEW_PIN.payloadSha256,
    asOfDate: move.asOfDate,
    movements: move.movements,
    assumptionSha256: 'a'.repeat(64),
    assumptions: {
      kind: 'governed-test-assumptions-v1',
      catalogueSha256: REAL_DRAFT_REVIEW_PIN.payloadSha256,
      proposalSha256: 'b'.repeat(64),
      stateDigest: 'digest',
      asOf: `${move.asOfDate}T12:00:00Z`,
      branchMode: 'native-selections',
      nativeTrade: {
        program: p,
        lifecycle: admittedLifecycle,
        resolutionOperationId: 'resolve',
        transfers: history,
      },
      tradingWindow: nativeTradeDate(
        p,
        admittedLifecycle,
        history,
        move.asOfDate
      ),
      ownership: 'stipulated-for-software-tests',
      otherHoldings: 'unknown-not-empty',
    },
  });
}
describe('resolved native selections remain distinct from their claim history', () => {
  it('authenticates composed-original receipt history and reports the outside-pool original team without inventing a final position', () => {
    const p = resolved();
    const composed = {
      ...lifecycle,
      retainedFirstIds: ['independent'],
      originalSelections: [
        {
          entitlementId: 'independent',
          originalTeam: 'FFF',
          year: 2031,
          holderTeam: 'EEE',
        },
      ],
    };
    const next = transfer();
    next.movements[1] = {
      ...next.movements[1],
      entitlementId: 'independent',
      originalTeam: 'FFF',
      year: 2031,
    };
    const r = tradeReceipt(p, [], next, composed);
    const resolution = DraftSwapReceiptZ.parse({
      scope: 'governed-simulation-only',
      worldId: 'world',
      operationId: 'resolve',
      catalogueSha256: REAL_DRAFT_REVIEW_PIN.payloadSha256,
      before: program,
      after: p,
      movements: program.slots.map((s) => ({
        entitlementId: s.entitlementId,
        originalTeam: s.originalTeam,
        year: 2029,
        round: 1,
        assetKind: 'pick_ownership',
        fromTeam: s.holderTeam,
        toTeam: p.result!.allocation[s.entitlementId],
      })),
      draftYear: 2029,
      date: '2029-06-20',
      nativeLifecycle: composed,
    });
    const rows = [
      {
        mutationType: 'draftConveyance',
        raw: {
          operationId: 'resolve',
          metadata: { swapDraftReceipt: resolution },
        },
      },
      {
        mutationType: 'executeTrade',
        raw: {
          operationId: next.operationId,
          metadata: { draftReviewReceipt: r },
        },
      },
    ] as ComparisonEventRow[];
    expect(deriveDraftAssetDelta(rows, 'world', 'FFF')?.restrictions).toContain(
      'FFF 2031 first: held by DDD'
    );
    expect(
      deriveDraftAssetDelta(rows, 'world', 'DDD')?.additions.map(
        (a) => a.entitlementId
      )
    ).toContain('independent');
    const forged = structuredClone(rows);
    Reflect.get(
      forged[0].raw!.metadata!,
      'swapDraftReceipt'
    ).nativeLifecycle.originalSelections[0].holderTeam = 'DDD';
    expect(deriveDraftAssetDelta(forged, 'world', 'FFF')).toBeNull();
    expect(() => tradeReceipt(p, [], next)).toThrow();
    const altered = structuredClone(r);
    altered.movements[1].year = 2032;
    expect(DraftReviewMutationReceiptZ.safeParse(altered).success).toBe(false);
  });
  it('does not invent a third holder or admit Contracts for the ranked 2029 pool', () => {
    const p = resolved();
    expect([...new Set(Object.values(p.result!.allocation))].sort()).toEqual([
      'DDD',
      'EEE',
    ]);
    const proposed = transfer();
    proposed.movements[1].toTeam = 'FFF';
    proposed.movements.push({
      ...proposed.movements[0],
      entitlementId: 'BBB',
      originalTeam: 'BBB',
      fromTeam: 'FFF',
      toTeam: 'DDD',
    });
    // All three give/receive, but FFF does not own the selection it promises.
    expect(() => nativeSelectionHolders(p, [proposed])).toThrow(
      /current owner/
    );
    const mixed = transfer();
    mixed.playerMovements = [
      {
        playerId: 'ordinary',
        contractId: 'contract',
        fromTeam: 'FFF',
        toTeam: 'DDD',
      },
    ];
    expect(() => nativeSelectionHolders(p, [mixed])).toThrow(
      /admitted 2028 family/
    );
  });
  it('replays multiple transfers, including a slot absent from the later trade, without changing the claim', () => {
    const p = resolved(),
      before = structuredClone(p),
      first = transfer();
    const next = transfer('trade-two');
    next.movements = next.movements.map((m) => ({
      ...m,
      fromTeam: m.toTeam,
      toTeam: m.fromTeam,
    }));
    const holders = nativeSelectionHolders(p, [first, next]);
    expect(holders).toEqual(p.result!.allocation);
    expect(p).toEqual(before);
    const { catalogue, entitlements } = input();
    for (const [id, owner] of Object.entries(
      nativeSelectionHolders(p, [first])
    ))
      entitlements[id].holderTeam = owner;
    expect(swapProgram(p, catalogue, entitlements, [first])).toEqual(p);
    expect(() => swapProgram(p, catalogue, entitlements, [])).toThrow(
      /owner|ownership/
    );
  });
  it.each(['2029-06-19', '2029-06-30', '2029-07-01', '2028-06-21'])(
    'rejects ineligible date %s',
    (date) => {
      expect(() => nativeTradeDate(resolved(), lifecycle, [], date)).toThrow(
        /before|after/
      );
    }
  );
  it('accepts only the pre-draft interval and rejects retrospective replay or old at-draft resolution', () => {
    expect(
      nativeTradeDate(resolved(), lifecycle, [], '2029-06-20').firstYear
    ).toBe(2029);
    expect(
      nativeTradeDate(resolved(), lifecycle, [], '2029-06-29').lastYear
    ).toBe(2035);
    expect(() =>
      nativeTradeDate(resolved(), lifecycle, [transfer()], '2029-06-20')
    ).toThrow();
    expect(() =>
      nativeTradeDate(resolved(), undefined, [], '2029-06-20')
    ).toThrow();
    expect(() =>
      nativeTradeDate(
        resolved(),
        { ...lifecycle, claimsEffectiveDate: '2029-06-30' },
        [],
        '2029-06-30'
      )
    ).toThrow();
  });
  it('rejects stale ownership, archival rights, identity substitution, duplicate writes and one-sided transfers', () => {
    const p = resolved(),
      first = transfer();
    expect(() => nativeSelectionHolders(p, [first, first])).toThrow(
      /duplicated/
    );
    expect(() =>
      nativeSelectionHolders(p, [first, transfer('second')])
    ).toThrow(/owner/);
    for (const patch of [
      { entitlementId: 'archival' },
      { originalTeam: 'CCC' },
      { year: 2028 },
      { fromTeam: 'AAA' },
      { assetKind: 'swap_right' },
    ]) {
      const t = transfer();
      Object.assign(t.movements[0], patch);
      expect(() => nativeSelectionHolders(p, [t])).toThrow();
    }
    expect(() =>
      nativeSelectionHolders(p, [{ ...first, movements: [first.movements[0]] }])
    ).toThrow();
    expect(() => nativeSelectionHolders(program, [])).toThrow(/Resolve/);
  });
  it('rejects operation identity reuse across resolution and trade receipts', () => {
    expect(() => tradeReceipt(resolved(), [], transfer('resolve'))).toThrow(
      /lineage/
    );
  });
  it('keeps beyond-catalogue witnesses nontradable and refuses unavailable retained inputs', () => {
    const { catalogue, entitlements } = input();
    expect(() =>
      nativeRetainedWitnesses(
        resolved(),
        { ...lifecycle, retainedFirstIds: ['missing'] },
        catalogue,
        entitlements
      )
    ).toThrow(/witness/);
    expect(() =>
      nativeRetainedWitnesses(
        resolved(),
        {
          ...lifecycle,
          softwareRetainedFirsts: [{ team: 'DDD', draftYear: 2029 }],
        },
        catalogue,
        entitlements
      )
    ).toThrow(/software/);
  });
  it('Compare shows the current holder for original and receiving teams, preserving the original resolution', () => {
    const after = resolved();
    const resolution = DraftSwapReceiptZ.parse({
      scope: 'governed-simulation-only',
      worldId: 'world',
      operationId: 'resolve',
      catalogueSha256: REAL_DRAFT_REVIEW_PIN.payloadSha256,
      before: program,
      after,
      movements: program.slots.map((s) => ({
        entitlementId: s.entitlementId,
        originalTeam: s.originalTeam,
        year: 2029,
        round: 1,
        fromTeam: s.holderTeam,
        toTeam: after.result!.allocation[s.entitlementId],
        assetKind: 'pick_ownership',
      })),
      draftYear: 2029,
      date: lifecycle.claimsEffectiveDate,
      nativeLifecycle: lifecycle,
    });
    const trade = tradeReceipt();
    const rows = [
      {
        mutationType: 'draftConveyance',
        raw: {
          operationId: 'resolve',
          metadata: { swapDraftReceipt: resolution },
        },
      },
      {
        mutationType: 'executeTrade',
        raw: {
          operationId: trade.operationId,
          metadata: { draftReviewReceipt: trade },
        },
      },
    ] as ComparisonEventRow[];
    expect(deriveDraftAssetDelta(rows, 'world', 'AAA')?.restrictions).toContain(
      'AAA 2029 first: final pick 3 · held by EEE'
    );
    expect(deriveDraftAssetDelta(rows, 'world', 'DDD')?.restrictions).toEqual([
      'DDD: exercised the native 2029 two-most-favorable claim; EEE receives the remaining selection',
      'BBB 2029 first: final pick 14 · held by DDD',
      'CCC 2029 first: final pick 27 · held by DDD',
    ]);
    const broken = structuredClone(rows);
    Reflect.get(
      broken[1].raw!.metadata!,
      'draftReviewReceipt'
    ).assumptions.nativeTrade.resolutionOperationId = 'other';
    expect(deriveDraftAssetDelta(broken, 'world', 'AAA')).toBeNull();
    expect(deriveDraftAssetDelta([rows[1]], 'world', 'AAA')).toBeNull();
    expect(
      deriveDraftAssetDelta([...rows, rows[1]], 'world', 'AAA')
    ).toBeNull();
  });
});

it('can subsequently transfer a native original retained by its original team at resolution', () => {
  const retained = resolveDraftClaimProgram(
    {
      ...program,
      nativePool: { ...program.nativePool, beneficiaryTeam: 'AAA' },
    },
    { AAA: 3, BBB: 14, CCC: 27 },
    { exercisePool: true }
  );
  expect(retained.result!.allocation.AAA).toBe('AAA');
  const next = transfer();
  next.movements = next.movements.map((m) => ({
    ...m,
    fromTeam: m.fromTeam === 'DDD' ? 'AAA' : m.fromTeam,
    toTeam: m.toTeam === 'DDD' ? 'AAA' : m.toTeam,
  }));
  const { catalogue, entitlements } = input();
  for (const [id, holder] of Object.entries(
    nativeSelectionHolders(retained, [next])
  ))
    entitlements[id].holderTeam = holder;
  expect(swapProgram(retained, catalogue, entitlements, [next])).toEqual(
    retained
  );
  expect(entitlements.AAA.holderTeam).toBe('EEE');
  expect(retained.result!.allocation.AAA).toBe('AAA');
});
