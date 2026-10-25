import { describe, expect, it } from 'vitest';
import { syntheticDraftReview } from './fixtures/draftPickReview';
import { evaluateSuppliedDraftStepien } from '@/features/architect/utils/draftStepien';
import {
  QUALIFIED_JUNE5_DRAFT_HORIZON as h,
  reviewJune5DraftTradingWindow,
} from '@/features/architect/utils/draftReview/horizon';

function input() {
  const r = syntheticDraftReview();
  const fact = r.facts[1] as any;
  const context = { ...r.request.context, asOf: h.asOf };
  r.request.context = context;
  fact.context = context;
  fact.effectiveAt = h.asOf;
  delete fact.previousDraft;
  delete fact.firstFutureDraftStartsAt;
  fact.firstFutureDraftYear = 2026;
  fact.throughDraftYear = 2032;
  fact.laterDrafts = 'outside-qualified-scope';
  fact.finiteScope = {
    authorityId: h.id,
    explanationSha256: h.explanationSha256,
    calendarSha256: h.calendarSha256,
    completeRelevantObligationCoverage: true,
    knownObligationDraftYears: [2028],
    unresolvedDependencyIds: [],
  };
  fact.branches = [
    {
      id: 'software-test-only',
      possible: true,
      unresolvedDependencyIds: [],
      drafts: Array.from({ length: 7 }, (_, i) => ({
        draftYear: i + 2026,
        inventoryComplete: true,
        retained:
          i + 2026 === 2028
            ? []
            : [
                {
                  kind: 'authenticated-original-pick',
                  id: `BOS_${i + 2026}_1st`,
                  originalTeam: 'BOS',
                  draftYear: i + 2026,
                  round: 1,
                },
              ],
      })),
    },
  ];
  return { request: r.request, fact };
}
describe('qualified date scope preserves Stepien coverage (software tests, not real proof)', () => {
  it('counts the upcoming draft, rejects another date and keeps availability separate', () => {
    expect(reviewJune5DraftTradingWindow(h.asOf, [2026, 2032]).status).toBe(
      'permits'
    );
    expect(reviewJune5DraftTradingWindow(h.asOf, [2033]).status).toBe(
      'prohibits'
    );
    expect(
      reviewJune5DraftTradingWindow('2026-06-06T12:19:56.526Z', [2028]).status
    ).toBe('needs-input');
  });
  it('permits a finite complete cover without pretending to own an infinite tail', () => {
    const { request, fact } = input();
    expect(evaluateSuppliedDraftStepien(request, [fact]).status).toBe(
      'component-permits'
    );
  });
  it.each([
    'source',
    'calendar',
    'date',
    'coverage',
    'later',
    'unresolved',
    'conflicting-calendar',
  ] as const)('fails closed for %s', (kind) => {
    const { request, fact } = input();
    if (kind === 'source') fact.finiteScope.explanationSha256 = '0'.repeat(64);
    if (kind === 'calendar') fact.finiteScope.calendarSha256 = '0'.repeat(64);
    if (kind === 'date')
      request.context.asOf = fact.context.asOf = '2026-06-06T12:19:56.526Z';
    if (kind === 'coverage')
      fact.finiteScope.completeRelevantObligationCoverage = false;
    if (kind === 'later') fact.finiteScope.knownObligationDraftYears.push(2034);
    if (kind === 'unresolved')
      fact.finiteScope.unresolvedDependencyIds.push('actual-later-branch');
    if (kind === 'conflicting-calendar')
      fact.firstFutureDraftStartsAt = '2026-05-01T00:00:00Z';
    expect(evaluateSuppliedDraftStepien(request, [fact]).status).toBe(
      'needs-input'
    );
  });
  it('extends Stepien coverage for a later obligation without making that pick tradable', () => {
    const { request, fact } = input();
    fact.finiteScope.knownObligationDraftYears.push(2034);
    fact.throughDraftYear = 2034;
    for (const year of [2033, 2034]) {
      fact.branches[0].drafts.push({
        draftYear: year,
        inventoryComplete: false,
        retained: [
          {
            kind: 'authenticated-original-pick',
            id: `BOS_${year}_1st`,
            originalTeam: 'BOS',
            draftYear: year,
            round: 1,
          },
        ],
      });
    }
    expect(evaluateSuppliedDraftStepien(request, [fact]).status).toBe(
      'component-permits'
    );
    expect(reviewJune5DraftTradingWindow(h.asOf, [2034]).status).toBe(
      'prohibits'
    );
    fact.branches[0].drafts.find((d: any) => d.draftYear === 2033).retained =
      [];
    fact.branches[0].drafts.find((d: any) => d.draftYear === 2034).retained =
      [];
    expect(evaluateSuppliedDraftStepien(request, [fact]).status).toBe(
      'needs-input'
    );
  });
  it('still prohibits an empty consecutive pair on any possible branch', () => {
    const { request, fact } = input();
    fact.branches.push(structuredClone(fact.branches[0]));
    fact.branches[1].id = 'other-possible-branch';
    fact.branches[1].drafts.find((d: any) => d.draftYear === 2029).retained =
      [];
    expect(evaluateSuppliedDraftStepien(request, [fact]).status).toBe(
      'component-prohibits'
    );
  });
  it('does not omit the final boundary pair', () => {
    const { request, fact } = input();
    fact.branches[0].drafts.find((d: any) => d.draftYear === 2032).retained =
      [];
    expect(evaluateSuppliedDraftStepien(request, [fact]).status).toBe(
      'needs-input'
    );
  });
});
