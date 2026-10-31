import { describe, it, expect } from 'vitest';
import { prepareSwapTradeRecord } from '@/features/architect/utils/draftReview/swapTradeReview';
import { swapProgram } from '@/features/architect/utils/draftReview/swapProgram';
import type { SimulationCatalogue } from '@/features/architect/utils/draftReview/simulationInventory';
import type { DraftSwapProgram } from '@/schemas/draftSwapProgram';
import type { ApplyWorldMutationArgs } from '@/features/architect/utils/mutationPipeline.types.ingress';
import { deriveDraftAssetDelta } from '@/features/architect/comparison/deriveDraftAssetDelta';
import { REAL_DRAFT_REVIEW_PIN } from '@/features/architect/utils/draftPickRealReviewPin';
import { swapAssets } from '@/features/architect/utils/draftReview/swapAssets';
import {
  syntheticDraftOperation,
  syntheticOriginal,
} from './fixtures/draftPickOperation';
import { QUALIFIED_JUNE5_DRAFT_HORIZON as horizon } from '@/features/architect/utils/draftReview/horizon';
import { evaluateSuppliedDraftStepien } from '@/features/architect/utils/draftStepien';
import { DraftReviewMutationReceiptZ } from '@/schemas/draftPickReviewMutation';

function fixture() {
  const records = ['AAA', 'BBB', 'CCC', 'DDD'].flatMap((team) =>
    Array.from({ length: 7 }, (_, i) => ({
      entitlementId: `${team}-${2026 + i}`,
      originalPick: {
        kind: 'authenticated-original-pick',
        id: `${team}_${2026 + i}_1st`,
        originalTeam: team,
        draftYear: 2026 + i,
        round: 1,
      },
    }))
  );
  const entitlements: Record<
    string,
    Record<string, unknown>
  > = Object.fromEntries(
    records.map((r) => [
      r.entitlementId,
      {
        id: r.entitlementId,
        kind: 'pick_ownership',
        holderTeam: r.originalPick.originalTeam,
        seasonYear: r.originalPick.draftYear,
        round: 1,
        underlyingPickId: r.originalPick.id,
      },
    ])
  );
  entitlements['right-a'] = {
    id: 'right-a',
    kind: 'swap_right',
    holderTeam: 'DDD',
    seasonYear: 2026,
    round: 1,
    swapControllerPickId: 'AAA_2026_1st',
    poolUnderlyingPickIds: ['AAA_2026_1st', 'BBB_2026_1st', 'CCC_2026_1st'],
  };
  entitlements['right-c'] = {
    id: 'right-c',
    kind: 'swap_right',
    holderTeam: 'CCC',
    seasonYear: 2026,
    round: 1,
    swapControllerPickId: 'CCC_2026_1st',
    poolUnderlyingPickIds: ['BBB_2026_1st', 'CCC_2026_1st'],
  };
  const program: DraftSwapProgram = {
    kind: 'ordered-swap-pool-v1',
    year: 2026,
    tradedRightId: 'right-a',
    grantorTeam: 'DDD',
    slots: ['AAA', 'BBB', 'CCC'].map((t) => ({
      entitlementId: `${t}-2026`,
      originalTeam: t,
      holderTeam: t,
      protectedThrough: 0,
    })),
    steps: [
      {
        rightId: 'right-c',
        controllerId: 'CCC-2026',
        poolIds: ['BBB-2026', 'CCC-2026'],
        comparator: 'best_of',
        election: 'exercise-or-waive',
      },
      {
        rightId: 'right-a',
        controllerId: 'AAA-2026',
        poolIds: ['AAA-2026', 'BBB-2026'],
        comparator: 'best_of',
        election: 'exercise-or-waive',
      },
    ],
    inactiveClaimIds: [],
    result: null,
  };
  const catalogue = {
    data: { records, unresolved: [] },
    release: {
      foundation: { release: { id: 'test-release' } },
      payloadSha256: 'a'.repeat(64),
    },
  } as unknown as SimulationCatalogue;
  const args = {
    worldId: 'w',
    userId: 'u',
    seasonId: '2025-26',
    mutationType: 'executeTrade',
    operationId: 'op',
    payload: {
      teams: [
        {
          teamCode: 'DDD',
          entitlementsOut: [
            {
              ...entitlements['right-a'],
              entitlementId: 'right-a',
              toTeamId: 'AAA',
            },
          ],
        },
        {
          teamCode: 'AAA',
          entitlementsOut: [
            {
              ...entitlements['AAA-2029'],
              entitlementId: 'AAA-2029',
              toTeamId: 'DDD',
            },
          ],
        },
      ],
    },
  } as ApplyWorldMutationArgs;
  return {
    args,
    catalogue,
    program,
    metadata: { draftSwapProgram: program },
    entitlements,
    documentSnapshots: {},
    stateDigest: 'state',
    state: {},
  };
}
describe('proposal-specific ordered option review', () => {
  it('permits the separately owned option and covers all four affected teams', async () => {
    const f = fixture(),
      r = await prepareSwapTradeRecord(f);
    expect(
      r.status,
      JSON.stringify(r.status === 'blocked' ? r.reasons : [])
    ).toBe('ready');
    if (r.status !== 'ready') throw new Error('expected ready');
    expect(
      r.record.reviews.map((r) =>
        r.review.status === 'swap-reviewed' ? r.review.team : ''
      )
    ).toEqual(['DDD', 'AAA', 'BBB', 'CCC']);
    expect(r.record.movements).toEqual([
      {
        entitlementId: 'right-a',
        assetKind: 'swap_right',
        originalTeam: 'AAA',
        year: 2026,
        round: 1,
        fromTeam: 'DDD',
        toTeam: 'AAA',
      },
      {
        entitlementId: 'AAA-2029',
        assetKind: 'pick_ownership',
        originalTeam: 'AAA',
        year: 2029,
        round: 1,
        fromTeam: 'AAA',
        toTeam: 'DDD',
      },
    ]);
    const receipt = {
      scope: r.record.scope,
      assumptionSha256: r.record.assumptionSha256,
      assumptions: r.record.assumptions,
      operationId: 'op',
      worldId: 'w',
      releaseId: r.record.releaseId,
      releaseSha256: r.record.releaseSha256,
      asOfDate: r.record.asOfDate,
      movements: r.record.movements,
    };
    expect(DraftReviewMutationReceiptZ.safeParse(receipt).success).toBe(true);
    expect(
      DraftReviewMutationReceiptZ.safeParse({
        ...receipt,
        movements: r.record.movements.map((m) => ({
          ...m,
          assetKind: 'pick_ownership',
        })),
      }).success
    ).toBe(false);
    expect(
      DraftReviewMutationReceiptZ.safeParse({
        ...receipt,
        movements: [
          ...r.record.movements,
          { ...r.record.movements[1], entitlementId: 'AAA-2026', year: 2026 },
        ],
      }).success
    ).toBe(false);
  });
  it('requires a retained Stepien witness even for a nontrading pool participant', async () => {
    const f = fixture();
    f.entitlements['BBB-2027'].holderTeam = 'DDD';
    f.entitlements['BBB-2028'].holderTeam = 'DDD';
    const r = await prepareSwapTradeRecord(f);
    expect(r.status).toBe('blocked');
    if (r.status === 'blocked')
      expect(r.reasons.join()).toMatch(/BBB: stepien/);
  });
  it('rejects wrong option owner and a recipient without the return selection', async () => {
    const f = fixture();
    f.entitlements['right-a'].holderTeam = 'BBB';
    await expect(prepareSwapTradeRecord(f)).rejects.toThrow(/ownership/);
    f.entitlements['right-a'].holderTeam = 'DDD';
    f.program.slots[0].holderTeam = 'DDD';
    f.entitlements['AAA-2026'].holderTeam = 'DDD';
    await expect(prepareSwapTradeRecord(f)).rejects.toThrow(/ownership/);
  });
  it('rejects competing, omitted, reordered or unowned prior claims', () => {
    const f = fixture();
    f.entitlements['another'] = { ...f.entitlements['right-c'], id: 'another' };
    expect(() => swapProgram(f.program, f.catalogue, f.entitlements)).toThrow(
      /competing/
    );
    delete f.entitlements.another;
    expect(() =>
      swapProgram(
        { ...f.program, steps: [...f.program.steps].reverse() },
        f.catalogue,
        f.entitlements
      )
    ).toThrow(/source-named pool/);
    f.entitlements['right-c'].holderTeam = 'DDD';
    expect(() => swapProgram(f.program, f.catalogue, f.entitlements)).toThrow(
      /not owned/
    );
  });
  it('does not waive allocation-only unresolved dependencies', () => {
    const f = fixture();
    f.catalogue.data.unresolved.push({
      entitlementIds: ['CCC-2026'],
      actions: ['allocate'],
    } as SimulationCatalogue['data']['unresolved'][number]);
    expect(() => swapProgram(f.program, f.catalogue, f.entitlements)).toThrow(
      /unresolved/
    );
  });
});

