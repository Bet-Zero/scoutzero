import { describe, it, expect } from 'vitest';
import { reviewDraftPickComponents as review } from '@/features/architect/utils/draftPickReview';
import {
  DraftOriginalOwnershipFactZ,
  DraftStepienFactZ,
} from '@/schemas/draftPickOperation';
import { DraftPickConsiderationFactZ } from '@/schemas/draftPickConsideration';
import { syntheticOriginal } from './fixtures/draftPickOperation';
import { DraftPickApronContextZ } from '@/schemas/draftPickReview';
import { syntheticDraftReview as fixture } from './fixtures/draftPickReview';

function requireReview(f = fixture()) {
  const result = review(f);
  if (result.status !== 'reviewed')
    throw new Error('Expected a component review');
  return result;
}

describe('synthetic draft component composition', () => {
  it('retains successful components while explicitly blocking Apply', () => {
    const r = requireReview();
    expect(r.ownership.status).toBe('component-permits');
    expect(r.stepien.status).toBe('component-permits');
    expect(r.cashSale.status).toBe('component-permits');
    expect(r.apron[0]).toMatchObject({
      status: 'evaluated',
      result: {
        freezeTriggered: {
          status: 'non-applicable',
          reason: 'rule-begins-2024-25',
        },
      },
    });
    expect(r).toMatchObject({
      scope: 'components-only',
      tradingVerdict: 'not-evaluated',
      apply: 'blocked',
    });
  });
  it.each(['cash', 'missing', 'duplicate', 'stale', 'mixed'])(
    'preserves the %s consideration result beside independent permitting components',
    (kind) => {
      const f = fixture();
      const cash = DraftPickConsiderationFactZ.parse(f.facts[2]);
      if (kind === 'cash' || kind === 'mixed') {
        const payment = {
          id: 'synthetic-payment',
          kind: 'cash' as const,
          amountCents: 1,
        };
        cash.consideration =
          kind === 'cash' ? [payment] : [...cash.consideration, payment];
      }
      if (kind === 'stale') cash.context.stateVersion = 'older-state';
      f.facts[2] = cash;
      if (kind === 'missing') f.facts.pop();
      if (kind === 'duplicate') f.facts.push(structuredClone(cash));
      const result = requireReview(f);
      expect(result.cashSale.status).toBe(
        kind === 'cash' ? 'component-prohibits' : 'needs-input'
      );
      expect(result.ownership.status).toBe('component-permits');
      expect(result.stepien.status).toBe('component-permits');
      expect(result.apply).toBe('blocked');
      expect(review(JSON.parse(JSON.stringify(f)))).toEqual(result);
    }
  );
  it.each(['team', 'date', 'proposal', 'origin', 'year'])(
    'blocks wrong Apron %s without invalidating independent ownership',
    (kind) => {
      const f = fixture(),
        d = DraftPickApronContextZ.parse(f.apron[0]);
      if (kind === 'team') d.context.team = 'MIA';
      if (kind === 'date') d.input.asOf = '2026-07-16T00:00:00Z';
      if (kind === 'proposal') d.context.proposalSha256 = 'd'.repeat(64);
      if (kind === 'origin')
        d.input.team = d.input.originalPick.originalTeam = 'MIA';
      if (kind === 'year') d.input.originalPick.draftYear = 2029;
      f.apron[0] = d;
      const r = requireReview(f);
      expect(r.apron[0].status).toBe('needs-input');
      expect(r.ownership.status).toBe('component-permits');
      expect(r.apply).toBe('blocked');
    }
  );
  it.each(['missing', 'duplicate', 'malformed'])(
    'keeps %s Apron input explicit',
    (kind) => {
      const f = fixture();
      if (kind === 'missing') f.apron = [];
      if (kind === 'duplicate') f.apron.push(structuredClone(f.apron[0]));
      if (kind === 'malformed')
        f.apron = [{ input: { originalPick: { id: 'BOS_2028_1st' } } }];
      expect(requireReview(f).apron[0].status).toBe('needs-input');
    }
  );
  it('does not confuse original team with current conveying holder', () => {
    const f = fixture();
    f.request.context.team = 'MIA';
    // Missing current MIA ownership must block ownership, while the BOS original
    // pick's Apron context still uses BOS observations.
    const d = DraftPickApronContextZ.parse(f.apron[0]);
    d.context.team = 'MIA';
    f.apron[0] = d;
    const r = requireReview(f);
    expect(r.ownership.status).toBe('needs-input');
    expect(r.apron[0].status).toBe('evaluated');
  });
  it('reloads identically, freezes the receipt and leaves caller inputs writable', () => {
    const f = fixture(),
      before = JSON.stringify(f),
      r = requireReview(f);
    expect(review(JSON.parse(before))).toEqual(r);
    expect(JSON.parse(JSON.stringify(r))).toEqual(r);
    expect(Object.isFrozen(r.request.context)).toBe(true);
    expect(Object.isFrozen(r.apron[0])).toBe(true);
    f.request.context.stateVersion = 'changed';
    expect(r.request.context.stateVersion).toBe('synthetic-world-v1');
    expect(requireReview(f).ownership.status).toBe('needs-input');
  });
  it('rejects non-serializable inputs and duplicate outgoing IDs', () => {
    const f = fixture();
    expect(review({ ...f, facts: [undefined] }).status).toBe('invalid-input');
    f.request.outgoing.push(f.request.outgoing[0]);
    expect(review(f).status).toBe('invalid-input');
  });
  it('composes an established Apron penalty without making it an ownership or whole-trade verdict', () => {
    const f = fixture();
    f.request.outgoing = [syntheticOriginal(2034)];
    f.request.context.asOf = '2031-07-15T12:00:00-04:00';
    const owner = DraftOriginalOwnershipFactZ.parse(f.facts[0]);
    owner.context = { ...f.request.context };
    owner.pick = syntheticOriginal(2034);
    const stepien = DraftStepienFactZ.parse(f.facts[1]);
    stepien.context = { ...f.request.context };
    stepien.outgoing = [...f.request.outgoing];
    stepien.firstFutureDraftYear = 2032;
    stepien.firstFutureDraftStartsAt = '2032-06-23T20:00:00-04:00';
    stepien.previousDraft = {
      draftYear: 2031,
      completedAt: '2031-06-25T23:00:00-04:00',
    };
    stepien.throughDraftYear = 2036;
    stepien.branches[0].drafts = [2032, 2033, 2034, 2035, 2036].map(
      (draftYear) => ({
        draftYear,
        retained: draftYear === 2034 ? [] : [syntheticOriginal(draftYear)],
        inventoryComplete: true,
      })
    );
    f.facts = [owner, stepien];
    const d = DraftPickApronContextZ.parse(f.apron[0]);
    d.context = { ...f.request.context };
    d.input.asOf = f.request.context.asOf;
    d.input.triggerSeasonStartYear = 2026;
    d.input.originalPick = {
      id: 'BOS_2034_1st',
      originalTeam: 'BOS',
      draftYear: 2034,
      round: 1,
    };
    d.input.observations = [true, true, true, false, false].map((above, i) => ({
      team: 'BOS',
      seasonStartYear: 2026 + i,
      state: 'supported',
      sourceResultId: `synthetic-apron-${i}`,
      pendingUntil: null,
      sources: [
        {
          id: `synthetic-source-${i}`,
          artifactSha256: 'e'.repeat(64),
          locator: `synthetic#${i}`,
          scope: 'synthetic-measurement',
          qualification: 'qualified',
          publishedAt: '2031-06-01T00:00:00Z',
          capturedAt: '2031-06-02T00:00:00Z',
          review: {
            status: 'accepted',
            reference: 'synthetic-only',
            limitations: [],
          },
        },
      ],
      value: {
        apronTeamSalaryCents: above ? 2 : 1,
        secondApronCents: 1,
        measuredAt: `${2027 + i}-04-11T19:00:00-04:00`,
        lastRegularSeasonGameStart: `${2027 + i}-04-11T19:00:00-04:00`,
      },
    }));
    f.apron = [d];
    const r = requireReview(f);
    expect(r.ownership.status).toBe('component-permits');
    expect(r.stepien.status).toBe('component-permits');
    expect(r.apron[0]).toMatchObject({
      status: 'evaluated',
      result: {
        frozen: { status: 'known', value: true },
        penalized: { status: 'known', value: true },
        placement: { status: 'blocked' },
        owned: { status: 'blocked' },
      },
    });
    expect(r.apply).toBe('blocked');
    d.input.observations[0].value!.measuredAt = '2027-04-12T19:00:00-04:00';
    f.apron = [d];
    expect(requireReview(f).apron[0]).toMatchObject({
      result: { freezeTriggered: { status: 'blocked' } },
    });
  });
});
