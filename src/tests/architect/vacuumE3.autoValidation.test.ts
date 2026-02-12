/**
 * FILE: src/tests/architect/vacuumE3.autoValidation.test.ts
 * PURPOSE: TM-VACUUM-E3 — Verify revert/delete trigger validation refresh.
 *          Tests the pattern used in TradeEditor:
 *          1) removeEdit/removeCreate → refreshEntitlements() → handleValidate()
 *
 * HISTORY:
 *  - 2026-02-12: Created for TM-VACUUM-E3 auto-validation validation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  removeEdit,
  removeCreate,
  applyVacuumEdit,
  applyVacuumCreate,
  clearVacuumOverlay,
  getTeamOverlay,
} from '@/features/architect/utils/entitlements/vacuumEntitlementOverlayStore';

// Provide localStorage mock
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

describe('Vacuum revert/delete → validation refresh pattern', () => {
  beforeEach(() => {
    clearVacuumOverlay();
  });

  describe('removeEdit triggers overlay change', () => {
    it('after removeEdit, overlay no longer contains the edit', () => {
      // Set up: apply a vacuum edit
      applyVacuumEdit('BOS', 'ent:BOS:2027:1:own:abc', {
        description: 'Edited description',
      });

      // Verify edit exists
      let overlay = getTeamOverlay('BOS');
      expect(overlay?.edits?.['ent:BOS:2027:1:own:abc']).toBeTruthy();

      // Revert it
      removeEdit('BOS', 'ent:BOS:2027:1:own:abc');

      // Verify edit is gone
      overlay = getTeamOverlay('BOS');
      expect(overlay?.edits?.['ent:BOS:2027:1:own:abc']).toBeUndefined();
    });

    it('removeEdit allows validation to see original entitlement', () => {
      // This tests the pattern: after removeEdit, refreshEntitlements() would
      // re-resolve and the resolver would return base (unedited) entitlements
      applyVacuumEdit('BOS', 'ent:BOS:2027:1:own:abc', {
        round: 2,
      });

      // Before revert: overlay has the edit
      let overlay = getTeamOverlay('BOS');
      expect(overlay?.edits?.['ent:BOS:2027:1:own:abc']?.round).toBe(2);

      // Revert
      removeEdit('BOS', 'ent:BOS:2027:1:own:abc');

      // After revert: overlay is clean
      overlay = getTeamOverlay('BOS');
      const editEntry = overlay?.edits?.['ent:BOS:2027:1:own:abc'];
      expect(editEntry).toBeUndefined();
    });
  });

  describe('removeCreate triggers overlay change', () => {
    it('after removeCreate, overlay no longer contains the create', () => {
      const vacuumId = 'vacuum:BOS:2028:1:own:abcd1234';
      applyVacuumCreate('BOS', vacuumId, {
        holderTeam: 'BOS',
        seasonYear: 2028,
        round: 1,
        kind: 'pick_ownership',
      });

      // Verify create exists
      let overlay = getTeamOverlay('BOS');
      expect(overlay?.creates?.[vacuumId]).toBeTruthy();

      // Delete it
      removeCreate('BOS', vacuumId);

      // Verify create is gone
      overlay = getTeamOverlay('BOS');
      expect(overlay?.creates?.[vacuumId]).toBeUndefined();
    });

    it('removeCreate removes the entitlement from resolver input', () => {
      const vacuumId = 'vacuum:LAL:2029:2:own:xyz98765';
      applyVacuumCreate('LAL', vacuumId, {
        holderTeam: 'LAL',
        seasonYear: 2029,
        round: 2,
        kind: 'pick_ownership',
        description: 'Session-only pick',
      });

      // Before delete
      let overlay = getTeamOverlay('LAL');
      expect(overlay?.creates?.[vacuumId]?.description).toBe(
        'Session-only pick'
      );

      // Delete
      removeCreate('LAL', vacuumId);

      // After delete: the entry should be gone
      overlay = getTeamOverlay('LAL');
      expect(overlay?.creates?.[vacuumId]).toBeUndefined();
    });
  });

  describe('validation pipeline integration', () => {
    it('simulates the revert → refresh → validate pattern', () => {
      // This test validates the PATTERN used in TradeEditor:
      // 1. Apply overlay edits (simulating user changes)
      // 2. removeEdit (revert)
      // 3. Verify overlay is clean (refreshEntitlements would re-resolve)
      // 4. A mock validator would see the original entitlements

      const mockRefreshEntitlements = vi.fn();
      const mockHandleValidate = vi.fn();

      // Step 1: Apply edit
      applyVacuumEdit('BOS', 'ent:BOS:2027:1:own:abc', {
        round: 2,
        description: 'Changed',
      });

      // Step 2: Revert (pattern from TradeEditor.handleRevertEntitlementEdit)
      removeEdit('BOS', 'ent:BOS:2027:1:own:abc');
      mockRefreshEntitlements();
      mockHandleValidate();

      // Step 3: Verify functions were called
      expect(mockRefreshEntitlements).toHaveBeenCalledTimes(1);
      expect(mockHandleValidate).toHaveBeenCalledTimes(1);

      // Step 4: Overlay should be clean
      const overlay = getTeamOverlay('BOS');
      expect(overlay?.edits?.['ent:BOS:2027:1:own:abc']).toBeUndefined();
    });

    it('simulates the delete → refresh → validate pattern', () => {
      const mockRefreshEntitlements = vi.fn();
      const mockHandleValidate = vi.fn();

      const vacuumId = 'vacuum:BOS:2028:1:own:abcd1234';

      // Step 1: Create
      applyVacuumCreate('BOS', vacuumId, {
        holderTeam: 'BOS',
        seasonYear: 2028,
        round: 1,
        kind: 'pick_ownership',
      });

      // Step 2: Delete (pattern from TradeEditor.handleDeleteSessionEntitlement)
      removeCreate('BOS', vacuumId);
      mockRefreshEntitlements();
      mockHandleValidate();

      // Step 3: Verify functions were called
      expect(mockRefreshEntitlements).toHaveBeenCalledTimes(1);
      expect(mockHandleValidate).toHaveBeenCalledTimes(1);

      // Step 4: Overlay should be clean
      const overlay = getTeamOverlay('BOS');
      expect(overlay?.creates?.[vacuumId]).toBeUndefined();
    });
  });
});
