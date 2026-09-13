import { describe, expect, it } from 'vitest';
import { evaluateSuppliedDraftPenaltyOrder } from '@/features/architect/utils/draftPenaltyOrder';
import type {
  DraftPenaltyOrderFact,
  DraftPenaltyOrderRequest,
} from '@/schemas/draftPenaltyOrder';

// Oracle recorded before execution: pinned CBA2-L08.8 / SC080(a).
// .400 precedes .500 precedes .600; reversing those three fails this component.
// This stipulates penalty membership, not real NBA eligibility or final slots.
function fixture() {
  const context = {
    proposalSha256: 'a'.repeat(64),
    stateVersion: 'world-state-1',
    releaseId: 'synthetic-penalty-order',
    asOf: '2027-07-15T12:00:00Z',
    team: 'DEN',
  };
  const request: DraftPenaltyOrderRequest = {
    context,
    draftYear: 2027,
    proposedEarlierToLater: ['CCC_2027_1st', 'BBB_2027_1st', 'AAA_2027_1st'],
  };
  const fact: DraftPenaltyOrderFact = {
    id: 'complete-penalty-order-input',
    context: { ...context },
    scope: 'penalized-first-relative-order',
    status: 'supported in stated scope',
    effectiveAt: '2027-07-15T00:00:00Z',
    validUntil: null,
    unresolvedDependencyIds: [],
    sources: [
      {
        id: 'synthetic-order-source',
        artifactSha256: 'b'.repeat(64),
        locator: 'complete-set-and-original-team-percentages',
        scope: 'penalized-first-relative-order',
        qualification: 'qualified',
        publishedAt: null,
        capturedAt: null,
        review: {
          status: 'accepted',
          reference: 'synthetic-only',
          limitations: [],
        },
      },
    ],
    draftYear: 2027,
    allPenalizedFirstsListed: true,
    members: ['AAA', 'BBB', 'CCC'].map((team, i) => ({
      pick: {
        kind: 'authenticated-original-pick',
        id: `${team}_2027_1st`,
        originalTeam: team,
        draftYear: 2027,
        round: 1,
      },
      officialWinningPercentage: ['0.600', '0.500', '0.400'][i],
    })),
  };
  return { request, fact };
}

