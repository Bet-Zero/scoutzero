import { describe, expect, it } from 'vitest';
import { deriveDraftAssetDelta } from '@/features/architect/comparison/deriveDraftAssetDelta';
import type { ComparisonEventRow } from '@/features/architect/comparison/deriveComparisonViewModel';
import type { DraftReviewMutationReceipt } from '@/schemas/draftPickReviewMutation';

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
describe('committed original-pick comparison', () => {
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
