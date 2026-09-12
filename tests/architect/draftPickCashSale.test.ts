import { describe, it, expect } from 'vitest';
import { DraftPickConsiderationFactZ } from '@/schemas/draftPickConsideration';
import { evaluateDraftPickCashSale as evaluate } from '@/features/architect/utils/draftPickCashSale';
import {
  syntheticDraftOperation,
  syntheticOriginal,
} from './fixtures/draftPickOperation';

function fixture() {
  const f = syntheticDraftOperation(),
    o = f.ownership;
  const fact = DraftPickConsiderationFactZ.parse({
    id: 'synthetic-cash-sale',
    scope: 'first-round-consideration',
    context: o.context,
    status: o.status,
    effectiveAt: o.effectiveAt,
    validUntil: o.validUntil,
    unresolvedDependencyIds: [],
    sources: o.sources.map((s) => ({
      ...s,
      scope: 'first-round-consideration',
    })),
    outgoing: f.request.outgoing,
    recipientTeam: 'MIA',
    onlyListedFirstsOutgoing: true,
    allReturnConsiderationListed: true,
    unconditionalDirectExchange: true,
    consideration: [
      { id: 'synthetic-payment', kind: 'cash', amountCents: 100_000_000 },
    ],
  });
  return { request: f.request, fact };
}