describe('saved receipt and display agreement', () => {
  // Independent result: CCC gets BBB #5, AAA gets CCC #10, BBB gets AAA #20.
  function event() {
    const { program } = fixture();
    return {
      mutationType: 'draftConveyance',
      raw: {
        operationId: 'resolve',
        metadata: {
          swapDraftReceipt: {
            worldId: 'w',
            operationId: 'resolve',
            scope: 'governed-simulation-only',
            catalogueSha256: REAL_DRAFT_REVIEW_PIN.payloadSha256,
            before: program,
            after: {
              ...program,
              result: {
                positions: { AAA: 20, BBB: 5, CCC: 10 },
                elections: { 'right-c': true, 'right-a': true },
                allocation: {
                  'AAA-2026': 'BBB',
                  'BBB-2026': 'CCC',
                  'CCC-2026': 'AAA',
                },
              },
            },
            draftYear: 2026,
            date: '2026-06-30',
            movements: [
              ['AAA', 'BBB'],
              ['BBB', 'CCC'],
              ['CCC', 'AAA'],
            ].map(([from, to]) => ({
              entitlementId: `${from}-2026`,
              originalTeam: from,
              year: 2026,
              round: 1,
              fromTeam: from,
              toTeam: to,
              assetKind: 'pick_ownership',
            })),
          },
        },
      },
    };
  }
  it('shows the nontrading participant’s incoming and outgoing originals', () => {
    expect(deriveDraftAssetDelta([event()], 'w', 'BBB')).toEqual({
      additions: [
        { entitlementId: 'AAA-2026', displayName: 'AAA 2026 first-round pick' },
      ],
      removals: [
        { entitlementId: 'BBB-2026', displayName: 'BBB 2026 first-round pick' },
      ],
    });
  });
  it('rejects an internally consistent but wrong allocation, missing inputs and retries', () => {
    const altered = event();
    altered.raw.metadata.swapDraftReceipt.after.result.elections['right-c'] =
      false;
    expect(deriveDraftAssetDelta([altered], 'w', 'BBB')).toBeNull();
    const incomplete = event();
    delete (
      incomplete.raw.metadata.swapDraftReceipt.after.result.positions as Record<
        string,
        number
      >
    ).CCC;
    expect(deriveDraftAssetDelta([incomplete], 'w', 'BBB')).toBeNull();
    expect(deriveDraftAssetDelta([event(), event()], 'w', 'BBB')).toBeNull();
  });
  it('counts the option as a right, separately from its underlying selection', () => {
    const f = fixture();
    f.entitlements['right-a'].holderTeam = 'AAA';
    const state = {
      swap: f.program,
      entitlements: f.entitlements,
      catalogue: f.catalogue,
    } as Parameters<typeof swapAssets>[0];
    const view = swapAssets(state, 'AAA', 2026);
    expect(view).toMatchObject({
      status: 'available',
      firstRoundCount: 7,
      rightCount: 1,
    });
    if (view.status !== 'available') throw new Error('expected assets');
    expect(view.years[0].rights).toEqual([
      { key: 'right-a', label: 'AAA swap right' },
    ]);
    expect(view.years[0].firstRound).toHaveLength(1);
  });
});

