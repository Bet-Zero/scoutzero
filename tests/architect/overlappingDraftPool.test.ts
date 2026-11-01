import { describe, it, expect } from 'vitest';
import {
  DraftOverlappingPoolProgramZ,
  type DraftOverlappingPoolProgram,
} from '@/schemas/draftOverlappingPool';
import {
  resolveDraftClaimProgram,
  swapProgram,
} from '@/features/architect/utils/draftReview/swapProgram';
import { prepareSwapDraft } from '@/features/architect/utils/draftReview/swapDraft';
import { swapAssets } from '@/features/architect/utils/draftReview/swapAssets';
import { DraftSwapReceiptZ } from '@/schemas/draftSwapReceipt';
import { deriveDraftAssetDelta } from '@/features/architect/comparison/deriveDraftAssetDelta';
import { REAL_DRAFT_REVIEW_PIN } from '@/features/architect/utils/draftPickRealReviewPin';
import type { SimulationCatalogue } from '@/features/architect/utils/draftReview/simulationInventory';
import type { ComparisonEventRow } from '@/features/architect/comparison/deriveComparisonViewModel';
import {
  requireAdmittedOverlappingTerms,
  requireAdmittedOverlappingEvent,
} from '@/features/architect/utils/draftReview/overlappingTerms';