describe('synthetic CBA2-A12.2 direct selection sale component', () => {
  it.each(['cash', 'cash-equivalent'] as const)(
    'prohibits the established first-round sale for %s',
    (kind) => {
      const f = fixture();
      f.fact.consideration[0].kind = kind;
      expect(evaluate(f.request, [f.fact])).toMatchObject({
        status: 'component-prohibits',
        leaf: 'CBA2-A12.2',
        tradingVerdict: 'not-evaluated',
        evidenceIds: [f.fact.id],
      });
    }
  );
  it('an established noncash-only exchange is outside this particular bar', () => {
    const f = fixture();
    f.fact.consideration[0] = {
      id: 'synthetic-player-contract',
      kind: 'established-noncash',
      amountCents: null,
    };
    expect(evaluate(f.request, [f.fact])).toMatchObject({
      status: 'component-permits',
      tradingVerdict: 'not-evaluated',
    });
  });
  it('does not require irrelevant other cash amounts or future lottery/Apron observations', () => {
    const f = fixture();
    f.fact.consideration.push({
      id: 'another-cash-item',
      kind: 'cash',
      amountCents: null,
    });
    expect(
      evaluate(f.request, [
        f.fact,
        { scope: 'lottery-method', status: 'unresolved' },
      ]).status
    ).toBe('component-prohibits');
  });
  it('covers multiple fully authenticated firsts in the same complete direct exchange', () => {
    const f = fixture();
    f.request.outgoing.push(syntheticOriginal(2030));
    f.fact.outgoing.push(syntheticOriginal(2030));
    expect(evaluate(f.request, [f.fact]).status).toBe('component-prohibits');
  });
  it.each([
    'mixed',
    'unclassified',
    'empty',
    'zero',
    'unknown-value',
    'duplicate',
    'negative',
    'unsafe',
    'fractional',
  ])('does not guess %s consideration', (kind) => {
    const f = fixture();
    if (kind === 'mixed')
      f.fact.consideration.push({
        id: 'player',
        kind: 'established-noncash',
        amountCents: null,
      });
    if (kind === 'unclassified') f.fact.consideration[0].kind = 'unclassified';
    if (kind === 'empty') f.fact.consideration = [];
    if (kind === 'zero') f.fact.consideration[0].amountCents = 0;
    if (kind === 'unknown-value') f.fact.consideration[0].amountCents = null;
    if (kind === 'duplicate')
      f.fact.consideration.push({ ...f.fact.consideration[0] });
    if (kind === 'negative') f.fact.consideration[0].amountCents = -1;
    if (kind === 'unsafe')
      f.fact.consideration[0].amountCents = Number.MAX_SAFE_INTEGER + 1;
    if (kind === 'fractional') f.fact.consideration[0].amountCents = 0.5;
    expect(evaluate(f.request, [f.fact]).status).toBe('needs-input');
  });
  it.each([
    'onlyListedFirstsOutgoing',
    'allReturnConsiderationListed',
    'unconditionalDirectExchange',
  ] as const)('requires %s', (key) => {
    const f = fixture();
    f.fact[key] = false;
    expect(evaluate(f.request, [f.fact]).status).toBe('needs-input');
  });
  it.each([
    'team',
    'date',
    'proposal',
    'state',
    'release',
    'pick',
    'self',
    'projection',
  ])('rejects wrong %s scope', (kind) => {
    const f = fixture();
    if (kind === 'team') f.request.context.team = 'POR';
    if (kind === 'date') f.request.context.asOf = '2026-07-16T12:00:00-04:00';
    if (kind === 'proposal') f.request.context.proposalSha256 = 'f'.repeat(64);
    if (kind === 'state') f.request.context.stateVersion = 'changed';
    if (kind === 'release') f.request.context.releaseId = 'new-release';
    if (kind === 'pick') f.fact.outgoing = [syntheticOriginal(2029)];
    if (kind === 'self') f.fact.recipientTeam = 'BOS';
    if (kind === 'projection') {
      const bad = {
        ...f.request,
        outgoing: [{ ...f.request.outgoing[0], kind: 'generated-projection' }],
      };
      expect(evaluate(bad, [f.fact]).status).toBe('needs-input');
      return;
    }
    expect(evaluate(f.request, [f.fact]).status).toBe('needs-input');
  });
  it.each([
    'omitted',
    'unqualified',
    'unreviewed',
    'limited',
    'wrong-source-scope',
    'future-effective',
    'missing-effective',
    'expired',
    'dependency',
    'conflict',
  ])('blocks %s evidence', (kind) => {
    const f = fixture();
    if (kind === 'omitted') f.fact.sources = [];
    if (kind === 'unqualified') f.fact.sources[0].qualification = 'unqualified';
    if (kind === 'unreviewed') f.fact.sources[0].review.status = 'unreviewed';
    if (kind === 'limited')
      f.fact.sources[0].review.limitations = ['classification incomplete'];
    if (kind === 'wrong-source-scope')
      f.fact.sources[0].scope = 'annual-cash-limit';
    if (kind === 'future-effective')
      f.fact.effectiveAt = '2026-07-20T00:00:00Z';
    if (kind === 'missing-effective') f.fact.effectiveAt = null;
    if (kind === 'expired') f.fact.validUntil = f.request.context.asOf;
    if (kind === 'dependency')
      f.fact.unresolvedDependencyIds = ['unknown-consideration'];
    if (kind === 'conflict') f.fact.status = 'conflicting';
    expect(evaluate(f.request, [f.fact]).status).toBe('needs-input');
  });
  it('rejects absent or duplicate facts and preserves serialization/caller state', () => {
    const f = fixture(),
      before = JSON.stringify(f);
    expect(evaluate(f.request, []).status).toBe('needs-input');
    expect(evaluate(f.request, [f.fact, f.fact]).status).toBe('needs-input');
    const result = evaluate(f.request, [f.fact]),
      loaded = JSON.parse(before);
    expect(evaluate(loaded.request, [loaded.fact])).toEqual(result);
    expect(JSON.stringify(f)).toBe(before);
  });
  it.each([null, 'BOS_2028_1st', { id: 17 }])(
    'retains malformed same-scope consideration conflicts: %j',
    (malformedPick) => {
      const f = fixture();
      const conflictingCash = {
        ...structuredClone(f.fact),
        pick: malformedPick,
      };
      f.fact.consideration[0].kind = 'established-noncash';
      f.fact.consideration[0].amountCents = null;
      expect(evaluate(f.request, [f.fact]).status).toBe('component-permits');
      for (const facts of [
        [f.fact, conflictingCash],
        [conflictingCash, f.fact],
      ])
        expect(evaluate(f.request, facts).status).toBe('needs-input');
    }
  );
});
