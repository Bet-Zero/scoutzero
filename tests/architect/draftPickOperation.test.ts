import { describe, expect, it } from 'vitest';
import { evaluateOriginalDraftPickOwnership as own } from '@/features/architect/utils/draftPickOwnership';
import { evaluateSuppliedDraftStepien as step } from '@/features/architect/utils/draftStepien';
import {
  syntheticDraftOperation as fixture,
  syntheticOriginal as pick,
} from './fixtures/draftPickOperation';

const permit = 'component-permits',
  prohibit = 'component-prohibits',
  missing = 'needs-input';

describe('synthetic original-pick ownership component', () => {
  it('permits a current authenticated owner, without a whole-trade verdict', () => {
    const f = fixture();
    expect(own(f.request, [f.ownership])).toMatchObject({
      status: permit,
      tradingVerdict: 'not-evaluated',
      evidenceIds: [f.ownership.id],
    });
  });
  it.each(['expected-acquisition', 'other-owner', 'no-owner'])(
    'prohibits %s using complete claims',
    (kind) => {
      const f = fixture();
      if (kind === 'expected-acquisition')
        f.ownership.claims[0].status = 'expected-acquisition';
      if (kind === 'other-owner') f.ownership.claims[0].team = 'MIA';
      if (kind === 'no-owner') f.ownership.claims = [];
      expect(own(f.request, [f.ownership]).status).toBe(prohibit);
    }
  );
  it.each(['same-team', 'different-team', 'same-id'])(
    'blocks duplicate %s ownership claims',
    (kind) => {
      const f = fixture();
      f.ownership.claims.push({
        ...f.ownership.claims[0],
        id: kind === 'same-id' ? f.ownership.claims[0].id : 'another',
        team: kind === 'different-team' ? 'MIA' : 'BOS',
      });
      expect(own(f.request, [f.ownership]).status).toBe(missing);
    }
  );
  it.each(['incomplete', 'dependency', 'conditional'])(
    'does not guess %s ownership',
    (kind) => {
      const f = fixture();
      if (kind === 'incomplete') f.ownership.claimCoverage = 'incomplete';
      if (kind === 'dependency')
        f.ownership.unresolvedDependencyIds = ['unresolved-correspondence'];
      if (kind === 'conditional')
        f.ownership.claims[0].status = 'conditional-right-unimplemented';
      expect(own(f.request, [f.ownership]).status).toBe(missing);
    }
  );
  it('does not demand unrelated lottery or pool facts for an established ownership component', () => {
    const f = fixture();
    expect(
      own(f.request, [
        f.ownership,
        { scope: 'lottery-method', status: 'unresolved' },
      ]).status
    ).toBe(permit);
  });
  it('a definite prohibited outgoing pick remains prohibited when another is missing', () => {
    const f = fixture();
    f.request.outgoing.push(pick(2030));
    f.ownership.claims[0].team = 'MIA';
    expect(own(f.request, [f.ownership]).status).toBe(prohibit);
  });
});