// Independent software analogue: A receives C conditionally, then B and D
// options, E consumes B's residual, F has priority over G, then E takes G's residual.
const teams = ['AAA', 'BBB', 'CCC', 'DDD', 'EEE', 'FFF', 'GGG'];
const binding = { sourceRefs: ['software-terms'], dependencyIds: ['terms'] };
const claim = (
  holderTeam: string,
  targetTeam: string,
  eligibleReturnIds: string[],
  i: number,
  representationIds = [`right-${i}`]
) => ({
  ...binding,
  clauseId: `native-${i}`,
  representationIds,
  holderTeam,
  targetTeam,
  eligibleReturnIds,
  dependencyIds: [
    'terms',
    ...representationIds.map((id) => `right-correspondence:${id}`),
  ],
  election: 'exercise-only' as const,
});
const program: DraftOverlappingPoolProgram = {
  kind: 'native-overlapping-pool-v1',
  year: 2028,
  slots: teams.map((originalTeam) => ({
    entitlementId: originalTeam,
    originalTeam,
    holderTeam: originalTeam,
    protectedThrough: 0,
  })),
  conveyance: {
    ...binding,
    entitlementId: 'CCC',
    recipientTeam: 'AAA',
    protectedThrough: 8,
    priorObligation: 'satisfied',
    scope: 'first-round-only',
  },
  claims: [
    claim('AAA', 'BBB', ['AAA', 'CCC'], 1),
    claim('AAA', 'DDD', ['AAA', 'BBB'], 2),
    claim('EEE', 'BBB', ['EEE'], 3, ['right-3', 'duplicate-3']),
    claim('FFF', 'GGG', ['FFF'], 4),
    claim('EEE', 'GGG', ['EEE', 'AAA', 'BBB', 'CCC'], 5, []),
  ],
  unrelatedClaims: [
    {
      ...binding,
      representationId: 'unrelated',
      originalPickIds: ['HHH_2028_1st', 'III_2028_1st'],
      dependencyIds: ['right-correspondence:unrelated'],
    },
  ],
  result: null,
};
const elections = Object.fromEntries(
  program.claims.map((c) => [c.clauseId, true])
);
function input() {
  const reps = program.claims.flatMap((c) => c.representationIds);
  const all = [...teams, ...reps, 'unrelated'];
  const catalogue = {
    data: {
      records: all.map((id) => ({
        entitlementId: id,
        role: teams.includes(id) ? 'original' : 'unestablished',
        poolIds: [],
        originalPick: teams.includes(id)
          ? {
              id: `${id}_2028_1st`,
              originalTeam: id,
              draftYear: 2028,
              round: 1,
            }
          : null,
      })),
      unresolved: [],
    },
    release: {
      foundation: {
        retained: {
          entitlements: all.map((entitlementId) => ({
            entitlementId,
            kind: teams.includes(entitlementId)
              ? 'pick_ownership'
              : 'swap_right',
            baselineUnderlyingAssetIdsUnchanged: ['AAA_2028_1st'],
          })),
          dependencies: [
            { id: 'terms', entitlementIds: all },
            ...[...reps, 'unrelated'].map((id) => ({
              id: `right-correspondence:${id}`,
              entitlementIds: [id],
            })),
          ],
        },
      },
    },
  } as unknown as SimulationCatalogue;
  const entitlements: Record<
    string,
    Record<string, unknown>
  > = Object.fromEntries(
    teams.map((id) => [
      id,
      {
        kind: 'pick_ownership',
        holderTeam: id,
        seasonYear: 2028,
        round: 1,
        underlyingPickId: `${id}_2028_1st`,
      },
    ])
  );
  for (const c of program.claims)
    for (const id of c.representationIds)
      entitlements[id] = {
        kind: 'swap_right',
        holderTeam: c.holderTeam,
        seasonYear: 2028,
        round: 1,
      };
  entitlements.unrelated = {
    kind: 'swap_right',
    holderTeam: 'HHH',
    seasonYear: 2028,
    round: 1,
    swapControllerPickId: 'HHH_2028_1st',
  };
  return { catalogue, entitlements };
}
function* permutations(xs: string[]): Generator<string[]> {
  if (!xs.length) yield [];
  else
    for (const x of xs)
      for (const tail of permutations(xs.filter((t) => t !== x)))
        yield [x, ...tail];
}
// Aggregate source-style oracle, independent of the ordered exchange algorithm.
function oracle(positions: Record<string, number>) {
  const protectedFirst = positions.CCC <= 8;
  const rank = (xs: string[]) =>
    [...xs].sort((a, b) => positions[a] - positions[b]);
  const pool = rank(['AAA', 'BBB', 'DDD', ...(protectedFirst ? [] : ['CCC'])]);
  const residual = rank(['AAA', 'BBB', ...(protectedFirst ? [] : ['CCC'])]).at(
    -1
  )!;
  const beneficiary = protectedFirst
    ? pool.slice(0, 1)
    : pool[2] === 'CCC' && pool.slice(0, 2).includes('DDD')
      ? [pool[0], pool[2]]
      : pool.slice(0, 2);
  const d = pool.find((x) => x !== residual && !beneficiary.includes(x))!;
  const [was, phx] = rank(['EEE', residual]);
  const [por, mil] = rank(['FFF', 'GGG']);
  const [finalWas, finalMil] = rank([was, mil]);
  return Object.fromEntries([
    ...beneficiary.map((t) => [t, 'AAA']),
    [d, 'DDD'],
    [phx, 'BBB'],
    [por, 'FFF'],
    [finalWas, 'EEE'],
    [finalMil, 'GGG'],
    ...(protectedFirst ? [['CCC', 'CCC']] : []),
  ]);
}

