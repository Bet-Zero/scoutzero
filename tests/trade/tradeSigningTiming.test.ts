import { describe, expect, it } from 'vitest';
import {
  signingTradeRestrictions,
  amendmentTradeRestrictions,
} from '@/features/architect/utils/tradeMachine/utils/tradeSigningTiming';
import { calendarMonthsAfter } from '@/features/architect/utils/tradeMachine/utils/tradeAggregation';
import { makeResultingState } from '../architect/contractHistory/contractHistoryFixtures';

function terms(day: string, overrides: Record<string, unknown> = {}) {
  return {
    ...makeResultingState().terms,
    signedUsing: 'Minimum Exception',
    signingDate: { value: day, precision: 'date' as const, rawValue: day },
    ...overrides,
  };
}
describe('current-season signing trade eligibility', () => {
  it('keeps recent veteran amendments and signed future rookie extensions restricted', () => {
    const extension = terms('2026-06-30', {
      isExtension: true,
      endSeason: '2029-30',
    });
    expect(
      amendmentTradeRestrictions(extension, '2026-11-14', 2027).join()
    ).toContain('bars trading for six');
    expect(
      amendmentTradeRestrictions(extension, '2026-12-30', 2027).join()
    ).toContain('exact anniversary');
    expect(amendmentTradeRestrictions(extension, '2026-12-31', 2027)).toEqual(
      []
    );
    expect(
      amendmentTradeRestrictions(
        { ...extension, endSeason: '2027-28' },
        '2026-11-14',
        2027
      ).join()
    ).toContain('needs complete extended-term salaries');
    expect(
      amendmentTradeRestrictions(
        terms('2026-08-31', { contractType: 'Renegotiation' }),
        '2026-11-14',
        2027
      ).join()
    ).toContain('renegotiation');
    const rookie = terms('2026-10-01', {
      isExtension: true,
      isRookieScale: true,
      startSeason: '2027-28',
    });
    expect(
      amendmentTradeRestrictions(rookie, '2026-11-14', 2027).join()
    ).toContain('poison-pill');
    expect(amendmentTradeRestrictions(rookie, '2027-07-02', 2028)).toEqual([]);
  });
  it('blocks November additions and July free agents through December 14', () => {
    expect(
      signingTradeRestrictions(terms('2026-11-13'), '2026-11-14').join()
    ).toContain('CBA2-L03.17');
    expect(
      signingTradeRestrictions(terms('2026-07-06'), '2026-12-14')
    ).toHaveLength(1);
    expect(signingTradeRestrictions(terms('2026-07-06'), '2026-12-15')).toEqual(
      []
    );
    expect(signingTradeRestrictions(terms('2025-07-06'), '2026-11-14')).toEqual(
      []
    );
  });
  it('counts calendar months and withholds a date-only anniversary', () => {
    expect(calendarMonthsAfter('2026-11-30', 3)).toBe('2027-02-28');
    expect(
      signingTradeRestrictions(terms('2026-09-16'), '2026-12-15')
    ).toHaveLength(1);
    expect(
      signingTradeRestrictions(terms('2026-09-16'), '2026-12-16')
    ).toHaveLength(1);
    expect(signingTradeRestrictions(terms('2026-09-16'), '2026-12-17')).toEqual(
      []
    );
  });
  it('uses thirty days for drafted rookies, including a retained MLE signing', () => {
    const rookie = terms('2026-10-14', {
      contractType: 'ROOKIE CONTRACT',
      signedUsing: 'Mle',
    });
    expect(
      signingTradeRestrictions(rookie, '2026-11-13', 2026).join()
    ).toContain('CBA2-L03.16');
    expect(signingTradeRestrictions(rookie, '2026-11-14', 2026)).toEqual([]);
    expect(
      signingTradeRestrictions(rookie, '2026-11-14', 'Undrafted').join()
    ).toContain('CBA2-L03.17');
    expect(
      signingTradeRestrictions(
        terms('2026-07-05', { isRookieScale: true }),
        '2026-11-14'
      )
    ).toEqual([]);
  });
  it('does not assume Bird-specific January 15 predicates are false', () => {
    const bird = terms('2026-07-05', { signedUsing: 'Bird Exception' });
    expect(signingTradeRestrictions(bird, '2026-12-15').join()).toContain(
      'CBA2-L03.18'
    );
    expect(signingTradeRestrictions(bird, '2027-01-15')).toEqual([]);
    expect(
      signingTradeRestrictions(
        terms('2026-12-20', { signedUsing: 'Early Bird Exception' }),
        '2027-01-15'
      ).join()
    ).toContain('CBA2-L03.17');
  });
  it('preserves the separate Two-Way and extension routes and refuses missing dates', () => {
    expect(
      signingTradeRestrictions(
        terms('2026-11-13', { contractType: 'Two-Way' }),
        '2026-11-14'
      )
    ).toEqual([]);
    expect(
      signingTradeRestrictions(
        terms('2026-11-13', { isExtension: true }),
        '2026-11-14'
      )
    ).toEqual([]);
    expect(signingTradeRestrictions(terms(''), '2026-11-14').join()).toContain(
      'signing date'
    );
  });
});
