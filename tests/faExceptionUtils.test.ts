import { describe, expect, it } from 'vitest';
import {
  allocateFaExceptionToIncoming,
  canUseFaException,
  getTeamFaExceptionBuckets,
  isFaExceptionEligibleType,
  summarizeFaExceptionUsage,
} from '@/features/architect/utils/faExceptionUtils';

describe('faExceptionUtils', () => {
  it('returns the current bucket array or an empty fallback', () => {
    const buckets = [{ type: 'NTMLE', remaining: 5_000_000 }];
    expect(getTeamFaExceptionBuckets({ faExceptionBuckets: buckets })).toBe(
      buckets
    );
    expect(getTeamFaExceptionBuckets()).toEqual([]);
  });

  it('uses either flag overrides or the default eligible exception list', () => {
    expect(isFaExceptionEligibleType('NTMLE')).toBe(true);
    expect(
      isFaExceptionEligibleType('RMLE', { faExceptionEligible: ['BAE'] })
    ).toBe(false);
    expect(
      isFaExceptionEligibleType('BAE', { faExceptionEligible: ['BAE'] })
    ).toBe(true);
  });

  it('preserves remaining, expiry, and apron-gating behavior', () => {
    const futureIso = '2099-07-01T00:00:00.000Z';
    const expiredIso = '2001-07-01T00:00:00.000Z';

    expect(
      canUseFaException(
        {
          teamTotalSalary: 170_000_000,
          teamSeasonState: {
            faExceptionBuckets: [{ type: 'NTMLE', remaining: 4_000_000, expiresAt: futureIso }],
          },
          context: { capSettings: { firstApron: 178_000_000, secondApron: 190_000_000 } },
        },
        'NTMLE'
      )
    ).toBe(true);

    expect(
      canUseFaException(
        {
          teamTotalSalary: 170_000_000,
          teamSeasonState: {
            faExceptionBuckets: [{ type: 'NTMLE', remaining: 0, expiresAt: futureIso }],
          },
          context: { capSettings: { firstApron: 178_000_000, secondApron: 190_000_000 } },
        },
        'NTMLE'
      )
    ).toBe(false);

    expect(
      canUseFaException(
        {
          teamTotalSalary: 170_000_000,
          teamSeasonState: {
            faExceptionBuckets: [{ type: 'NTMLE', remaining: 4_000_000, expiresAt: expiredIso }],
          },
          context: { capSettings: { firstApron: 178_000_000, secondApron: 190_000_000 } },
        },
        'NTMLE'
      )
    ).toBe(false);
  });

  it('mutates bucket remaining and records usage allocations', () => {
    const teamCtx = {
      teamSeasonState: {
        faExceptionBuckets: [{ type: 'NTMLE', remaining: 5_000_000 }],
      },
    };

    const bucket = allocateFaExceptionToIncoming({
      teamCtx,
      incomingPlayerId: 'p1',
      amount: 1_250_000,
      bucketType: 'NTMLE',
    });

    expect(bucket?.remaining).toBe(3_750_000);
    expect(teamCtx.faExceptionUsage).toEqual([
      { playerId: 'p1', amount: 1_250_000, type: 'NTMLE' },
    ]);
  });

  it('preserves summary text formatting', () => {
    expect(
      summarizeFaExceptionUsage({
        faExceptionUsage: [
          { type: 'NTMLE', amount: 2_000_000 },
          { type: 'BAE', amount: 500_000 },
        ],
      })
    ).toBe('NTMLE:2000000, BAE:500000');
  });
});