describe('overlapping native claims', () => {
  it('does not admit arbitrary analogue terms as reviewed saved-world authority', async () => {
    await expect(requireAdmittedOverlappingTerms(program)).rejects.toThrow(
      /reviewed source-linked program/
    );
    await expect(
      requireAdmittedOverlappingEvent({
        metadata: { swapDraftReceipt: { before: program, after: program } },
      })
    ).rejects.toThrow(/reviewed source-linked program/);
    await expect(
      requireAdmittedOverlappingEvent({ metadata: { summary: 'Other event' } })
    ).resolves.toBeUndefined();
  });
  it('matches an independent aggregate oracle for 720 protected and 5040 conveyed orders', () => {
    let count = 0;
    for (const protectedFirst of [true, false]) {
      for (const order of permutations(
        protectedFirst ? teams.filter((t) => t !== 'CCC') : teams
      )) {
        const positions = Object.fromEntries(order.map((t, i) => [t, i + 9]));
        if (protectedFirst) positions.CCC = 8;
        const after = resolveDraftClaimProgram(program, positions, elections);
        expect(after.result?.allocation).toEqual(oracle(positions));
        expect(after.result?.positions).toEqual(positions);
        expect(Object.keys(after.result!.allocation).sort()).toEqual(teams);
        count++;
      }
    }
    expect(count).toBe(5760);
    expect(program.result).toBeNull();
  }, 30000);
  it('handles the protection boundary and the first-plus-third exception without returning C to D', () => {
    for (const CCC of [8, 9]) {
      const positions = {
        AAA: 20,
        BBB: 3,
        CCC,
        DDD: 6,
        EEE: 25,
        FFF: 14,
        GGG: 27,
      };
      const result = resolveDraftClaimProgram(
        program,
        positions,
        elections
      ).result!;
      expect(result.allocation).toEqual(oracle(positions));
      expect(result.allocation.CCC).toBe(CCC === 8 ? 'CCC' : 'AAA');
      expect(result.allocation.DDD).toBe(CCC === 8 ? 'DDD' : 'DDD');
    }
  });
  it('rejects missing, tied, extra or unsupported inputs without mutating the input', () => {
    const positions = Object.fromEntries(teams.map((t, i) => [t, i + 9]));
    const before = structuredClone(program);
    for (const bad of [
      {},
      { ...positions, AAA: 10 },
      { ...positions, AAA: 0 },
      { ...positions, AAA: 31 },
      { ...positions, AAA: 1.5 },
      { ...positions, HHH: 30 },
    ])
      expect(() => resolveDraftClaimProgram(program, bad, elections)).toThrow();
    for (const bad of [
      {},
      { ...elections, 'native-1': false },
      { ...elections, 'duplicate-3': true },
      { ...elections, 'native-1': 1 },
    ])
      expect(() =>
        resolveDraftClaimProgram(
          program,
          positions,
          bad as Record<string, boolean>
        )
      ).toThrow(/exercise/);
    expect(program).toEqual(before);
  });
  it('requires complete closure, eligible returns, order and governing conditions', () => {
    const { catalogue, entitlements } = input();
    expect(swapProgram(program, catalogue, entitlements)).toEqual(program);
    const bad = [
      { ...program, claims: [...program.claims].reverse() },
      { ...program, slots: program.slots.slice(0, 6) },
      {
        ...program,
        claims: program.claims.map((c, i) =>
          i === 1 ? { ...c, eligibleReturnIds: ['AAA', 'CCC'] } : c
        ),
      },
      {
        ...program,
        conveyance: { ...program.conveyance, priorObligation: 'unknown' },
      },
      { ...program, unrelatedClaims: [] },
      {
        ...program,
        claims: program.claims.map((c, i) =>
          i ? c : { ...c, dependencyIds: ['missing'] }
        ),
      },
      {
        ...program,
        unrelatedClaims: program.unrelatedClaims.map((c) => ({
          ...c,
          originalPickIds: ['AAA_2028_1st'],
        })),
      },
    ];
    const before = structuredClone(entitlements);
    for (const p of bad)
      expect(() => swapProgram(p, catalogue, entitlements)).toThrow();
    expect(entitlements).toEqual(before);
    catalogue.data.records.find((r) => r.entitlementId === 'right-1')!.role =
      'generated-alias';
    expect(() => swapProgram(program, catalogue, entitlements)).toThrow(
      /representations/
    );
  });
  it('rejects unresolved originals, altered holders, forged results and repeated resolution', () => {
    const { catalogue, entitlements } = input();
    const positions = Object.fromEntries(teams.map((t, i) => [t, i + 9]));
    const after = resolveDraftClaimProgram(program, positions, elections);
    for (const [id, holder] of Object.entries(after.result!.allocation))
      entitlements[id].holderTeam = holder;
    expect(swapProgram(after, catalogue, entitlements)).toEqual(after);
    expect(() => resolveDraftClaimProgram(after, positions, elections)).toThrow(
      /already/
    );
    after.result!.allocation.BBB = 'CCC';
    entitlements.BBB.holderTeam = 'CCC';
    expect(() => swapProgram(after, catalogue, entitlements)).toThrow(
      /contradicts/
    );
    expect(() => swapProgram(program, catalogue, entitlements)).toThrow(
      /saved inventory/
    );
    catalogue.data.unresolved.push({ entitlementIds: ['CCC'] } as never);
    expect(() => swapProgram(program, catalogue, entitlements)).toThrow(
      /unresolved/
    );
  });
  it('shares atomic preparation, receipts and all-participant projections without counting a duplicate option', () => {
    const inputState = input();
    const state = {
      ...inputState,
      swap: program,
      metadata: {},
    } as unknown as Parameters<typeof prepareSwapDraft>[0];
    const positions = {
      AAA: 20,
      BBB: 3,
      CCC: 9,
      DDD: 6,
      EEE: 25,
      FFF: 14,
      GGG: 27,
    };
    const before = structuredClone(inputState.entitlements);
    const prepared = prepareSwapDraft(state, positions, elections, 2028);
    expect([...prepared.affected].sort()).toEqual(teams);
    expect(inputState.entitlements).toEqual(before);
    expect(prepared.entitlements['duplicate-3']).toEqual(before['duplicate-3']);
    const receipt = DraftSwapReceiptZ.parse({
      scope: 'governed-simulation-only',
      worldId: 'world',
      operationId: 'op',
      catalogueSha256: REAL_DRAFT_REVIEW_PIN.payloadSha256,
      before: program,
      after: prepared.updated,
      movements: prepared.movements,
      draftYear: 2028,
      date: '2028-06-30',
    });
    const row = {
      mutationType: 'draftConveyance',
      raw: { operationId: 'op', metadata: { swapDraftReceipt: receipt } },
    } as ComparisonEventRow;
    for (const team of teams)
      expect(deriveDraftAssetDelta([row], 'world', team)).not.toBeNull();
    expect(
      deriveDraftAssetDelta([row], 'world', 'CCC')!.restrictions
    ).toContain('CCC 2028 first: final pick 9 · held by AAA');
    const assets = swapAssets(
      { ...state, swap: prepared.updated, entitlements: prepared.entitlements },
      'EEE',
      2028
    );
    expect(assets.rightCount).toBe(2);
    expect(
      assets.years[0].rights?.find((r) => r.key === 'native-5')?.label
    ).toContain('residual swap option');
    expect(
      assets.years[0].rights?.find((r) => r.key === 'duplicate-3')?.label
    ).toContain('not an additional executable right');
    const forged = structuredClone(row);
    Reflect.get(
      forged.raw!.metadata!,
      'swapDraftReceipt'
    ).after.result.positions.AAA = 1;
    expect(deriveDraftAssetDelta([forged], 'world', 'AAA')).toBeNull();
    expect(() =>
      DraftOverlappingPoolProgramZ.parse({
        ...program,
        conveyance: { ...program.conveyance, scope: 'whole-obligation' },
      })
    ).toThrow();
  });
});

