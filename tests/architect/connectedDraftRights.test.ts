import { describe, expect, it } from 'vitest';
import { resolveStoredOrComputedIdentityKey } from '@/features/architect/utils/entitlements/entitlementIdentity';
import { compileSimulationDraftBaseline } from '@/features/architect/utils/simulationDraftBaseline';
import { compileSimulationConnectedDraftBaseline } from '@/features/architect/utils/simulationConnectedDraftBaseline';
import { DraftConnectedProgramsZ } from '@/schemas/draftConnectedRights';
import {
  governedDraftHolders,
  reviewGovernedDraftWorldTrade,
  validateGovernedDraftBaseline,
} from '@/features/architect/utils/governedDraftWorld.baseline';
import { connectedPossessionBranches } from '@/features/architect/utils/draftReview/connectedRights';
import { simulationPickStatuses } from '@/features/architect/utils/simulationPickStatus';
import { decorateEntitlementForTrade } from '@/features/architect/utils/entitlements/entitlementTerms';
import { validateConnectedTradeInventory } from '@/features/architect/utils/draftReview/connectedTradeInventory';
import type { DraftReviewCapabilityRecord } from '@/features/architect/utils/draftReview/capability';

const ASOF = '2026-11-14T12:00:00.000Z';
const teams = Array.from(
  { length: 30 },
  (_, i) =>
    `A${String.fromCharCode(65 + Math.floor(i / 26))}${String.fromCharCode(65 + (i % 26))}`
);
function base() {
  const entitlements = teams.flatMap((team) =>
    Array.from({ length: 8 }, (_, i) => ({
      id: `test:${team}:${2027 + i}`,
      kind: 'pick_ownership',
      holderTeam: team,
      originalTeam: team,
      seasonYear: 2027 + i,
      round: 1,
      underlyingPickId: `${team}_${2027 + i}_1st`,
      description: 'Invented unit-test original',
    }))
  );
  return compileSimulationDraftBaseline({
    candidate: {
      asOf: ASOF,
      unresolved: [],
      teamInputs: teams.map((team) => ({ team })),
      records: entitlements.map((e) => ({
        entitlementId: e.id,
        group: 'original-supported',
        reportedHolder: e.holderTeam,
        nativeAssets: [],
        originalPick: {
          id: e.underlyingPickId,
          originalTeam: e.originalTeam,
          draftYear: e.seasonYear,
          round: 1,
        },
        retainedAssessment: {
          actions: {
            resolveConditionalOutcome: {
              status: 'non-applicable-or-underlying-program-only',
            },
          },
        },
      })),
    },
    candidateSha256: 'a'.repeat(64),
    entitlements,
    seasonId: '2026-27',
    releaseId: 'invented-unit-input',
    currentWindow: {
      kind: 'governed-test-seven-draft-window',
      asOf: ASOF,
      previousDraftCompletedAt: '2026-06-25T04:00:00.000Z',
      firstFutureDraftStartsAt: '2027-06-23T04:00:00.000Z',
      firstYear: 2027,
      lastYear: 2033,
    },
    admissionYears: { first: 2027, last: 2034 },
    currentAssumptions: [
      {
        id: 'test-only',
        statement: 'Invented software input, not real NBA facts.',
      },
    ],
    apronHistory: teams.flatMap((team) =>
      [2024, 2025].map((seasonStartYear) => ({
        team,
        seasonStartYear,
        aboveSecondApron: false,
        sourceResultId: 'test',
      }))
    ),
  });
}
function program() {
  return {
    id: 'protected',
    sourceRefs: ['invented:test'],
    terms: 'First top ten protected in 2027; unprotected 2028 fallback.',
    originals: ['AAA_2027_1st', 'AAA_2028_1st'],
    interests: [
      {
        entitlementId: 'protected:owed',
        anchorPickId: 'AAA_2027_1st',
        possibleOriginals: ['AAA_2027_1st', 'AAA_2028_1st'],
        terms: 'AAA 2027 top ten protected, unprotected 2028 fallback',
      },
      {
        entitlementId: 'protected:keep27',
        anchorPickId: 'AAA_2027_1st',
        possibleOriginals: ['AAA_2027_1st'],
        terms: 'AAA 2027 only if top ten',
      },
      {
        entitlementId: 'protected:keep28',
        anchorPickId: 'AAA_2028_1st',
        possibleOriginals: ['AAA_2028_1st'],
        terms: 'AAA 2028 only if the prior 2027 obligation conveys',
      },
    ],
    possessionCases: [
      {
        id: 'convey',
        condition: '2027 position 11–30',
        allocation: {
          AAA_2027_1st: 'protected:owed',
          AAA_2028_1st: 'protected:keep28',
        },
      },
      {
        id: 'defer',
        condition: '2027 position 1–10',
        allocation: {
          AAA_2027_1st: 'protected:keep27',
          AAA_2028_1st: 'protected:owed',
        },
      },
    ],
  };
}
function connected() {
  return compileSimulationConnectedDraftBaseline({
    baseline: base(),
    programs: [program()],
    holders: {
      'protected:owed': 'AAB',
      'protected:keep27': 'AAA',
      'protected:keep28': 'AAA',
    },
    releaseId: 'test-connected',
    sourceSha256: 'b'.repeat(64),
  });
}
function proposal(
  b = connected(),
  moves = [
    { id: 'protected:owed', from: 'AAB', to: 'AAC' },
    { id: 'test:AAC:2028', from: 'AAC', to: 'AAB' },
  ],
  holders = governedDraftHolders(b, []).holders
) {
  const codes = [...new Set(moves.flatMap((m) => [m.from, m.to]))];
  return {
    baseline: b,
    holders,
    stateVersion: 'test-state',
    state: {
      teams: codes.map((teamCode) => ({
        teamCode,
        team: {
          entitlementIds: b.identities.filter((id) => holders[id] === teamCode),
          entitlements: Object.values(b.retainedEntitlements)
            .filter((e) => holders[String(e.id)] === teamCode)
            .map((e) => ({ ...e, holderTeam: teamCode })),
        },
      })),
    },
    payload: {
      asOfDate: '2026-11-14',
      tradeCtx: {
        worldId: 'test-world',
        source: 'tradeMachine',
        asOfDate: '2026-11-14',
        yearKey: 2027,
      },
      teams: codes.map((teamCode) => ({
        teamCode,
        sends: [],
        picksOut: [],
        entitlementsOut: moves
          .filter((m) => m.from === teamCode)
          .map((m) => ({
            ...decorateEntitlementForTrade({
              ...b.retainedEntitlements[m.id],
              holderTeam: teamCode,
            }),
            entitlementId: m.id,
            toTeamId: m.to,
          })),
      })),
    },
  };
}