describe('supplied penalized-first relative order', () => {
  it('implements SC080(a) positive and negative without a placement or trading verdict', () => {
    const { request, fact } = fixture();
    const before = JSON.stringify({ request, fact });
    const positive = evaluateSuppliedDraftPenaltyOrder(request, [fact]);
    expect(positive).toMatchObject({
      status: 'component-permits',
      leaf: 'CBA2-L08.8',
      orderedPickIds: ['CCC_2027_1st', 'BBB_2027_1st', 'AAA_2027_1st'],
      evidenceIds: [fact.id],
      placement: 'not-evaluated',
      tradingVerdict: 'not-evaluated',
      apply: 'blocked',
    });
    expect(JSON.stringify({ request, fact })).toBe(before);
    const negative = evaluateSuppliedDraftPenaltyOrder(
      {
        ...request,
        proposedEarlierToLater: [...request.proposedEarlierToLater].reverse(),
      },
      [fact]
    );
    expect(negative.status).toBe('component-prohibits');
    expect(negative.orderedPickIds).toEqual(positive.orderedPickIds);
    expect(Object.isFrozen(positive)).toBe(true);
    expect(Object.isFrozen(positive.orderedPickIds)).toBe(true);
    expect(Object.isFrozen(positive.reasons)).toBe(true);
    expect(Object.isFrozen(positive.evidenceIds)).toBe(true);
    expect(JSON.parse(JSON.stringify(positive))).toEqual(positive);
  });

  it.each([
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ])('does not use source listing order (%s,%s,%s)', (a, b, c) => {
    const { request, fact } = fixture();
    fact.members = [fact.members[a], fact.members[b], fact.members[c]];
    expect(evaluateSuppliedDraftPenaltyOrder(request, [fact]).status).toBe(
      'component-permits'
    );
  });

  it('compares exact decimal text beyond binary floating-point precision', () => {
    const { request, fact } = fixture();
    fact.members[0].officialWinningPercentage = '0.500000000000000000002';
    fact.members[1].officialWinningPercentage = '0.500000000000000000001';
    fact.members[2].officialWinningPercentage = '0.500000000000000000000';
    expect(evaluateSuppliedDraftPenaltyOrder(request, [fact]).status).toBe(
      'component-permits'
    );
  });

  it('orders zero and one without assuming an NBA record length or rounding', () => {
    const { request, fact } = fixture();
    fact.members[0].officialWinningPercentage = '1.000';
    fact.members[2].officialWinningPercentage = '0';
    expect(evaluateSuppliedDraftPenaltyOrder(request, [fact]).status).toBe(
      'component-permits'
    );
  });

  it.each(['0.5', '0.5000'])(
    'blocks numerical ties (%s), including trailing-zero aliases',
    (value) => {
      const { request, fact } = fixture();
      fact.members[0].officialWinningPercentage = value;
      expect(evaluateSuppliedDraftPenaltyOrder(request, [fact])).toMatchObject({
        status: 'needs-input',
        reasons: ['governing-tie-procedure-not-established'],
        orderedPickIds: [],
      });
    }
  );

  it('does not consume a supplied tie result as a substitute for a governing procedure', () => {
    const { request, fact } = fixture();
    fact.members[0].officialWinningPercentage = '0.5';
    expect(
      evaluateSuppliedDraftPenaltyOrder(request, [
        {
          ...fact,
          tieResult: ['BBB_2027_1st', 'AAA_2027_1st'],
        },
      ]).status
    ).toBe('needs-input');
  });

  it.each(['-0.1', '1.1', '.5', '5e-1', '0.5 ', 'NaN', '0.' + '1'.repeat(63)])(
    'rejects unsupported percentage representation %s',
    (value) => {
      const { request, fact } = fixture();
      fact.members[0].officialWinningPercentage = value;
      expect(evaluateSuppliedDraftPenaltyOrder(request, [fact]).status).toBe(
        'needs-input'
      );
    }
  );

  const invalidFacts: Array<[string, (fact: DraftPenaltyOrderFact) => void]> = [
    [
      'incomplete membership',
      (f) => {
        f.allPenalizedFirstsListed = false;
      },
    ],
    [
      'unresolved dependency',
      (f) => {
        f.unresolvedDependencyIds = ['unknown'];
      },
    ],
    [
      'unqualified source',
      (f) => {
        f.sources[0].qualification = 'unqualified';
      },
    ],
    [
      'wrong source scope',
      (f) => {
        f.sources[0].scope = 'ownership';
      },
    ],
    [
      'review limitation',
      (f) => {
        f.sources[0].review.limitations = ['not all picks'];
      },
    ],
    [
      'unreviewed source',
      (f) => {
        f.sources[0].review.status = 'unreviewed';
      },
    ],
    [
      'missing source',
      (f) => {
        f.sources = [];
      },
    ],
    [
      'conflicting fact',
      (f) => {
        f.status = 'conflicting';
      },
    ],
    [
      'future evidence',
      (f) => {
        f.status = 'legitimate future outcome pending';
      },
    ],
    [
      'missing effective date',
      (f) => {
        f.effectiveAt = null;
      },
    ],
    [
      'not yet effective',
      (f) => {
        f.effectiveAt = '2028-01-01T00:00:00Z';
      },
    ],
    [
      'expired at equality',
      (f) => {
        f.validUntil = f.context.asOf;
      },
    ],
    [
      'wrong proposal',
      (f) => {
        f.context.proposalSha256 = 'c'.repeat(64);
      },
    ],
    [
      'wrong state',
      (f) => {
        f.context.stateVersion = 'changed';
      },
    ],
    [
      'wrong release',
      (f) => {
        f.context.releaseId = 'changed';
      },
    ],
    [
      'wrong date',
      (f) => {
        f.context.asOf = '2027-07-16T00:00:00Z';
      },
    ],
    [
      'wrong requesting team',
      (f) => {
        f.context.team = 'LAL';
      },
    ],
    [
      'wrong Draft',
      (f) => {
        f.draftYear = 2028;
      },
    ],
    [
      'duplicate pick',
      (f) => {
        f.members[0] = structuredClone(f.members[1]);
      },
    ],
    [
      'incoherent ID',
      (f) => {
        f.members[0].pick.id = 'BBB_2027_1st';
      },
    ],
    [
      'coherent wrong-year pick',
      (f) => {
        f.members[0].pick.draftYear = 2028;
        f.members[0].pick.id = 'AAA_2028_1st';
      },
    ],
    [
      'single penalized pick outside scope',
      (f) => {
        f.members = [f.members[0]];
      },
    ],
  ];
  it.each(invalidFacts)('needs input for %s', (_label, change) => {
    const { request, fact } = fixture();
    change(fact);
    expect(evaluateSuppliedDraftPenaltyOrder(request, [fact])).toMatchObject({
      status: 'needs-input',
      orderedPickIds: [],
      apply: 'blocked',
    });
  });

  it.each([
    ['AAA_2027_1st', 'BBB_2027_1st'],
    ['CCC_2027_1st', 'BBB_2027_1st', 'BBB_2027_1st'],
    ['CCC_2027_1st', 'BBB_2027_1st', 'DDD_2027_1st'],
  ])('requires exact proposed membership %j', (...ids) => {
    const { request, fact } = fixture();
    request.proposedEarlierToLater = ids;
    expect(evaluateSuppliedDraftPenaltyOrder(request, [fact]).status).toBe(
      'needs-input'
    );
  });

  it('rejects missing, duplicate, or malformed same-scope facts; unrelated kinds are ignored', () => {
    const { request, fact } = fixture();
    for (const facts of [[], [fact, fact], [fact, { scope: fact.scope }]]) {
      expect(evaluateSuppliedDraftPenaltyOrder(request, facts).status).toBe(
        'needs-input'
      );
    }
    expect(
      evaluateSuppliedDraftPenaltyOrder(request, [fact, { scope: 'unrelated' }])
        .status
    ).toBe('component-permits');
  });

  it('rejects conditional identities and does not reinterpret current holder as original Team', () => {
    const { request, fact } = fixture();
    const conditional = structuredClone(fact);
    Object.assign(conditional.members[0].pick, { kind: 'conditional-right' });
    expect(
      evaluateSuppliedDraftPenaltyOrder(request, [conditional]).status
    ).toBe('needs-input');
    const holder = structuredClone(fact);
    Object.assign(holder.members[0], { holderTeam: 'DEN' });
    expect(evaluateSuppliedDraftPenaltyOrder(request, [holder]).status).toBe(
      'needs-input'
    );
  });
});