import { nativeSelectionHolders } from '@/features/architect/utils/draftReview/nativeTrading';
import { DraftReviewMutationReceiptZ } from '@/schemas/draftPickReviewMutation';
import type {
  NativeDraftLifecycle,
  NativeSelectionTransfer,
} from '@/schemas/draftNativeTrading';
it('trades resolved 2028 originals while retaining the protected first and separate fallback caveat', () => {
  const positions = {
    AAA: 20,
    BBB: 4,
    CCC: 8,
    DDD: 10,
    EEE: 25,
    FFF: 30,
    GGG: 15,
  };
  const after = resolveDraftClaimProgram(program, positions, elections);
  const lifecycle: NativeDraftLifecycle = {
    kind: 'governed-pre-draft-native-selections-v1',
    claimsEffectiveDate: '2028-06-20',
    selections: 'unconsumed-before-draft',
    tradingWindow: {
      kind: 'governed-test-seven-draft-window',
      asOf: '2028-06-20T12:00:00Z',
      previousDraftCompletedAt: '2027-06-30T23:59:59Z',
      firstFutureDraftStartsAt: '2028-06-30T00:00:00Z',
      firstYear: 2028,
      lastYear: 2034,
    },
    retainedFirstIds: [],
    softwareRetainedFirsts: [],
  };
  const ownedByA = Object.entries(after.result!.allocation).find(
    ([, holder]) => holder === 'AAA'
  )![0];
  const ownedByE = Object.entries(after.result!.allocation).find(
    ([, holder]) => holder === 'EEE'
  )![0];
  const transfer: NativeSelectionTransfer = {
    operationId: 'trade',
    asOfDate: '2028-06-20',
    movements: [
      [ownedByA, 'AAA', 'EEE'],
      [ownedByE, 'EEE', 'AAA'],
    ].map(([id, fromTeam, toTeam]) => ({
      entitlementId: id,
      originalTeam: id,
      year: 2028,
      round: 1,
      assetKind: 'pick_ownership',
      fromTeam,
      toTeam,
    })),
  };
  const claimBefore = structuredClone(after);
  expect(nativeSelectionHolders(after, [transfer])[ownedByA]).toBe('EEE');
  expect(nativeSelectionHolders(after, [transfer]).CCC).toBe('CCC');
  const { catalogue, entitlements } = input();
  for (const [id, holder] of Object.entries(
    nativeSelectionHolders(after, [transfer])
  ))
    entitlements[id].holderTeam = holder;
  expect(swapProgram(after, catalogue, entitlements, [transfer])).toEqual(
    claimBefore
  );
  const resolution = DraftSwapReceiptZ.parse({
    scope: 'governed-simulation-only',
    worldId: 'world',
    operationId: 'resolve',
    catalogueSha256: REAL_DRAFT_REVIEW_PIN.payloadSha256,
    before: program,
    after,
    draftYear: 2028,
    date: lifecycle.claimsEffectiveDate,
    nativeLifecycle: lifecycle,
    movements: program.slots
      .filter((s) => s.holderTeam !== after.result!.allocation[s.entitlementId])
      .map((s) => ({
        entitlementId: s.entitlementId,
        originalTeam: s.originalTeam,
        year: 2028,
        round: 1,
        assetKind: 'pick_ownership',
        fromTeam: s.holderTeam,
        toTeam: after.result!.allocation[s.entitlementId],
      })),
  });
  const trade = DraftReviewMutationReceiptZ.parse({
    assumptionSha256: 'c'.repeat(64),
    scope: 'governed-simulation-only',
    worldId: 'world',
    operationId: 'trade',
    releaseId: 'software',
    releaseSha256: 'a'.repeat(64),
    asOfDate: transfer.asOfDate,
    movements: transfer.movements,
    assumptions: {
      kind: 'governed-test-assumptions-v1',
      catalogueSha256: REAL_DRAFT_REVIEW_PIN.payloadSha256,
      proposalSha256: 'b'.repeat(64),
      stateDigest: 'digest',
      asOf: lifecycle.tradingWindow.asOf,
      branchMode: 'native-selections',
      ownership: 'stipulated-for-software-tests',
      otherHoldings: 'unknown-not-empty',
      nativeTrade: {
        program: after,
        lifecycle,
        resolutionOperationId: 'resolve',
        transfers: [],
      },
    },
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
      raw: { operationId: 'trade', metadata: { draftReviewReceipt: trade } },
    },
  ] as ComparisonEventRow[];
  expect(deriveDraftAssetDelta(rows, 'world', 'CCC')?.restrictions).toContain(
    'CCC: protected first retained; separate second-round/cash obligation not resolved here'
  );
  expect(deriveDraftAssetDelta(rows, 'world', 'AAA')?.restrictions).toContain(
    `${ownedByE} 2028 first: final pick ${positions[ownedByE as keyof typeof positions]} · held by AAA`
  );
  expect(after).toEqual(claimBefore);
});