describe('current connected rights — CBA2-A12.1/A12.3/A12.4/L09.6', () => {
  it('keeps same-original conditional interests distinct from each other and reference originals', () => {
    const b = connected();
    const keys = Object.values(b.retainedEntitlements).map(
      resolveStoredOrComputedIdentityKey
    );
    expect(new Set(keys).size).toBe(keys.length);
    const broken = structuredClone(b);
    delete broken.retainedEntitlements['protected:owed'].identityKey;
    delete broken.records.find((r) => r.entitlement.id === 'protected:owed')!
      .entitlement.identityKey;
    expect(() => validateGovernedDraftBaseline(broken)).toThrow(
      /distinct immutable identity/
    );
  });
  it('transfers a protected obligation with its fallback, without moving either retained residual', async () => {
    const p = proposal();
    const snapshot = JSON.stringify(p.baseline);
    const result = await reviewGovernedDraftWorldTrade(p);
    expect(result.reviews.filter((r) => !r.eligible)).toEqual([]);
    const history = [
      {
        operationId: 'one',
        asOfDate: '2026-11-14',
        movements: result.movements.map(
          ({ entitlementId, fromTeam, toTeam }) => ({
            entitlementId,
            fromTeam,
            toTeam,
          })
        ),
      },
    ];
    const next = governedDraftHolders(p.baseline, history);
    expect(next.holders['protected:owed']).toBe('AAC');
    expect(next.holders['protected:keep27']).toBe('AAA');
    expect(next.holders['protected:keep28']).toBe('AAA');
    expect(JSON.stringify(p.baseline)).toBe(snapshot);
    expect(
      (
        await reviewGovernedDraftWorldTrade(
          proposal(
            p.baseline,
            [
              { id: 'protected:owed', from: 'AAC', to: 'AAB' },
              { id: 'test:AAC:2028', from: 'AAB', to: 'AAC' },
            ],
            next.holders
          )
        )
      ).reviews.every((r) => r.eligible)
    ).toBe(true);
  });
  it('permits the reserved fallback residual only with another guaranteed first in the affected adjacent pair', async () => {
    // AAA is already owed either 2027 or 2028, never both. Giving its 2028
    // residual away may leave it empty in both years; an incoming 2029 cannot cure it.
    const bad = await reviewGovernedDraftWorldTrade(
      proposal(connected(), [
        { id: 'protected:keep28', from: 'AAA', to: 'AAC' },
        { id: 'test:AAC:2029', from: 'AAC', to: 'AAA' },
      ])
    );
    expect(
      bad.reviews.find((r) => 'team' in r.review && r.review.team === 'AAA')
        ?.eligible
    ).toBe(false);
    const good = await reviewGovernedDraftWorldTrade(
      proposal(connected(), [
        { id: 'protected:keep28', from: 'AAA', to: 'AAC' },
        { id: 'test:AAC:2028', from: 'AAC', to: 'AAA' },
      ])
    );
    expect(good.reviews.filter((r) => !r.eligible)).toEqual([]);
  });
  it('does not count a conditional incoming first in a branch where it does not convey', () => {
    const b = connected(),
      h = governedDraftHolders(b, []).holders;
    delete h['test:AAB:2027'];
    delete h['test:AAB:2028'];
    const branches = connectedPossessionBranches(b, h, 'AAB');
    expect(
      branches.map((b) =>
        b.drafts
          .filter((d) => d.draftYear <= 2028 && d.retained.length)
          .map((d) => d.draftYear)
      )
    ).toEqual([[2027], [2028]]);
  });
  it('rejects overlapping programs, missing underlying allocations and counterfeit ownership facts', () => {
    const p = program();
    expect(() => DraftConnectedProgramsZ.parse([p, p])).toThrow();
    delete (p.possessionCases[1].allocation as Record<string, string>)
      .AAA_2028_1st;
    expect(() => DraftConnectedProgramsZ.parse([p])).toThrow();
    const b = connected();
    b.records.find(
      (r) => r.entitlement.id === 'protected:owed'
    )!.ownership.claims[0].status = 'owned-unconditionally';
    expect(() => validateGovernedDraftBaseline(b)).toThrow('Connected rights');
  });
  it('never restores a forfeited original, or counts an archived underlying identity as a second claim', () => {
    const b = base();
    b.retainedEntitlements['test:AAA:2027'].simulationRestriction = 'forfeited';
    b.records = b.records.filter((r) => r.entitlement.id !== 'test:AAA:2027');
    expect(() =>
      compileSimulationConnectedDraftBaseline({
        baseline: b,
        programs: [program()],
        holders: {},
        releaseId: 'bad',
        sourceSha256: 'b'.repeat(64),
      })
    ).toThrow('forfeited');
    const c = connected();
    const status = simulationPickStatuses(c);
    expect(status['test:AAA:2027'].tradeable).toBe(false);
    expect(status['protected:owed'].tradeable).toBe(true);
    c.records.push(
      base().records.find((r) => r.entitlement.id === 'test:AAA:2027')!
    );
    expect(() => validateGovernedDraftBaseline(c)).toThrow(
      'underlying original'
    );
  });
  it('checks every possible first in an interest for a freeze or unavailable history', async () => {
    const b = connected();
    b.apron = b.apron.filter((a) => a.originalPick.id !== 'AAA_2028_1st');
    expect(simulationPickStatuses(b)['protected:owed'].tradeable).toBe(false);
    const result = await reviewGovernedDraftWorldTrade(proposal(b));
    expect(result.reviews.every((r) => r.eligible)).toBe(false);
  });
  it('rejects a stale sender, duplicate interest and a hidden term change before review', async () => {
    for (const kind of ['sender', 'duplicate', 'terms']) {
      const p = proposal();
      if (kind === 'sender') p.holders['protected:owed'] = 'AAD';
      if (kind === 'duplicate')
        p.payload.teams[0].entitlementsOut.push(
          p.payload.teams[0].entitlementsOut[0]
        );
      if (kind === 'terms')
        Object.assign(p.payload.teams[0].entitlementsOut[0], {
          description: 'Unprotected, no fallback',
        });
      await expect(reviewGovernedDraftWorldTrade(p)).rejects.toThrow();
    }
  });
  it('preserves swap-return custody and tests a connected protection in every adjacent-year branch', async () => {
    const swap = {
      id: 'swap',
      sourceRefs: ['invented:swap'],
      terms: 'One-for-one priority swap',
      originals: ['AAA_2029_1st', 'AAB_2029_1st'],
      interests: [
        {
          entitlementId: 'swap:choice',
          anchorPickId: 'AAA_2029_1st',
          possibleOriginals: ['AAA_2029_1st', 'AAB_2029_1st'],
          terms: 'AAA selection with swap right',
        },
        {
          entitlementId: 'swap:return',
          anchorPickId: 'AAB_2029_1st',
          possibleOriginals: ['AAA_2029_1st', 'AAB_2029_1st'],
          terms: 'AAB retained return after prior swap',
        },
      ],
      possessionCases: [
        {
          id: 'all-rankings',
          condition: 'One first each for every ranking and election',
          allocation: {
            AAA_2029_1st: 'swap:choice',
            AAB_2029_1st: 'swap:return',
          },
        },
      ],
    };
    const b = compileSimulationConnectedDraftBaseline({
      baseline: base(),
      programs: [program(), swap],
      holders: {
        'protected:owed': 'AAB',
        'protected:keep27': 'AAA',
        'protected:keep28': 'AAA',
        'swap:choice': 'AAA',
        'swap:return': 'AAB',
      },
      releaseId: 'combined',
      sourceSha256: 'b'.repeat(64),
    });
    const returned = await reviewGovernedDraftWorldTrade(
      proposal(b, [
        { id: 'swap:return', from: 'AAB', to: 'AAC' },
        { id: 'test:AAC:2029', from: 'AAC', to: 'AAB' },
      ])
    );
    expect(returned.reviews.filter((r) => !r.eligible)).toEqual([]);
    const risky = await reviewGovernedDraftWorldTrade(
      proposal(b, [
        { id: 'swap:choice', from: 'AAA', to: 'AAC' },
        { id: 'test:AAC:2030', from: 'AAC', to: 'AAA' },
      ])
    );
    expect(
      risky.reviews.find((r) => 'team' in r.review && r.review.team === 'AAA')
        ?.eligible
    ).toBe(false);
    const safe = await reviewGovernedDraftWorldTrade(
      proposal(b, [
        { id: 'swap:choice', from: 'AAA', to: 'AAC' },
        { id: 'test:AAC:2029', from: 'AAC', to: 'AAA' },
      ])
    );
    expect(safe.reviews.filter((r) => !r.eligible)).toEqual([]);
  });

  it('trades a reserved second-round counterparty interest without inventing a first-round witness', async () => {
    const p =
      program() as unknown as import('@/schemas/draftConnectedRights').DraftConnectedProgram;
    p.originals.push('AAA_2027_2nd');
    p.interests.push({
      entitlementId: 'second:counterparty',
      anchorPickId: null,
      possibleOriginals: ['AAA_2027_2nd'],
      terms: 'Second only if prior first conveys',
    });
    p.interests[0].possibleOriginals.push('AAA_2027_2nd');
    p.possessionCases[0].allocation.AAA_2027_2nd = 'second:counterparty';
    p.possessionCases[1].allocation.AAA_2027_2nd = 'protected:owed';
    const b = compileSimulationConnectedDraftBaseline({
      baseline: base(),
      programs: [p],
      holders: {
        'protected:owed': 'AAB',
        'protected:keep27': 'AAA',
        'protected:keep28': 'AAA',
        'second:counterparty': 'AAC',
      },
      releaseId: 'second',
      sourceSha256: 'b'.repeat(64),
    });
    expect(simulationPickStatuses(b)['second:counterparty'].tradeable).toBe(
      true
    );
    // The second-round contingent claim is established noncash consideration;
    // AAA keeps its own firsts in every unaffected year after giving up 2030.
    const result = await reviewGovernedDraftWorldTrade(
      proposal(b, [
        { id: 'second:counterparty', from: 'AAC', to: 'AAA' },
        { id: 'test:AAA:2030', from: 'AAA', to: 'AAC' },
      ])
    );
    expect(result.reviews.filter((r) => !r.eligible)).toEqual([]);
    expect(
      result.movements.find((m) => m.entitlementId === 'second:counterparty')
        ?.round
    ).toBe(2);
    expect(result.firstsByTeam.AAC).toEqual([]);
    const missingCounterparty = structuredClone(p);
    delete missingCounterparty.possessionCases[0].allocation.AAA_2027_2nd;
    expect(() =>
      DraftConnectedProgramsZ.parse([missingCounterparty])
    ).toThrow();
    expect(() =>
      DraftConnectedProgramsZ.parse([
        {
          ...p,
          possessionCases: [
            {
              ...p.possessionCases[0],
              allocation: {
                ...p.possessionCases[0].allocation,
                AAA_2027_2nd: null,
              },
            },
          ],
        },
      ])
    ).toThrow();
    const malformed = structuredClone(p);
    malformed.interests.at(-1)!.possibleOriginals.push('AAA_2027_1st');
    expect(() => DraftConnectedProgramsZ.parse([malformed])).toThrow();
  });

  it('routes separate retained interests to two counterparties in one three-team trade', async () => {
    const b = connected();
    const p = proposal(b, [
      { id: 'protected:keep27', from: 'AAA', to: 'AAB' },
      { id: 'protected:keep28', from: 'AAA', to: 'AAC' },
      { id: 'test:AAB:2027', from: 'AAB', to: 'AAA' },
      { id: 'test:AAC:2028', from: 'AAC', to: 'AAA' },
    ]);
    const result = await reviewGovernedDraftWorldTrade(p);
    expect(result.reviews.filter((r) => !r.eligible)).toEqual([]);
    const after = governedDraftHolders(b, [
      {
        operationId: 'three-team',
        asOfDate: '2026-11-14',
        movements: result.movements.map(
          ({ entitlementId, fromTeam, toTeam }) => ({
            entitlementId,
            fromTeam,
            toTeam,
          })
        ),
      },
    ]);
    expect(after.holders['protected:keep27']).toBe('AAB');
    expect(after.holders['protected:keep28']).toBe('AAC');
    expect(after.holders['protected:owed']).toBe('AAB');
  });
  it('conserves every third-party membership at the actual computed-inventory boundary', () => {
    const b = connected(),
      root = 'architect_worlds/test-world/';
    const snapshots = Object.fromEntries([
      ...Object.entries(b.initialTeams).map(([id, d]) => [
        root + 'teams/' + id,
        JSON.stringify(d),
      ]),
      ...Object.entries(b.retainedEntitlements).map(([id, d]) => [
        root + 'entitlements/' + id,
        JSON.stringify(d),
      ]),
    ]);
    const movements = [
      {
        entitlementId: 'protected:owed',
        fromTeam: 'AAB',
        toTeam: 'AAC',
        originalTeam: 'AAA',
        year: 2027,
        round: 1,
      },
      {
        entitlementId: 'test:AAC:2028',
        fromTeam: 'AAC',
        toTeam: 'AAB',
        originalTeam: 'AAC',
        year: 2028,
        round: 1,
      },
    ];
    const review = {
      scope: 'governed-world-fixture',
      connectedInventory: true,
      worldId: 'test-world',
      documentSnapshots: snapshots,
      movements,
    } as DraftReviewCapabilityRecord;
    const h = governedDraftHolders(b, [
      {
        operationId: 'one',
        asOfDate: '2026-11-14',
        movements: movements.map(({ entitlementId, fromTeam, toTeam }) => ({
          entitlementId,
          fromTeam,
          toTeam,
        })),
      },
    ]).holders;
    const computed = {
      entitlementUpdates: movements.map((m) => ({
        entitlementId: m.entitlementId,
        holderTeam: m.toTeam,
      })),
      teamUpdates: ['AAB', 'AAC'].map((teamCode) => ({
        teamCode,
        team: {
          entitlementIds: b.identities.filter((id) => h[id] === teamCode),
        },
      })),
    };
    expect(validateConnectedTradeInventory(review, computed)).toEqual({
      valid: true,
    });
    computed.teamUpdates[0].team.entitlementIds.push('protected:keep28');
    expect(() => validateConnectedTradeInventory(review, computed)).toThrow(
      'dropped or duplicated'
    );
  });
});
