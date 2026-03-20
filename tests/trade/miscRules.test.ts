import { describe, expect, it } from 'vitest';
import {
  enforceTradeKicker,
  validateAllNewRules,
  validateBYC,
  validatePlayerConsent,
} from '@/features/architect/utils/tradeMachine/rules/miscRules';

const currentYear = 2025;
const season = `${currentYear - 1}-${String(currentYear).slice(-2)}`;

type BycTestPlayer = {
  name: string;
  contract: {
    salariesByYear: Array<{
      season: string;
      salary: number;
      capHit?: number;
    }>;
  };
  isBYC?: boolean;
  previousSalary?: number;
  matchOutgoing?: number;
};

describe('miscRules compatibility surface', () => {
  it('exports validateAllNewRules through the .js compatibility path', () => {
    expect(typeof validateAllNewRules).toBe('function');
  });

  it('detects BYC from season contract rows and mutates matching values in place', () => {
    const player: BycTestPlayer = {
      name: 'BYC Season Player',
      contract: {
        salariesByYear: [
          { season: '2023-24', salary: 12_000_000, capHit: 12_000_000 },
          { season: '2024-25', salary: 30_000_000, capHit: 30_000_000 },
        ],
      },
    };
    const team = { sends: [player] };

    const result = validateBYC(team, { yearKey: currentYear });

    expect(result).toEqual({
      passed: true,
      violations: [],
      warningsOnly: false,
    });
    expect(player.isBYC).toBe(true);
    expect(player.previousSalary).toBe(12_000_000);
    expect(player.matchOutgoing).toBe(15_000_000);
  });

  it('falls back to getSalaryForYear when season lookups miss', () => {
    const player: BycTestPlayer = {
      name: 'BYC Fallback Player',
      contract: {
        salariesByYear: [
          { season: '2024', salary: 10_000_000 },
          { season: '2025', salary: 30_000_000 },
        ],
      },
    };
    const team = { sends: [player] };

    validateBYC(team, { yearKey: currentYear });

    expect(player.isBYC).toBe(true);
    expect(player.previousSalary).toBe(10_000_000);
    expect(player.matchOutgoing).toBe(15_000_000);
  });

  it('preserves exact consent message text and duplicate behavior', () => {
    const violations = validatePlayerConsent({
      teamId: 'LAL',
      sends: [
        { hasNoTradeClause: true, hasProvidedConsent: false },
        {
          limitedNTCTeams: ['LAL'],
          hasProvidedConsent: false,
        },
        { hasBirdRights: true, hasProvidedConsent: false },
      ],
    });

    expect(violations).toEqual([
      'Player NTC — consent required',
      'Player NTC — consent required',
      '1-yr Bird veto — consent required',
    ]);
  });

  it('prorates trade kicker amounts when season timing is provided', () => {
    expect(
      enforceTradeKicker(
        {
          salary: 10_000_000,
          tradeKickerPct: 0.15,
          remainingGuaranteedOnCurrentContract: 20_000_000,
        },
        {
          daysRemainingInSeason: 41,
          daysInSeason: 82,
        }
      )
    ).toBe(750_000);
  });

  it('caps trade kicker at remaining guaranteed money', () => {
    expect(
      enforceTradeKicker({
        salary: 10_000_000,
        tradeKickerPct: 0.2,
        remainingGuaranteedOnCurrentContract: 11_000_000,
      })
    ).toBe(1_000_000);
  });
});
