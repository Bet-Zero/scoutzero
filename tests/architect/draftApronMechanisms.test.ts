import { describe, expect, it } from 'vitest';
import {
  evaluateDraftApronFreeze,
  evaluateDraftApronLifecycle,
  evaluateDraftApronObservation,
} from '@/features/architect/utils/draftApronMechanisms';
import type { DraftApronInput } from '@/schemas/draftApron';

const source = {
  id: 'synthetic-only',
  artifactSha256: 'a'.repeat(64),
  locator: 'synthetic#observation',
  scope: 'synthetic team-season observation and calendar',
  qualification: 'qualified' as const,
  publishedAt: '2031-04-14T00:00:00-04:00',
  capturedAt: '2031-04-15T00:00:00-04:00',
  review: {
    status: 'accepted' as const,
    reference: 'synthetic-review',
    limitations: [],
  },
};
function input(above = [true, true, false, false, false]): DraftApronInput {
  return {
    team: 'TEAM-A',
    triggerSeasonStartYear: 2026,
    originalPick: {
      id: 'TEAM-A-2034-first',
      originalTeam: 'TEAM-A',
      draftYear: 2034,
      round: 1,
    },
    asOf: '2031-04-14T00:00:00-04:00',
    observations: above.map((isAbove, i) => ({
      team: 'TEAM-A',
      seasonStartYear: 2026 + i,
      state: 'supported',
      sourceResultId: `measurement-${i}`,
      pendingUntil: null,
      sources: [source],
      value: {
        apronTeamSalaryCents: isAbove ? 22168600001 : 22168600000,
        secondApronCents: 22168600000,
        measuredAt: `${2027 + i}-04-11T19:00:00-04:00`,
        lastRegularSeasonGameStart: `${2027 + i}-04-11T19:00:00-04:00`,
      },
    })),
    regularSeasonEnds: [2027, 2028, 2029, 2030].map((y) => ({
      seasonStartYear: y,
      date: `${y + 1}-04-13`,
      dayAfterStartsAt: `${y + 1}-04-14T00:00:00-04:00`,
      sources: [source],
    })),
  };
}

