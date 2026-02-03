/**
 * FILE: src/tests/architect/dare/swapResolutionAdapter.test.js
 * PURPOSE: Tests for swap resolution adapter
 */

import { describe, it, expect } from 'vitest';
import { resolveSwapForEntitlement } from '@/features/architect/utils/entitlements/dare/swapResolutionAdapter';

describe('Swap Resolution Adapter', () => {
  const baseOpts = {
    draftYear: 2026,
    nowIso: '2026-06-25T12:00:00Z',
    method: 'lottery',
  };

  describe('resolveSwapForEntitlement', () => {
    it('resolves best_of swap to lower position team', () => {
      const entitlement = {
        id: 'ent:NOP:2026:1:swap:xyz',
        kind: 'swap_right',
        holderTeam: 'NOP',
        seasonYear: 2026,
        swapControllerPickId: 'NOP_2026_1st',
        swapTargetDefinition: 'Option to swap with MIL',
        swapType: 'best_of',
      };
      const positionsMap = { NOP: 10, MIL: 5 };

      const result = resolveSwapForEntitlement(entitlement, positionsMap, baseOpts);

      expect(result.outcome).toBe('swap_resolved');
      expect(result.swapWinner).toBe('MIL');
      expect(result.swapPosition).toBe(5);
      expect(result.swapLoser).toBe('NOP');
    });

    it('resolves worst_of swap to higher position team', () => {
      const entitlement = {
        id: 'ent:OKC:2026:1:swap:abc',
        kind: 'swap_right',
        holderTeam: 'OKC',
        seasonYear: 2026,
        swapControllerPickId: 'OKC_2026_1st',
        swapTargetDefinition: 'Option to swap with LAL',
        swapType: 'worst_of',
      };
      const positionsMap = { OKC: 5, LAL: 20 };

      const result = resolveSwapForEntitlement(entitlement, positionsMap, baseOpts);

      expect(result.outcome).toBe('swap_resolved');
      expect(result.swapWinner).toBe('LAL');
      expect(result.swapPosition).toBe(20);
      expect(result.swapLoser).toBe('OKC');
    });

    it('defaults to best_of when swapType not specified', () => {
      const entitlement = {
        id: 'ent:BOS:2026:1:swap:def',
        kind: 'swap_right',
        holderTeam: 'BOS',
        seasonYear: 2026,
        swapControllerPickId: 'BOS_2026_1st',
        swapTargetDefinition: 'Option to swap with PHI',
        // No swapType - should default to best_of
      };
      const positionsMap = { BOS: 15, PHI: 8 };

      const result = resolveSwapForEntitlement(entitlement, positionsMap, baseOpts);

      expect(result.outcome).toBe('swap_resolved');
      expect(result.swapWinner).toBe('PHI'); // Lower position wins in best_of
      expect(result.swapPosition).toBe(8);
    });

    it('returns unchanged for non-swap entitlement', () => {
      const entitlement = {
        id: 'ent:LAL:2026:1:own:xyz',
        kind: 'pick_ownership',
        holderTeam: 'LAL',
        seasonYear: 2026,
      };
      const positionsMap = { LAL: 5 };

      const result = resolveSwapForEntitlement(entitlement, positionsMap, baseOpts);

      expect(result.outcome).toBe('unchanged');
      expect(result.reason).toContain('Not a swap_right');
    });

    it('returns unchanged for wrong year', () => {
      const entitlement = {
        id: 'ent:MIA:2027:1:swap:xyz',
        kind: 'swap_right',
        holderTeam: 'MIA',
        seasonYear: 2027, // Different year
        swapControllerPickId: 'MIA_2027_1st',
        swapTargetDefinition: 'Swap with CHI',
      };
      const positionsMap = { MIA: 10, CHI: 15 };

      const result = resolveSwapForEntitlement(entitlement, positionsMap, baseOpts);

      expect(result.outcome).toBe('unchanged');
      expect(result.reason).toContain('does not match draft year');
    });

    it('returns unchanged for already resolved entitlement', () => {
      const entitlement = {
        id: 'ent:ATL:2026:1:swap:xyz',
        kind: 'swap_right',
        holderTeam: 'ATL',
        seasonYear: 2026,
        swapControllerPickId: 'ATL_2026_1st',
        swapTargetDefinition: 'Swap with DET',
        resolved: true, // Already resolved
      };
      const positionsMap = { ATL: 10, DET: 5 };

      const result = resolveSwapForEntitlement(entitlement, positionsMap, baseOpts);

      expect(result.outcome).toBe('unchanged');
      expect(result.reason).toContain('already resolved');
    });

    it('returns unchanged when missing position data', () => {
      const entitlement = {
        id: 'ent:CLE:2026:1:swap:xyz',
        kind: 'swap_right',
        holderTeam: 'CLE',
        seasonYear: 2026,
        swapControllerPickId: 'CLE_2026_1st',
        swapTargetDefinition: 'Swap with TOR',
      };
      const positionsMap = { CLE: 10 }; // Missing TOR

      const result = resolveSwapForEntitlement(entitlement, positionsMap, baseOpts);

      expect(result.outcome).toBe('unchanged');
      expect(result.reason).toContain('Missing position data');
    });

    it('handles tie by awarding to controller team', () => {
      const entitlement = {
        id: 'ent:NYK:2026:1:swap:xyz',
        kind: 'swap_right',
        holderTeam: 'NYK',
        seasonYear: 2026,
        swapControllerPickId: 'NYK_2026_1st',
        swapTargetDefinition: 'Swap with BKN',
        swapType: 'best_of',
      };
      const positionsMap = { NYK: 10, BKN: 10 }; // Same position = tie

      const result = resolveSwapForEntitlement(entitlement, positionsMap, baseOpts);

      expect(result.outcome).toBe('swap_resolved');
      expect(result.swapWinner).toBe('NYK'); // Controller wins ties
    });
  });
});
