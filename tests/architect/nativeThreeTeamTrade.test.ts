import { expect, it } from 'vitest';
import { program } from '../fixtures/draftOverlappingProgram';
import { resolveDraftClaimProgram } from '@/features/architect/utils/draftReview/swapProgram';
import { nativeSelectionHolders } from '@/features/architect/utils/draftReview/nativeTrading';
import { NativeSelectionTransferZ } from '@/schemas/draftNativeTrading';
import { validateNativeTradeInventory } from '@/features/architect/utils/draftReview/nativeTradeInventory';
import { AUTHORITATIVE_WORLD_TEAM_CODES } from '@/features/architect/utils/leagueTeams';

function fixture() {
  const names: Record<string, string> = {
    AAA: 'BKN',
    BBB: 'PHX',
    CCC: 'PHI',
    DDD: 'NYK',
    EEE: 'WAS',
    FFF: 'POR',
    GGG: 'MIL',
  };
  const input = JSON.parse(
    JSON.stringify(program).replace(
      /AAA|BBB|CCC|DDD|EEE|FFF|GGG/g,
      (s) => names[s]
    )
  );
  const resolved = resolveDraftClaimProgram(
    input,
    { BKN: 20, PHX: 3, PHI: 5, NYK: 6, WAS: 14, POR: 27, MIL: 25 },
    Object.fromEntries(input.claims.map((c: any) => [c.clauseId, true]))
  );
  const move = (originalTeam: string, fromTeam: string, toTeam: string) => ({
    entitlementId: originalTeam,
    originalTeam,
    fromTeam,
    toTeam,
    year: 2028,
    round: 1,
    assetKind: 'pick_ownership',
  });
  const next = NativeSelectionTransferZ.parse({
    operationId: 'mixed',
    asOfDate: '2028-06-20',
    movements: [move('PHI', 'PHI', 'BKN'), move('PHX', 'BKN', 'PHI')],
    playerMovements: [
      { playerId: 'one', contractId: 'c-one', fromTeam: 'PHI', toTeam: 'SAS' },
      { playerId: 'two', contractId: 'c-two', fromTeam: 'SAS', toTeam: 'BKN' },
    ],
  });
  return { resolved, next };
}
it('replays real three-party consideration then a bilateral selection return using updated holders', () => {
  const { resolved, next } = fixture(),
    original = structuredClone(resolved);
  expect(nativeSelectionHolders(resolved, [next])).toMatchObject({
    PHI: 'BKN',
    PHX: 'PHI',
  });
  const returned = {
    ...next,
    operationId: 'return',
    playerMovements: undefined,
    movements: next.movements.map((m) => ({
      ...m,
      fromTeam: m.toTeam,
      toTeam: m.fromTeam,
    })),
  };
  expect(nativeSelectionHolders(resolved, [next, returned])).toEqual(
    resolved.result!.allocation
  );
  expect(resolved).toEqual(original);
  expect(() => nativeSelectionHolders(resolved, [next, next])).toThrow(
    /duplicated/
  );
  expect(() => nativeSelectionHolders(resolved, [returned])).toThrow(
    /current owner/
  );
  expect(() =>
    nativeSelectionHolders(resolved, [next, { ...next, operationId: 'stale' }])
  ).toThrow(/current owner/);
});
it.each([
  'missing-give',
  'missing-receive',
  'fourth-team',
  'duplicate-player',
  'duplicate-contract',
  'self',
  'selection-only',
])('rejects incomplete or unsupported participation: %s', (mode) => {
  const { resolved, next } = fixture();
  if (mode === 'missing-give') next.playerMovements!.pop();
  if (mode === 'missing-receive') next.playerMovements![0].toTeam = 'BKN';
  if (mode === 'fourth-team')
    next.playerMovements!.push({
      playerId: 'three',
      contractId: 'c-three',
      fromTeam: 'LAL',
      toTeam: 'PHI',
    });
  if (mode === 'duplicate-player') next.playerMovements![1].playerId = 'one';
  if (mode === 'duplicate-contract')
    next.playerMovements![1].contractId = 'c-one';
  if (mode === 'self') next.playerMovements![1].toTeam = 'SAS';
  if (mode === 'selection-only') {
    next.playerMovements = undefined;
    next.movements[0].toTeam = 'SAS';
  }
  expect(() => nativeSelectionHolders(resolved, [next])).toThrow();
});
it('requires the atomic computation to retain the player-only participant and all untouched inventory', () => {
  const { resolved: program, next } = fixture();
  const entitlements: Record<string, any> = Object.fromEntries(
    program.slots.map((s) => [
      s.entitlementId,
      {
        id: s.entitlementId,
        kind: 'pick_ownership',
        holderTeam: program.result!.allocation[s.entitlementId],
        underlyingPickId: `${s.originalTeam}_2028_1st`,
        round: 1,
        seasonYear: 2028,
      },
    ])
  );
  if (program.kind === 'native-overlapping-pool-v1')
    for (const c of program.claims)
      for (const id of c.representationIds)
        entitlements[id] = {
          id,
          kind: 'swap_right',
          holderTeam: c.holderTeam,
          swapControllerPickId: `${c.holderTeam}_2028_1st`,
        };
  entitlements.untouched = {
    id: 'untouched',
    kind: 'pick_ownership',
    holderTeam: 'SAS',
    underlyingPickId: 'SAS_2030_1st',
    round: 1,
    seasonYear: 2030,
  };
  const teams = Object.fromEntries(
    AUTHORITATIVE_WORLD_TEAM_CODES.map((t) => [
      t,
      {
        entitlementIds: Object.keys(entitlements).filter(
          (id) => entitlements[id].holderTeam === t
        ),
      },
    ])
  );
  const computed = {
    entitlementUpdates: next.movements.map((m) => ({
      entitlementId: m.entitlementId,
      holderTeam: m.toTeam,
    })),
    teamUpdates: ['PHI', 'BKN', 'SAS'].map((teamCode) => ({
      teamCode,
      team: {
        entitlementIds: Object.keys(entitlements).filter(
          (id) =>
            (next.movements.find((m) => m.entitlementId === id)?.toTeam ??
              entitlements[id].holderTeam) === teamCode
        ),
      },
    })),
  };
  const input = {
    program,
    next,
    teams,
    entitlements,
    history: [],
    lifecycle: {
      kind: 'governed-pre-draft-native-selections-v1' as const,
      claimsEffectiveDate: '2028-06-20',
      selections: 'unconsumed-before-draft' as const,
      retainedFirstIds: [],
      softwareRetainedFirsts: [],
      tradingWindow: {
        kind: 'governed-test-seven-draft-window' as const,
        asOf: '2028-06-20T12:00:00Z',
        previousDraftCompletedAt: '2027-06-30T23:59:59Z',
        firstFutureDraftStartsAt: '2028-06-30T00:00:00Z',
        firstYear: 2028,
        lastYear: 2034,
      },
    },
  };
  expect(validateNativeTradeInventory({ ...input, computed })).toEqual({
    valid: true,
  });
  for (const code of ['PHI', 'BKN', 'SAS'])
    expect(() =>
      validateNativeTradeInventory({
        ...input,
        computed: {
          ...computed,
          teamUpdates: computed.teamUpdates.filter((t) => t.teamCode !== code),
        },
      })
    ).toThrow(/participating teams/);
  computed.teamUpdates[2].team.entitlementIds = [];
  expect(() => validateNativeTradeInventory({ ...input, computed })).toThrow(
    /untouched inventory/
  );
});