describe('isolated Canon Apron components', () => {
  it('A12.4 discriminates one cent above from equality and identifies the seventh-following draft', () => {
    expect(evaluateDraftApronFreeze(input())).toMatchObject({
      status: 'known',
      value: true,
    });
    expect(
      evaluateDraftApronFreeze(input([false, false, false, false, false]))
    ).toMatchObject({ status: 'known', value: false });
    const wrongDraft = input();
    wrongDraft.originalPick.draftYear = 2033;
    expect(evaluateDraftApronFreeze(wrongDraft).status).toBe('blocked');
  });
  it('A12.5/A12.7 releases only at the next-day boundary, without computing a slot', () => {
    const d = input();
    d.asOf = '2031-04-13T23:59:59-04:00';
    expect(evaluateDraftApronLifecycle(d).unfrozen).toMatchObject({
      status: 'known',
      value: false,
    });
    d.asOf = '2031-04-14T00:00:00-04:00';
    const result = evaluateDraftApronLifecycle(d);
    expect(result.unfrozen).toMatchObject({ status: 'known', value: true });
    expect(result.frozen).toMatchObject({ status: 'known', value: false });
    expect(result.noPenalty).toMatchObject({ status: 'known', value: true });
    expect(result.placement.status).toBe('blocked');
    expect(result.owned.status).toBe('blocked');
  });
  it('L08.7 penalizes two of four above seasons, independently from final placement', () => {
    const result = evaluateDraftApronLifecycle(
      input([true, true, true, false, false])
    );
    expect(result.penalized).toMatchObject({ status: 'known', value: true });
    expect(result.noPenalty).toMatchObject({ status: 'known', value: false });
    expect(result.unfrozen).toMatchObject({ status: 'known', value: false });
    expect(result.placement.status).toBe('blocked');
    expect(result.penalized).toMatchObject({
      sourceResultIds: ['measurement-0', 'measurement-1', 'measurement-2'],
      calendarSourceIds: [],
    });
  });
  it.each(['missing', 'conflicting'] as const)(
    'retains a conclusive threshold with an irrelevant %s fourth observation',
    (state) => {
      for (const penalty of [true, false]) {
        const d = input(
          penalty
            ? [true, true, true, false, false]
            : [true, false, false, false, false]
        );
        if (state === 'missing') d.observations.pop();
        else d.observations[4].state = state;
        const result = evaluateDraftApronLifecycle(d);
        expect(result.penalized).toMatchObject({
          status: 'known',
          value: penalty,
        });
        expect(result.unfrozen).toMatchObject({
          status: 'known',
          value: !penalty,
        });
        if (!penalty) {
          expect(result.releaseEffectiveAt).toBe('2030-04-14T00:00:00-04:00');
          expect(result.unfrozen).toMatchObject({
            sourceResultIds: [
              'measurement-0',
              'measurement-1',
              'measurement-2',
              'measurement-3',
            ],
            calendarSourceIds: ['synthetic-only'],
          });
        }
      }
    }
  );
  it('proves release by a date without inventing exact timing across an earlier unknown', () => {
    const d = input([true, false, false, false, false]);
    d.observations[1].state = 'conflicting';
    let result = evaluateDraftApronLifecycle(d);
    expect(result.unfrozen).toMatchObject({ status: 'known', value: true });
    expect(result.releaseEffectiveAt).toBeUndefined();
    expect(result.releaseEffectiveNoLaterThan).toBe(
      '2031-04-14T00:00:00-04:00'
    );
    d.asOf = '2031-04-13T23:59:59-04:00';
    result = evaluateDraftApronLifecycle(d);
    expect(result.frozen.status).toBe('blocked');
    expect(result.noPenalty.status).toBe('blocked');
  });
  it.each([
    'unresolved',
    'conflicting',
    'unsupported',
    'non-applicable',
  ] as const)(
    'does not turn %s observations into favorable history',
    (state) => {
      const d = input();
      d.observations[2].state = state;
      const result = evaluateDraftApronLifecycle(d);
      expect(result.freezeTriggered).toMatchObject({
        status: 'known',
        value: true,
      });
      expect(result.frozen.status).toBe('blocked');
      expect(result.unfrozen.status).toBe('blocked');
      expect(result.noPenalty.status).toBe('blocked');
    }
  );
  it.each([
    'missing',
    'wrong-team',
    'wrong-time',
    'wrong-year',
    'duplicate',
    'unqualified',
    'no-season-end',
    'bad-next-day',
    'wrong-calendar-season',
  ])('blocks %s input', (error) => {
    const d = input();
    if (error === 'missing') d.observations.pop();
    if (error === 'wrong-team') d.observations[3].team = 'TEAM-B';
    if (error === 'wrong-time')
      d.observations[3].value!.measuredAt = '2030-04-11T20:00:00-04:00';
    if (error === 'wrong-year')
      d.observations[3].value!.measuredAt =
        d.observations[3].value!.lastRegularSeasonGameStart =
          '2029-04-11T19:00:00-04:00';
    if (error === 'duplicate') d.observations.push(d.observations[0]);
    if (error === 'unqualified') d.observations[3].sources = [];
    if (error === 'no-season-end') d.regularSeasonEnds = [];
    if (error === 'bad-next-day')
      d.regularSeasonEnds[3].dayAfterStartsAt = '2031-04-13T00:00:00-04:00';
    if (error === 'wrong-calendar-season') {
      d.regularSeasonEnds[3].date = '2032-04-13';
      d.regularSeasonEnds[3].dayAfterStartsAt = '2032-04-14T00:00:00-04:00';
    }
    expect(evaluateDraftApronLifecycle(d).unfrozen.status).toBe('blocked');
  });
  it('keeps known future alternatives; does not label absent historical values future', () => {
    const d = input();
    d.asOf = '2027-04-12T00:00:00-04:00';
    d.observations.slice(1).forEach((o) => {
      o.state = 'future-pending';
      o.pendingUntil = o.value!.measuredAt;
      o.value = null;
    });
    expect(evaluateDraftApronLifecycle(d).penalized.status).toBe(
      'future-pending'
    );
    d.asOf = '2032-01-01T00:00:00Z';
    expect(evaluateDraftApronLifecycle(d).penalized.status).toBe('blocked');
  });
  it('allows the proven third-below release before the fourth future observation', () => {
    const d = input([true, false, false, false, false]);
    d.asOf = '2030-04-14T00:00:00-04:00';
    d.observations[4].state = 'future-pending';
    d.observations[4].pendingUntil = d.observations[4].value!.measuredAt;
    d.observations[4].value = null;
    expect(evaluateDraftApronLifecycle(d).noPenalty).toMatchObject({
      status: 'known',
      value: true,
    });
  });
  it('preserves pre-rule non-applicability and blocks invalid direct observation input', () => {
    const d = input();
    d.triggerSeasonStartYear = 2023;
    d.originalPick.draftYear = 2031;
    d.observations = [];
    expect(evaluateDraftApronFreeze(d).status).toBe('non-applicable');
    expect(
      evaluateDraftApronObservation(
        { value: { apronTeamSalaryCents: NaN } },
        'bad-date'
      ).status
    ).toBe('blocked');
  });
});
