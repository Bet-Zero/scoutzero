/**
 * FILE: tests/entitlements/formatEntitlement.test.ts
 * PURPOSE: Lock behavior for entitlement presentation helpers migrated in E67.
 * OWNERSHIP: Feature: architect/tradeMachine
 *
 * HISTORY:
 *  - 2026-03-12: Created for E67 entitlement presentation helper migration.
 */

import { describe, expect, it } from 'vitest';
import {
  formatEntitlementLabel,
  getEntitlementKindTag,
  getKindSortPriority,
} from '@/features/architect/utils/entitlements/formatEntitlement';

describe('formatEntitlement', () => {
  describe('getEntitlementKindTag', () => {
    it('preserves exact tag mappings, keys, and color classes', () => {
      expect(getEntitlementKindTag('pick_ownership')).toEqual({
        label: 'Own',
        colorClass: 'bg-cockpit-safe/20 text-cockpit-safe',
      });
      expect(Object.keys(getEntitlementKindTag('pick_ownership'))).toEqual([
        'label',
        'colorClass',
      ]);

      expect(getEntitlementKindTag('conveyance_right')).toEqual({
        label: 'Conditional',
        colorClass: 'bg-cockpit-watch/20 text-cockpit-watch',
      });
      expect(getEntitlementKindTag('swap_right')).toEqual({
        label: 'Swap Option',
        colorClass: 'bg-cockpit-info/20 text-cockpit-info',
      });
    });

    it('preserves unknown fallback behavior exactly', () => {
      expect(getEntitlementKindTag('mystery_kind')).toEqual({
        label: 'mystery_kind',
        colorClass: 'bg-cockpit-raised text-cockpit-text-muted',
      });
      expect(getEntitlementKindTag(undefined)).toEqual({
        label: 'Unknown',
        colorClass: 'bg-cockpit-raised text-cockpit-text-muted',
      });
    });
  });

  describe('formatEntitlementLabel', () => {
    it('returns description directly when present', () => {
      expect(
        formatEntitlementLabel({
          description: "Atlanta's 2028 1st top 5 protected",
          seasonYear: 2028,
          round: 1,
          originalTeamId: 'ATL',
          holderTeam: 'BKN',
          kind: 'pick_ownership',
        })
      ).toBe("Atlanta's 2028 1st top 5 protected");
    });

    it('formats year, round, via team, and swap suffix in current order', () => {
      expect(
        formatEntitlementLabel({
          seasonYear: 2027,
          round: 1,
          originalTeamId: 'bos',
          holderTeam: 'LAL',
          kind: 'swap_right',
        })
      ).toBe('2027 1st via BOS (Swap)');
    });

    it('formats season-only labels with original team when holder is unknown', () => {
      expect(
        formatEntitlementLabel({
          seasonYear: 2029,
          originalTeam: 'mia',
          kind: 'conveyance_right',
        })
      ).toBe('2029 MIA (Conditional)');
    });

    it('omits via when original team matches holder', () => {
      expect(
        formatEntitlementLabel({
          seasonYear: 2030,
          round: 2,
          originalTeamId: 'DAL',
          holderTeam: 'DAL',
          kind: 'pick_ownership',
        })
      ).toBe('2030 2nd');
    });

    it('falls back to Unknown Pick when no usable fields exist', () => {
      expect(formatEntitlementLabel(null)).toBe('Unknown Pick');
      expect(formatEntitlementLabel({})).toBe('Unknown Pick');
    });
  });

  describe('getKindSortPriority', () => {
    it('preserves sort priority mappings and unknown fallback', () => {
      expect(getKindSortPriority('pick_ownership')).toBe(1);
      expect(getKindSortPriority('conveyance_right')).toBe(2);
      expect(getKindSortPriority('swap_right')).toBe(3);
      expect(getKindSortPriority('mystery_kind')).toBe(99);
      expect(getKindSortPriority(undefined)).toBe(99);
    });
  });
});
