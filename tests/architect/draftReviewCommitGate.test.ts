import { describe, expect, it } from 'vitest';
import { createDraftReviewCommitGate } from '@/features/architect/utils/draftReview/commitGate';

describe('coordinator-owned exact result commit seal', () => {
  it('consumes the exact result once while allowing unchanged transaction retries', () => {
    const gate = createDraftReviewCommitGate(),
      authority = {};
    const result = { worldId: 'world', updates: [{ holderTeam: 'MIA' }] };
    const token = gate.seal(authority, result);
    const retry = gate.consume(token, authority, structuredClone(result));
    expect(() => retry()).not.toThrow();
    expect(() => retry()).not.toThrow();
    expect(() => gate.consume(token, authority, result)).toThrow(/one-use/);
  });
  it.each([
    'worldId',
    'computeResult',
    'committedTeamUpdates',
    'timestamp',
    'payloadAsOfDate',
    'auditContext',
    'expectedRightsLedgersByTeam',
  ])('rejects changed %s and consumes the unsuccessful attempt', (field) => {
    const gate = createDraftReviewCommitGate(),
      authority = {};
    const result = { [field]: { original: true } };
    const token = gate.seal(authority, result);
    expect(() =>
      gate.consume(token, authority, { [field]: { injected: true } })
    ).toThrow(/exact validated/);
    expect(() => gate.consume(token, authority, result)).toThrow(/one-use/);
  });
  it('rejects forged, foreign-gate, wrong-capability and serialized tokens', () => {
    const gate = createDraftReviewCommitGate(),
      authority = {},
      result = {};
    for (const token of [
      {},
      undefined,
      createDraftReviewCommitGate().seal(authority, result),
      JSON.parse(JSON.stringify(gate.seal(authority, result))),
    ])
      expect(() => gate.consume(token, authority, result)).toThrow(/one-use/);
    expect(() =>
      gate.consume(gate.seal(authority, result), {}, result)
    ).toThrow(/one-use/);
  });
  it('rejects in-place result mutation while Firestore reads are pending', () => {
    const gate = createDraftReviewCommitGate(),
      authority = {};
    const result = { updates: [{ holderTeam: 'MIA' }] };
    const assertUnchanged = gate.consume(
      gate.seal(authority, result),
      authority,
      result
    );
    result.updates[0].holderTeam = 'DEN';
    expect(() => assertUnchanged()).toThrow(/exact validated/);
  });
});
