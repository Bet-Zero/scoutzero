import { describe, expect, it } from 'vitest';
import { deriveExceptionDelta } from '@/features/architect/comparison/exceptionDelta';

describe('saved trade exceptions in Compare', () => {
  const saved = {
    worldId: 'saved-world',
    teamCode: 'CHI',
    seasonId: '2026-27',
    tpeId: 'traded-player',
  };
  const created = { ...saved, type: 'TPE_CREATED', mutationId: 'trade-1', historyKey: 'new', amountCreated: 8_000_000 };
  const used = { ...saved, type: 'TPE_CONSUMED', mutationId: 'trade-2', historyKey: 'use', amountConsumed: 2_500_000, remainingAmountAfter: 5_500_000 };
  const input = {
    worldId: saved.worldId,
    teamCode: saved.teamCode,
    season: saved.seasonId,
    moves: [
      { operationId: 'trade-1', occurredAt: '2026-11-14T12:00:00.000Z' },
      { operationId: 'trade-2', occurredAt: '2026-11-15T12:00:00.000Z' },
    ],
    history: [created, used, used, { ...used, historyKey: 'discard', mutationId: 'unsaved' }],
    balances: [{ id: saved.tpeId, remainingAmount: 5_500_000, createdFrom: 'Prior trade' }],
  };

  it('shows each recorded move once and agrees with the saved exception balance', () => {
    expect(deriveExceptionDelta(input)).toMatchObject({
      status: 'available',
      entries: [{ kind: 'created', amount: 8_000_000 }, { kind: 'used', amount: 2_500_000 }],
      balances: [{ remaining: 5_500_000 }],
    });
  });

  it('requires the same world, team, season and committed operation and avoids inferred balances', () => {
    expect(deriveExceptionDelta({ ...input, worldId: 'copy' }).status).toBe('deferred');
    expect(deriveExceptionDelta({ ...input, teamCode: 'TOR' }).status).toBe('deferred');
    expect(deriveExceptionDelta({ ...input, season: '2027-28' }).status).toBe('deferred');
    expect(deriveExceptionDelta({ ...input, balances: [{ id: saved.tpeId, remainingAmount: 3_000_000 }] })).toMatchObject({
      status: 'available',
      balances: [{ remaining: null }],
    });
  });
});
