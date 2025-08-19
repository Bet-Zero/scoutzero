import { describe, it, expect } from 'vitest';
import {
  toNum,
  toSeasonKey,
  normalizeCaps,
  getTeamObject,
  resolvePayroll,
} from '@/utils/architect/tradeMachine/utils/calculations/capUtils.js';

describe('Cap Utilities', () => {
  describe('toNum', () => {
    it('handles numeric values correctly', () => {
      expect(toNum(100)).toBe(100);
      expect(toNum(0)).toBe(0);
      expect(toNum(-50)).toBe(-50);
      expect(toNum(1.5)).toBe(1.5);
    });

    it('converts string values to numbers', () => {
      expect(toNum('100')).toBe(100);
      expect(toNum('0')).toBe(0);
      expect(toNum('-50')).toBe(-50);
      expect(toNum('1.5')).toBe(1.5);
    });

    it('returns 0 for non-numeric values', () => {
      expect(toNum(null)).toBe(0);
      expect(toNum(undefined)).toBe(0);
      expect(toNum('abc')).toBe(0);
      expect(toNum({})).toBe(0);
      expect(toNum([])).toBe(0);
    });
  });

  describe('toSeasonKey', () => {
    it('formats season keys correctly', () => {
      expect(toSeasonKey(2025)).toBe('2024-25');
      expect(toSeasonKey(2030)).toBe('2029-30');
      expect(toSeasonKey(2100)).toBe('2099-00');
    });
  });

  describe('normalizeCaps', () => {
    it('normalizes cap settings with standard property names', () => {
      const rawCaps = {
        salaryCap: 140_588_000,
        firstApron: 178_132_000,
        secondApron: 188_938_000,
        taxLine: 170_818_000,
        fullMLE: 12_860_000,
        roomMLE: 8_008_000,
        bae: 4_189_000,
      };

      const normalized = normalizeCaps(rawCaps);

      expect(normalized.salaryCap).toBe(140_588_000);
      expect(normalized.firstApron).toBe(178_132_000);
      expect(normalized.secondApron).toBe(188_938_000);
      expect(normalized.taxLine).toBe(170_818_000);
      expect(normalized.fullMLE).toBe(12_860_000);
      expect(normalized.roomMLE).toBe(8_008_000);
      expect(normalized.bae).toBe(4_189_000);
    });

    it('normalizes cap settings with alternative property names', () => {
      const rawCaps = {
        cap: 140_588_000,
        apron1: 178_132_000,
        apron2: 188_938_000,
        tax: 170_818_000,
        mle: 12_860_000,
        rmle: 8_008_000,
        bae: 4_189_000,
      };

      const normalized = normalizeCaps(rawCaps);

      expect(normalized.salaryCap).toBe(140_588_000);
      expect(normalized.firstApron).toBe(178_132_000);
      expect(normalized.secondApron).toBe(188_938_000);
      expect(normalized.taxLine).toBe(170_818_000);
      expect(normalized.fullMLE).toBe(12_860_000);
      expect(normalized.roomMLE).toBe(8_008_000);
      expect(normalized.bae).toBe(4_189_000);
    });

    it('defaults missing values to 0', () => {
      const rawCaps = {
        salaryCap: 140_588_000,
        // missing other properties
      };

      const normalized = normalizeCaps(rawCaps);

      expect(normalized.salaryCap).toBe(140_588_000);
      expect(normalized.firstApron).toBe(0);
      expect(normalized.secondApron).toBe(0);
    });

    it('handles empty or undefined input', () => {
      expect(normalizeCaps()).toEqual({
        salaryCap: 0,
        firstApron: 0,
        secondApron: 0,
        taxLine: 0,
        fullMLE: 0,
        roomMLE: 0,
        bae: 0,
      });
    });
  });

  describe('getTeamObject', () => {
    it('extracts team from various wrapper formats', () => {
      const team = { id: 'GSW', name: 'Warriors' };

      expect(getTeamObject({ team })).toEqual(team);
      expect(getTeamObject({ sourceTeam: team })).toEqual(team);
      expect(getTeamObject({ ctx: team })).toEqual(team);
      expect(getTeamObject(team)).toEqual(team);
    });

    it('returns null for invalid inputs', () => {
      expect(getTeamObject(null)).toBeNull();
      expect(getTeamObject(undefined)).toBeNull();
      expect(getTeamObject({})).toEqual({});
    });
  });

  describe('resolvePayroll', () => {
    it('prioritizes available payroll fields correctly', () => {
      const team = {
        postTradeStatus: { projectedSalary: 150_000_000 },
        preTradeStatus: { projectedSalary: 140_000_000 },
        projectedSalary: 130_000_000,
        teamTotalSalary: 120_000_000,
        totalSalary: 110_000_000,
        payroll: 100_000_000,
      };

      expect(resolvePayroll(team)).toBe(150_000_000);

      // Test priority by removing fields
      const team2 = { ...team };
      delete team2.postTradeStatus;
      expect(resolvePayroll(team2)).toBe(140_000_000);

      const team3 = { ...team2 };
      delete team3.preTradeStatus;
      expect(resolvePayroll(team3)).toBe(130_000_000);

      const team4 = { ...team3 };
      delete team4.projectedSalary;
      expect(resolvePayroll(team4)).toBe(120_000_000);

      const team5 = { ...team4 };
      delete team5.teamTotalSalary;
      expect(resolvePayroll(team5)).toBe(110_000_000);

      const team6 = { ...team5 };
      delete team6.totalSalary;
      expect(resolvePayroll(team6)).toBe(100_000_000);
    });

    it('returns 0 for missing or invalid payroll data', () => {
      expect(resolvePayroll(null)).toBe(0);
      expect(resolvePayroll(undefined)).toBe(0);
      expect(resolvePayroll({})).toBe(0);
      expect(resolvePayroll({ payroll: 'not a number' })).toBe(0);
    });
  });
});
