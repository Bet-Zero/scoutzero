import { describe, it, expect, vi } from 'vitest';
import { toTeamHistoryEventDisplay } from '@/features/architect/history/utils/normalizeWorldEventsForTeamHistory';
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

vi.mock('@/firebaseConfig', () => ({
  db: {},
  functions: {},
  auth: {},
  isSyntheticDraftReviewEnvironment: () => true,
}));

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
  async function mixed(threeTeam = false, count = 1) {
    const f = fixture();
    f.args.payload.teams![1].entitlementsOut = [];
    const playerMovements = [
      {
        playerId: 'one',
        contractId: 'contract-one',
        fromTeam: 'DDD',
        toTeam: 'AAA',
      },
      {
        playerId: 'two',
        contractId: 'contract-two',
        fromTeam: 'AAA',
        toTeam: 'DDD',
      },
    ];
    if (threeTeam) {
      f.args.payload.teams!.push({
        teamCode: 'BBB',
        sends: [],
        entitlementsOut: [],
      });
      playerMovements[1].toTeam = 'BBB';
      playerMovements.push({
        playerId: 'three',
        contractId: 'contract-three',
        fromTeam: 'BBB',
        toTeam: 'DDD',
      });
    }
    for (let i = 1; i < count; i++)
      playerMovements.push({
        playerId: `extra-${i}`,
        contractId: `contract-extra-${i}`,
        fromTeam: 'DDD',
        toTeam: threeTeam && i % 2 ? 'BBB' : 'AAA',
      });
    const r = await prepareSwapTradeRecord({ ...f, playerMovements });
    if (r.status !== 'ready') throw new Error('expected mixed swap');
    const receipt = {
      scope: r.record.scope,
      assumptions: r.record.assumptions!,
      assumptionSha256: r.record.assumptionSha256,
      operationId: 'op',
      worldId: 'w',
      releaseId: r.record.releaseId,
      releaseSha256: r.record.releaseSha256,
      asOfDate: r.record.asOfDate,
      movements: [...r.record.movements],
      playerMovements,
    };
    return { f, r, receipt };
  }
  it.each([2, 3, 5])(
    'replays %i outgoing Contracts without a sender or record cap',
    async (count) => {
      for (const threeTeam of [false, true]) {
        const { f, r, receipt } = await mixed(threeTeam, count);
        const saved = DraftReviewMutationReceiptZ.parse(
          JSON.parse(JSON.stringify(receipt))
        );
        expect(saved.playerMovements).toEqual(r.record.playerMovements);
        expect(
          saved.playerMovements!.filter((p) => p.fromTeam === 'DDD')
        ).toHaveLength(count);
        const event = {
          mutationType: 'executeTrade',
          worldId: 'w',
          operationId: 'op',
          valid: true,
          playerIds: saved.playerMovements!.map((p) => p.playerId),
          teamCodes: threeTeam ? ['DDD', 'AAA', 'BBB'] : ['DDD', 'AAA'],
          metadata: { draftReviewReceipt: saved },
        };
        expect(JSON.stringify(toTeamHistoryEventDisplay(event))).toContain(
          `extra-${count - 1}`
        );
        expect(
          deriveDraftAssetDelta(
            [{ mutationType: 'executeTrade', raw: event }],
            'w',
            'AAA'
          )?.additions
        ).toHaveLength(1);
        const reordered = await prepareSwapTradeRecord({
          ...f,
          playerMovements: [...saved.playerMovements!].reverse(),
        });
        expect(reordered.status).toBe('ready');
        saved.playerMovements!.at(-1)!.contractId =
          saved.playerMovements![0].contractId;
        expect(DraftReviewMutationReceiptZ.safeParse(saved).success).toBe(
          false
        );
      }
    }
  );
  it('binds a genuine three-team Contract cycle and reviews every affected pool owner', async () => {
    const { f, r, receipt } = await mixed(true);
    expect(r.record.playerMovements).toEqual([
      {
        playerId: 'one',
        contractId: 'contract-one',
        fromTeam: 'DDD',
        toTeam: 'AAA',
      },
      {
        playerId: 'two',
        contractId: 'contract-two',
        fromTeam: 'AAA',
        toTeam: 'BBB',
      },
      {
        playerId: 'three',
        contractId: 'contract-three',
        fromTeam: 'BBB',
        toTeam: 'DDD',
      },
    ]);
    expect(
      r.record.reviews.map(
        (r) => r.review.status === 'swap-reviewed' && r.review.team
      )
    ).toEqual(['DDD', 'AAA', 'BBB', 'CCC']);
    expect(r.record.movements).toHaveLength(1);
    expect(f.entitlements['AAA-2026'].holderTeam).toBe('AAA');
    expect(
      DraftReviewMutationReceiptZ.parse(receipt).playerMovements
    ).toHaveLength(3);
    const event = {
      mutationType: 'executeTrade',
      worldId: 'w',
      operationId: 'op',
      valid: true,
      playerIds: ['one', 'two', 'three'],
      teamCodes: ['DDD', 'AAA', 'BBB'],
      metadata: { draftReviewReceipt: receipt },
    };
    expect(JSON.stringify(toTeamHistoryEventDisplay(event))).toContain(
      'unresolved swap right'
    );
    expect(
      deriveDraftAssetDelta(
        [{ mutationType: 'executeTrade', raw: event }],
        'w',
        'AAA'
      )?.additions
    ).toHaveLength(1);
  });
  it.each([
    'fourth-team',
    'neutral',
    'duplicate-contract',
    'self',
    'missing-return',
  ])('rejects three-team receipt corruption: %s', async (mode) => {
    const { receipt } = await mixed(true);
    if (mode === 'fourth-team') receipt.playerMovements[2].fromTeam = 'CCC';
    if (mode === 'neutral') receipt.playerMovements.pop();
    if (mode === 'duplicate-contract')
      receipt.playerMovements[2].contractId = 'contract-one';
    if (mode === 'self') receipt.playerMovements[2].toTeam = 'BBB';
    if (mode === 'missing-return') receipt.playerMovements[2].toTeam = 'AAA';
    expect(DraftReviewMutationReceiptZ.safeParse(receipt).success).toBe(false);
  });
  it('rejects an empty third team, a wrong right receiver and a pick-only three-team proposal', async () => {
    const { f, receipt } = await mixed(true);
    await expect(
      prepareSwapTradeRecord({
        ...f,
        playerMovements: receipt.playerMovements.slice(0, 2),
      })
    ).rejects.toThrow(/noncash return/);
    await expect(prepareSwapTradeRecord(f)).rejects.toThrow(
      /Contract consideration/
    );
    f.args.payload.teams![0].entitlementsOut![0].toTeamId = 'BBB';
    await expect(
      prepareSwapTradeRecord({ ...f, playerMovements: receipt.playerMovements })
    ).rejects.toThrow(/return selection/);
  });
  it('binds ordinary Contracts as noncash return consideration without transferring a pool original', async () => {
    const { f, r, receipt } = await mixed();
    expect(r.record.playerMovements).toEqual(receipt.playerMovements);
    expect(r.record.movements).toHaveLength(1);
    expect(r.record.movements[0].assetKind).toBe('swap_right');
    expect(f.entitlements['AAA-2026'].holderTeam).toBe('AAA');
    expect(DraftReviewMutationReceiptZ.parse(receipt).playerMovements).toEqual(
      receipt.playerMovements
    );
    await expect(prepareSwapTradeRecord(f)).rejects.toThrow(/noncash return/);
  });
  it.each([
    'duplicate-player',
    'duplicate-contract',
    'third-party',
    'self',
    'same-sender',
    'future-year',
    'late-date',
    'resolved',
    'pool-original',
  ])('rejects mixed swap receipt corruption: %s', async (mode) => {
    const { receipt } = await mixed();
    if (mode === 'duplicate-player')
      receipt.playerMovements[1].playerId = 'one';
    if (mode === 'duplicate-contract')
      receipt.playerMovements[1].contractId = 'contract-one';
    if (mode === 'third-party') receipt.playerMovements[1].fromTeam = 'BBB';
    if (mode === 'self') receipt.playerMovements[1].toTeam = 'AAA';
    if (mode === 'same-sender') receipt.playerMovements[1].fromTeam = 'DDD';
    if (mode === 'future-year') receipt.assumptions.swapProgram!.year = 2027;
    if (mode === 'late-date') receipt.asOfDate = '2026-07-01';
    if (mode === 'resolved')
      receipt.assumptions.swapProgram!.result = {
        positions: { AAA: 20, BBB: 5, CCC: 10 },
        elections: { 'right-a': true, 'right-c': true },
        allocation: { 'AAA-2026': 'AAA', 'BBB-2026': 'BBB', 'CCC-2026': 'CCC' },
      };
    if (mode === 'pool-original')
      receipt.movements[0] = {
        ...receipt.movements[0],
        entitlementId: 'AAA-2026',
        assetKind: 'pick_ownership',
      };
    expect(DraftReviewMutationReceiptZ.safeParse(receipt).success).toBe(false);
  });
  it('reloads separate Contract and unresolved-right receipt lines and rejects mismatched saved player identity', async () => {
    const { receipt } = await mixed();
    const event = {
      mutationType: 'executeTrade',
      worldId: 'w',
      operationId: 'op',
      valid: true,
      playerIds: ['one', 'two'],
      teamCodes: ['DDD', 'AAA'],
      metadata: { draftReviewReceipt: receipt },
    };
    const display = () =>
      toTeamHistoryEventDisplay(event, {
        playerNameLookup: { one: 'First Player', two: 'Second Player' },
      });
    expect(JSON.stringify(display())).toContain('unresolved swap right');
    expect(JSON.stringify(display())).toContain(
      'Underlying pool selections remain'
    );
    expect(
      deriveDraftAssetDelta(
        [{ mutationType: 'executeTrade', raw: event }],
        'w',
        'AAA'
      )?.additions
    ).toEqual([
      {
        entitlementId: 'right-a',
        displayName: 'AAA 2026 first-round swap right',
      },
    ]);
    event.playerIds = ['one'];
    expect(JSON.stringify(display())).not.toContain(
      'Underlying pool selections remain'
    );
    expect(
      deriveDraftAssetDelta(
        [{ mutationType: 'executeTrade', raw: event }],
        'w',
        'AAA'
      )
    ).toBeNull();
  });
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
      metadata: {},
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
