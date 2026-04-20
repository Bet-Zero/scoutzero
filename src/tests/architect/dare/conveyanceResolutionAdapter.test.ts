/**
 * @file conveyanceResolutionAdapter.test.js
 * @description Tests for conveyance resolution adapter - protection ladder evaluation
 *
 * HISTORY:
 *  - 2026-02-04: Phase A - Fixed imports to use resolveConveyanceForEntitlement
 *                Updated test assertions to match actual API return shape
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ProtectionLadder } from '@/features/architect/utils/entitlements/dare/types';

// Mock the protection ladder factory functions
vi.mock(
  '@/features/architect/utils/entitlements/dare/protectionLadderFactory',
  () => ({
    buildProtectionLadder: vi.fn(),
    protectionTriggers: vi.fn(),
    getCurrentProtectionTier: vi.fn(),
    getNextProtectionTier: vi.fn(),
    isFinalProtectionYear: vi.fn(),
  })
);

import { resolveConveyanceForEntitlement } from '@/features/architect/utils/entitlements/dare/conveyanceResolutionAdapter';
import {
  protectionTriggers,
  getCurrentProtectionTier,
  getNextProtectionTier,
  isFinalProtectionYear,
} from '@/features/architect/utils/entitlements/dare/protectionLadderFactory';

const mockProtectionTriggers = vi.mocked(protectionTriggers);
const mockGetCurrentProtectionTier = vi.mocked(getCurrentProtectionTier);
const mockGetNextProtectionTier = vi.mocked(getNextProtectionTier);
const mockIsFinalProtectionYear = vi.mocked(isFinalProtectionYear);

describe('conveyanceResolutionAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks: no protection triggers
    mockProtectionTriggers.mockReturnValue(false);
    mockGetCurrentProtectionTier.mockReturnValue(null);
    mockGetNextProtectionTier.mockReturnValue(null);
    mockIsFinalProtectionYear.mockReturnValue(false);
  });

  describe('resolveConveyanceForEntitlement', () => {
    it('should convey unprotected pick', () => {
      const entitlement = {
        id: 'ent-1',
        kind: 'pick_ownership',
        holderTeam: 'LAL',
        seasonYear: 2026,
        underlyingPickId: 'BOS_2026_1st',
      };

      const positionsMap = { BOS: 20 };
      const ladder = null;

      const result = resolveConveyanceForEntitlement(
        entitlement,
        positionsMap,
        ladder,
        {
          draftYear: 2026,
        }
      );

      expect(result.outcome).toBe('conveyed');
      expect(result.position).toBe(20);
      expect(result.entitlementId).toBe('ent-1');
    });

    it('should roll protected pick when protection triggers', () => {
      const entitlement = {
        id: 'ent-2',
        kind: 'pick_ownership',
        holderTeam: 'MIA',
        seasonYear: 2026,
        underlyingPickId: 'CHI_2026_1st',
      };

      const ladder: ProtectionLadder = [
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
        { year: 2028, condition: 'Unprotected', ifTriggered: 'cancel' },
      ];

      mockProtectionTriggers.mockReturnValue(true);
      mockGetCurrentProtectionTier.mockReturnValue(ladder[0]);
      mockGetNextProtectionTier.mockReturnValue(ladder[1]);
      mockIsFinalProtectionYear.mockReturnValue(false);

      const positionsMap = { CHI: 8 };

      const result = resolveConveyanceForEntitlement(
        entitlement,
        positionsMap,
        ladder,
        {
          draftYear: 2026,
        }
      );

      expect(result.outcome).toBe('rolled');
      expect(result.position).toBe(8);
      expect(result.newYear).toBe(2027);
    });

    it('should convert to second round when conversion triggers', () => {
      const entitlement = {
        id: 'ent-3',
        kind: 'pick_ownership',
        holderTeam: 'PHX',
        seasonYear: 2026,
        underlyingPickId: 'DET_2026_1st',
      };

      const ladder: ProtectionLadder = [
        {
          year: 2026,
          condition: 'Lottery',
          ifTriggered: 'convert',
          convertToRound: 2,
        },
      ];

      mockProtectionTriggers.mockReturnValue(true);
      mockGetCurrentProtectionTier.mockReturnValue(ladder[0]);
      mockIsFinalProtectionYear.mockReturnValue(false);

      const positionsMap = { DET: 5 };

      const result = resolveConveyanceForEntitlement(
        entitlement,
        positionsMap,
        ladder,
        {
          draftYear: 2026,
        }
      );

      expect(result.outcome).toBe('converted');
      expect(result.position).toBe(5);
      expect(result.convertedToRound).toBe(2);
    });

    it('should expire pick at final protection year', () => {
      const entitlement = {
        id: 'ent-4',
        kind: 'pick_ownership',
        holderTeam: 'NYK',
        seasonYear: 2026,
        underlyingPickId: 'ORL_2026_1st',
      };

      const ladder: ProtectionLadder = [
        { year: 2026, condition: 'Top 3', ifTriggered: 'cancel' },
      ];

      mockProtectionTriggers.mockReturnValue(true);
      mockGetCurrentProtectionTier.mockReturnValue(ladder[0]);
      mockIsFinalProtectionYear.mockReturnValue(true);

      const positionsMap = { ORL: 2 };

      const result = resolveConveyanceForEntitlement(
        entitlement,
        positionsMap,
        ladder,
        {
          draftYear: 2026,
        }
      );

      expect(result.outcome).toBe('expired');
      expect(result.position).toBe(2);
    });

    it('should convey pick with no protection ladder (unprotected)', () => {
      const entitlement = {
        id: 'ent-5',
        kind: 'pick_ownership',
        holderTeam: 'TOR',
        seasonYear: 2026,
        underlyingPickId: 'SAC_2026_1st',
      };

      const positionsMap = { SAC: 15 };

      const result = resolveConveyanceForEntitlement(
        entitlement,
        positionsMap,
        null,
        {
          draftYear: 2026,
        }
      );

      expect(result.outcome).toBe('conveyed');
      expect(result.position).toBe(15);
    });

    it('should return unchanged for non-conveyable entitlement kind', () => {
      const entitlement = {
        id: 'ent-swap',
        kind: 'swap_right',
        holderTeam: 'BOS',
        seasonYear: 2026,
        underlyingPickId: 'BOS_2026_1st',
      };

      const positionsMap = { BOS: 5 };

      const result = resolveConveyanceForEntitlement(
        entitlement,
        positionsMap,
        null,
        {
          draftYear: 2026,
        }
      );

      expect(result.outcome).toBe('unchanged');
      expect(result.reason).toContain('Not a conveyable entitlement');
    });

    it('should return unchanged when origin team not in positionsMap', () => {
      const entitlement = {
        id: 'ent-7',
        kind: 'pick_ownership',
        holderTeam: 'LAC',
        seasonYear: 2026,
        underlyingPickId: 'XXX_2026_1st',
      };

      const positionsMap = { LAL: 10 };

      const result = resolveConveyanceForEntitlement(
        entitlement,
        positionsMap,
        null,
        {
          draftYear: 2026,
        }
      );

      expect(result.outcome).toBe('unchanged');
      expect(result.reason).toContain('Missing position data');
    });

    it('should handle lottery threshold correctly (1-14)', () => {
      const entitlement = {
        id: 'ent-8',
        kind: 'pick_ownership',
        holderTeam: 'BKN',
        seasonYear: 2026,
        underlyingPickId: 'WAS_2026_1st',
      };

      const ladder: ProtectionLadder = [
        {
          year: 2026,
          condition: 'Lottery',
          ifTriggered: 'roll',
          rollToYear: 2027,
        },
        { year: 2027, condition: 'Unprotected', ifTriggered: 'cancel' },
      ];

      mockProtectionTriggers.mockReturnValue(true);
      mockGetCurrentProtectionTier.mockReturnValue(ladder[0]);
      mockGetNextProtectionTier.mockReturnValue(ladder[1]);
      mockIsFinalProtectionYear.mockReturnValue(false);

      let positionsMap = { WAS: 14 };
      let result = resolveConveyanceForEntitlement(
        entitlement,
        positionsMap,
        ladder,
        {
          draftYear: 2026,
        }
      );
      expect(result.outcome).toBe('rolled');

      mockProtectionTriggers.mockReturnValue(false);

      positionsMap = { WAS: 15 };
      result = resolveConveyanceForEntitlement(
        entitlement,
        positionsMap,
        ladder,
        {
          draftYear: 2026,
        }
      );
      expect(result.outcome).toBe('conveyed');
    });

    it('should return unchanged when draftYear does not match entitlement year', () => {
      const entitlement = {
        id: 'ent-9',
        kind: 'pick_ownership',
        holderTeam: 'CLE',
        seasonYear: 2027,
        underlyingPickId: 'IND_2027_1st',
      };

      const positionsMap = { IND: 7 };

      const result = resolveConveyanceForEntitlement(
        entitlement,
        positionsMap,
        null,
        {
          draftYear: 2026,
        }
      );

      expect(result.outcome).toBe('unchanged');
      expect(result.reason).toContain('does not match draft year');
    });

    it('should handle Top 5 protection correctly at boundary', () => {
      const entitlement = {
        id: 'ent-10',
        kind: 'pick_ownership',
        holderTeam: 'ATL',
        seasonYear: 2026,
        underlyingPickId: 'SAS_2026_1st',
      };

      const ladder: ProtectionLadder = [
        {
          year: 2026,
          condition: 'Top 5',
          ifTriggered: 'roll',
          rollToYear: 2027,
        },
        { year: 2027, condition: 'Unprotected', ifTriggered: 'cancel' },
      ];

      mockProtectionTriggers.mockReturnValue(true);
      mockGetCurrentProtectionTier.mockReturnValue(ladder[0]);
      mockGetNextProtectionTier.mockReturnValue(ladder[1]);
      mockIsFinalProtectionYear.mockReturnValue(false);

      let positionsMap = { SAS: 5 };
      let result = resolveConveyanceForEntitlement(
        entitlement,
        positionsMap,
        ladder,
        {
          draftYear: 2026,
        }
      );
      expect(result.outcome).toBe('rolled');

      mockProtectionTriggers.mockReturnValue(false);

      positionsMap = { SAS: 6 };
      result = resolveConveyanceForEntitlement(
        entitlement,
        positionsMap,
        ladder,
        {
          draftYear: 2026,
        }
      );
      expect(result.outcome).toBe('conveyed');
    });
  });
});
