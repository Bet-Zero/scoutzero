import { requireNativeSelectionTradeAdmission } from '@/features/architect/utils/draftReview/nativeTrading';
import {
  nativeSelectionHolders,
  nativeRetainedWitnesses,
  nativeLifecycle,
} from '@/features/architect/utils/draftReview/nativeTrading';
import { it, expect } from 'vitest';
import { validateNativeTradeInventory } from '@/features/architect/utils/draftReview/nativeTradeInventory';
import { validateNativeTradeApply } from '@/features/architect/utils/draftReview/nativeTradeApply';
import { AUTHORITATIVE_WORLD_TEAM_CODES } from '@/features/architect/utils/leagueTeams';
import { resolveDraftClaimProgram } from '@/features/architect/utils/draftReview/swapProgram';
import type { DraftNativePoolProgram } from '@/schemas/draftNativePool';
import type {
  NativeDraftLifecycle,
  NativeSelectionTransfer,
} from '@/schemas/draftNativeTrading';

function fixture() {
  const p: DraftNativePoolProgram = {
    kind: 'native-ranked-pool-v1',
    year: 2029,
    slots: ['DAL', 'HOU', 'PHX'].map((originalTeam) => ({
      entitlementId: originalTeam,
      originalTeam,
      holderTeam: originalTeam,
      protectedThrough: 0,
    })),
    nativePool: {
      clauseIds: ['native'],
      sourceRefs: ['software'],
      dependencyIds: ['terms'],
      archivalIds: ['resolved-alias'],
      beneficiaryTeam: 'HOU',
      residualTeam: 'BKN',
      ranks: [1, 2],
      residualRank: 3,
      priority: 'ranked-claim-before-residual',
      conditions: 'all-three-unprotected',
      election: 'exercise-only',
    },
    result: null,
  };
  const program = resolveDraftClaimProgram(
    p,
    { DAL: 3, PHX: 14, HOU: 27 },
    { exercisePool: true }
  );
  const lifecycle: NativeDraftLifecycle = {
    kind: 'governed-pre-draft-native-selections-v1',
    claimsEffectiveDate: '2029-06-20',
    selections: 'unconsumed-before-draft',
    retainedFirstIds: ['witness'],
    softwareRetainedFirsts: [],
    tradingWindow: {
      kind: 'governed-test-seven-draft-window',
      asOf: '2029-06-20T12:00:00Z',
      previousDraftCompletedAt: '2028-06-30T23:59:59Z',
      firstFutureDraftStartsAt: '2029-06-30T00:00:00Z',
      firstYear: 2029,
      lastYear: 2035,
    },
  };
  const next: NativeSelectionTransfer = {
    operationId: 'trade',
    asOfDate: '2029-06-20',
    movements: [
      {
        entitlementId: 'DAL',
        assetKind: 'pick_ownership',
        originalTeam: 'DAL',
        year: 2029,
        round: 1,
        fromTeam: 'HOU',
        toTeam: 'BKN',
      },
      {
        entitlementId: 'HOU',
        assetKind: 'pick_ownership',
        originalTeam: 'HOU',
        year: 2029,
        round: 1,
        fromTeam: 'BKN',
        toTeam: 'HOU',
      },
    ],
  };
  const entitlements: Record<
    string,
    Record<string, unknown>
  > = Object.fromEntries(
    p.slots.map((s) => [
      s.entitlementId,
      {
        id: s.entitlementId,
        kind: 'pick_ownership',
        holderTeam: program.result!.allocation[s.entitlementId],
        underlyingPickId: `${s.originalTeam}_2029_1st`,
        seasonYear: 2029,
        round: 1,
      },
    ])
  );
  entitlements.witness = {
    id: 'witness',
    kind: 'pick_ownership',
    holderTeam: 'BKN',
    underlyingPickId: 'BKN_2031_1st',
    seasonYear: 2031,
    round: 1,
  };
  entitlements['resolved-alias'] = {
    id: 'resolved-alias',
    kind: 'swap_right',
    holderTeam: 'HOU',
    swapControllerPickId: 'HOU_2029_1st',
  };
  for (const id of ['archival-one', 'archival-two'])
    entitlements[id] = {
      id,
      kind: 'swap_right',
      holderTeam: 'BKN',
      swapControllerPickId: 'BKN_2028_1st',
    };
  const teams = Object.fromEntries(
    AUTHORITATIVE_WORLD_TEAM_CODES.map((team) => [
      team,
      {
        entitlementIds: Object.keys(entitlements).filter(
          (id) => entitlements[id].holderTeam === team
        ),
      },
    ])
  );
  return { program, lifecycle, history: [], next, entitlements, teams };
}
function computed(f: ReturnType<typeof fixture>) {
  return {
    entitlementUpdates: f.next.movements.map((m) => ({
      entitlementId: m.entitlementId,
      holderTeam: m.toTeam,
    })),
    teamUpdates: ['HOU', 'BKN'].map((teamCode) => ({
      teamCode,
      team: {
        entitlementIds: Object.keys(f.entitlements).filter(
          (id) =>
            (f.next.movements.find((m) => m.entitlementId === id)?.toTeam ??
              f.entitlements[id].holderTeam) === teamCode
        ),
      },
    })),
  };
}
it('checks the entire inventory while preserving exact disjoint archival conflicts', () => {
  const f = fixture(),
    before = structuredClone(f);
  expect(validateNativeTradeInventory({ ...f, computed: computed(f) })).toEqual(
    { valid: true }
  );
  expect(f).toEqual(before);
});
it('rejects an unchanged competing claim touching any native selection or Stepien witness', () => {
  for (const pick of ['DAL_2029_1st', 'BKN_2031_1st']) {
    const f = fixture();
    f.entitlements['archival-one'].swapControllerPickId = pick;
    f.entitlements['archival-two'].swapControllerPickId = pick;
    expect(() => validateNativeTradeInventory(f)).toThrow(/conflicts/);
  }
});
it('does not grandfather a duplicate original anywhere in the league', () => {
  const f = fixture();
  f.entitlements.duplicate = {
    ...f.entitlements.witness,
    id: 'duplicate',
    holderTeam: 'LAL',
  };
  f.teams.LAL.entitlementIds.push('duplicate');
  expect(() => validateNativeTradeInventory(f)).toThrow(/conflicts/);
});
it('rejects lost untouched inventory, extra computed ownership and missing teams', () => {
  const f = fixture(),
    c = computed(f);
  c.teamUpdates[1].team.entitlementIds =
    c.teamUpdates[1].team.entitlementIds.filter((id) => id !== 'witness');
  expect(() => validateNativeTradeInventory({ ...f, computed: c })).toThrow(
    /untouched/
  );
  const extra = computed(f);
  extra.entitlementUpdates.push({
    entitlementId: 'witness',
    holderTeam: 'HOU',
  });
  expect(() => validateNativeTradeInventory({ ...f, computed: extra })).toThrow(
    /movements/
  );
  delete f.teams.LAL;
  expect(() => validateNativeTradeInventory(f)).toThrow(/thirty/);
});
it('rejects stale holders and attempts to remove original assets as representations', () => {
  const f = fixture();
  f.entitlements.DAL.holderTeam = 'BKN';
  expect(() => validateNativeTradeInventory(f)).toThrow(/ownership/);
  const g = fixture();
  if (g.program.kind === 'native-ranked-pool-v1')
    g.program.nativePool.archivalIds.push('DAL');
  expect(() => validateNativeTradeInventory(g)).toThrow(/representations/);
});
it('cannot select the guarded apply path using a forged serializable authority', () => {
  expect(() =>
    validateNativeTradeApply(
      { assumptions: { nativeTrade: fixture() } },
      {},
      { worldId: 'world', operationId: 'op' }
    )
  ).toThrow(/permission|unavailable/);
});

