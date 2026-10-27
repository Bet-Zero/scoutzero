import { describe, expect, it, vi } from 'vitest';
import { deriveComparisonViewModel } from '@/features/architect/comparison/deriveComparisonViewModel';
import { deriveDraftAssetDelta } from '@/features/architect/comparison/deriveDraftAssetDelta';
import type { ComparisonEventRow } from '@/features/architect/comparison/deriveComparisonViewModel';
import type { DraftReviewMutationReceipt } from '@/schemas/draftPickReviewMutation';
import { REAL_DRAFT_REVIEW_PIN } from '@/features/architect/utils/draftPickRealReviewPin';

const environment = vi.hoisted(() => ({ allowed: false }));
vi.mock('@/firebaseConfig', () => ({
  isSyntheticDraftReviewEnvironment: () => environment.allowed,
}));

function event(
  operationId = 'op1',
  fromTeam = 'BOS',
  toTeam = 'MIA'
): ComparisonEventRow {
  const receipt: DraftReviewMutationReceipt = {
    scope: 'synthetic-review-only',
    operationId,
    worldId: 'world',
    releaseId: 'synthetic',
    releaseSha256: 'a'.repeat(64),
    asOfDate: '2026-07-15',
    movements: [
      {
        entitlementId: 'original',
        originalTeam: 'BOS',
        year: 2028,
        round: 1,
        fromTeam,
        toTeam,
      },
    ],
  };
  return {
    id: operationId,
    eventId: operationId,
    occurredAt: '2026-07-15T00:00:00Z',
    mutationType: 'executeTrade',
    playerIds: [],
    teamCodes: [fromTeam, toTeam],
    teamsInvolved: [fromTeam, toTeam],
    beforeTotalsByTeam: {},
    afterTotalsByTeam: {},
    raw: { operationId, metadata: { draftReviewReceipt: receipt } },
  };
}

