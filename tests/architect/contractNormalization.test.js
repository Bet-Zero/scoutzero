/**
 * Contract Normalization Tests
 *
 * Tests for canonical contract schema normalization helpers.
 * Ensures world mutation writers produce consistent field names/types.
 *
 * @file tests/architect/contractNormalization.test.js
 */

import { describe, it, expect } from 'vitest';
import {
  isPlausibleFreeAgencyYear,
  normalizeOptionUsed,
  normalizePlayerTeamRef,
  normalizeSalaryRow,
  normalizeFreeAgency,
  normalizeSigningDate,
  normalizeTeamRef,
  normalizeContractForWorld,
  normalizeFutureContract,
  isOptionAccepted,
  isOptionDeclined,
  hasOptionDecision,
} from '@/features/architect/utils/contractNormalization';

describe('contractNormalization', () => {
  // ===========================================================================
  // isPlausibleFreeAgencyYear
  // ===========================================================================
  describe('isPlausibleFreeAgencyYear', () => {
    it('accepts years within the default plausibility window', () => {
      expect(isPlausibleFreeAgencyYear(2021)).toEqual({
        plausible: true,
        minYear: 2021,
        maxYear: 2036,
      });
      expect(isPlausibleFreeAgencyYear(2036)).toEqual({
        plausible: true,
        minYear: 2021,
        maxYear: 2036,
      });
    });

    it('rejects years outside the plausibility window', () => {
      expect(isPlausibleFreeAgencyYear(2020).plausible).toBe(false);
      expect(isPlausibleFreeAgencyYear(2037).plausible).toBe(false);
      expect(isPlausibleFreeAgencyYear('2026').plausible).toBe(false);
    });

    it('uses the provided context year', () => {
      expect(isPlausibleFreeAgencyYear(2025, 2030)).toEqual({
        plausible: true,
        minYear: 2025,
        maxYear: 2040,
      });
      expect(isPlausibleFreeAgencyYear(2041, 2030).plausible).toBe(false);
    });
  });

  // ===========================================================================
  // normalizeTeamRef / normalizePlayerTeamRef
  // ===========================================================================
  describe('normalizeTeamRef', () => {
    it('normalizes canonical and prefixed team identifiers', () => {
      expect(normalizeTeamRef('lal')).toBe('LAL');
      expect(normalizeTeamRef('NBA:bos')).toBe('BOS');
      expect(normalizeTeamRef({ teamCode: 'gsw' })).toBe('GSW');
    });

    it('falls back through alternate object fields', () => {
      expect(normalizeTeamRef({ code: 'mia' })).toBe('MIA');
      expect(normalizeTeamRef({ id: 'nba:nyk' })).toBe('NYK');
    });

    it('returns null when no string identifier is available', () => {
      expect(normalizeTeamRef(null)).toBe(null);
      expect(normalizeTeamRef({})).toBe(null);
      expect(normalizeTeamRef({ teamCode: 123 })).toBe(null);
    });
  });

  describe('normalizePlayerTeamRef', () => {
    it('uses the documented priority order', () => {
      expect(
        normalizePlayerTeamRef({
          teamId: 'nba:lal',
          team_id: 'nba:bos',
          teamCode: 'gsw',
          contract: { signingTeam: 'mia' },
        })
      ).toBe('LAL');
    });

    it('falls back to contract.signingTeam when needed', () => {
      expect(
        normalizePlayerTeamRef({
          contract: { signingTeam: 'phi' },
        })
      ).toBe('PHI');
    });

    it('returns null when no player team reference is extractable', () => {
      expect(normalizePlayerTeamRef(null)).toBe(null);
      expect(normalizePlayerTeamRef({})).toBe(null);
    });
  });

  // ===========================================================================
  // normalizeOptionUsed
  // ===========================================================================
  describe('normalizeOptionUsed', () => {
    it('converts "accepted" string to true', () => {
      expect(normalizeOptionUsed('accepted')).toBe(true);
    });

    it('converts "exercised" string to true', () => {
      expect(normalizeOptionUsed('exercised')).toBe(true);
    });

    it('converts "declined" string to false', () => {
      expect(normalizeOptionUsed('declined')).toBe(false);
    });

    it('preserves boolean true', () => {
      expect(normalizeOptionUsed(true)).toBe(true);
    });

    it('preserves boolean false', () => {
      expect(normalizeOptionUsed(false)).toBe(false);
    });

    it('returns null for null input', () => {
      expect(normalizeOptionUsed(null)).toBe(null);
    });

    it('returns null for undefined input', () => {
      expect(normalizeOptionUsed(undefined)).toBe(null);
    });

    it('returns null for unknown string', () => {
      expect(normalizeOptionUsed('unknown')).toBe(null);
    });

    it('handles case-insensitive strings', () => {
      expect(normalizeOptionUsed('ACCEPTED')).toBe(true);
      expect(normalizeOptionUsed('Declined')).toBe(false);
      expect(normalizeOptionUsed('EXERCISED')).toBe(true);
    });
  });

  // ===========================================================================
  // normalizeSalaryRow
  // ===========================================================================
  describe('normalizeSalaryRow', () => {
    it('converts string optionUsed to boolean', () => {
      const row = {
        season: '2025-26',
        salary: 5000000,
        optionUsed: 'accepted',
      };
      const result = normalizeSalaryRow(row);
      expect(result.optionUsed).toBe(true);
    });

    it('defaults capHit to salary if missing', () => {
      const row = {
        season: '2025-26',
        salary: 5000000,
      };
      const result = normalizeSalaryRow(row);
      expect(result.capHit).toBe(5000000);
    });

    it('preserves existing capHit if present', () => {
      const row = {
        season: '2025-26',
        salary: 5000000,
        capHit: 4500000,
      };
      const result = normalizeSalaryRow(row);
      expect(result.capHit).toBe(4500000);
    });

    it('preserves all other fields', () => {
      const row = {
        season: '2025-26',
        salary: 5000000,
        guaranteed: true,
        guaranteedAmount: 5000000,
        option: 'Player Option',
        tradeBonus: 100000,
      };
      const result = normalizeSalaryRow(row);
      expect(result.season).toBe('2025-26');
      expect(result.guaranteed).toBe(true);
      expect(result.guaranteedAmount).toBe(5000000);
      expect(result.option).toBe('Player Option');
      expect(result.tradeBonus).toBe(100000);
    });

    it('handles null input', () => {
      expect(normalizeSalaryRow(null)).toBe(null);
    });
  });

  // ===========================================================================
  // normalizeFreeAgency
  // ===========================================================================
  describe('normalizeFreeAgency', () => {
    it('parses string format "2026 (UFA)"', () => {
      const result = normalizeFreeAgency('2026 (UFA)');
      expect(result).toEqual({ year: 2026, type: 'UFA' });
    });

    it('parses string format "2027"', () => {
      const result = normalizeFreeAgency('2027');
      expect(result).toEqual({ year: 2027, type: null });
    });

    it('passes through object format', () => {
      const input = { year: 2026, type: 'RFA', capHold: 5000000 };
      const result = normalizeFreeAgency(input);
      expect(result.year).toBe(2026);
      expect(result.type).toBe('RFA');
      expect(result.capHold).toBe(5000000);
    });

    it('returns null for null input', () => {
      expect(normalizeFreeAgency(null)).toBe(null);
    });

    it('returns null for undefined input', () => {
      expect(normalizeFreeAgency(undefined)).toBe(null);
    });

    it('handles unparseable string as type', () => {
      const result = normalizeFreeAgency('UFA');
      expect(result).toEqual({ type: 'UFA', year: null });
    });
  });

  // ===========================================================================
  // normalizeSigningDate
  // ===========================================================================
  describe('normalizeSigningDate', () => {
    it('returns signingDate if present', () => {
      const contract = {
        signingDate: '2025-07-01T00:00:00.000Z',
        signedAt: '2025-06-01T00:00:00.000Z',
      };
      expect(normalizeSigningDate(contract)).toBe('2025-07-01T00:00:00.000Z');
    });

    it('falls back to signedAt if signingDate missing', () => {
      const contract = {
        signedAt: '2025-07-01T00:00:00.000Z',
      };
      expect(normalizeSigningDate(contract)).toBe('2025-07-01T00:00:00.000Z');
    });

    it('falls back to extensionSignedAt if others missing', () => {
      const contract = {
        extensionSignedAt: '2025-07-01T00:00:00.000Z',
      };
      expect(normalizeSigningDate(contract)).toBe('2025-07-01T00:00:00.000Z');
    });

    it('returns null if no date fields present', () => {
      const contract = {};
      expect(normalizeSigningDate(contract)).toBe(null);
    });

    it('returns null for null input', () => {
      expect(normalizeSigningDate(null)).toBe(null);
    });
  });

  // ===========================================================================
  // normalizeContractForWorld
  // ===========================================================================
  describe('normalizeContractForWorld', () => {
    it('renames signedAt to signingDate', () => {
      const contract = {
        signedAt: '2025-07-01T00:00:00.000Z',
        totalValue: 10000000,
      };
      const result = normalizeContractForWorld(contract);
      expect(result.signingDate).toBe('2025-07-01T00:00:00.000Z');
      expect(result.signedAt).toBeUndefined();
    });

    it('renames extension to isExtension', () => {
      const contract = {
        extension: true,
        totalValue: 10000000,
      };
      const result = normalizeContractForWorld(contract);
      expect(result.isExtension).toBe(true);
      expect(result.extension).toBeUndefined();
    });

    it('normalizes salariesByYear entries', () => {
      const contract = {
        salariesByYear: [
          { season: '2025-26', salary: 5000000, optionUsed: 'accepted' },
          { season: '2026-27', salary: 5500000, optionUsed: 'declined' },
        ],
      };
      const result = normalizeContractForWorld(contract);
      expect(result.salariesByYear[0].optionUsed).toBe(true);
      expect(result.salariesByYear[1].optionUsed).toBe(false);
    });

    it('normalizes freeAgency string to object', () => {
      const contract = {
        freeAgency: '2027 (UFA)',
      };
      const result = normalizeContractForWorld(contract);
      expect(result.freeAgency).toEqual({ year: 2027, type: 'UFA' });
    });

    it('preserves other fields', () => {
      const contract = {
        contractType: 'Standard',
        totalValue: 50000000,
        yearsRemaining: 3,
        signingTeam: 'LAL',
      };
      const result = normalizeContractForWorld(contract);
      expect(result.contractType).toBe('Standard');
      expect(result.totalValue).toBe(50000000);
      expect(result.yearsRemaining).toBe(3);
      expect(result.signingTeam).toBe('LAL');
    });

    it('handles null input', () => {
      expect(normalizeContractForWorld(null)).toBe(null);
    });
  });

  // ===========================================================================
  // normalizeFutureContract
  // ===========================================================================
  describe('normalizeFutureContract', () => {
    it('ensures isExtension is true', () => {
      const futureContract = {
        salariesByYear: [{ season: '2028-29', salary: 10000000 }],
      };
      const result = normalizeFutureContract(futureContract);
      expect(result.isExtension).toBe(true);
    });

    it('applies all normalizations from normalizeContractForWorld', () => {
      const futureContract = {
        extension: false, // Should be overridden
        extensionSignedAt: '2025-07-01T00:00:00.000Z',
        salariesByYear: [{ season: '2028-29', salary: 10000000, optionUsed: 'accepted' }],
      };
      const result = normalizeFutureContract(futureContract);
      expect(result.isExtension).toBe(true);
      expect(result.signingDate).toBe('2025-07-01T00:00:00.000Z');
      expect(result.extensionSignedAt).toBeUndefined();
      expect(result.salariesByYear[0].optionUsed).toBe(true);
    });

    it('handles null input', () => {
      expect(normalizeFutureContract(null)).toBe(null);
    });
  });

  // ===========================================================================
  // Helper functions
  // ===========================================================================
  describe('isOptionAccepted', () => {
    it('returns true for "accepted" string', () => {
      expect(isOptionAccepted('accepted')).toBe(true);
    });

    it('returns true for boolean true', () => {
      expect(isOptionAccepted(true)).toBe(true);
    });

    it('returns false for "declined" string', () => {
      expect(isOptionAccepted('declined')).toBe(false);
    });

    it('returns false for boolean false', () => {
      expect(isOptionAccepted(false)).toBe(false);
    });

    it('returns false for null', () => {
      expect(isOptionAccepted(null)).toBe(false);
    });
  });

  describe('isOptionDeclined', () => {
    it('returns true for "declined" string', () => {
      expect(isOptionDeclined('declined')).toBe(true);
    });

    it('returns true for boolean false', () => {
      expect(isOptionDeclined(false)).toBe(true);
    });

    it('returns false for "accepted" string', () => {
      expect(isOptionDeclined('accepted')).toBe(false);
    });

    it('returns false for boolean true', () => {
      expect(isOptionDeclined(true)).toBe(false);
    });

    it('returns false for null', () => {
      expect(isOptionDeclined(null)).toBe(false);
    });
  });

  describe('hasOptionDecision', () => {
    it('returns true for accepted', () => {
      expect(hasOptionDecision('accepted')).toBe(true);
      expect(hasOptionDecision(true)).toBe(true);
    });

    it('returns true for declined', () => {
      expect(hasOptionDecision('declined')).toBe(true);
      expect(hasOptionDecision(false)).toBe(true);
    });

    it('returns false for null', () => {
      expect(hasOptionDecision(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(hasOptionDecision(undefined)).toBe(false);
    });
  });

  // ===========================================================================
  // Integration: Mutation Output Validation
  // ===========================================================================
  describe('Mutation Output Validation', () => {
    it('signing result produces canonical signingDate field', () => {
      // Simulate what computeSigningResult produces
      const signingContract = {
        signingTeam: 'LAL',
        signingDate: '2025-07-01T00:00:00.000Z',
        salariesByYear: [
          { season: '2025-26', salary: 5000000 },
        ],
      };
      const result = normalizeContractForWorld(signingContract);
      
      expect(result.signingDate).toBeDefined();
      expect(result.signedAt).toBeUndefined();
      expect(typeof result.signingDate).toBe('string');
    });

    it('extension result produces canonical isExtension and signingDate', () => {
      // Simulate what computeExtensionResult produces
      const extensionContract = {
        isExtension: true,
        signingDate: '2025-07-01T00:00:00.000Z',
        salariesByYear: [
          { season: '2028-29', salary: 10000000, isExtensionSeason: true },
        ],
      };
      const result = normalizeFutureContract(extensionContract);
      
      expect(result.isExtension).toBe(true);
      expect(result.extension).toBeUndefined();
      expect(result.signingDate).toBeDefined();
      expect(result.extensionSignedAt).toBeUndefined();
    });

    it('option decision produces boolean optionUsed', () => {
      // Simulate what computeOptionResult produces
      const salaryRow = {
        season: '2026-27',
        salary: 6000000,
        option: 'Player Option',
        optionUsed: true, // Should be boolean now
      };
      const result = normalizeSalaryRow(salaryRow);
      
      expect(typeof result.optionUsed).toBe('boolean');
      expect(result.optionUsed).toBe(true);
    });

    it('freeAgency is always object format after normalization', () => {
      const contract1 = { freeAgency: '2027 (UFA)' };
      const contract2 = { freeAgency: { year: 2027, type: 'UFA' } };
      
      const result1 = normalizeContractForWorld(contract1);
      const result2 = normalizeContractForWorld(contract2);
      
      expect(typeof result1.freeAgency).toBe('object');
      expect(typeof result2.freeAgency).toBe('object');
      expect(result1.freeAgency.year).toBe(2027);
      expect(result2.freeAgency.year).toBe(2027);
    });
  });
});