describe('operation-specific selection and qualification', () => {
  it.each(['proposalSha256', 'stateVersion', 'releaseId', 'asOf', 'team'])(
    'rejects stale/wrong %s against independently supplied current request',
    (field) => {
      const f = fixture();
      if (field === 'proposalSha256')
        f.request.context.proposalSha256 = 'c'.repeat(64);
      if (field === 'stateVersion') f.request.context.stateVersion = 'v2';
      if (field === 'releaseId') f.request.context.releaseId = 'new-release';
      if (field === 'asOf')
        f.request.context.asOf = '2026-07-16T12:00:00-04:00';
      if (field === 'team') f.request.context.team = 'MIA';
      expect(own(f.request, [f.ownership]).status).toBe(missing);
      expect(step(f.request, [f.stepien]).status).toBe(missing);
    }
  );
  it.each([
    'unresolved',
    'conflicting',
    'legitimate future outcome pending',
    'proven non-applicable',
  ] as const)(
    'preserves %s as unavailable for a current supported-fact request',
    (status) => {
      const f = fixture();
      f.ownership.status = status;
      f.stepien.status = status;
      expect(own(f.request, [f.ownership]).status).toBe(missing);
      expect(step(f.request, [f.stepien]).status).toBe(missing);
    }
  );
  it.each([
    'omitted',
    'unqualified',
    'unreviewed',
    'limited',
    'scope',
    'effective-missing',
    'effective-future',
    'expired',
  ])('blocks %s evidence without capture-date fallback', (kind) => {
    const f = fixture();
    for (const fact of [f.ownership, f.stepien]) {
      if (kind === 'omitted') fact.sources = [];
      if (kind === 'unqualified') fact.sources[0].qualification = 'unqualified';
      if (kind === 'unreviewed') fact.sources[0].review.status = 'unreviewed';
      if (kind === 'limited')
        fact.sources[0].review.limitations = ['unresolved scope'];
      if (kind === 'scope') fact.sources[0].scope = 'another-fact';
      if (kind === 'effective-missing') fact.effectiveAt = null;
      if (kind === 'effective-future')
        fact.effectiveAt = '2026-07-16T00:00:00Z';
      if (kind === 'expired') fact.validUntil = f.request.context.asOf;
    }
    expect(own(f.request, [f.ownership]).status).toBe(missing);
    expect(step(f.request, [f.stepien]).status).toBe(missing);
  });
  it('rejects omitted, duplicate and malformed selected fact records', () => {
    const f = fixture();
    for (const fn of [own, step])
      expect(fn(f.request, []).status).toBe(missing);
    expect(own(f.request, [f.ownership, f.ownership]).status).toBe(missing);
    expect(step(f.request, [f.stepien, f.stepien]).status).toBe(missing);
    expect(own(f.request, [{ ...f.ownership, unexpected: true }]).status).toBe(
      missing
    );
  });
  it('never converts a projection or an inconsistent year tuple into an original pick', () => {
    const f = fixture();
    const projection = {
      ...f.ownership,
      pick: { ...f.ownership.pick, kind: 'generated-projection' },
    };
    expect(own(f.request, [projection]).status).toBe(missing);
    f.request.outgoing[0].draftYear = 2029;
    expect(own(f.request, [f.ownership]).status).toBe(missing);
    expect(step(f.request, [f.stepien]).status).toBe(missing);
  });
});

