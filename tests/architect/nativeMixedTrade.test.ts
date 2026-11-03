import { expect, it, vi } from 'vitest';
import { program } from '../fixtures/draftOverlappingProgram';
import { resolveDraftClaimProgram } from '@/features/architect/utils/draftReview/swapProgram';
import { nativeSelectionHolders } from '@/features/architect/utils/draftReview/nativeTrading';
import { NativeSelectionTransferZ } from '@/schemas/draftNativeTrading';
import { DraftReviewMutationReceiptZ } from '@/schemas/draftPickReviewMutation';
import { toTeamHistoryEventDisplay } from '@/features/architect/history/utils/normalizeWorldEventsForTeamHistory';

const environment = vi.hoisted(() => ({ allowed: true }));
vi.mock('@/firebaseConfig', () => ({
  db: {},
  functions: {},
  auth: {},
  isSyntheticDraftReviewEnvironment: () => environment.allowed,
}));

function fixture() {
  const resolved = resolveDraftClaimProgram(
    program,
    { AAA: 20, BBB: 4, CCC: 8, DDD: 10, EEE: 25, FFF: 30, GGG: 15 },
    Object.fromEntries(program.claims.map((c) => [c.clauseId, true]))
  );
  const next = NativeSelectionTransferZ.parse({
    operationId: 'mixed',
    asOfDate: '2028-06-20',
    movements: [
      {
        entitlementId: 'CCC',
        originalTeam: 'CCC',
        year: 2028,
        round: 1,
        assetKind: 'pick_ownership',
        fromTeam: 'CCC',
        toTeam: 'HHH',
      },
    ],
    playerMovements: [
      {
        playerId: 'one',
        contractId: 'contract-one',
        fromTeam: 'CCC',
        toTeam: 'HHH',
      },
      {
        playerId: 'two',
        contractId: 'contract-two',
        fromTeam: 'HHH',
        toTeam: 'CCC',
      },
    ],
  });
  const receipt = {
    scope: 'governed-simulation-only',
    assumptionSha256: 'a'.repeat(64),
    worldId: 'world',
    releaseId: 'software',
    releaseSha256: 'b'.repeat(64),
    ...next,
    assumptions: {
      kind: 'governed-test-assumptions-v1',
      catalogueSha256: 'c'.repeat(64),
      proposalSha256: 'd'.repeat(64),
      stateDigest: 'state',
      asOf: '2028-06-20T12:00:00Z',
      branchMode: 'native-selections',
      ownership: 'stipulated-for-software-tests',
      otherHoldings: 'unknown-not-empty',
      nativeTrade: {
        program: resolved,
        resolutionOperationId: 'resolved',
        transfers: [],
        lifecycle: {
          kind: 'governed-pre-draft-native-selections-v1',
          claimsEffectiveDate: '2028-06-20',
          selections: 'unconsumed-before-draft',
          retainedFirstIds: [],
          softwareRetainedFirsts: [],
          tradingWindow: {
            kind: 'governed-test-seven-draft-window',
            asOf: '2028-06-20T12:00:00Z',
            previousDraftCompletedAt: '2027-06-30T23:59:59Z',
            firstFutureDraftStartsAt: '2028-06-30T00:00:00Z',
            firstYear: 2028,
            lastYear: 2034,
          },
        },
      },
    },
  };
  return { resolved, next, receipt };
}
it('replays a one-selection/ordinary-Contract exchange and a legitimate return without changing the claim', () => {
  const { resolved, next, receipt } = fixture(),
    original = structuredClone(resolved);
  expect(DraftReviewMutationReceiptZ.parse(receipt).playerMovements).toEqual(
    next.playerMovements
  );
  expect(nativeSelectionHolders(resolved, [next]).CCC).toBe('HHH');
  const returned = {
    ...next,
    operationId: 'return',
    movements: next.movements.map((m) => ({
      ...m,
      fromTeam: m.toTeam,
      toTeam: m.fromTeam,
    })),
    playerMovements: next.playerMovements!.map((m) => ({
      ...m,
      fromTeam: m.toTeam,
      toTeam: m.fromTeam,
    })),
  };
  expect(nativeSelectionHolders(resolved, [next, returned])).toEqual(
    resolved.result!.allocation
  );
  expect(resolved).toEqual(original);
  expect(() => nativeSelectionHolders(resolved, [next, next])).toThrow();
  expect(() => nativeSelectionHolders(resolved, [returned])).toThrow();
});
it.each([
  'missing-return',
  'third-team',
  'duplicate-player',
  'duplicate-contract',
  'two-from-one',
  'self',
  'unknown-pick',
  'stale',
  'timing',
  'no-native',
])('rejects unsupported or inconsistent mixed lineage: %s', (mode) => {
  const { receipt } = fixture();
  if (mode === 'missing-return') receipt.playerMovements = undefined;
  if (mode === 'third-team') receipt.playerMovements![1].fromTeam = 'III';
  if (mode === 'duplicate-player') receipt.playerMovements![1].playerId = 'one';
  if (mode === 'duplicate-contract')
    receipt.playerMovements![1].contractId = 'contract-one';
  if (mode === 'two-from-one') receipt.playerMovements![1].fromTeam = 'CCC';
  if (mode === 'self') receipt.playerMovements![1].toTeam = 'HHH';
  if (mode === 'unknown-pick') receipt.movements[0].entitlementId = 'other';
  if (mode === 'stale') receipt.movements[0].fromTeam = 'HHH';
  if (mode === 'timing') receipt.asOfDate = '2028-06-30';
  if (mode === 'no-native')
    Reflect.deleteProperty(receipt.assumptions, 'nativeTrade');
  expect(DraftReviewMutationReceiptZ.safeParse(receipt).success).toBe(false);
});

