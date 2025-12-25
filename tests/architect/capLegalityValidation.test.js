/**
 * Cap Legality Validation Tests
 *
 * Tests for the preflight validation in the Architect mutation pipeline.
 * Verifies:
 * - Invalid mutations are blocked (do not persist)
 * - Valid mutations with warnings proceed but return warnings
 * - Roster max (>15) is an error (blocking)
 * - Roster min (<14) is a warning (non-blocking)
 * - Hard cap violations are blocking
 *
 * @file tests/architect/capLegalityValidation.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { computeWorldMutation } from '@/features/architect/utils/mutationPipeline';
import {
  validateSigning,
  validateWaive,
  validateRenounceRights,
  getOverridePolicy,
  HARD_BLOCK_RULES,
} from '@/features/architect/utils/capLegalityValidation';
import {
  seedBaseData,
  createMockTeam,
  createMockPlayer,
  createMockCapProjections,
} from '../helpers/architectTestHelpers.js';

describe('Cap Legality Validation', () => {
  const seasonId = '2025-26';
  const year = 2026; // End year extracted from seasonId

  beforeEach(() => {
    seedBaseData(['LAL', 'GSW', 'BOS']);
  });

  // ==========================================================================
  // SIGNING VALIDATION - Roster Maximum (BLOCK)
  // ==========================================================================

  describe('validateSigning - Roster Maximum', () => {
    it('blocks signing when roster would exceed 15 players', () => {
      // Create team with 15 players already
      const players = Array.from({ length: 15 }, (_, i) => ({
        player_id: `player_${i}`,
        name: `Player ${i}`,
        displayName: `Player ${i}`,
        contract: {
          contractType: 'Standard',
          salariesByYear: [{ season: '2025-26', salary: 5_000_000 }],
        },
      }));

      const team = {
        teamCode: 'LAL',
        teamName: 'Los Angeles Lakers',
        players,
        roster: players.map((p) => p.player_id),
        totals: {
          totalSalary: 75_000_000,
          capHit: 75_000_000,
          rosterCount: 15,
        },
      };

      const newPlayer = createMockPlayer({
        playerId: 'new_player',
        displayName: 'New Player',
      });

      const contract = {
        contractType: 'Standard',
        salariesByYear: [{ season: '2025-26', salary: 2_000_000 }],
      };

      const result = validateSigning({
        team,
        player: newPlayer,
        contract,
        signedUsing: null,
        year,
      });

      expect(result.valid).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].rule).toBe('roster_size');
      expect(result.violations[0].severity).toBe('error');
    });

    it('allows signing when roster is under 15 players', () => {
      const players = Array.from({ length: 10 }, (_, i) => ({
        player_id: `player_${i}`,
        name: `Player ${i}`,
        displayName: `Player ${i}`,
        contract: {
          contractType: 'Standard',
          salariesByYear: [{ season: '2025-26', salary: 5_000_000 }],
        },
      }));

      const team = {
        teamCode: 'LAL',
        teamName: 'Los Angeles Lakers',
        players,
        roster: players.map((p) => p.player_id),
        totals: {
          totalSalary: 50_000_000,
          capHit: 50_000_000,
          rosterCount: 10,
        },
      };

      const newPlayer = createMockPlayer({
        playerId: 'new_player',
        displayName: 'New Player',
      });

      const contract = {
        contractType: 'Standard',
        salariesByYear: [{ season: '2025-26', salary: 2_000_000 }],
      };

      const result = validateSigning({
        team,
        player: newPlayer,
        contract,
        signedUsing: null,
        year,
      });

      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });

  // ==========================================================================
  // SIGNING VALIDATION - Hard Cap (BLOCK)
  // ==========================================================================

  describe('validateSigning - Hard Cap Ceiling', () => {
    it('blocks signing when it would exceed hard cap ceiling', () => {
      // 2025-26 first apron is ~196M, so set capHit to 193M
      // and try to sign a player for 5M which would push it to 198M (over firstApron ceiling)
      const players = Array.from({ length: 10 }, (_, i) => ({
        player_id: `player_${i}`,
        name: `Player ${i}`,
        displayName: `Player ${i}`,
        contract: {
          contractType: 'Standard',
          salariesByYear: [{ season: '2025-26', salary: 19_300_000 }],
        },
      }));

      const team = {
        teamCode: 'LAL',
        teamName: 'Los Angeles Lakers',
        players,
        roster: players.map((p) => p.player_id),
        totals: {
          totalSalary: 193_000_000,
          capHit: 193_000_000, // Close to 2025-26 firstApron of ~196M
          rosterCount: 10,
          isHardCapped: true,
          hardCapLevel: 'firstApron',
        },
      };

      const newPlayer = createMockPlayer({
        playerId: 'new_player',
        displayName: 'New Player',
      });

      // Contract that would push over hard cap (193M + 5M = 198M > 196M firstApron)
      const contract = {
        contractType: 'Standard',
        salariesByYear: [{ season: '2025-26', salary: 5_000_000 }],
      };

      const result = validateSigning({
        team,
        player: newPlayer,
        contract,
        signedUsing: null,
        year,
      });

      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.rule === 'hard_cap')).toBe(true);
    });
  });

  // ==========================================================================
  // WAIVE VALIDATION - Roster Minimum (WARNING)
  // ==========================================================================

  describe('validateWaive - Roster Minimum', () => {
    it('warns (but allows) when waiving would drop roster below 14', () => {
      const players = Array.from({ length: 14 }, (_, i) => ({
        player_id: `player_${i}`,
        name: `Player ${i}`,
        displayName: `Player ${i}`,
        contract: {
          contractType: 'Standard',
          salariesByYear: [{ season: '2025-26', salary: 5_000_000 }],
        },
      }));

      const team = {
        teamCode: 'LAL',
        teamName: 'Los Angeles Lakers',
        players,
        roster: players.map((p) => p.player_id),
        totals: {
          totalSalary: 70_000_000,
          capHit: 70_000_000,
          rosterCount: 14,
        },
      };

      const playerToWaive = players[0];

      const result = validateWaive({
        team,
        player: playerToWaive,
        stretch: false,
        year,
        isGracePeriod: false,
      });

      // Should be valid (allowed) but with a warning
      expect(result.valid).toBe(true);
      const foundWarning = result.warnings.find((w) => w.rule === 'roster_minimum');
      expect(foundWarning).toBeDefined();
      expect(foundWarning.severity).toBe('warning');
    });

    it('does not warn when roster stays at 14+ after waive', () => {
      const players = Array.from({ length: 15 }, (_, i) => ({
        player_id: `player_${i}`,
        name: `Player ${i}`,
        displayName: `Player ${i}`,
        contract: {
          contractType: 'Standard',
          salariesByYear: [{ season: '2025-26', salary: 5_000_000 }],
        },
      }));

      const team = {
        teamCode: 'LAL',
        teamName: 'Los Angeles Lakers',
        players,
        roster: players.map((p) => p.player_id),
        totals: {
          totalSalary: 75_000_000,
          capHit: 75_000_000,
          rosterCount: 15,
        },
      };

      const playerToWaive = players[0];

      const result = validateWaive({
        team,
        player: playerToWaive,
        stretch: false,
        year,
        isGracePeriod: false,
      });

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.rule === 'roster_minimum')).toBe(false);
    });
  });

  // ==========================================================================
  // COMPUTE MUTATION - Blocking Behavior
  // ==========================================================================

  describe('computeWorldMutation - Signing', () => {
    it('successfully computes signing when valid', () => {
      const teamCode = 'LAL';
      const players = Array.from({ length: 10 }, (_, i) => ({
        player_id: `player_${i}`,
        name: `Player ${i}`,
        displayName: `Player ${i}`,
        contract: {
          contractType: 'Standard',
          salariesByYear: [{ season: '2025-26', salary: 5_000_000 }],
        },
      }));

      const team = {
        teamCode,
        teamName: 'Los Angeles Lakers',
        players,
        roster: players.map((p) => p.player_id),
        totals: {
          totalSalary: 50_000_000,
          capHit: 50_000_000,
          rosterCount: 10,
        },
      };

      const newPlayer = {
        player_id: 'new_player',
        name: 'New Player',
        displayName: 'New Player',
      };

      const currentState = {
        team,
        player: newPlayer,
        teamCode,
      };

      const payload = {
        teamCode,
        playerId: 'new_player',
        contract: {
          contractType: 'Standard',
          salariesByYear: [{ season: '2025-26', salary: 5_000_000 }],
        },
        signedUsing: null,
      };

      const result = computeWorldMutation({
        mutationType: 'signFreeAgent',
        payload,
        currentState,
        seasonId: '2025-26',
        timestamp: Date.now(),
      });

      expect(result.success).toBe(true);
      expect(result.teamUpdates).toHaveLength(1);
      expect(result.teamUpdates[0].team.roster).toContain('new_player');
    });
  });

  // ==========================================================================
  // RENOUNCE RIGHTS - Always Valid
  // ==========================================================================

  describe('validateRenounceRights', () => {
    it('is always valid when player has cap hold', () => {
      const team = {
        teamCode: 'LAL',
        teamName: 'Los Angeles Lakers',
        players: [],
        capHolds: [
          {
            playerId: 'fa_player',
            playerName: 'Free Agent',
            amount: 15_000_000,
            type: 'FA Cap Hold',
          },
        ],
        totals: {},
      };

      const player = {
        player_id: 'fa_player',
        name: 'Free Agent',
        displayName: 'Free Agent',
        contract: {
          birdRights: { status: 'Full', yearsOfService: 5 },
        },
      };

      const result = validateRenounceRights({
        team,
        player,
        year,
      });

      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });

  // ==========================================================================
  // TWO-WAY CONTRACT LIMIT
  // ==========================================================================

  describe('validateSigning - Two-Way Limit', () => {
    it('blocks two-way signing when team already has 3', () => {
      const players = [
        {
          player_id: 'twoway_1',
          name: 'Two-Way 1',
          contract: { contractType: 'Two-Way' },
        },
        {
          player_id: 'twoway_2',
          name: 'Two-Way 2',
          contract: { contractType: 'Two-Way' },
        },
        {
          player_id: 'twoway_3',
          name: 'Two-Way 3',
          contract: { contractType: 'Two-Way' },
        },
      ];

      const team = {
        teamCode: 'LAL',
        teamName: 'Los Angeles Lakers',
        players,
        roster: players.map((p) => p.player_id),
        totals: { rosterCount: 3 },
      };

      const newPlayer = createMockPlayer({
        playerId: 'new_twoway',
        displayName: 'New Two-Way',
      });

      const contract = {
        contractType: 'Two-Way',
        salariesByYear: [{ season: '2025-26', salary: 500_000 }],
      };

      const result = validateSigning({
        team,
        player: newPlayer,
        contract,
        signedUsing: null,
        year,
      });

      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.rule === 'two_way_limit')).toBe(true);
    });
  });

  // ==========================================================================
  // DEFENSIVE CHECKS (getOverridePolicy)
  // ==========================================================================

  describe('getOverridePolicy Defensive Checks', () => {

    it('handles normal valid violations and warnings', () => {
      const violations = [{ rule: HARD_BLOCK_RULES[0], message: 'Hard block' }];
      const warnings = [{ rule: 'some_warning', message: 'Just a warning' }];
      
      const result = getOverridePolicy(violations, warnings);
      
      expect(result.canOverride).toBe(false);
      expect(result.hasHardBlock).toBe(true);
      expect(result.hardBlockReasons).toContain('Hard block');
      expect(result.softWarningReasons).toContain('Just a warning');
    });

    it('handles malformed violations (missing rule)', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const violations = [{ message: 'Missing rule' }];
      
      const result = getOverridePolicy(violations, []);
      
      expect(result.softWarningReasons[0]).toMatch(/Malformed violation: Missing rule/);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('handles malformed violations (missing message)', () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const violations = [{ rule: 'roster_size' }];
        
        const result = getOverridePolicy(violations, []);
        
        expect(result.softWarningReasons[0]).toMatch(/Malformed violation detected/);
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });

    it('handles malformed warnings', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const warnings = [{ rule: 'something', message: '' }]; // Empty message
      
      const result = getOverridePolicy([], warnings);
      
      expect(result.softWarningReasons[0]).toMatch(/Malformed warning detected/);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('promotes warnings to hard blocks if rule is in HARD_BLOCK_RULES', () => {
      // Simulate a scenario where a hard block rule ended up in the warnings array
      const warnings = [{ rule: HARD_BLOCK_RULES[0], message: 'Should be hard block' }];
      
      const result = getOverridePolicy([], warnings);
      
      expect(result.hasHardBlock).toBe(true);
      expect(result.hardBlockReasons).toContain('Should be hard block');
      expect(result.softWarningReasons).not.toContain('Should be hard block');
    });

    it('handles null/undefined inputs gracefully', () => {
        const result = getOverridePolicy(undefined, undefined);
        expect(result.canOverride).toBe(true);
        expect(result.hardBlockReasons).toHaveLength(0);
    });
  });
});
