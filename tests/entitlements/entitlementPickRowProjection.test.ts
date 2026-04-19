/**
 * FILE: tests/entitlements/entitlementPickRowProjection.test.js
 * PURPOSE: Tests for PickRow projection layer (Phase 12.3C)
 * OWNERSHIP: Trade Machine / Entitlements
 * HISTORY:
 *   - 2026-01-30: Created for Phase 12.3C - Entitlement PickRow Projection Layer
 * LINKS:
 *   - docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md (Phase 12.3C)
 *   - src/features/architect/utils/entitlements/entitlementPickRowProjection.ts
 */
import { describe, it, expect } from 'vitest';
import {
  projectEntitlementToPickRow,
  getPickRowDisplayLabel,
  getPickRowSecondaryText,
} from '@/features/architect/utils/entitlements/entitlementPickRowProjection';

describe('entitlementPickRowProjection', () => {
  describe('projectEntitlementToPickRow', () => {
    describe('pick_ownership entitlements', () => {
      it('projects basic unprotected pick_ownership correctly', () => {
        const entitlement = {
          id: 'BOS_pick_ownership_2026_R1',
          kind: 'pick_ownership',
          seasonYear: 2026,
          round: 1,
          underlyingPickId: 'BOS_2026_1st',
          underlyingStatus: 'clean',
          description: "Boston's 2026 1st round pick",
        };

        const result = projectEntitlementToPickRow(entitlement, {
          teamCode: 'BOS',
        });

        expect(result.id).toBe('BOS_pick_ownership_2026_R1');
        expect(result.year).toBe(2026);
        expect(result.round).toBe(1);
        expect(result.kind).toBe('pick_ownership');
        expect(result.assetType).toBe('outright_pick');
        expect(result.originalTeam).toBe('BOS');
        expect(result.via).toBeNull(); // Same as holder
        expect(result.protectionText).toBe('Unprotected');
        expect(result.protectionMeta).toBeNull();
      });

      it('projects pick_ownership with top N protection', () => {
        const entitlement = {
          id: 'DAL_pick_ownership_2027_R1',
          kind: 'pick_ownership',
          seasonYear: 2027,
          round: 1,
          underlyingPickId: 'DAL_2027_1st',
          underlyingStatus: 'clean',
          description: "Dallas' 2027 1st top 4 protected",
        };

        const result = projectEntitlementToPickRow(entitlement, {
          teamCode: 'NYK',
        });

        expect(result.id).toBe('DAL_pick_ownership_2027_R1');
        expect(result.year).toBe(2027);
        expect(result.round).toBe(1);
        expect(result.assetType).toBe('conditional_right'); // Has protection
        expect(result.originalTeam).toBe('DAL');
        expect(result.via).toBe('DAL'); // Different from holder (NYK)
        expect(result.protectionText).toBe('Top 4 protected');
        expect(result.protectionMeta).toEqual({
          type: 'top_n',
          protectedRange: { start: 1, end: 4 },
        });
      });

      it('projects pick_ownership with lottery protection', () => {
        const entitlement = {
          id: 'MIA_pick_ownership_2028_R1',
          kind: 'pick_ownership',
          seasonYear: 2028,
          round: 1,
          underlyingPickId: 'MIA_2028_1st',
          underlyingStatus: 'encumbered',
          description: "Miami's 2028 1st lottery protected",
        };

        const result = projectEntitlementToPickRow(entitlement, {
          teamCode: 'OKC',
        });

        expect(result.assetType).toBe('conditional_right');
        expect(result.protectionText).toBe('Lottery protected');
        expect(result.protectionMeta).toEqual({
          type: 'lottery',
          protectedRange: { start: 1, end: 14 },
        });
      });

      it('projects 2nd round pick_ownership', () => {
        const entitlement = {
          id: 'LAL_pick_ownership_2026_R2',
          kind: 'pick_ownership',
          seasonYear: 2026,
          round: 2,
          underlyingPickId: 'LAL_2026_2nd',
          underlyingStatus: 'clean',
          description: "Lakers' 2026 2nd round pick",
        };

        const result = projectEntitlementToPickRow(entitlement, {
          teamCode: 'LAL',
        });

        expect(result.round).toBe(2);
        expect(result.assetType).toBe('outright_pick');
        expect(result.protectionText).toBe('Unprotected');
      });
    });

    describe('swap_right entitlements', () => {
      it('projects swap_right correctly', () => {
        const entitlement = {
          id: 'ATL_swap_right_2026_R1',
          kind: 'swap_right',
          seasonYear: 2026,
          round: 1,
          swapTarget: 'SAS_2026_1st',
          underlyingStatus: 'clean',
          description: 'Hawks option to swap with Spurs 2026 1st',
        };

        const result = projectEntitlementToPickRow(entitlement, {
          teamCode: 'ATL',
        });

        expect(result.id).toBe('ATL_swap_right_2026_R1');
        expect(result.kind).toBe('swap_right');
        expect(result.assetType).toBe('swap_right');
        expect(result.protectionText).toBe('Swap option');
        expect(result.conditionsText).toBe(null);
      });

      it('projects swap_right with pool', () => {
        const entitlement = {
          id: 'PHX_swap_right_2027_R1',
          kind: 'swap_right',
          seasonYear: 2027,
          round: 1,
          poolUnderlyingPickIds: [
            'PHX_2027_1st',
            'WAS_2027_1st',
            'MIA_2027_1st',
          ],
          underlyingStatus: 'clean',
          description: 'Phoenix swap right from pool',
        };

        const result = projectEntitlementToPickRow(entitlement, {
          teamCode: 'PHX',
        });

        expect(result.assetType).toBe('swap_right');
        expect(result.conditionsText).toBe('Swap pool (3 picks)');
      });
    });

    describe('conveyance_right entitlements', () => {
      it('projects conveyance_right correctly', () => {
        const entitlement = {
          id: 'DEN_conveyance_right_2027_R1',
          kind: 'conveyance_right',
          seasonYear: 2027,
          round: 1,
          poolUnderlyingPickIds: ['DEN_2027_1st', 'MIN_2027_1st'],
          selectionRanks: [1],
          selectionCriteria: 'more_favorable',
          underlyingStatus: 'pooled',
          description: 'Denver receives more favorable of own or MIN 2027 1st',
        };

        const result = projectEntitlementToPickRow(entitlement, {
          teamCode: 'DEN',
        });

        expect(result.id).toBe('DEN_conveyance_right_2027_R1');
        expect(result.kind).toBe('conveyance_right');
        expect(result.assetType).toBe('conditional_right');
        expect(result.protectionText).toBe('Conditional');
        expect(result.conditionsText).toBe('Pool of 2 picks');
      });

      it('projects conveyance_right with convey mention in description', () => {
        const entitlement = {
          id: 'CLE_conveyance_right_2028_R1',
          kind: 'conveyance_right',
          seasonYear: 2028,
          round: 1,
          description: "Cleveland receives pick if protection doesn't convey",
        };

        const result = projectEntitlementToPickRow(entitlement, {
          teamCode: 'CLE',
        });

        expect(result.assetType).toBe('conditional_right');
        expect(result.conditionsText).toContain('convey');
      });
    });

    describe('protectionText fallback behavior', () => {
      it('returns "Unprotected" for pick_ownership without protection mention', () => {
        const entitlement = {
          id: 'GSW_pick_ownership_2026_R1',
          kind: 'pick_ownership',
          seasonYear: 2026,
          round: 1,
          description: "Warriors' 2026 1st round pick",
        };

        const result = projectEntitlementToPickRow(entitlement, {
          teamCode: 'GSW',
        });

        expect(result.protectionText).toBe('Unprotected');
        expect(result.protectionMeta).toBeNull();
      });

      it('extracts protection text from description when structured parse fails', () => {
        const entitlement = {
          id: 'CHI_pick_ownership_2027_R1',
          kind: 'pick_ownership',
          seasonYear: 2027,
          round: 1,
          description: 'Bulls 2027 1st protected if Bulls miss playoffs',
        };

        const result = projectEntitlementToPickRow(entitlement, {
          teamCode: 'CHI',
        });

        expect(result.assetType).toBe('conditional_right');
        expect(result.protectionText).toBe('protected if Bulls miss playoffs');
        expect(result.protectionMeta).toBeNull(); // Couldn't parse structured data
      });

      it('returns "Protected (details unavailable)" for ambiguous protection mention', () => {
        const entitlement = {
          id: 'TOR_pick_ownership_2028_R1',
          kind: 'pick_ownership',
          seasonYear: 2028,
          round: 1,
          description: 'Toronto 2028 1st protected under complex terms',
        };

        const result = projectEntitlementToPickRow(entitlement, {
          teamCode: 'TOR',
        });

        expect(result.assetType).toBe('conditional_right');
        // Should extract "protected under complex terms" from description
        expect(result.protectionText).toBe('protected under complex terms');
      });

      it('returns "Conditional" for conveyance_right without explicit protection', () => {
        const entitlement = {
          id: 'SAC_conveyance_right_2029_R1',
          kind: 'conveyance_right',
          seasonYear: 2029,
          round: 1,
          description: '',
        };

        const result = projectEntitlementToPickRow(entitlement, {
          teamCode: 'SAC',
        });

        expect(result.protectionText).toBe('Conditional');
      });

      it('appends ladder summary into conditionsText with current-tier protection text', () => {
        const entitlement = {
          id: 'LAL_pick_ownership_2026_R1',
          kind: 'pick_ownership',
          seasonYear: 2026,
          round: 1,
          protectionLadder: [
            { year: 2026, condition: 'Top 3', ifTriggered: 'roll' },
            { year: 2027, condition: 'Top 5', ifTriggered: 'roll' },
            { year: 2028, condition: 'Top 8', ifTriggered: 'roll' },
            { year: 2029, condition: 'Unprotected', ifTriggered: 'convey' },
          ],
        };

        const result = projectEntitlementToPickRow(entitlement, {
          teamCode: 'LAL',
        });

        expect(result.protectionText).toBe('Top 3');
        expect(result.ladderSummary).toBe(
          'Ladder: 2026 Top 3 → 2027 Top 5 → 2028 Top 8 …'
        );
        expect(result.conditionsText).toBe(
          'Ladder: 2026 Top 3 → 2027 Top 5 → 2028 Top 8 …'
        );
      });

      it('preserves explicit termsShort over derived fallback output', () => {
        const entitlement = {
          id: 'NOP_pick_ownership_2026_R1',
          kind: 'pick_ownership',
          seasonYear: 2026,
          round: 1,
          termsShort: 'Manual override',
          protectionLadder: [
            {
              year: 2026,
              condition: 'Top 3',
              ifTriggered: 'roll',
              rollToYear: 2027,
            },
          ],
        };

        const result = projectEntitlementToPickRow(entitlement, {
          teamCode: 'NOP',
        });

        expect(result.termsShort).toBe('Manual override');
      });

      it('falls back to derived termsShort when no explicit override is present', () => {
        const entitlement = {
          id: 'UTA_pick_ownership_2026_R1',
          kind: 'pick_ownership',
          seasonYear: 2026,
          round: 1,
          protectionLadder: [
            {
              year: 2026,
              condition: 'Top 3',
              ifTriggered: 'roll',
              rollToYear: 2027,
            },
          ],
        };

        const result = projectEntitlementToPickRow(entitlement, {
          teamCode: 'UTA',
        });

        expect(result.termsShort).toBe('Top 3 prot -> 2027 1st');
      });
    });

    describe('edge cases', () => {
      it('handles null entitlement gracefully', () => {
        const result = projectEntitlementToPickRow(null);

        expect(result.id).toBe('unknown');
        expect(result.year).toBe(0);
        expect(result.protectionText).toBe('Unknown');
      });

      it('handles undefined entitlement gracefully', () => {
        const result = projectEntitlementToPickRow(undefined);

        expect(result.id).toBe('unknown');
        expect(result.year).toBe(0);
      });

      it('handles entitlement with minimal fields', () => {
        const entitlement = {
          id: 'MIN_pick_ownership_2030_R1',
          kind: 'pick_ownership',
        };

        const result = projectEntitlementToPickRow(entitlement);

        expect(result.id).toBe('MIN_pick_ownership_2030_R1');
        expect(result.year).toBe(0);
        expect(result.round).toBe(0);
        expect(result.originalTeam).toBe('MIN'); // Parsed from ID
      });
    });
  });

  describe('getPickRowDisplayLabel', () => {
    it('returns formatted label for basic pick', () => {
      const pickRow = {
        year: 2026,
        round: 1,
        assetType: 'outright_pick',
        via: null,
      };

      expect(getPickRowDisplayLabel(pickRow)).toBe('2026 1st');
    });

    it('includes via team when present', () => {
      const pickRow = {
        year: 2027,
        round: 1,
        assetType: 'outright_pick',
        via: 'DAL',
      };

      expect(getPickRowDisplayLabel(pickRow)).toBe('2027 1st via DAL');
    });

    it('includes (Swap) suffix for swap_right', () => {
      const pickRow = {
        year: 2028,
        round: 1,
        assetType: 'swap_right',
        via: null,
      };

      expect(getPickRowDisplayLabel(pickRow)).toBe('2028 1st (Swap)');
    });

    it('includes (Cond.) suffix for conditional_right', () => {
      const pickRow = {
        year: 2029,
        round: 1,
        assetType: 'conditional_right',
        via: 'MIA',
      };

      expect(getPickRowDisplayLabel(pickRow)).toBe('2029 1st via MIA (Cond.)');
    });

    it('formats 2nd round correctly', () => {
      const pickRow = {
        year: 2026,
        round: 2,
        assetType: 'outright_pick',
        via: null,
      };

      expect(getPickRowDisplayLabel(pickRow)).toBe('2026 2nd');
    });

    it('returns "Unknown Pick" for null input', () => {
      expect(getPickRowDisplayLabel(null)).toBe('Unknown Pick');
    });

    it('returns "Unknown Pick" for missing year', () => {
      expect(getPickRowDisplayLabel({ round: 1 })).toBe('Unknown Pick');
    });
  });

  describe('getPickRowSecondaryText', () => {
    it('returns null for unprotected picks', () => {
      const pickRow = {
        protectionText: 'Unprotected',
        conditionsText: null,
      };

      expect(getPickRowSecondaryText(pickRow)).toBeNull();
    });

    it('returns protectionText when present and not unprotected', () => {
      const pickRow = {
        protectionText: 'Top 10 protected',
        conditionsText: null,
      };

      expect(getPickRowSecondaryText(pickRow)).toBe('Top 10 protected');
    });

    it('returns conditionsText when present', () => {
      const pickRow = {
        protectionText: 'Swap option',
        conditionsText: 'Can swap for LAL_2027_1st',
      };

      expect(getPickRowSecondaryText(pickRow)).toBe(
        'Swap option · Can swap for LAL_2027_1st'
      );
    });

    it('combines protection and conditions with separator', () => {
      const pickRow = {
        protectionText: 'Lottery protected',
        conditionsText: 'Converts to 2nd if not conveyed',
      };

      expect(getPickRowSecondaryText(pickRow)).toBe(
        'Lottery protected · Converts to 2nd if not conveyed'
      );
    });

    it('returns null for null input', () => {
      expect(getPickRowSecondaryText(null)).toBeNull();
    });

    it('returns null when only "Unprotected" and no conditions', () => {
      const pickRow = {
        protectionText: 'Unprotected',
        conditionsText: null,
      };

      expect(getPickRowSecondaryText(pickRow)).toBeNull();
    });
  });

  // Phase 12.3B: Tests for pickRulesById integration
  describe('pickRulesById integration', () => {
    it('uses structured protection from pick rule when available', () => {
      const entitlement = {
        id: 'LAL_pick_ownership_2027_R1',
        kind: 'pick_ownership',
        seasonYear: 2027,
        round: 1,
        underlyingPickId: 'LAL_2027_1st',
        underlyingStatus: 'encumbered',
        description: "Lakers' 2027 1st round pick", // No protection in description
      };

      const pickRulesById = {
        LAL_2027_1st: {
          pickId: 'LAL_2027_1st',
          seasonYear: 2027,
          round: 1,
          protections: [{ type: 'top_n', protectedRange: '1-4' }],
          updatedAtISO: '2026-01-31T00:00:00Z',
          source: 'PST_LEDGER_FINAL',
        },
      };

      const result = projectEntitlementToPickRow(entitlement, {
        teamCode: 'UTA',
        pickRulesById,
      });

      expect(result.protectionText).toBe('Top 4 protected');
      expect(result.protectionMeta).toEqual({
        type: 'top_n',
        protectedRange: { start: 1, end: 4 },
        appliesToYears: undefined,
      });
    });

    it('uses lottery protection from pick rule', () => {
      const entitlement = {
        id: 'PHX_pick_ownership_2028_R1',
        kind: 'pick_ownership',
        seasonYear: 2028,
        round: 1,
        underlyingPickId: 'PHX_2028_1st',
        underlyingStatus: 'encumbered',
        description: "Phoenix's 2028 1st round pick",
      };

      const pickRulesById = {
        PHX_2028_1st: {
          pickId: 'PHX_2028_1st',
          seasonYear: 2028,
          round: 1,
          protections: [{ type: 'lottery' }],
          updatedAtISO: '2026-01-31T00:00:00Z',
          source: 'PST_LEDGER_FINAL',
        },
      };

      const result = projectEntitlementToPickRow(entitlement, {
        teamCode: 'BKN',
        pickRulesById,
      });

      expect(result.protectionText).toBe('Lottery protected');
      expect(result.protectionMeta).toEqual({
        type: 'lottery',
        protectedRange: { start: 1, end: 14 },
        appliesToYears: undefined,
      });
    });

    it('uses structured conditions from pick rule when available', () => {
      const entitlement = {
        id: 'BOS_pick_ownership_2028_R1',
        kind: 'pick_ownership',
        seasonYear: 2028,
        round: 1,
        underlyingPickId: 'BOS_2028_1st',
        underlyingStatus: 'clean',
        description: "Boston's 2028 1st round pick",
      };

      const pickRulesById = {
        BOS_2028_1st: {
          pickId: 'BOS_2028_1st',
          seasonYear: 2028,
          round: 1,
          conditions: [
            {
              kind: 'swap_right',
              description: 'PHX has swap right',
              controller: 'PHX',
            },
          ],
          updatedAtISO: '2026-01-31T00:00:00Z',
          source: 'PST_LEDGER_FINAL',
        },
      };

      const result = projectEntitlementToPickRow(entitlement, {
        teamCode: 'BOS',
        pickRulesById,
      });

      expect(result.conditionsText).toBe('PHX swap option');
    });

    it('falls back to description parsing when no pick rule exists', () => {
      const entitlement = {
        id: 'MIA_pick_ownership_2027_R1',
        kind: 'pick_ownership',
        seasonYear: 2027,
        round: 1,
        underlyingPickId: 'MIA_2027_1st',
        underlyingStatus: 'clean',
        description: "Miami's 2027 1st top 10 protected",
      };

      const pickRulesById = {}; // No rule for this pick

      const result = projectEntitlementToPickRow(entitlement, {
        teamCode: 'OKC',
        pickRulesById,
      });

      // Should fall back to description parsing
      expect(result.protectionText).toBe('Top 10 protected');
    });

    it('falls back to description parsing when pickRulesById is undefined', () => {
      const entitlement = {
        id: 'CHI_pick_ownership_2027_R1',
        kind: 'pick_ownership',
        seasonYear: 2027,
        round: 1,
        underlyingPickId: 'CHI_2027_1st',
        underlyingStatus: 'clean',
        description: "Chicago's 2027 1st lottery protected",
      };

      // No pickRulesById passed
      const result = projectEntitlementToPickRow(entitlement, {
        teamCode: 'SAS',
      });

      // Should fall back to description parsing
      expect(result.protectionText).toBe('Lottery protected');
    });
  });
});
