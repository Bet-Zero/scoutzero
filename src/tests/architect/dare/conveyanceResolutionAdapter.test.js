/**
 * @file conveyanceResolutionAdapter.test.js
 * @description Tests for conveyance resolution adapter - protection ladder evaluation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the protection ladder factory
vi.mock(
  '@/features/architect/utils/entitlements/dare/protectionLadderFactory',
  () => ({
    buildProtectionLadder: vi.fn(),
  })
);

import { resolveConveyance } from '@/features/architect/utils/entitlements/dare/conveyanceResolutionAdapter';
import { buildProtectionLadder } from '@/features/architect/utils/entitlements/dare/protectionLadderFactory';

describe('conveyanceResolutionAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resolveConveyance', () => {
    it('should convey unprotected pick', () => {
      const entitlement = {
        id: 'ent-1',
        pickType: 'first',
        originTeam: 'BOS',
        ownerTeam: 'LAL',
        seasonYear: 2026,
        pickRuleId: 'rule-1',
      };

      buildProtectionLadder.mockReturnValue([
        { year: 2026, condition: 'Unprotected', ifTriggered: 'convey' },
      ]);

      const positionsMap = { BOS: 20 }; // Not protected

      const result = resolveConveyance(entitlement, positionsMap, {});

      expect(result.outcome).toBe('conveyed');
      expect(result.resolvedPosition).toBe(20);
      expect(result.protectionTriggered).toBe(false);
    });

    it('should roll protected pick when protection triggers', () => {
      const entitlement = {
        id: 'ent-2',
        pickType: 'first',
        originTeam: 'CHI',
        ownerTeam: 'MIA',
        seasonYear: 2026,
        pickRuleId: 'rule-2',
      };

      buildProtectionLadder.mockReturnValue([
        {
          year: 2026,
          condition: 'Top 10',
          ifTriggered: 'roll',
          rollToYear: 2027,
        },
        {
          year: 2027,
          condition: 'Top 5',
          ifTriggered: 'roll',
          rollToYear: 2028,
        },
        { year: 2028, condition: 'Unprotected', ifTriggered: 'convey' },
      ]);

      const positionsMap = { CHI: 8 }; // Top 10, triggers protection

      const result = resolveConveyance(entitlement, positionsMap, {});

      expect(result.outcome).toBe('rolled');
      expect(result.protectionTriggered).toBe(true);
      expect(result.rollToYear).toBe(2027);
      expect(result.resolvedPosition).toBe(8);
    });

    it('should convert to second round when conversion triggers', () => {
      const entitlement = {
        id: 'ent-3',
        pickType: 'first',
        originTeam: 'DET',
        ownerTeam: 'PHX',
        seasonYear: 2026,
        pickRuleId: 'rule-3',
      };

      buildProtectionLadder.mockReturnValue([
        {
          year: 2026,
          condition: 'Lottery',
          ifTriggered: 'convert',
          convertToRound: 2,
        },
      ]);

      const positionsMap = { DET: 5 }; // Lottery pick, triggers conversion

      const result = resolveConveyance(entitlement, positionsMap, {});

      expect(result.outcome).toBe('converted');
      expect(result.protectionTriggered).toBe(true);
      expect(result.convertToRound).toBe(2);
      expect(result.resolvedPosition).toBe(5);
    });

    it('should cancel pick when final protection triggers', () => {
      const entitlement = {
        id: 'ent-4',
        pickType: 'first',
        originTeam: 'ORL',
        ownerTeam: 'NYK',
        seasonYear: 2026,
        pickRuleId: 'rule-4',
      };

      buildProtectionLadder.mockReturnValue([
        { year: 2026, condition: 'Top 3', ifTriggered: 'cancel' },
      ]);

      const positionsMap = { ORL: 2 }; // Top 3, triggers cancel

      const result = resolveConveyance(entitlement, positionsMap, {});

      expect(result.outcome).toBe('cancelled');
      expect(result.protectionTriggered).toBe(true);
    });

    it('should handle pick with no protection ladder (unprotected)', () => {
      const entitlement = {
        id: 'ent-5',
        pickType: 'first',
        originTeam: 'SAC',
        ownerTeam: 'TOR',
        seasonYear: 2026,
      };

      buildProtectionLadder.mockReturnValue(null);

      const positionsMap = { SAC: 15 };

      const result = resolveConveyance(entitlement, positionsMap, {});

      expect(result.outcome).toBe('conveyed');
      expect(result.protectionTriggered).toBe(false);
    });

    it('should handle second round picks (always convey)', () => {
      const entitlement = {
        id: 'ent-6',
        pickType: 'second',
        originTeam: 'MEM',
        ownerTeam: 'DAL',
        seasonYear: 2026,
      };

      const positionsMap = { MEM: 45 }; // Second round position

      const result = resolveConveyance(entitlement, positionsMap, {});

      expect(result.outcome).toBe('conveyed');
      expect(result.protectionTriggered).toBe(false);
    });

    it('should warn when origin team not in positionsMap', () => {
      const entitlement = {
        id: 'ent-7',
        pickType: 'first',
        originTeam: 'XXX', // Invalid team
        ownerTeam: 'LAC',
        seasonYear: 2026,
      };

      const positionsMap = { LAL: 10 }; // XXX not in map

      const result = resolveConveyance(entitlement, positionsMap, {});

      expect(result.outcome).toBe('error');
      expect(result.error).toContain('position');
    });

    it('should handle lottery threshold correctly (1-14)', () => {
      const entitlement = {
        id: 'ent-8',
        pickType: 'first',
        originTeam: 'WAS',
        ownerTeam: 'BKN',
        seasonYear: 2026,
        pickRuleId: 'rule-8',
      };

      buildProtectionLadder.mockReturnValue([
        {
          year: 2026,
          condition: 'Lottery',
          ifTriggered: 'roll',
          rollToYear: 2027,
        },
        { year: 2027, condition: 'Unprotected', ifTriggered: 'convey' },
      ]);

      // Test position 14 - should trigger lottery protection
      let positionsMap = { WAS: 14 };
      let result = resolveConveyance(entitlement, positionsMap, {});
      expect(result.outcome).toBe('rolled');
      expect(result.protectionTriggered).toBe(true);

      // Test position 15 - should convey (not lottery)
      positionsMap = { WAS: 15 };
      result = resolveConveyance(entitlement, positionsMap, {});
      expect(result.outcome).toBe('conveyed');
      expect(result.protectionTriggered).toBe(false);
    });

    it('should match year from ladder correctly', () => {
      const entitlement = {
        id: 'ent-9',
        pickType: 'first',
        originTeam: 'IND',
        ownerTeam: 'CLE',
        seasonYear: 2027, // Second year of ladder
        pickRuleId: 'rule-9',
      };

      buildProtectionLadder.mockReturnValue([
        {
          year: 2026,
          condition: 'Top 10',
          ifTriggered: 'roll',
          rollToYear: 2027,
        },
        {
          year: 2027,
          condition: 'Top 5',
          ifTriggered: 'roll',
          rollToYear: 2028,
        },
        { year: 2028, condition: 'Unprotected', ifTriggered: 'convey' },
      ]);

      // Position 7 - not in Top 5 for 2027, should convey
      const positionsMap = { IND: 7 };
      const result = resolveConveyance(entitlement, positionsMap, {});

      expect(result.outcome).toBe('conveyed');
      expect(result.protectionTriggered).toBe(false);
    });

    it('should handle Top 5 protection correctly at boundary', () => {
      const entitlement = {
        id: 'ent-10',
        pickType: 'first',
        originTeam: 'SAS',
        ownerTeam: 'ATL',
        seasonYear: 2026,
        pickRuleId: 'rule-10',
      };

      buildProtectionLadder.mockReturnValue([
        {
          year: 2026,
          condition: 'Top 5',
          ifTriggered: 'roll',
          rollToYear: 2027,
        },
        { year: 2027, condition: 'Unprotected', ifTriggered: 'convey' },
      ]);

      // Position 5 - should trigger Top 5
      let positionsMap = { SAS: 5 };
      let result = resolveConveyance(entitlement, positionsMap, {});
      expect(result.outcome).toBe('rolled');

      // Position 6 - should convey
      positionsMap = { SAS: 6 };
      result = resolveConveyance(entitlement, positionsMap, {});
      expect(result.outcome).toBe('conveyed');
    });
  });
});
