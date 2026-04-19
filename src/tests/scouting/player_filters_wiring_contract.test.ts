/**
 * @file player_filters_wiring_contract.test.ts
 * @description Phase 2S Filter Wiring Contract Tests
 *
 * These tests serve as guardrails to ensure filter logic remains consistent
 * across refactors. Each test validates that a specific filter key correctly
 * filters the enriched player fixture set.
 *
 * NOTE: The filter API uses:
 * - freeAgentType/birdRights as STRINGS (not arrays) for single-select dropdowns
 * - optionTypes as an array for multi-select
 * - Stat keys like min_PPG/max_PPG (uppercase)
 * - Trait keys like min_Defense/max_Playmaking (capitalized)
 * - Player fields like p.PTS, p.REB (uppercase abbreviations from enrichPlayerData)
 *
 * USAGE: npm run test:scouting -- --reporter=dot src/tests/scouting/player_filters_wiring_contract.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { filterPlayers } from '@/shared/utils/filtering/playerFilterUtils';
import type { FilterablePlayer } from '@/shared/utils/filtering/playerFilterUtils';
import { getDefaultPlayerFilters } from '@/shared/utils/filtering/playerFilterDefaults';
import {
  enrichPlayerData,
  type EnrichablePlayerData,
} from '@/features/roster/utils/enrichPlayerData';
import fixtureData from '../fixtures/players_enriched_minimal.json';

// Extract players array from fixture
const FIXTURE_PLAYERS = fixtureData.players;
const FILTER_DEFAULTS = getDefaultPlayerFilters();
const toFilterablePlayer = (
  playerData: EnrichablePlayerData
): FilterablePlayer => {
  const enrichedPlayer = enrichPlayerData(playerData);
  expect(enrichedPlayer).not.toBeNull();
  if (!enrichedPlayer) {
    throw new Error('Expected player fixture to enrich successfully');
  }
  return enrichedPlayer as unknown as FilterablePlayer;
};

describe('Phase 2S Filter Wiring Contract Tests', () => {
  beforeAll(() => {
    // Validate fixture data loaded correctly
    expect(FIXTURE_PLAYERS).toBeDefined();
    expect(FIXTURE_PLAYERS.length).toBe(8);
  });

  describe('Identity & Basic Filters', () => {
    it('nameSearch: filters by displayName substring (case-insensitive)', () => {
      const filters = { ...FILTER_DEFAULTS, nameSearch: 'marcus' };
      const result = filterPlayers(FIXTURE_PLAYERS, filters);

      // Should match "Marcus Freeman" and "Marcus Bell"
      expect(result.length).toBe(2);
      expect(
        result.every((p) => p.bio.displayName.toLowerCase().includes('marcus'))
      ).toBe(true);
    });

    it('team: filters by exact team abbreviation', () => {
      const filters = { ...FILTER_DEFAULTS, team: 'BOS' };
      const result = filterPlayers(FIXTURE_PLAYERS, filters);

      expect(result.length).toBe(1);
      expect(result[0].bio.display.teamId).toBe('BOS');
    });

    it('position: filters by position string', () => {
      // Note: position filter uses expandPositionGroup and checks formattedPosition
      const filters = { ...FILTER_DEFAULTS, position: 'PG' };
      const result = filterPlayers(FIXTURE_PLAYERS, filters);

      // Tyler Jackson (PG), Marcus Bell (PG)
      expect(result.length).toBe(2);
      expect(result.every((p) => p.formattedPosition === 'PG')).toBe(true);
    });

    it('position: empty string returns all players', () => {
      const filters = { ...FILTER_DEFAULTS, position: '' };
      const result = filterPlayers(FIXTURE_PLAYERS, filters);

      expect(result.length).toBe(8);
    });
  });

  describe('Free Agency Filters', () => {
    it('freeAgentYear: filters by specific FA year', () => {
      const filters = { ...FILTER_DEFAULTS, freeAgentYear: '2025' };
      const result = filterPlayers(FIXTURE_PLAYERS, filters);

      // Marcus Freeman, DeShawn Williams, Kevin Morrison, Marcus Bell
      expect(result.length).toBe(4);
      expect(result.every((p) => p.freeAgentYear === 2025)).toBe(true);
    });

    it('freeAgentYear: empty string returns all players', () => {
      const filters = { ...FILTER_DEFAULTS, freeAgentYear: '' };
      const result = filterPlayers(FIXTURE_PLAYERS, filters);

      expect(result.length).toBe(8);
    });

    it('freeAgentType: filters by UFA (string, not array)', () => {
      const filters = { ...FILTER_DEFAULTS, freeAgentType: 'UFA' };
      const result = filterPlayers(FIXTURE_PLAYERS, filters);

      // Marcus Freeman, DeShawn Williams, Kevin Morrison, James Carter
      expect(result.length).toBe(4);
      expect(result.every((p) => p.freeAgentType === 'UFA')).toBe(true);
    });

    it('freeAgentType: filters by RFA (string, not array)', () => {
      const filters = { ...FILTER_DEFAULTS, freeAgentType: 'RFA' };
      const result = filterPlayers(FIXTURE_PLAYERS, filters);

      // Jordan Chen, Tyler Jackson, Marcus Bell
      expect(result.length).toBe(3);
      expect(result.every((p) => p.freeAgentType === 'RFA')).toBe(true);
    });

    it('freeAgentType: empty string returns all players', () => {
      const filters = { ...FILTER_DEFAULTS, freeAgentType: '' };
      const result = filterPlayers(FIXTURE_PLAYERS, filters);

      expect(result.length).toBe(8);
    });
  });

  describe('Bird Rights Filters', () => {
    it('birdRights: filters by Full Bird (string, not array)', () => {
      const filters = { ...FILTER_DEFAULTS, birdRights: 'Full Bird' };
      const result = filterPlayers(FIXTURE_PLAYERS, filters);

      // Marcus Freeman, Tyler Jackson, James Carter
      expect(result.length).toBe(3);
      expect(result.every((p) => p.birdRightsStatus === 'Full Bird')).toBe(
        true
      );
    });

    it('birdRights: filters by Early Bird (string, not array)', () => {
      const filters = { ...FILTER_DEFAULTS, birdRights: 'Early Bird' };
      const result = filterPlayers(FIXTURE_PLAYERS, filters);

      // Jordan Chen, Kevin Morrison
      expect(result.length).toBe(2);
      expect(result.every((p) => p.birdRightsStatus === 'Early Bird')).toBe(
        true
      );
    });

    it('birdRights: filters by Non-Bird (string, not array)', () => {
      const filters = { ...FILTER_DEFAULTS, birdRights: 'Non-Bird' };
      const result = filterPlayers(FIXTURE_PLAYERS, filters);

      // DeShawn Williams, Marcus Bell
      expect(result.length).toBe(2);
      expect(result.every((p) => p.birdRightsStatus === 'Non-Bird')).toBe(true);
    });

    it('birdRights: empty string returns all players', () => {
      const filters = { ...FILTER_DEFAULTS, birdRights: '' };
      const result = filterPlayers(FIXTURE_PLAYERS, filters);

      expect(result.length).toBe(8);
    });
  });

  describe('Contract Option Filters', () => {
    it('optionTypes: filters by Player Option (PO) with salaryYear', () => {
      // optionTypes uses salaryYear to check the specific year
      const filters = {
        ...FILTER_DEFAULTS,
        optionTypes: ['PO'],
        salaryYear: 2025,
      };
      const result = filterPlayers(FIXTURE_PLAYERS, filters);

      // Marcus Freeman (2025 PO), Kevin Morrison (2025 PO)
      // James Carter has 2027 PO so won't match 2025
      expect(result.length).toBe(2);
      expect(result.every((p) => p.optionByYear?.[2025] === 'PO')).toBe(true);
    });

    it('optionTypes: filters by Team Option (TO) with salaryYear', () => {
      const filters = {
        ...FILTER_DEFAULTS,
        optionTypes: ['TO'],
        salaryYear: 2025,
      };
      const result = filterPlayers(FIXTURE_PLAYERS, filters);

      // DeShawn Williams (2025 TO)
      expect(result.length).toBe(1);
      expect(result[0].bio.displayName).toBe('DeShawn Williams');
    });

    it('optionTypes: combined PO+TO for 2025', () => {
      const filters = {
        ...FILTER_DEFAULTS,
        optionTypes: ['PO', 'TO'],
        salaryYear: 2025,
      };
      const result = filterPlayers(FIXTURE_PLAYERS, filters);

      // 2 with 2025 PO + 1 with 2025 TO = 3 total
      expect(result.length).toBe(3);
    });

    it('optionTypes: empty array returns all players', () => {
      const filters = { ...FILTER_DEFAULTS, optionTypes: [] };
      const result = filterPlayers(FIXTURE_PLAYERS, filters);

      expect(result.length).toBe(8);
    });

    /**
     * Phase 2U Regression Test: Season-String Option Format
     *
     * This test validates the SSOT fix where optionByYear keys must use
     * seasonStartYear convention (2025 for "2025-26" season).
     *
     * BEFORE FIX: "2025-26" → optionByYear[2026] (end year) → MISMATCH with salaryYear: 2025
     * AFTER FIX:  "2025-26" → optionByYear[2025] (start year) → MATCHES salaryYear: 2025
     */
    it('optionTypes: season-string format uses start year (SSOT regression)', () => {
      // Simulate raw Firestore player data with season-string format in salariesByYear
      const rawPlayerWithSeasonString: EnrichablePlayerData = {
        id: 'fixture-season-string-option',
        bio: {
          displayName: 'Season String Player',
          position: 'SG',
          display: { teamId: 'BOS', team: 'Boston Celtics' },
        },
        contracts: {
          'contract-1': {
            salariesByYear: [
              { season: '2025-26', salary: 5000000, option: 'ETO' }, // Season STRING format
              { season: '2026-27', salary: 6000000 },
            ],
          },
        },
      };

      // Enrich the player data (this is where optionByYear gets built)
      const enrichedPlayer = toFilterablePlayer(rawPlayerWithSeasonString);

      // Validate the key is 2025 (start year), NOT 2026 (end year)
      expect(enrichedPlayer.optionByYear?.[2025]).toBe('ETO');
      expect(enrichedPlayer.optionByYear?.[2026]).toBeUndefined();

      // Now filter with salaryYear: 2025 + optionTypes: ["ETO"]
      const filters = {
        ...FILTER_DEFAULTS,
        optionTypes: ['ETO'],
        salaryYear: 2025,
      };
      const result = filterPlayers([enrichedPlayer], filters);

      // Should find the player because optionByYear[2025] === "ETO"
      expect(result.length).toBe(1);
      expect(result[0].bio.displayName).toBe('Season String Player');
    });

    /**
     * Phase 2X: optionYear explicit filter
     * When optionYear is set, it overrides salaryYear for option matching.
     */
    it('optionTypes: uses optionYear when explicitly set (Phase 2X)', () => {
      // James Carter has 2027 PO - salaryYear is 2025 but optionYear is 2027
      const filters = {
        ...FILTER_DEFAULTS,
        optionTypes: ['PO'],
        salaryYear: 2025,
        optionYear: 2027, // Explicit optionYear overrides salaryYear
      };
      const result = filterPlayers(FIXTURE_PLAYERS, filters);

      // James Carter has 2027 PO
      expect(result.length).toBe(1);
      expect(result[0].bio.displayName).toBe('James Carter');
    });

    it('optionTypes: falls back to salaryYear when optionYear is null', () => {
      // optionYear null should use salaryYear (2025)
      const filters = {
        ...FILTER_DEFAULTS,
        optionTypes: ['PO'],
        salaryYear: 2025,
        optionYear: null, // Null means use salaryYear
      };
      const result = filterPlayers(FIXTURE_PLAYERS, filters);

      // Marcus Freeman (2025 PO), Kevin Morrison (2025 PO)
      expect(result.length).toBe(2);
      expect(result.every((p) => p.optionByYear?.[2025] === 'PO')).toBe(true);
    });

    it('optionTypes: no match when optionYear has no options', () => {
      // Set optionYear to 2030 where no players have options
      const filters = {
        ...FILTER_DEFAULTS,
        optionTypes: ['PO', 'TO'],
        salaryYear: 2025,
        optionYear: 2030, // No options in 2030
      };
      const result = filterPlayers(FIXTURE_PLAYERS, filters);

      expect(result.length).toBe(0);
    });

    /**
     * Phase 2Y: optionsByYear from main doc (SSOT)
     * When currentContractView.optionsByYear exists in main doc,
     * enrichPlayerData uses it directly instead of building from salariesByYear.
     * This is the PRIMARY source for option data.
     */
    it('optionTypes: uses optionsByYear from main doc when present (Phase 2Y SSOT)', () => {
      // Simulate raw Firestore player data with optionsByYear in currentContractView
      const rawPlayerWithOptionsByYear: EnrichablePlayerData = {
        id: 'fixture-options-by-year-ssot',
        bio: {
          displayName: 'OptionsByYear SSOT Player',
          position: 'PF',
          display: { teamId: 'LAL', team: 'Los Angeles Lakers' },
        },
        currentContractView: {
          // Phase 2Y SSOT: optionsByYear in main doc
          optionsByYear: {
            2025: 'TO',
            2026: 'PO',
          },
        },
        // No contracts subcollection - this player has denormalized data only
      };

      // Enrich the player data
      const enrichedPlayer = toFilterablePlayer(rawPlayerWithOptionsByYear);

      // Validate optionByYear is correctly populated from main doc
      expect(enrichedPlayer.optionByYear?.[2025]).toBe('TO');
      expect(enrichedPlayer.optionByYear?.[2026]).toBe('PO');

      // Filter with TO option for 2025
      const filters = {
        ...FILTER_DEFAULTS,
        optionTypes: ['TO'],
        salaryYear: 2025,
      };
      const result = filterPlayers([enrichedPlayer], filters);

      // Should find the player because optionByYear[2025] === "TO"
      expect(result.length).toBe(1);
      expect(result[0].bio.displayName).toBe('OptionsByYear SSOT Player');
    });

    /**
     * Phase 2Y: Verify SSOT takes priority over fallback
     * When both optionsByYear and salariesByYear exist, optionsByYear wins.
     */
    it('optionTypes: optionsByYear takes priority over salariesByYear fallback (Phase 2Y)', () => {
      // Simulate player with both SSOT and fallback data (SSOT should win)
      const rawPlayerWithBoth: EnrichablePlayerData = {
        id: 'fixture-options-priority-test',
        bio: {
          displayName: 'Priority Test Player',
          position: 'C',
          display: { teamId: 'MIA', team: 'Miami Heat' },
        },
        currentContractView: {
          // SSOT: This should be used
          optionsByYear: {
            2025: 'ETO',
          },
        },
        contracts: {
          'contract-1': {
            // Fallback: This should be IGNORED because optionsByYear exists
            salariesByYear: [
              { season: '2025-26', salary: 10000000, option: 'PO' },
            ],
          },
        },
      };

      // Enrich the player data
      const enrichedPlayer = toFilterablePlayer(rawPlayerWithBoth);

      // Validate SSOT wins (ETO from optionsByYear, not PO from salariesByYear)
      expect(enrichedPlayer.optionByYear?.[2025]).toBe('ETO');
    });
  });

  describe('Grade Filters', () => {
    it('min_overall_grade: filters players at or above threshold', () => {
      const filters = { ...FILTER_DEFAULTS, min_overall_grade: 75 };
      const result = filterPlayers(FIXTURE_PLAYERS, filters);

      // Marcus Freeman (78), Tyler Jackson (81), James Carter (92)
      expect(result.length).toBe(3);
      expect(result.every((p) => p.overallGrade >= 75)).toBe(true);
    });

    it('max_overall_grade: filters players at or below threshold', () => {
      const filters = { ...FILTER_DEFAULTS, max_overall_grade: 70 };
      const result = filterPlayers(FIXTURE_PLAYERS, filters);

      // DeShawn Williams (65), Kevin Morrison (70), Marcus Bell (58)
      expect(result.length).toBe(3);
      expect(result.every((p) => p.overallGrade <= 70)).toBe(true);
    });

    it('grade range: combined min and max', () => {
      const filters = {
        ...FILTER_DEFAULTS,
        min_overall_grade: 70,
        max_overall_grade: 80,
      };
      const result = filterPlayers(FIXTURE_PLAYERS, filters);

      // Jordan Chen (72), Andre Thompson (74), Kevin Morrison (70), Marcus Freeman (78)
      expect(result.length).toBe(4);
      expect(
        result.every((p) => p.overallGrade >= 70 && p.overallGrade <= 80)
      ).toBe(true);
    });
  });

  describe('Age Filters', () => {
    it('minAge: filters players at or above age', () => {
      const filters = { ...FILTER_DEFAULTS, minAge: 28 };
      const result = filterPlayers(FIXTURE_PLAYERS, filters);

      // Marcus Freeman (28), DeShawn Williams (31), Kevin Morrison (29)
      expect(result.length).toBe(3);
      expect(result.every((p) => p.age >= 28)).toBe(true);
    });

    it('maxAge: filters players at or below age', () => {
      const filters = { ...FILTER_DEFAULTS, maxAge: 24 };
      const result = filterPlayers(FIXTURE_PLAYERS, filters);

      // Jordan Chen (24), Andre Thompson (22), Marcus Bell (23)
      expect(result.length).toBe(3);
      expect(result.every((p) => p.age <= 24)).toBe(true);
    });
  });

  describe('Combined Filter Scenarios', () => {
    it('UFA + Full Bird + 2025 FA year', () => {
      const filters = {
        ...FILTER_DEFAULTS,
        freeAgentType: 'UFA',
        birdRights: 'Full Bird',
        freeAgentYear: '2025',
      };
      const result = filterPlayers(FIXTURE_PLAYERS, filters);

      // Only Marcus Freeman matches all criteria
      expect(result.length).toBe(1);
      expect(result[0].bio.displayName).toBe('Marcus Freeman');
    });

    it('RFA + Player Option 2025 + grade >= 70', () => {
      const filters = {
        ...FILTER_DEFAULTS,
        freeAgentType: 'RFA',
        optionTypes: ['PO'],
        salaryYear: 2025,
        min_overall_grade: 70,
      };
      const result = filterPlayers(FIXTURE_PLAYERS, filters);

      // No RFA players have 2025 PO in fixture set
      expect(result.length).toBe(0);
    });

    it('Guards (PG) + UFA + age >= 28', () => {
      const filters = {
        ...FILTER_DEFAULTS,
        position: 'PG',
        freeAgentType: 'UFA',
        minAge: 28,
      };
      const result = filterPlayers(FIXTURE_PLAYERS, filters);

      // No PG + UFA + age>=28 in fixture set
      expect(result.length).toBe(0);
    });

    it('SG position + UFA + age >= 28', () => {
      const filters = {
        ...FILTER_DEFAULTS,
        position: 'SG',
        freeAgentType: 'UFA',
        minAge: 28,
      };
      const result = filterPlayers(FIXTURE_PLAYERS, filters);

      // Marcus Freeman (SG, UFA, 28), Kevin Morrison (SG, UFA, 29)
      expect(result.length).toBe(2);
    });
  });

  describe('Edge Cases', () => {
    it('all default filters returns all players', () => {
      const result = filterPlayers(FIXTURE_PLAYERS, FILTER_DEFAULTS);
      expect(result.length).toBe(8);
    });

    it('empty players array returns empty', () => {
      const result = filterPlayers([], FILTER_DEFAULTS);
      expect(result.length).toBe(0);
    });

    it('null/undefined players returns empty', () => {
      expect(filterPlayers(null, FILTER_DEFAULTS).length).toBe(0);
      expect(filterPlayers(undefined, FILTER_DEFAULTS).length).toBe(0);
    });
  });
});
