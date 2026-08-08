/**
 * FILE: tests/entitlements/entitlementWarnings.test.ts
 * PURPOSE: Lock warning helper behavior for the E67 entitlement presentation migration.
 * OWNERSHIP: Feature: architect/tradeMachine
 *
 * HISTORY:
 *  - 2026-03-12: Created for E67 entitlement presentation helper migration.
 */

import { describe, expect, it } from 'vitest';
import {
  computeEntitlementWarnings,
  getEntitlementKindBadge,
} from '@/features/architect/tradeMachine/utils/entitlementWarnings';

const ENCUMBERED_WARNING =
  '⚠️ Encumbered pick traded without linked swap right. Recipient may not receive expected value.';
const LINKED_WARNING =
  '⚠️ This pick right is linked to other pick rights not included in the trade.';
const SWAP_CONFLICT_WARNING =
  '⚠️ This swap uses a controller pick that is also being moved in this trade.';

describe('entitlementWarnings', () => {
  describe('computeEntitlementWarnings', () => {
    it('returns an empty array for non-array or empty inputs', () => {
      expect(computeEntitlementWarnings(undefined)).toEqual([]);
      expect(computeEntitlementWarnings(null)).toEqual([]);
      expect(computeEntitlementWarnings([])).toEqual([]);
    });

    it('warns for encumbered picks without a linked outgoing swap right', () => {
      expect(
        computeEntitlementWarnings([
          {
            id: 'own-1',
            kind: 'pick_ownership',
            underlyingStatus: 'encumbered',
            coveredByEntitlementIds: ['swap-1'],
          },
        ])
      ).toEqual([ENCUMBERED_WARNING]);
    });

    it('does not warn for encumbered picks when the linked swap right is also outgoing', () => {
      expect(
        computeEntitlementWarnings([
          {
            id: 'own-1',
            kind: 'pick_ownership',
            underlyingStatus: 'encumbered',
            coveredByEntitlementIds: ['swap-1'],
          },
          {
            id: 'swap-1',
            kind: 'swap_right',
          },
        ])
      ).toEqual([]);
    });

    it('uses allTeamsEntitlementsOut when checking linked-package completeness', () => {
      const entitlementsOut = [
        {
          id: 'linked-1',
          kind: 'conveyance_right',
          linkedEntitlementIds: ['linked-2'],
        },
      ];

      expect(computeEntitlementWarnings(entitlementsOut)).toEqual([
        LINKED_WARNING,
      ]);

      expect(
        computeEntitlementWarnings(entitlementsOut, [
          entitlementsOut[0],
          {
            id: 'linked-2',
            kind: 'swap_right',
          },
        ])
      ).toEqual([]);
    });

    it('warns for swap controller conflicts', () => {
      expect(
        computeEntitlementWarnings([
          {
            id: 'own-1',
            kind: 'pick_ownership',
            underlyingPickId: 'BOS_2027_1st',
          },
          {
            id: 'swap-1',
            kind: 'swap_right',
            swapControllerPickId: 'BOS_2027_1st',
          },
        ])
      ).toEqual([SWAP_CONFLICT_WARNING]);
    });

    it('preserves warning insertion order and one-per-type dedupe behavior', () => {
      expect(
        computeEntitlementWarnings([
          {
            id: 'own-1',
            kind: 'pick_ownership',
            underlyingStatus: 'encumbered',
          },
          {
            id: 'linked-1',
            kind: 'conveyance_right',
            linkedEntitlementIds: ['linked-2'],
          },
          {
            id: 'own-2',
            kind: 'pick_ownership',
            underlyingStatus: 'encumbered',
            underlyingPickId: 'PHX_2028_1st',
          },
          {
            id: 'swap-1',
            kind: 'swap_right',
            swapControllerPickId: 'PHX_2028_1st',
          },
          {
            id: 'linked-3',
            kind: 'swap_right',
            linkedEntitlementIds: ['linked-4'],
          },
        ])
      ).toEqual([
        ENCUMBERED_WARNING,
        LINKED_WARNING,
        SWAP_CONFLICT_WARNING,
      ]);
    });
  });

  describe('getEntitlementKindBadge', () => {
    it('preserves exact badge mappings, keys, and color classes', () => {
      expect(getEntitlementKindBadge('pick_ownership')).toEqual({
        label: 'Own',
        colorClass: 'bg-cockpit-info/20 text-cockpit-info',
      });
      expect(Object.keys(getEntitlementKindBadge('pick_ownership'))).toEqual([
        'label',
        'colorClass',
      ]);

      expect(getEntitlementKindBadge('conveyance_right')).toEqual({
        label: 'Conditional',
        colorClass: 'bg-cockpit-info/20 text-cockpit-info',
      });
      expect(getEntitlementKindBadge('swap_right')).toEqual({
        label: 'Swap Option',
        colorClass: 'bg-cockpit-watch/20 text-cockpit-watch',
      });
    });

    it('preserves unknown badge fallback behavior exactly', () => {
      expect(getEntitlementKindBadge('mystery_kind')).toEqual({
        label: 'mystery_kind',
        colorClass: 'bg-cockpit-raised text-cockpit-text-secondary',
      });
      expect(getEntitlementKindBadge(undefined)).toEqual({
        label: 'Unknown',
        colorClass: 'bg-cockpit-raised text-cockpit-text-secondary',
      });
    });
  });
});