describe('conditional receipt chain in Compare', () => {
  function journey() {
    const program = {
      id: 'p',
      originalTeam: 'BOS',
      stages: [
        { entitlementId: 'original', year: 2028, protectedThrough: 10 },
        { entitlementId: 'fallback', year: 2029, protectedThrough: 0 },
      ],
      results: [],
    };
    const trade = event();
    const tradeReceipt = trade.raw!.metadata!
      .draftReviewReceipt as DraftReviewMutationReceipt;
    tradeReceipt.scope = 'governed-simulation-only';
    tradeReceipt.assumptionSha256 = 'b'.repeat(64);
    tradeReceipt.assumptions = {
      kind: 'governed-test-assumptions-v1',
      catalogueSha256: REAL_DRAFT_REVIEW_PIN.payloadSha256,
      proposalSha256: 'c'.repeat(64),
      stateDigest: 'test',
      asOf: '2026-07-15T00:00:00Z',
      branchMode: 'protection-programs',
      programs: [program],
      ownership: 'stipulated-for-software-tests',
      otherHoldings: 'unknown-not-empty',
    };
    const receipt = {
      scope: 'governed-simulation-only',
      worldId: 'world',
      operationId: 'draft',
      catalogueSha256: REAL_DRAFT_REVIEW_PIN.payloadSha256,
      before: [program],
      after: [
        {
          ...program,
          results: [{ year: 2028, position: 10, outcome: 'deferred' }],
        },
      ],
      positions: { BOS: 10 },
      draftYear: 2028,
      date: '2028-06-30',
      movements: [
        {
          entitlementId: 'original',
          originalTeam: 'BOS',
          year: 2028,
          round: 1,
          fromTeam: 'MIA',
          toTeam: 'BOS',
        },
        {
          entitlementId: 'fallback',
          originalTeam: 'BOS',
          year: 2029,
          round: 1,
          fromTeam: 'BOS',
          toTeam: 'MIA',
        },
      ],
    };
    const draft = {
      ...event('draft'),
      mutationType: 'draftConveyance',
      raw: {
        operationId: 'draft',
        metadata: { conditionalDraftReceipt: receipt },
      },
    };
    return { trade, draft, receipt };
  }
  it('nets the returned protected first and reports the next obligation on both teams', () => {
    const { trade, draft } = journey();
    expect(deriveDraftAssetDelta([trade, draft], 'world', 'BOS')).toEqual({
      additions: [],
      removals: [
        { entitlementId: 'fallback', displayName: 'BOS 2029 first-round pick' },
      ],
    });
    expect(deriveDraftAssetDelta([trade, draft], 'world', 'MIA')).toEqual({
      removals: [],
      additions: [
        { entitlementId: 'fallback', displayName: 'BOS 2029 first-round pick' },
      ],
    });
  });
  it('rejects a valid-looking result with terms different from the committed trade', () => {
    const { trade, draft, receipt } = journey();
    receipt.before[0] = {
      ...receipt.before[0],
      stages: receipt.before[0].stages.map((s, i) =>
        i ? s : { ...s, protectedThrough: 12 }
      ),
    };
    receipt.after[0].stages = receipt.before[0].stages;
    expect(deriveDraftAssetDelta([trade, draft], 'world', 'BOS')).toBeNull();
    expect(deriveDraftAssetDelta([draft], 'world', 'BOS')).toBeNull();
  });
});
describe('committed original-pick comparison', () => {
  it('does not promote a schema-shaped user event into a production draft delta', () => {
    const input = {
      worldId: 'world',
      worldName: 'World',
      teamCode: 'BOS',
      baselineSeason: '2026-27',
      currentSeason: '2026-27',
      committedEventRows: [event()],
      currentRosterPlayerIds: [],
    };
    environment.allowed = false;
    const production = deriveComparisonViewModel(input);
    expect(production.draftAssetDelta).toBeNull();
    expect(
      production.unavailableSummary.some((s) => s.field === 'draftAssetDelta')
    ).toBe(true);
    environment.allowed = true;
    expect(
      deriveComparisonViewModel(input).draftAssetDelta?.removals
    ).toHaveLength(1);
    environment.allowed = false;
  });
  it('shows the same actual movement for both teams and after serialization', () => {
    const row = event();
    expect(deriveDraftAssetDelta([row], 'world', 'BOS')).toEqual({
      additions: [],
      removals: [
        { entitlementId: 'original', displayName: 'BOS 2028 first-round pick' },
      ],
    });
    const received = {
      additions: [
        { entitlementId: 'original', displayName: 'BOS 2028 first-round pick' },
      ],
      removals: [],
    };
    expect(deriveDraftAssetDelta([row], 'world', 'MIA')).toEqual(received);
    expect(
      deriveDraftAssetDelta(JSON.parse(JSON.stringify([row])), 'world', 'MIA')
    ).toEqual(received);
  });
  it('nets a complete return movement and chains a later onward transfer', () => {
    expect(
      deriveDraftAssetDelta(
        [event(), event('op2', 'MIA', 'BOS')],
        'world',
        'BOS'
      )
    ).toEqual({ additions: [], removals: [] });
    expect(
      deriveDraftAssetDelta(
        [event(), event('op2', 'MIA', 'DEN')],
        'world',
        'MIA'
      )
    ).toEqual({ additions: [], removals: [] });
    expect(
      deriveDraftAssetDelta(
        [event(), event('op2', 'MIA', 'DEN')],
        'world',
        'DEN'
      )?.additions
    ).toHaveLength(1);
  });
  it('keeps incomplete, conflicting, cross-world or duplicate history unavailable', () => {
    const row = event();
    expect(deriveDraftAssetDelta([row], 'other-world', 'BOS')).toBeNull();
    expect(deriveDraftAssetDelta([row, row], 'world', 'BOS')).toBeNull();
    expect(
      deriveDraftAssetDelta([row, event('op2', 'DEN', 'MIA')], 'world', 'BOS')
    ).toBeNull();
    expect(
      deriveDraftAssetDelta([row, { ...event('op2'), raw: {} }], 'world', 'BOS')
    ).toBeNull();
    expect(
      deriveDraftAssetDelta(
        [row, { ...event('season'), mutationType: 'seasonAdvance' }],
        'world',
        'BOS'
      )
    ).toBeNull();
    expect(
      deriveDraftAssetDelta(
        [{ ...row, raw: { ...row.raw, operationId: 'wrong' } }],
        'world',
        'BOS'
      )
    ).toBeNull();
  });
});