it('requires separate admission for an unverified native transfer family', () => {
  expect(() =>
    requireNativeSelectionTradeAdmission(fixture().program)
  ).not.toThrow();
  expect(() =>
    requireNativeSelectionTradeAdmission({ ...fixture().program, year: 2028 })
  ).toThrow(/not yet admitted/);
});

function composedFixture() {
  const f = fixture();
  f.lifecycle.originalSelections = [
    {
      entitlementId: 'witness',
      originalTeam: 'BKN',
      year: 2031,
      holderTeam: 'BKN',
    },
  ];
  f.next.movements[1] = {
    ...f.next.movements[1],
    entitlementId: 'witness',
    originalTeam: 'BKN',
    year: 2031,
  };
  return f;
}
it('uses one current-owner ledger for resolved and independent originals, including a return', () => {
  const f = composedFixture(),
    original = structuredClone(f.program);
  expect(validateNativeTradeInventory({ ...f, computed: computed(f) })).toEqual(
    { valid: true }
  );
  const current = nativeSelectionHolders(
    f.program,
    [f.next],
    f.lifecycle.originalSelections
  );
  expect(current).toMatchObject({ DAL: 'BKN', witness: 'HOU' });
  const returned = {
    ...f.next,
    operationId: 'return',
    movements: f.next.movements.map((m) => ({
      ...m,
      fromTeam: m.toTeam,
      toTeam: m.fromTeam,
    })),
  };
  expect(
    nativeSelectionHolders(
      f.program,
      [f.next, returned],
      f.lifecycle.originalSelections
    )
  ).toEqual({ ...f.program.result!.allocation, witness: 'BKN' });
  expect(f.program).toEqual(original);
  expect(() => nativeSelectionHolders(f.program, [f.next])).toThrow(
    /original identity/
  );
  expect(() =>
    nativeSelectionHolders(
      f.program,
      [returned],
      f.lifecycle.originalSelections
    )
  ).toThrow(/current owner/);
  expect(() =>
    nativeSelectionHolders(
      f.program,
      [f.next, f.next],
      f.lifecycle.originalSelections
    )
  ).toThrow(/duplicated/);
});
it.each([
  'duplicate-id',
  'duplicate-pick',
  'pool-id',
  'pool-pick',
  'wrong-year',
  'wrong-owner',
  'not-retained',
  'outside-window',
])('rejects invalid composition admission: %s', (mode) => {
  const f = composedFixture(),
    originals = f.lifecycle.originalSelections!;
  if (mode === 'duplicate-id')
    originals.push({ ...originals[0], originalTeam: 'LAL' });
  if (mode === 'duplicate-pick')
    originals.push({ ...originals[0], entitlementId: 'other' });
  if (mode === 'pool-id') originals[0].entitlementId = 'DAL';
  if (mode === 'pool-pick')
    Object.assign(originals[0], { originalTeam: 'DAL', year: 2029 });
  if (mode === 'wrong-year') originals[0].year = 2030;
  if (mode === 'wrong-owner') originals[0].holderTeam = 'HOU';
  if (mode === 'not-retained') f.lifecycle.retainedFirstIds = [];
  if (mode === 'outside-window') originals[0].year = 2036;
  expect(() => {
    nativeLifecycle(f.lifecycle, 2029);
    validateNativeTradeInventory(f);
  }).toThrow();
});
it.each([
  'protection',
  'encumbered',
  'claim',
  'unresolved',
  'wrong-identity',
  'not-retained',
])('keeps independent original source admission closed for %s', (mode) => {
  const f = composedFixture();
  const records = Object.entries(f.entitlements)
    .filter(([, e]) => e.kind === 'pick_ownership')
    .map(([entitlementId, e]) => ({
      entitlementId,
      role: 'original',
      originalPick: {
        kind: 'authenticated-original-pick',
        id: e.underlyingPickId,
        originalTeam: String(e.underlyingPickId).slice(0, 3),
        draftYear: e.seasonYear,
        round: 1,
      },
    }));
  const catalogue = {
    data: { records, unresolved: [] as { entitlementIds: string[] }[] },
  };
  if (mode === 'protection')
    f.entitlements.witness.protectionLadder = [
      { year: 2031, condition: 'Top 10' },
    ];
  if (mode === 'encumbered')
    f.entitlements.witness.underlyingStatus = 'encumbered';
  if (mode === 'claim')
    f.entitlements['archival-one'].swapControllerPickId = 'BKN_2031_1st';
  if (mode === 'unresolved')
    catalogue.data.unresolved.push({ entitlementIds: ['witness'] });
  if (mode === 'wrong-identity')
    f.lifecycle.originalSelections![0].originalTeam = 'LAL';
  if (mode === 'not-retained') f.lifecycle.retainedFirstIds = [];
  expect(() =>
    nativeRetainedWitnesses(
      f.program,
      f.lifecycle,
      catalogue as never,
      f.entitlements
    )
  ).toThrow();
});
it('rejects partial computed composition and stale independent custody', () => {
  const f = composedFixture(),
    c = computed(f);
  c.entitlementUpdates.pop();
  expect(() => validateNativeTradeInventory({ ...f, computed: c })).toThrow(
    /movements/
  );
  f.entitlements.witness.holderTeam = 'HOU';
  f.teams.BKN.entitlementIds = f.teams.BKN.entitlementIds.filter(
    (id) => id !== 'witness'
  );
  f.teams.HOU.entitlementIds.push('witness');
  expect(() => validateNativeTradeInventory(f)).toThrow(
    /Stale native ownership/
  );
});
