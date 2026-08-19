/********************  SCSP™ BLOCK: tradeHelpers.test.js  ********************
 * ------------------------------------------------------------------------- */
import { describe, it, expect } from 'vitest';
import {
  getSalaryForYear,
  areSamePick,
  calculateAllowableIncoming,
  getIncomingCeilingViaFaException,
  calculateTPERemaining,
  formatCurrency,
  generateTradeId,
  getPlayerAdjustmentTypes,
  getAdjustmentTooltipLabel,
} from '@/features/architect/utils/tradeHelpers';
import { isTwoWayTradePlayer } from '@/features/architect/utils/tradeMachine/utils/twoWayTradeSalary';

// 🔧  simple mock cap settings for 2025 season
const settings = {
  salaryCap: 141_000_000,
  firstApron: 172_346_000,
  secondApron: 182_794_000,
};

/* --------------------------------------------------------------------------
   getSalaryForYear
--------------------------------------------------------------------------- */
describe('getSalaryForYear', () => {
  const year = 2025;

  it('uses an explicit capHit without adding its retained likely incentive twice', () => {
    const p = {
      contract: {
        salariesByYear: [
          {
            season: '2024-25',
            capHit: 12_000_000,
            salary: 10_000_000,
            incentives: { likely: 500_000 },
          },
        ],
      },
    };
    expect(getSalaryForYear(p, year)).toBe(12_000_000);
  });

  it('adds likely incentives to base salary when no capHit is present', () => {
    const p = {
      contract: {
        salariesByYear: [
          {
            season: '2024-25',
            salary: 5_000_000,
            incentives: { likely: 500_000 },
          },
        ],
      },
    };
    expect(getSalaryForYear(p, year)).toBe(5_500_000);
  });

  it('falls back to salary property when contract data missing', () => {
    const p = { salary: 8_500_000 };
    expect(getSalaryForYear(p, year)).toBe(8_500_000);
  });
});

describe('Two-Way trade classification', () => {
  it.each(['TwoWay', 'two-way', 'two_way', 'two way'])(
    'recognizes the explicit %s contract spelling',
    (contractType) => {
      expect(isTwoWayTradePlayer({ contract: { contractType } })).toBe(true);
    }
  );

  it('does not infer Two-Way status from salary alone', () => {
    expect(isTwoWayTradePlayer({ salary: 636_435 })).toBe(false);
  });
});

/* --------------------------------------------------------------------------
   areSamePick
--------------------------------------------------------------------------- */
describe('areSamePick', () => {
  it('matches picks with numeric and string values', () => {
    const pickA = { year: 2029, round: 1, pick: 3 };
    const pickB = { year: '2029', round: '1', pick: '3' };
    expect(areSamePick(pickA, pickB)).toBe(true);
  });
});

/* --------------------------------------------------------------------------
   calculateAllowableIncoming
--------------------------------------------------------------------------- */
describe('calculateAllowableIncoming', () => {
  it('includes TPE amounts', () => {
    // mock TPE uses .remaining like live data
    const tpe = { remaining: 5_000_000, expired: false };
    const allowable = calculateAllowableIncoming(
      160_000_000, // teamTotalSalary (already over cap)
      0, // salaryOut
      [], // incomingPlayers
      [tpe], // tradeExceptions
      settings
    );
    expect(allowable).toBe(5_000_000); // margin now equals TPE value
  });

  it('returns object shape for object-style calls', () => {
    const allowable = calculateAllowableIncoming({
      currentTeamSalary: 160_000_000,
      salaryOut: 10_000_000,
      secondApronStatus: false,
      firstApronStatus: false,
      yearKey: 2025,
      tpeAmount: 3_000_000,
    });

    // Band 2 (10M outgoing): 10M + 9.096M expanded TPE = 19.096M, + 3M TPE = 22.096M
    expect(allowable).toEqual({
      ceiling: 22_096_000,
      margin: 12_096_000,
    });
  });
});

describe('other helper surface behavior', () => {
  it('adds FA exception remaining to salary out when computing FA-exception ceiling', () => {
    const team = {
      team: {
        faExceptionBuckets: [{ type: 'NTMLE', remaining: 4_500_000 }],
      },
      salaryOut: 1_250_000,
    };

    expect(getIncomingCeilingViaFaException(team, 'NTMLE')).toBe(5_750_000);
  });

  it('calculates remaining TPE amount', () => {
    expect(calculateTPERemaining({ amount: 6_000_000 }, 1_250_000)).toBe(
      4_750_000
    );
  });

  it('formats currency with current fallback behavior', () => {
    expect(formatCurrency(25000000)).toBe('$25,000,000');
    expect(formatCurrency('25000000')).toBe('-');
  });

  it('builds trade ids from team and sorted send ids', () => {
    const tradeId = generateTradeId([
      {
        team: { id: 'LAL' },
        sends: [{ id: 'p2' }, { id: 'p1' }],
      },
      {
        team: { id: 'BOS' },
        sends: [{ id: 'p3' }],
      },
    ]);

    expect(tradeId).toBe('LAL:p1,p2|BOS:p3');
  });

  it('returns only explicitly flagged adjustment types', () => {
    expect(
      getPlayerAdjustmentTypes({
        isBYC: true,
        tradeKickerPct: 15,
        isPoisonPill: true,
      })
    ).toEqual(['BYC', 'Trade Kicker', 'Poison Pill']);
    expect(getPlayerAdjustmentTypes({ isRookieScale: true })).toEqual([]);
  });

  it('uses specific adjustment labels when available and preserves generic fallback text', () => {
    expect(getAdjustmentTooltipLabel({ tradeKicker: true })).toBe(
      'Trade Kicker'
    );
    expect(getAdjustmentTooltipLabel({})).toBe(
      'Adjusted trade matching value (BYC/kicker/poison pill may apply)'
    );
    expect(
      getAdjustmentTooltipLabel({
        contractType: 'two-way',
        isBYC: true,
        tradeKicker: true,
      })
    ).toBe('Two-Way salary exclusion');
  });
});

/******************  END SCSP™ BLOCK: tradeHelpers.test.js  ******************/