it('requires every conservative swap allocation and preserves the ordinary sale guard', () => {
  const { request, stepien } = syntheticDraftOperation();
  request.context = { ...request.context, team: 'AAA', asOf: horizon.asOf };
  request.outgoing = [syntheticOriginal(2026, 'AAA')];
  Object.assign(stepien, {
    context: request.context,
    outgoing: request.outgoing,
    effectiveAt: horizon.asOf,
    firstFutureDraftYear: 2026,
    throughDraftYear: 2032,
    laterDrafts: 'outside-qualified-scope',
    finiteScope: {
      authorityId: horizon.id,
      explanationSha256: horizon.explanationSha256,
      calendarSha256: horizon.calendarSha256,
      completeRelevantObligationCoverage: true,
      knownObligationDraftYears: [2026],
      unresolvedDependencyIds: [],
    },
    swapProgram: fixture().program,
  });
  delete stepien.previousDraft;
  delete stepien.firstFutureDraftStartsAt;
  stepien.sources[0].publishedAt = null;
  stepien.sources[0].capturedAt = null;
  stepien.branches = ['AAA', 'BBB', 'CCC'].map((t) => ({
    id: t,
    possible: true,
    unresolvedDependencyIds: [],
    drafts: Array.from({ length: 7 }, (_, i) => ({
      draftYear: 2026 + i,
      retained: [syntheticOriginal(2026 + i, i === 0 ? t : 'AAA')],
      inventoryComplete: false,
    })),
  }));
  expect(evaluateSuppliedDraftStepien(request, [stepien]).status).toBe(
    'component-permits'
  );
  expect(
    evaluateSuppliedDraftStepien(request, [
      { ...stepien, branches: stepien.branches.slice(0, 2) },
    ]).reasons
  ).toContain('complete-swap-allocation-coverage-required');
  expect(
    evaluateSuppliedDraftStepien(request, [
      {
        ...stepien,
        branches: [
          stepien.branches[0],
          stepien.branches[0],
          stepien.branches[2],
        ],
      },
    ]).status
  ).toBe('needs-input');
  const ordinary = { ...stepien };
  delete ordinary.swapProgram;
  expect(evaluateSuppliedDraftStepien(request, [ordinary]).reasons).toContain(
    'outgoing-original-pick-still-retained'
  );
});
