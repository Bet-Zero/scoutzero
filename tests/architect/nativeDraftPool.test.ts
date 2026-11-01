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
