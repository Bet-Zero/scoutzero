/**
 * FILE: src/tests/architect/entitlementInvariants.test.js
 * PURPOSE: Tests for entitlement league invariants (B5 + B6)
 */

import { describe, it, expect } from 'vitest';
import {
  validateNoDuplicateEntitlements,
  validatePickSlotAccounting,
} from '@/features/architect/utils/leagueInvariants';

describe('Entitlement Invariants', () => {
  describe('validateNoDuplicateEntitlements (B5)', () => {
    it('passes when no duplicates', () => {
      const teams = [
        { teamCode: 'LAL', entitlementIds: ['ent:1', 'ent:2'] },
        { teamCode: 'BOS', entitlementIds: ['ent:3', 'ent:4'] },
        { teamCode: 'MIA', entitlementIds: ['ent:5'] },
      ];

      const result = validateNoDuplicateEntitlements(teams);

      expect(result.valid).toBe(true);
      expect(result.duplicates).toBeUndefined();
    });

    it('detects entitlement on multiple teams', () => {
      const teams = [
        { teamCode: 'LAL', entitlementIds: ['ent:1', 'ent:2'] },
        { teamCode: 'BOS', entitlementIds: ['ent:2', 'ent:3'] }, // ent:2 is duplicate
      ];

      const result = validateNoDuplicateEntitlements(teams);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('ent:2');
      expect(result.error).toContain('LAL');
      expect(result.error).toContain('BOS');
      const duplicates = result.duplicates ?? [];
      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].entitlementId).toBe('ent:2');
      expect(duplicates[0].teams).toContain('LAL');
      expect(duplicates[0].teams).toContain('BOS');
    });

    it('detects multiple duplicates', () => {
      const teams = [
        { teamCode: 'LAL', entitlementIds: ['ent:1', 'ent:2', 'ent:3'] },
        { teamCode: 'BOS', entitlementIds: ['ent:2', 'ent:3', 'ent:4'] }, // ent:2 and ent:3 are duplicates
      ];

      const result = validateNoDuplicateEntitlements(teams);

      expect(result.valid).toBe(false);
      expect(result.duplicates).toHaveLength(2);
    });

    it('handles teams with empty entitlementIds', () => {
      const teams = [
        { teamCode: 'LAL', entitlementIds: [] },
        { teamCode: 'BOS', entitlementIds: ['ent:1'] },
        { teamCode: 'MIA' }, // No entitlementIds field
      ];

      const result = validateNoDuplicateEntitlements(teams);

      expect(result.valid).toBe(true);
    });

    it('handles teams with missing teamCode', () => {
      const teams = [
        { teamCode: 'LAL', entitlementIds: ['ent:1'] },
        { entitlementIds: ['ent:2'] }, // No teamCode - should be skipped
      ];

      const result = validateNoDuplicateEntitlements(teams);

      expect(result.valid).toBe(true);
    });

    it('handles empty teams array', () => {
      const result = validateNoDuplicateEntitlements([]);
      expect(result.valid).toBe(true);
    });
  });

  describe('validatePickSlotAccounting (B6)', () => {
    const TEAM_CODES = ['LAL', 'BOS', 'MIA'];

    it('passes when all slots accounted for', () => {
      const teams = [
        {
          teamCode: 'LAL',
          entitlements: [
            { id: 'ent:1', kind: 'pick_ownership', seasonYear: 2026, round: 1, underlyingPickId: 'LAL_2026_1st' },
            { id: 'ent:2', kind: 'pick_ownership', seasonYear: 2026, round: 2, underlyingPickId: 'LAL_2026_2nd' },
          ],
        },
        {
          teamCode: 'BOS',
          entitlements: [
            { id: 'ent:3', kind: 'pick_ownership', seasonYear: 2026, round: 1, underlyingPickId: 'BOS_2026_1st' },
            { id: 'ent:4', kind: 'pick_ownership', seasonYear: 2026, round: 2, underlyingPickId: 'BOS_2026_2nd' },
          ],
        },
        {
          teamCode: 'MIA',
          entitlements: [
            { id: 'ent:5', kind: 'pick_ownership', seasonYear: 2026, round: 1, underlyingPickId: 'MIA_2026_1st' },
            { id: 'ent:6', kind: 'pick_ownership', seasonYear: 2026, round: 2, underlyingPickId: 'MIA_2026_2nd' },
          ],
        },
      ];
      const yearRange = [2026];

      const result = validatePickSlotAccounting(teams, yearRange, TEAM_CODES);

      expect(result.valid).toBe(true);
      expect(result.expected).toBe(6); // 3 teams × 2 rounds × 1 year
      expect(result.actual).toBe(6);
    });

    it('detects missing slots', () => {
      const teams = [
        {
          teamCode: 'LAL',
          entitlements: [
            { id: 'ent:1', kind: 'pick_ownership', seasonYear: 2026, round: 1, underlyingPickId: 'LAL_2026_1st' },
            // Missing LAL 2nd round
          ],
        },
        {
          teamCode: 'BOS',
          entitlements: [
            { id: 'ent:2', kind: 'pick_ownership', seasonYear: 2026, round: 1, underlyingPickId: 'BOS_2026_1st' },
            { id: 'ent:3', kind: 'pick_ownership', seasonYear: 2026, round: 2, underlyingPickId: 'BOS_2026_2nd' },
          ],
        },
        {
          teamCode: 'MIA',
          entitlements: [
            { id: 'ent:4', kind: 'pick_ownership', seasonYear: 2026, round: 1, underlyingPickId: 'MIA_2026_1st' },
            { id: 'ent:5', kind: 'pick_ownership', seasonYear: 2026, round: 2, underlyingPickId: 'MIA_2026_2nd' },
          ],
        },
      ];
      const yearRange = [2026];

      const result = validatePickSlotAccounting(teams, yearRange, TEAM_CODES);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing: 1');
      const missingSlots = result.missingSlots ?? [];
      expect(missingSlots).toHaveLength(1);
      expect(missingSlots[0]).toMatchObject({ year: 2026, round: 2, team: 'LAL' });
    });

    it('detects duplicate slot coverage', () => {
      const teams = [
        {
          teamCode: 'LAL',
          entitlements: [
            { id: 'ent:1', kind: 'pick_ownership', seasonYear: 2026, round: 1, underlyingPickId: 'LAL_2026_1st' },
            { id: 'ent:2', kind: 'pick_ownership', seasonYear: 2026, round: 2, underlyingPickId: 'LAL_2026_2nd' },
          ],
        },
        {
          teamCode: 'BOS',
          entitlements: [
            { id: 'ent:3', kind: 'pick_ownership', seasonYear: 2026, round: 1, underlyingPickId: 'BOS_2026_1st' },
            { id: 'ent:4', kind: 'pick_ownership', seasonYear: 2026, round: 2, underlyingPickId: 'BOS_2026_2nd' },
            // BOS also has LAL's pick (duplicate slot coverage)
            { id: 'ent:5', kind: 'pick_ownership', seasonYear: 2026, round: 1, underlyingPickId: 'LAL_2026_1st' },
          ],
        },
        {
          teamCode: 'MIA',
          entitlements: [
            { id: 'ent:6', kind: 'pick_ownership', seasonYear: 2026, round: 1, underlyingPickId: 'MIA_2026_1st' },
            { id: 'ent:7', kind: 'pick_ownership', seasonYear: 2026, round: 2, underlyingPickId: 'MIA_2026_2nd' },
          ],
        },
      ];
      const yearRange = [2026];

      const result = validatePickSlotAccounting(teams, yearRange, TEAM_CODES);

      expect(result.valid).toBe(false);
      const extraSlots = result.extraSlots ?? [];
      expect(extraSlots).toHaveLength(1);
      expect(extraSlots[0].entitlementId).toBe('ent:5');
    });

    it('only counts pick_ownership entitlements', () => {
      const teams = [
        {
          teamCode: 'LAL',
          entitlements: [
            { id: 'ent:1', kind: 'pick_ownership', seasonYear: 2026, round: 1, underlyingPickId: 'LAL_2026_1st' },
            { id: 'ent:2', kind: 'pick_ownership', seasonYear: 2026, round: 2, underlyingPickId: 'LAL_2026_2nd' },
            // swap_right should not be counted as a slot
            { id: 'ent:3', kind: 'swap_right', seasonYear: 2026, round: 1, underlyingPickId: 'LAL_2026_1st' },
          ],
        },
      ];
      const yearRange = [2026];

      const result = validatePickSlotAccounting(teams, yearRange, ['LAL']);

      expect(result.valid).toBe(true);
      expect(result.actual).toBe(2); // Only pick_ownership counted
    });

    it('handles multiple years', () => {
      const teams = [
        {
          teamCode: 'LAL',
          entitlements: [
            { id: 'ent:1', kind: 'pick_ownership', seasonYear: 2026, round: 1, underlyingPickId: 'LAL_2026_1st' },
            { id: 'ent:2', kind: 'pick_ownership', seasonYear: 2026, round: 2, underlyingPickId: 'LAL_2026_2nd' },
            { id: 'ent:3', kind: 'pick_ownership', seasonYear: 2027, round: 1, underlyingPickId: 'LAL_2027_1st' },
            { id: 'ent:4', kind: 'pick_ownership', seasonYear: 2027, round: 2, underlyingPickId: 'LAL_2027_2nd' },
          ],
        },
      ];
      const yearRange = [2026, 2027];

      const result = validatePickSlotAccounting(teams, yearRange, ['LAL']);

      expect(result.valid).toBe(true);
      expect(result.expected).toBe(4); // 1 team × 2 rounds × 2 years
      expect(result.actual).toBe(4);
    });

    it('handles empty inputs', () => {
      expect(validatePickSlotAccounting([], [], []).valid).toBe(true);
      expect(validatePickSlotAccounting([], [2026], ['LAL']).expected).toBe(2);
    });
  });
});
