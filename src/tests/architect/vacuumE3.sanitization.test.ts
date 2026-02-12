/**
 * FILE: src/tests/architect/vacuumE3.sanitization.test.ts
 * PURPOSE: TM-VACUUM-E3 — Verify vacuum metadata is stripped from payloads/receipts/exports.
 *
 * HISTORY:
 *  - 2026-02-12: Created for TM-VACUUM-E3 sanitization validation.
 */

import { describe, it, expect } from 'vitest';
import {
  sanitizeEntitlement,
  sanitizeEntitlements,
  hasVacuumMetadata,
} from '@/features/architect/utils/entitlements/sanitizeVacuumMetadata';

describe('sanitizeVacuumMetadata', () => {
  describe('sanitizeEntitlement', () => {
    it('returns null/undefined unchanged', () => {
      expect(sanitizeEntitlement(null)).toBeNull();
      expect(sanitizeEntitlement(undefined)).toBeUndefined();
    });

    it('returns same reference when no vacuum keys present', () => {
      const ent = {
        id: 'ent:BOS:2027:1:own:abc',
        holderTeam: 'BOS',
        seasonYear: 2027,
        round: 1,
        kind: 'pick_ownership',
      };
      const result = sanitizeEntitlement(ent);
      expect(result).toBe(ent); // same reference — no copy needed
    });

    it('strips __vacuumEdited', () => {
      const ent = {
        id: 'ent:BOS:2027:1:own:abc',
        holderTeam: 'BOS',
        seasonYear: 2027,
        __vacuumEdited: true,
      };
      const result = sanitizeEntitlement(ent);
      expect(result).not.toHaveProperty('__vacuumEdited');
      expect(result.id).toBe('ent:BOS:2027:1:own:abc');
      expect(result.holderTeam).toBe('BOS');
    });

    it('strips __vacuumSessionOnly', () => {
      const ent = {
        id: 'vacuum:BOS:2028:1:own:abcd1234',
        holderTeam: 'BOS',
        __vacuumSessionOnly: true,
      };
      const result = sanitizeEntitlement(ent);
      expect(result).not.toHaveProperty('__vacuumSessionOnly');
      expect(result.id).toBe('vacuum:BOS:2028:1:own:abcd1234');
    });

    it('strips both vacuum keys simultaneously', () => {
      const ent = {
        id: 'test',
        __vacuumEdited: true,
        __vacuumSessionOnly: true,
        holderTeam: 'LAL',
      };
      const result = sanitizeEntitlement(ent);
      expect(result).not.toHaveProperty('__vacuumEdited');
      expect(result).not.toHaveProperty('__vacuumSessionOnly');
      expect(result.holderTeam).toBe('LAL');
    });
  });

  describe('sanitizeEntitlements', () => {
    it('strips vacuum keys from all items in array', () => {
      const ents = [
        { id: 'a', __vacuumEdited: true, kind: 'pick_ownership' },
        { id: 'b', __vacuumSessionOnly: true, kind: 'swap_right' },
        { id: 'c', kind: 'conveyance_right' },
      ];
      const result = sanitizeEntitlements(ents);
      expect(result).toHaveLength(3);
      expect(result[0]).not.toHaveProperty('__vacuumEdited');
      expect(result[1]).not.toHaveProperty('__vacuumSessionOnly');
      expect(result[2]).toBe(ents[2]); // no vacuum keys = same reference
    });

    it('handles empty array', () => {
      expect(sanitizeEntitlements([])).toEqual([]);
    });
  });

  describe('hasVacuumMetadata', () => {
    it('returns false for null/undefined', () => {
      expect(hasVacuumMetadata(null)).toBe(false);
      expect(hasVacuumMetadata(undefined)).toBe(false);
    });

    it('returns true when __vacuumEdited is present', () => {
      expect(hasVacuumMetadata({ __vacuumEdited: true })).toBe(true);
    });

    it('returns true when __vacuumSessionOnly is present', () => {
      expect(hasVacuumMetadata({ __vacuumSessionOnly: true })).toBe(true);
    });

    it('returns false when no vacuum keys are present', () => {
      expect(hasVacuumMetadata({ id: 'test', holderTeam: 'BOS' })).toBe(false);
    });
  });
});