it('rehydrates mixed consideration in the saved Trade Receipt only with matching event identity', () => {
  const { receipt } = fixture();
  const event = {
    mutationType: 'executeTrade',
    operationId: receipt.operationId,
    worldId: receipt.worldId,
    valid: true,
    playerIds: ['one', 'two'],
    teamCodes: ['CCC', 'HHH'],
    metadata: { draftReviewReceipt: receipt },
  };
  const display = (input: typeof event) =>
    toTeamHistoryEventDisplay(input, {
      playerNameLookup: { one: 'First Player', two: 'Second Player' },
    }).detailSections.find((s) => s.title === 'Trade Receipt');
  const section = display(event);
  expect(section?.presentation).toBe('trade-summary');
  expect(JSON.stringify(section)).toContain('First Player Contract: CCC → HHH');
  expect(JSON.stringify(section)).toContain(
    'CCC 2028 first: final pick 8 · CCC → HHH'
  );
  for (const change of [
    { worldId: 'other' },
    { operationId: 'other' },
    { valid: false },
    { playerIds: ['one'] },
  ])
    expect(display({ ...event, ...change })).toBeUndefined();
  expect(
    display({
      ...event,
      metadata: { draftReviewReceipt: { ...receipt, asOfDate: '2028-06-30' } },
    })
  ).toBeUndefined();
  environment.allowed = false;
  try {
    expect(display(event)).toBeUndefined();
  } finally {
    environment.allowed = true;
  }
});

