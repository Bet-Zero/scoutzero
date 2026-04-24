import { describe, expect, it } from 'vitest';
import {
  computeExpectedCapHoldAmount,
  deriveFreeAgencyYearFromOptionSeason,
  didCreateCapHold,
  didRemoveCapHold,
  getCapHoldForPlayer,
  getRightsTypeFromPlayer,
  isCapHoldAmountValid,
  shouldExpectCapHoldOnDecline,
  validateDeclineFreeAgency,
} from '@/features/architect/utils/capHoldTransitionHelpers';
import { CAP_HOLD_MULTIPLIERS } from '@/features/architect/utils/capHolds';

describe('capHoldTransitionHelpers', () => {
  describe('getRightsTypeFromPlayer', () => {
    it('normalizes rights type from contract birdRights status', () => {
      expect(
        getRightsTypeFromPlayer({
          contract: {
            birdRights: {
              status: 'Full Bird',
            },
          },
        })
      ).toBe('FULL_BIRD');
    });

    it('falls back to root-level birdRights when needed', () => {
      expect(
        getRightsTypeFromPlayer({
          birdRights: 'non bird',
        })
      ).toBe('NON_BIRD');
    });

    it('returns null when rights type is not recognized', () => {
      expect(getRightsTypeFromPlayer({ contract: { birdRights: 'mystery' } })).toBe(
        null
      );
    });
  });

  describe('deriveFreeAgencyYearFromOptionSeason', () => {
    it('derives the year from option season codes', () => {
      expect(deriveFreeAgencyYearFromOptionSeason('2025-26')).toEqual({
        year: 2025,
        source: 'option_season',
      });
    });

    it('uses the fallback end year when option season is invalid', () => {
      expect(deriveFreeAgencyYearFromOptionSeason('unknown', 2028)).toEqual({
        year: 2027,
        source: 'fallback_end_year',
      });
    });

    it('returns unknown when neither source is usable', () => {
      expect(deriveFreeAgencyYearFromOptionSeason('unknown')).toEqual({
        year: null,
        source: 'unknown',
      });
    });
  });

  describe('cap hold lookup and transitions', () => {
    const beforeTeam = {
      capHolds: [{ playerId: 'p1', amount: 1_500_000 }],
    };
    const afterCreated = {
      capHolds: [
        { playerId: 'p1', amount: 1_500_000 },
        { playerId: 'p2', amount: 2_000_000 },
      ],
    };
    const afterRemoved = {
      capHolds: [],
    };

    it('finds cap holds by player id', () => {
      expect(getCapHoldForPlayer(beforeTeam, 'p1')).toEqual({
        playerId: 'p1',
        amount: 1_500_000,
      });
      expect(getCapHoldForPlayer(beforeTeam, 'missing')).toBe(null);
      expect(getCapHoldForPlayer({}, 'p1')).toBe(null);
    });

    it('detects cap hold creation and removal', () => {
      expect(didCreateCapHold(beforeTeam, afterCreated, 'p2')).toBe(true);
      expect(didCreateCapHold(beforeTeam, afterCreated, 'p1')).toBe(false);
      expect(didRemoveCapHold(beforeTeam, afterRemoved, 'p1')).toBe(true);
      expect(didRemoveCapHold(beforeTeam, afterCreated, 'p1')).toBe(false);
    });
  });

  describe('isCapHoldAmountValid', () => {
    it('rejects null and malformed cap hold objects with exact reasons', () => {
      expect(isCapHoldAmountValid(null)).toEqual({
        valid: false,
        reason: 'Cap hold is null or undefined',
      });
      expect(
        isCapHoldAmountValid({
          amount: '5',
          playerId: 'p1',
        } as unknown as Parameters<typeof isCapHoldAmountValid>[0])
      ).toEqual({
        valid: false,
        reason: 'Cap hold amount is not a number',
      });
      expect(isCapHoldAmountValid({ amount: Number.NaN, playerId: 'p1' })).toEqual({
        valid: false,
        reason: 'Cap hold amount is NaN',
      });
      expect(isCapHoldAmountValid({ amount: -1, playerId: 'p1' })).toEqual({
        valid: false,
        reason: 'Cap hold amount is negative',
      });
      expect(isCapHoldAmountValid({ amount: 1_000_000 })).toEqual({
        valid: false,
        reason: 'Cap hold missing playerId',
      });
    });

    it('accepts valid cap hold objects', () => {
      expect(
        isCapHoldAmountValid({
          amount: 1_000_000,
          playerId: 'p1',
        })
      ).toEqual({ valid: true });
    });
  });

  describe('shouldExpectCapHoldOnDecline', () => {
    it('reports missing salary history', () => {
      expect(shouldExpectCapHoldOnDecline({}, 2026)).toEqual({
        shouldCreate: false,
        priorSalary: 0,
        optionSeason: null,
        reason: 'No salary history available',
      });
    });

    it('reports missing option year and missing prior salary year', () => {
      expect(
        shouldExpectCapHoldOnDecline(
          {
            contract: {
              salariesByYear: [{ season: '2024-25', salary: 5_000_000 }],
            },
          },
          2026
        )
      ).toEqual({
        shouldCreate: false,
        priorSalary: 0,
        optionSeason: null,
        reason: 'No option year found',
      });

      expect(
        shouldExpectCapHoldOnDecline(
          {
            contract: {
              salariesByYear: [
                {
                  season: '2025-26',
                  salary: 7_000_000,
                  option: 'Player Option',
                },
              ],
            },
          },
          2026
        )
      ).toEqual({
        shouldCreate: false,
        priorSalary: 0,
        optionSeason: '2025-26',
        reason: 'No prior year salary found',
      });
    });

    it('reports non-positive prior salary and returns a valid expectation otherwise', () => {
      expect(
        shouldExpectCapHoldOnDecline(
          {
            contract: {
              salariesByYear: [
                { season: '2024-25', salary: 0 },
                {
                  season: '2025-26',
                  salary: 7_000_000,
                  option: 'Player Option',
                },
              ],
            },
          },
          2026
        )
      ).toEqual({
        shouldCreate: false,
        priorSalary: 0,
        optionSeason: '2025-26',
        reason: 'Prior year salary is zero or negative',
      });

      expect(
        shouldExpectCapHoldOnDecline(
          {
            contract: {
              salariesByYear: [
                { season: '2024-25', capHit: 8_000_000 },
                {
                  season: '2025-26',
                  salary: 9_000_000,
                  option: 'Team Option',
                },
              ],
            },
          },
          2026
        )
      ).toEqual({
        shouldCreate: true,
        priorSalary: 8_000_000,
        optionSeason: '2025-26',
      });
    });
  });

  describe('computeExpectedCapHoldAmount', () => {
    it('uses the canonical multiplier for recognized human-readable rights types', () => {
      expect(
        computeExpectedCapHoldAmount({
          player: null,
          lastSalary: 10_000_000,
          rules: null,
          rightsType: 'Early Bird',
        })
      ).toEqual({
        amount: Math.round(10_000_000 * CAP_HOLD_MULTIPLIERS.EARLY_BIRD),
        multiplier: CAP_HOLD_MULTIPLIERS.EARLY_BIRD,
        rightsType: 'EARLY_BIRD',
        usedFallback: false,
        missingRightsType: false,
      });
    });

    it('falls back when rights type is missing', () => {
      expect(
        computeExpectedCapHoldAmount({
          player: { birdRights: null },
          lastSalary: 10_000_000,
          rules: { ignored: true },
          rightsType: null,
        })
      ).toEqual({
        amount: 15_000_000,
        multiplier: 1.5,
        rightsType: null,
        usedFallback: true,
        missingRightsType: true,
      });
    });

    it('uses the player rights fallback when explicit rightsType is absent', () => {
      expect(
        computeExpectedCapHoldAmount({
          player: { contract: { birdRights: { status: 'Early Bird' } } },
          lastSalary: 5_000_000,
          rules: null,
          rightsType: null,
        })
      ).toEqual({
        amount: Math.round(5_000_000 * CAP_HOLD_MULTIPLIERS.EARLY_BIRD),
        multiplier: CAP_HOLD_MULTIPLIERS.EARLY_BIRD,
        rightsType: 'EARLY_BIRD',
        usedFallback: false,
        missingRightsType: false,
      });
    });
  });

  describe('validateDeclineFreeAgency', () => {
    it('returns exact violations for missing and legacy freeAgency state', () => {
      expect(validateDeclineFreeAgency(null, 2026)).toEqual({
        valid: false,
        violations: [
          {
            rule: 'cap_hold_transition_invalid',
            message: 'Option decline must set freeAgency state',
            severity: 'error',
          },
        ],
        warnings: [],
      });

      expect(validateDeclineFreeAgency('2026 (UFA)', 2026)).toEqual({
        valid: false,
        violations: [
          {
            rule: 'cap_hold_transition_invalid',
            message: 'freeAgency is a legacy string format, must be canonical object',
            severity: 'error',
          },
        ],
        warnings: [],
      });
    });

    it('reports invalid type, invalid year type, and year mismatch', () => {
      expect(validateDeclineFreeAgency({ type: '???', year: '2026' }, 2026)).toEqual({
        valid: false,
        violations: [
          {
            rule: 'cap_hold_transition_invalid',
            message: 'freeAgency.type must be one of: UFA, RFA, TO, PO. Got: ???',
            severity: 'error',
          },
          {
            rule: 'cap_hold_transition_invalid',
            message: 'freeAgency.year must be a number. Got: string',
            severity: 'error',
          },
        ],
        warnings: [],
      });

      expect(
        validateDeclineFreeAgency(
          { type: 'UFA', year: 2025 },
          2026,
          { source: 'option_season' }
        )
      ).toEqual({
        valid: false,
        violations: [
          {
            rule: 'option_decline_free_agency_year_mismatch',
            message: 'freeAgency.year (2025) differs from option_season (2026)',
            severity: 'error',
          },
        ],
        warnings: [],
      });
    });

    it('passes valid canonical freeAgency state', () => {
      expect(validateDeclineFreeAgency({ type: 'UFA', year: 2026 }, 2026)).toEqual({
        valid: true,
        violations: [],
        warnings: [],
      });
    });
  });
});