describe('all supplied possible Stepien branches', () => {
  it('checks consecutive future pairs and the tail boundary', () => {
    const f = fixture();
    const result = step(f.request, [f.stepien]);
    expect(result.status).toBe(permit);
    expect(result.pairs.map((p) => p.years)).toEqual([
      [2027, 2028],
      [2028, 2029],
      [2029, 2030],
      [2030, 2031],
    ]);
    expect(result.tradingVerdict).toBe('not-evaluated');
  });
  it('one bad possible branch prohibits even when another branch retains a first', () => {
    const f = fixture();
    f.stepien.branches.push({
      ...structuredClone(f.stepien.branches[0]),
      id: 'synthetic-P2',
    });
    f.stepien.branches[0].drafts[2].retained = [];
    expect(step(f.request, [f.stepien])).toMatchObject({
      status: prohibit,
      reasons: ['synthetic-P1:no-first-in-2028/2029'],
    });
    f.stepien.branches[0].drafts[2].retained = [pick(2029, 'MIA')];
    expect(step(f.request, [f.stepien]).status).toBe(permit);
  });
  it('a proved violating branch does not depend on unknown remaining branches or the tail', () => {
    const f = fixture();
    f.stepien.branches[0].drafts[2].retained = [];
    f.stepien.branchesComplete = false;
    f.stepien.laterDrafts = 'unestablished';
    f.stepien.branches.push({
      id: 'unknown-other-branch',
      possible: true,
      unresolvedDependencyIds: ['another-branch'],
      drafts: [],
    });
    expect(step(f.request, [f.stepien]).status).toBe(prohibit);
  });
  it('a dependency shared by all branches blocks even an apparently bad branch', () => {
    const f = fixture();
    f.stepien.branches[0].drafts[2].retained = [];
    f.stepien.unresolvedDependencyIds = ['unestablished-lottery-method'];
    expect(step(f.request, [f.stepien]).status).toBe(missing);
    f.stepien.unresolvedDependencyIds = [];
    f.stepien.branches[0].unresolvedDependencyIds = [
      'unestablished-pool-identity',
    ];
    expect(step(f.request, [f.stepien]).status).toBe(missing);
  });
  it.each(['branches', 'tail', 'dependency', 'empty-branches'])(
    'requires complete %s for a permitting result',
    (kind) => {
      const f = fixture();
      if (kind === 'branches') f.stepien.branchesComplete = false;
      if (kind === 'tail') f.stepien.laterDrafts = 'unestablished';
      if (kind === 'dependency')
        f.stepien.unresolvedDependencyIds = ['unknown-lottery-program'];
      if (kind === 'empty-branches') f.stepien.branches = [];
      expect(step(f.request, [f.stepien]).status).toBe(missing);
    }
  );
  it('an omitted inventory next to an owned first is irrelevant; next to an empty one is material', () => {
    const f = fixture();
    f.stepien.branches[0].drafts.splice(1, 1);
    expect(step(f.request, [f.stepien]).status).toBe(permit);
    f.stepien.branches[0].drafts[1].retained = [];
    expect(step(f.request, [f.stepien]).status).toBe(missing);
  });
  it('a positive authenticated retained first needs no complete count of other rights', () => {
    const f = fixture();
    f.stepien.branches[0].drafts[2].inventoryComplete = false;
    expect(step(f.request, [f.stepien]).status).toBe(permit);
    f.stepien.branches[0].drafts[2].retained = [];
    expect(step(f.request, [f.stepien]).status).toBe(missing);
  });
  it.each([
    'year',
    'duplicate-row',
    'duplicate-branch',
    'duplicate-right',
    'retained-outgoing',
    'different-outgoing',
  ])('rejects %s branch inconsistency', (kind) => {
    const f = fixture(),
      branch = f.stepien.branches[0];
    if (kind === 'year') branch.drafts[2].retained = [pick(2030)];
    if (kind === 'duplicate-row')
      branch.drafts.push(structuredClone(branch.drafts[0]));
    if (kind === 'duplicate-branch')
      f.stepien.branches.push(structuredClone(branch));
    if (kind === 'duplicate-right') branch.drafts[0].retained.push(pick(2027));
    if (kind === 'retained-outgoing')
      branch.drafts[1].retained.push(pick(2028));
    if (kind === 'different-outgoing') f.stepien.outgoing = [pick(2029)];
    expect(step(f.request, [f.stepien]).status).toBe(missing);
  });
  it.each([
    'past',
    'during-draft',
    'skipped-year',
    'coverage',
    'wrong-date-year',
  ])('blocks %s calendar/window errors', (kind) => {
    const f = fixture();
    if (kind === 'past')
      ((f.stepien.firstFutureDraftStartsAt = '2027-01-01T00:00:00Z'),
        (f.request.context.asOf = f.stepien.context.asOf =
          '2027-02-01T00:00:00Z'));
    if (kind === 'during-draft')
      f.stepien.previousDraft.completedAt = '2026-07-16T00:00:00Z';
    if (kind === 'skipped-year') f.stepien.firstFutureDraftYear = 2028;
    if (kind === 'coverage') f.stepien.throughDraftYear = 2027;
    if (kind === 'wrong-date-year')
      f.stepien.firstFutureDraftStartsAt = '2029-06-23T00:00:00Z';
    expect(step(f.request, [f.stepien]).status).toBe(missing);
  });
  it('replay after serialization is identical and evaluation does not mutate facts', () => {
    const f = fixture(),
      before = JSON.stringify(f);
    const result = step(f.request, [f.stepien]);
    const loaded = JSON.parse(before);
    expect(step(loaded.request, [loaded.stepien])).toEqual(result);
    expect(own(loaded.request, [loaded.ownership])).toEqual(
      own(f.request, [f.ownership])
    );
    expect(JSON.stringify(f)).toBe(before);
  });
});