it('Compare preserves mixed consideration through a later selection-only retrade and rejects conflicting history', async () => {
  const { deriveDraftAssetDelta } = await import(
    '@/features/architect/comparison/deriveDraftAssetDelta'
  );
  const { REAL_DRAFT_REVIEW_PIN } = await import(
    '@/features/architect/utils/draftPickRealReviewPin'
  );
  const { resolved, receipt } = fixture();
  const otherSlot = resolved.slots.find(
    (s) =>
      s.entitlementId !== 'CCC' &&
      resolved.result!.allocation[s.entitlementId] !== 'CCC'
  )!;
  const other = resolved.result!.allocation[otherSlot.entitlementId];
  const first = DraftReviewMutationReceiptZ.parse({
    ...receipt,
    playerMovements: [receipt.playerMovements[0]].map((p) => ({
      ...p,
      toTeam: other,
    })),
    movements: [
      { ...receipt.movements[0], toTeam: other },
      {
        ...receipt.movements[0],
        entitlementId: otherSlot.entitlementId,
        originalTeam: otherSlot.originalTeam,
        fromTeam: other,
        toTeam: 'CCC',
      },
    ],
  });
  const second = DraftReviewMutationReceiptZ.parse({
    ...first,
    operationId: 'selection-retrade',
    playerMovements: undefined,
    movements: first.movements.map((m) => ({
      ...m,
      fromTeam: m.toTeam,
      toTeam: m.fromTeam,
    })),
    assumptions: {
      ...first.assumptions,
      nativeTrade: {
        ...first.assumptions!.nativeTrade,
        transfers: [
          {
            operationId: first.operationId,
            asOfDate: first.asOfDate,
            movements: first.movements,
            playerMovements: first.playerMovements,
          },
        ],
      },
    },
  });
  const resolution = {
    scope: 'governed-simulation-only',
    worldId: 'world',
    operationId: 'resolved',
    catalogueSha256: REAL_DRAFT_REVIEW_PIN.payloadSha256,
    before: program,
    after: resolved,
    draftYear: 2028,
    date: '2028-06-20',
    nativeLifecycle: first.assumptions!.nativeTrade!.lifecycle,
    movements: program.slots
      .filter(
        (s) => s.holderTeam !== resolved.result!.allocation[s.entitlementId]
      )
      .map((s) => ({
        entitlementId: s.entitlementId,
        originalTeam: s.originalTeam,
        year: 2028,
        round: 1,
        fromTeam: s.holderTeam,
        toTeam: resolved.result!.allocation[s.entitlementId],
        assetKind: 'pick_ownership',
      })),
  };
  const rows = [
    {
      mutationType: 'draftConveyance',
      raw: {
        operationId: 'resolved',
        metadata: { swapDraftReceipt: resolution },
      },
    },
    ...[first, second].map((r) => ({
      mutationType: 'executeTrade',
      raw: {
        operationId: r.operationId,
        valid: true,
        playerIds: r.playerMovements?.map((p) => p.playerId) ?? [],
        metadata: { draftReviewReceipt: r },
      },
    })),
  ] as import('@/features/architect/comparison/deriveComparisonViewModel').ComparisonEventRow[];
  const delta = deriveDraftAssetDelta(
    JSON.parse(JSON.stringify(rows)),
    'world',
    'CCC'
  );
  expect(delta?.restrictions).toContain(
    'CCC 2028 first: final pick 8 · held by CCC'
  );
  expect(delta?.additions).toEqual([]);
  expect(delta?.removals).toEqual([]);
  const { deriveComparisonViewModel } = await import(
    '@/features/architect/comparison/deriveComparisonViewModel'
  );
  const financialRows = rows.map((row, i) => ({
    ...row,
    id: `event-${i}`,
    eventId: `event-${i}`,
    occurredAt: `2028-06-20T0${i}:00:00Z`,
    playerIds: i === 1 ? ['one'] : [],
    teamCodes: ['CCC', other],
    teamsInvolved: ['CCC', other],
    beforeTotalsByTeam: i
      ? {
          CCC: {
            teamSalary: i === 1 ? 20 : 12,
            apronTeamSalary: i === 1 ? 20 : 12,
            taxSalary: 20,
          },
        }
      : {},
    afterTotalsByTeam: i
      ? {
          CCC: { teamSalary: 12, apronTeamSalary: 12, taxSalary: 20 },
        }
      : {},
  }));
  const compare = (events: typeof financialRows) =>
    deriveComparisonViewModel({
      worldId: 'world',
      worldName: 'Test',
      teamCode: 'CCC',
      baselineSeason: '2027-28',
      currentSeason: '2027-28',
      committedEventRows: events,
      currentRosterPlayerIds: [],
    });
  expect(compare(financialRows).capTotalDelta).toMatchObject({
    teamSalaryDelta: -8,
    apronTeamSalaryDelta: -8,
    taxSalaryDelta: 0,
  });
  // An earlier unknown financial event must not be skipped as an allocation.
  expect(
    compare([
      {
        ...financialRows[0],
        id: 'unknown',
        eventId: 'unknown',
        occurredAt: '2028-06-19T00:00:00Z',
        mutationType: 'extendPlayer',
        raw: {},
      },
      ...financialRows,
    ]).capTotalDelta?.teamSalaryDelta
  ).toBeNull();
  const invalidAllocation = structuredClone(financialRows);
  Reflect.get(
    invalidAllocation[0].raw!.metadata!,
    'swapDraftReceipt'
  ).catalogueSha256 = 'f'.repeat(64);
  expect(compare(invalidAllocation).capTotalDelta?.teamSalaryDelta).toBeNull();
  for (const change of [{ valid: false }, { playerIds: [] }]) {
    const broken = structuredClone(rows);
    Object.assign(broken[1].raw!, change);
    expect(deriveDraftAssetDelta(broken, 'world', 'CCC')).toBeNull();
  }
  const broken = structuredClone(rows);
  Reflect.get(
    broken[2].raw!.metadata!,
    'draftReviewReceipt'
  ).assumptions.nativeTrade.transfers[0].playerMovements[0].contractId =
    'forged';
  expect(deriveDraftAssetDelta(broken, 'world', 'CCC')).toBeNull();
});
