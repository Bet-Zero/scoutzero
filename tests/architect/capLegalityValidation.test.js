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
  validateExtension,
  validateRenounceRights,
  getOverridePolicy,
  validateExtensionTermsAndRaises,
  HARD_BLOCK_RULES,
  EXTENSION_YEARS_LIMITS,
  EXTENSION_FIRST_YEAR_MAX_PERCENT,
  EXTENSION_MAX_RAISE_PERCENT,
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

      // Use a rookie player (0 YOS) with salary above rookie minimum ($1.164M)
      const newPlayer = {
        player_id: 'new_player',
        name: 'New Player',
        displayName: 'New Player',
        bio: { experience: 0 }, // Rookie - 0 YOS
      };

      const contract = {
        contractType: 'Standard',
        salariesByYear: [{ season: '2025-26', salary: 2_000_000 }], // Above rookie min ($1.164M)
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

      // Use a rookie player (0 YOS) with salary above rookie minimum ($1.164M)
      const newPlayer = {
        player_id: 'new_player',
        name: 'New Player',
        displayName: 'New Player',
        bio: { experience: 0 }, // Rookie - 0 YOS
      };

      const contract = {
        contractType: 'Standard',
        salariesByYear: [{ season: '2025-26', salary: 2_000_000 }], // Above rookie min ($1.164M)
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
  // MINIMUM SALARY ENFORCEMENT (Phase 1 - CBA Contract Rules)
  // ==========================================================================

  describe('validateSigning - Minimum Salary Enforcement', () => {
    // 2025-26 minimum salaries (from minimumSalaryScales.ts):
    // 0 YOS (rookie): $1,164,345
    // 5 YOS (veteran): $2,912,000
    // 10 YOS (max veteran): $3,952,000
    const ROOKIE_MIN_2026 = 1_164_345;
    const VET_5_YOS_MIN_2026 = 2_912_000;
    const VET_10_YOS_MIN_2026 = 3_952_000;

    it('blocks signing when first-year salary is below minimum for rookie (0 YOS)', () => {
      const team = {
        teamCode: 'LAL',
        teamName: 'Los Angeles Lakers',
        players: [],
        roster: [],
        totals: { capHit: 100_000_000 },
      };

      // Player with no experience data (defaults to 0 YOS)
      const rookiePlayer = {
        player_id: 'rookie_1',
        name: 'Rookie Player',
        displayName: 'Rookie Player',
        bio: { experience: 0 },
      };

      // Contract below rookie minimum ($1M < $1.164M)
      const contract = {
        contractType: 'Standard',
        salariesByYear: [{ season: '2025-26', salary: 1_000_000 }],
      };

      const result = validateSigning({
        team,
        player: rookiePlayer,
        contract,
        signedUsing: null,
        year,
      });

      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.rule === 'min_salary_violation')).toBe(true);
      expect(result.violations.find((v) => v.rule === 'min_salary_violation').message).toMatch(/below CBA minimum/);
    });

    it('blocks signing when first-year salary is below minimum for veteran (5 YOS)', () => {
      const team = {
        teamCode: 'LAL',
        teamName: 'Los Angeles Lakers',
        players: [],
        roster: [],
        totals: { capHit: 100_000_000 },
      };

      // Veteran player with 5 years of service
      const veteranPlayer = {
        player_id: 'vet_5',
        name: 'Veteran Player',
        displayName: 'Veteran Player',
        bio: { experience: 5 },
      };

      // Contract below 5-year veteran minimum ($2M < $2.912M)
      const contract = {
        contractType: 'Standard',
        salariesByYear: [{ season: '2025-26', salary: 2_000_000 }],
      };

      const result = validateSigning({
        team,
        player: veteranPlayer,
        contract,
        signedUsing: null,
        year,
      });

      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.rule === 'min_salary_violation')).toBe(true);
    });

    it('allows signing when first-year salary exactly meets minimum', () => {
      const team = {
        teamCode: 'LAL',
        teamName: 'Los Angeles Lakers',
        players: [],
        roster: [],
        totals: { capHit: 100_000_000 },
      };

      const rookiePlayer = {
        player_id: 'rookie_1',
        name: 'Rookie Player',
        displayName: 'Rookie Player',
        bio: { experience: 0 },
      };

      // Contract exactly at rookie minimum
      const contract = {
        contractType: 'Standard',
        salariesByYear: [{ season: '2025-26', salary: ROOKIE_MIN_2026 }],
      };

      const result = validateSigning({
        team,
        player: rookiePlayer,
        contract,
        signedUsing: null,
        year,
      });

      // Should pass (no min_salary_violation)
      const minSalaryViolation = result.violations.find((v) => v.rule === 'min_salary_violation');
      expect(minSalaryViolation).toBeUndefined();
    });

    it('allows signing when first-year salary is above minimum', () => {
      const team = {
        teamCode: 'LAL',
        teamName: 'Los Angeles Lakers',
        players: [],
        roster: [],
        totals: { capHit: 100_000_000 },
      };

      const veteranPlayer = {
        player_id: 'vet_10',
        name: 'Max Veteran',
        displayName: 'Max Veteran',
        bio: { experience: 10 },
      };

      // Contract well above 10-year veteran minimum ($5M > $3.952M)
      const contract = {
        contractType: 'Standard',
        salariesByYear: [{ season: '2025-26', salary: 5_000_000 }],
      };

      const result = validateSigning({
        team,
        player: veteranPlayer,
        contract,
        signedUsing: null,
        year,
      });

      const minSalaryViolation = result.violations.find((v) => v.rule === 'min_salary_violation');
      expect(minSalaryViolation).toBeUndefined();
    });

    it('defaults to rookie minimum (0 YOS) when player has no experience data', () => {
      const team = {
        teamCode: 'LAL',
        teamName: 'Los Angeles Lakers',
        players: [],
        roster: [],
        totals: { capHit: 100_000_000 },
      };

      // Player with NO experience/YOS fields at all
      const unknownPlayer = {
        player_id: 'unknown_1',
        name: 'Unknown Player',
        displayName: 'Unknown Player',
        // No bio, no yearsOfService, nothing
      };

      // Contract below rookie minimum - should be blocked
      const belowMinContract = {
        contractType: 'Standard',
        salariesByYear: [{ season: '2025-26', salary: 1_000_000 }],
      };

      const result = validateSigning({
        team,
        player: unknownPlayer,
        contract: belowMinContract,
        signedUsing: null,
        year,
      });

      // Should fail because salary is below rookie minimum
      expect(result.violations.some((v) => v.rule === 'min_salary_violation')).toBe(true);

      // Contract at or above rookie minimum - should pass this check
      const atMinContract = {
        contractType: 'Standard',
        salariesByYear: [{ season: '2025-26', salary: ROOKIE_MIN_2026 }],
      };

      const result2 = validateSigning({
        team,
        player: unknownPlayer,
        contract: atMinContract,
        signedUsing: null,
        year,
      });

      const minSalaryViolation2 = result2.violations.find((v) => v.rule === 'min_salary_violation');
      expect(minSalaryViolation2).toBeUndefined();
    });

    it('excludes two-way contracts from minimum salary enforcement', () => {
      const team = {
        teamCode: 'LAL',
        teamName: 'Los Angeles Lakers',
        players: [],
        roster: [],
        totals: { capHit: 100_000_000 },
      };

      const twoWayPlayer = {
        player_id: 'twoway_new',
        name: 'Two-Way Player',
        displayName: 'Two-Way Player',
        bio: { experience: 0 },
      };

      // Two-way contract with salary way below standard minimum
      // Two-way contracts follow different salary rules
      const contract = {
        contractType: 'Two-Way',
        salariesByYear: [{ season: '2025-26', salary: 500_000 }],
      };

      const result = validateSigning({
        team,
        player: twoWayPlayer,
        contract,
        signedUsing: null,
        year,
      });

      // Should NOT have min_salary_violation for two-way contracts
      const minSalaryViolation = result.violations.find((v) => v.rule === 'min_salary_violation');
      expect(minSalaryViolation).toBeUndefined();
    });

    it('validates capHit when different from salary', () => {
      const team = {
        teamCode: 'LAL',
        teamName: 'Los Angeles Lakers',
        players: [],
        roster: [],
        totals: { capHit: 100_000_000 },
      };

      const rookiePlayer = {
        player_id: 'rookie_1',
        name: 'Rookie Player',
        displayName: 'Rookie Player',
        bio: { experience: 0 },
      };

      // Contract where salary is above min but capHit is below min
      // This tests the edge case where capHit differs from salary
      const contract = {
        contractType: 'Standard',
        salariesByYear: [{
          season: '2025-26',
          salary: ROOKIE_MIN_2026,  // Salary meets minimum
          capHit: 1_000_000,        // But capHit is below minimum
        }],
      };

      const result = validateSigning({
        team,
        player: rookiePlayer,
        contract,
        signedUsing: null,
        year,
      });

      // Should fail because capHit is below minimum
      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.rule === 'min_salary_violation')).toBe(true);
      expect(result.violations.find((v) => v.rule === 'min_salary_violation').message).toMatch(/cap hit/i);
    });

    it('confirms min_salary_violation is a HARD_BLOCK rule', () => {
      // Verify the rule is in HARD_BLOCK_RULES
      expect(HARD_BLOCK_RULES).toContain('min_salary_violation');
    });
  });

  // ==========================================================================
  // CONTRACT YEARS VALIDATION (Phase 2 - CBA Contract Rules)
  // ==========================================================================

  describe('validateSigning - Contract Years Validation', () => {
    // Year limits by mechanism:
    // MINIMUM: 1-2 years
    // FULL_MLE: 1-4 years
    // TPMLE: 1-2 years
    // ROOM_MLE: 1-2 years
    // BAE: 1-2 years

    it('blocks MLE signing when contract exceeds max years (5-year MLE)', () => {
      const team = {
        teamCode: 'LAL',
        teamName: 'Los Angeles Lakers',
        players: [],
        roster: [],
        totals: { capHit: 100_000_000 },
      };

      const player = {
        player_id: 'player_1',
        name: 'Test Player',
        displayName: 'Test Player',
        bio: { experience: 5 },
      };

      // 5-year MLE contract (max is 4)
      const contract = {
        contractType: 'Standard',
        salariesByYear: [
          { season: '2025-26', salary: 5_000_000 },
          { season: '2026-27', salary: 5_250_000 },
          { season: '2027-28', salary: 5_500_000 },
          { season: '2028-29', salary: 5_750_000 },
          { season: '2029-30', salary: 6_000_000 },
        ],
      };

      const result = validateSigning({
        team,
        player,
        contract,
        signedUsing: 'MLE',
        year,
      });

      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.rule === 'contract_years_invalid')).toBe(true);
      expect(result.violations.find((v) => v.rule === 'contract_years_invalid').message).toMatch(/exceeds maximum.*4.*FULL MLE/);
    });

    it('blocks MINIMUM signing when contract exceeds max years (3-year minimum)', () => {
      const team = {
        teamCode: 'LAL',
        teamName: 'Los Angeles Lakers',
        players: [],
        roster: [],
        totals: { capHit: 100_000_000 },
      };

      const player = {
        player_id: 'player_1',
        name: 'Test Player',
        displayName: 'Test Player',
        bio: { experience: 3 },
      };

      // 3-year minimum contract (max is 2)
      const contract = {
        contractType: 'Standard',
        salariesByYear: [
          { season: '2025-26', salary: 2_200_000 },
          { season: '2026-27', salary: 2_300_000 },
          { season: '2027-28', salary: 2_400_000 },
        ],
      };

      const result = validateSigning({
        team,
        player,
        contract,
        signedUsing: 'Minimum',
        year,
      });

      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.rule === 'contract_years_invalid')).toBe(true);
      expect(result.violations.find((v) => v.rule === 'contract_years_invalid').message).toMatch(/exceeds maximum.*2.*MINIMUM/);
    });

    it('blocks BAE signing when contract exceeds max years (3-year BAE)', () => {
      const team = {
        teamCode: 'LAL',
        teamName: 'Los Angeles Lakers',
        players: [],
        roster: [],
        totals: { capHit: 100_000_000 },
      };

      const player = {
        player_id: 'player_1',
        name: 'Test Player',
        displayName: 'Test Player',
        bio: { experience: 2 },
      };

      // 3-year BAE contract (max is 2)
      const contract = {
        contractType: 'Standard',
        salariesByYear: [
          { season: '2025-26', salary: 4_500_000 },
          { season: '2026-27', salary: 4_700_000 },
          { season: '2027-28', salary: 4_900_000 },
        ],
      };

      const result = validateSigning({
        team,
        player,
        contract,
        signedUsing: 'BAE',
        year,
      });

      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.rule === 'contract_years_invalid')).toBe(true);
    });

    it('allows MLE signing at max years (4-year MLE)', () => {
      const team = {
        teamCode: 'LAL',
        teamName: 'Los Angeles Lakers',
        players: [],
        roster: [],
        totals: { capHit: 100_000_000 },
      };

      const player = {
        player_id: 'player_1',
        name: 'Test Player',
        displayName: 'Test Player',
        bio: { experience: 5 },
      };

      // 4-year MLE contract (exactly at max)
      const contract = {
        contractType: 'Standard',
        salariesByYear: [
          { season: '2025-26', salary: 5_000_000 },
          { season: '2026-27', salary: 5_250_000 },
          { season: '2027-28', salary: 5_500_000 },
          { season: '2028-29', salary: 5_750_000 },
        ],
      };

      const result = validateSigning({
        team,
        player,
        contract,
        signedUsing: 'MLE',
        year,
      });

      // Should NOT have contract_years_invalid violation
      const yearsViolation = result.violations.find((v) => v.rule === 'contract_years_invalid');
      expect(yearsViolation).toBeUndefined();
    });

    it('allows minimum signing at boundary (1-year and 2-year)', () => {
      const team = {
        teamCode: 'LAL',
        teamName: 'Los Angeles Lakers',
        players: [],
        roster: [],
        totals: { capHit: 100_000_000 },
      };

      const player = {
        player_id: 'player_1',
        name: 'Test Player',
        displayName: 'Test Player',
        bio: { experience: 3 },
      };

      // 1-year minimum contract (at min)
      const oneYearContract = {
        contractType: 'Standard',
        salariesByYear: [{ season: '2025-26', salary: 2_200_000 }],
      };

      const result1 = validateSigning({
        team,
        player,
        contract: oneYearContract,
        signedUsing: 'Minimum',
        year,
      });

      expect(result1.violations.find((v) => v.rule === 'contract_years_invalid')).toBeUndefined();

      // 2-year minimum contract (at max)
      const twoYearContract = {
        contractType: 'Standard',
        salariesByYear: [
          { season: '2025-26', salary: 2_200_000 },
          { season: '2026-27', salary: 2_300_000 },
        ],
      };

      const result2 = validateSigning({
        team,
        player,
        contract: twoYearContract,
        signedUsing: 'Minimum',
        year,
      });

      expect(result2.violations.find((v) => v.rule === 'contract_years_invalid')).toBeUndefined();
    });

    it('excludes two-way contracts from years validation', () => {
      const team = {
        teamCode: 'LAL',
        teamName: 'Los Angeles Lakers',
        players: [],
        roster: [],
        totals: { capHit: 100_000_000 },
      };

      const player = {
        player_id: 'twoway_player',
        name: 'Two-Way Player',
        displayName: 'Two-Way Player',
        bio: { experience: 0 },
      };

      // 3-year two-way contract (would be invalid for standard but we don't enforce for two-way)
      const contract = {
        contractType: 'Two-Way',
        salariesByYear: [
          { season: '2025-26', salary: 500_000 },
          { season: '2026-27', salary: 550_000 },
          { season: '2027-28', salary: 600_000 },
        ],
      };

      const result = validateSigning({
        team,
        player,
        contract,
        signedUsing: 'Minimum',
        year,
      });

      // Should NOT have contract_years_invalid for two-way
      const yearsViolation = result.violations.find((v) => v.rule === 'contract_years_invalid');
      expect(yearsViolation).toBeUndefined();
    });

    it('does not enforce years limits for unknown signing mechanism', () => {
      const team = {
        teamCode: 'LAL',
        teamName: 'Los Angeles Lakers',
        players: [],
        roster: [],
        totals: { capHit: 100_000_000 },
      };

      const player = {
        player_id: 'player_1',
        name: 'Test Player',
        displayName: 'Test Player',
        bio: { experience: 5 },
      };

      // 5-year contract with no signedUsing (unknown mechanism)
      const contract = {
        contractType: 'Standard',
        salariesByYear: [
          { season: '2025-26', salary: 10_000_000 },
          { season: '2026-27', salary: 10_500_000 },
          { season: '2027-28', salary: 11_000_000 },
          { season: '2028-29', salary: 11_500_000 },
          { season: '2029-30', salary: 12_000_000 },
        ],
      };

      const result = validateSigning({
        team,
        player,
        contract,
        signedUsing: null, // Unknown mechanism
        year,
      });

      // Should NOT have contract_years_invalid for unknown mechanism
      const yearsViolation = result.violations.find((v) => v.rule === 'contract_years_invalid');
      expect(yearsViolation).toBeUndefined();
    });

    it('uses contractLength field when present', () => {
      const team = {
        teamCode: 'LAL',
        teamName: 'Los Angeles Lakers',
        players: [],
        roster: [],
        totals: { capHit: 100_000_000 },
      };

      const player = {
        player_id: 'player_1',
        name: 'Test Player',
        displayName: 'Test Player',
        bio: { experience: 5 },
      };

      // Contract with explicit contractLength that differs from salariesByYear length
      // (e.g., only first year's salary data is present but contract is 5 years)
      const contract = {
        contractType: 'Standard',
        contractLength: 5, // Explicit 5-year contract
        salariesByYear: [{ season: '2025-26', salary: 5_000_000 }], // Only 1 entry
      };

      const result = validateSigning({
        team,
        player,
        contract,
        signedUsing: 'MLE',
        year,
      });

      // Should block because contractLength (5) exceeds MLE max (4)
      expect(result.violations.some((v) => v.rule === 'contract_years_invalid')).toBe(true);
    });

    it('confirms contract_years_invalid is a HARD_BLOCK rule', () => {
      expect(HARD_BLOCK_RULES).toContain('contract_years_invalid');
    });
  });

  // ==========================================================================
  // FIRST YEAR MAX ENFORCEMENT (Phase 2.5 - CBA Contract Rules)
  // ==========================================================================

  describe('validateSigning - First Year Max Enforcement', () => {
    // 2025-26 exception amounts (from capProjections.js):
    // Full MLE: $14,104,000
    // Taxpayer MLE: $5,685,000
    // Room MLE: $8,781,000
    // BAE: $5,135,000
    // Rookie minimum: $1,164,345
    const FULL_MLE_2026 = 14_104_000;
    const TPMLE_2026 = 5_685_000;
    const BAE_2026 = 5_135_000;
    const ROOM_MLE_2026 = 8_781_000;
    const ROOKIE_MIN_2026 = 1_164_345;

    it('blocks FULL_MLE signing when first-year salary exceeds fullMLE amount', () => {
      const team = {
        teamCode: 'LAL',
        teamName: 'Los Angeles Lakers',
        players: [],
        roster: [],
        totals: { capHit: 100_000_000 },
      };

      const player = {
        player_id: 'player_1',
        name: 'Test Player',
        displayName: 'Test Player',
        bio: { experience: 5 },
      };

      // Contract at $15M (above Full MLE of $14.104M)
      const contract = {
        contractType: 'Standard',
        salariesByYear: [{ season: '2025-26', salary: 15_000_000 }],
      };

      const result = validateSigning({
        team,
        player,
        contract,
        signedUsing: 'MLE',
        year,
      });

      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.rule === 'first_year_max_invalid')).toBe(true);
      expect(result.violations.find((v) => v.rule === 'first_year_max_invalid').message).toMatch(/exceeds FULL MLE maximum/);
    });

    it('blocks TPMLE signing when first-year salary exceeds taxpayerMLE amount', () => {
      const team = {
        teamCode: 'LAL',
        teamName: 'Los Angeles Lakers',
        players: [],
        roster: [],
        totals: { capHit: 100_000_000 },
      };

      const player = {
        player_id: 'player_1',
        name: 'Test Player',
        displayName: 'Test Player',
        bio: { experience: 5 },
      };

      // Contract at $6M (above Taxpayer MLE of $5.685M)
      const contract = {
        contractType: 'Standard',
        salariesByYear: [{ season: '2025-26', salary: 6_000_000 }],
      };

      const result = validateSigning({
        team,
        player,
        contract,
        signedUsing: 'Taxpayer MLE',
        year,
      });

      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.rule === 'first_year_max_invalid')).toBe(true);
      expect(result.violations.find((v) => v.rule === 'first_year_max_invalid').message).toMatch(/exceeds TPMLE maximum/);
    });

    it('blocks BAE signing when first-year salary exceeds bae amount', () => {
      const team = {
        teamCode: 'LAL',
        teamName: 'Los Angeles Lakers',
        players: [],
        roster: [],
        totals: { capHit: 100_000_000 },
      };

      const player = {
        player_id: 'player_1',
        name: 'Test Player',
        displayName: 'Test Player',
        bio: { experience: 5 },
      };

      // Contract at $5.5M (above BAE of $5.135M)
      const contract = {
        contractType: 'Standard',
        salariesByYear: [{ season: '2025-26', salary: 5_500_000 }],
      };

      const result = validateSigning({
        team,
        player,
        contract,
        signedUsing: 'BAE',
        year,
      });

      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.rule === 'first_year_max_invalid')).toBe(true);
    });

    it('blocks ROOM_MLE signing when first-year salary exceeds roomMLE amount', () => {
      const team = {
        teamCode: 'LAL',
        teamName: 'Los Angeles Lakers',
        players: [],
        roster: [],
        totals: { capHit: 100_000_000 },
      };

      const player = {
        player_id: 'player_1',
        name: 'Test Player',
        displayName: 'Test Player',
        bio: { experience: 5 },
      };

      // Contract at $9M (above Room MLE of $8.781M)
      const contract = {
        contractType: 'Standard',
        salariesByYear: [{ season: '2025-26', salary: 9_000_000 }],
      };

      const result = validateSigning({
        team,
        player,
        contract,
        signedUsing: 'Room MLE',
        year,
      });

      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.rule === 'first_year_max_invalid')).toBe(true);
    });

    it('blocks MINIMUM signing when first-year salary exceeds minimum (exactness check)', () => {
      const team = {
        teamCode: 'LAL',
        teamName: 'Los Angeles Lakers',
        players: [],
        roster: [],
        totals: { capHit: 100_000_000 },
      };

      const player = {
        player_id: 'rookie_1',
        name: 'Rookie Player',
        displayName: 'Rookie Player',
        bio: { experience: 0 },
      };

      // Contract at $2M using MINIMUM exception (should be exactly $1.164M)
      const contract = {
        contractType: 'Standard',
        salariesByYear: [{ season: '2025-26', salary: 2_000_000 }],
      };

      const result = validateSigning({
        team,
        player,
        contract,
        signedUsing: 'Minimum',
        year,
      });

      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.rule === 'first_year_max_invalid')).toBe(true);
      expect(result.violations.find((v) => v.rule === 'first_year_max_invalid').message).toMatch(/exceeds minimum salary.*for MINIMUM signing/);
    });

    it('allows signing at exactly the exception max', () => {
      const team = {
        teamCode: 'LAL',
        teamName: 'Los Angeles Lakers',
        players: [],
        roster: [],
        totals: { capHit: 100_000_000 },
      };

      const player = {
        player_id: 'player_1',
        name: 'Test Player',
        displayName: 'Test Player',
        bio: { experience: 5 },
      };

      // Contract at exactly Full MLE amount
      const contract = {
        contractType: 'Standard',
        salariesByYear: [{ season: '2025-26', salary: FULL_MLE_2026 }],
      };

      const result = validateSigning({
        team,
        player,
        contract,
        signedUsing: 'MLE',
        year,
      });

      // Should NOT have first_year_max_invalid violation
      const maxViolation = result.violations.find((v) => v.rule === 'first_year_max_invalid');
      expect(maxViolation).toBeUndefined();
    });

    it('excludes two-way contracts from first-year max enforcement', () => {
      const team = {
        teamCode: 'LAL',
        teamName: 'Los Angeles Lakers',
        players: [],
        roster: [],
        totals: { capHit: 100_000_000 },
      };

      const player = {
        player_id: 'twoway_player',
        name: 'Two-Way Player',
        displayName: 'Two-Way Player',
        bio: { experience: 0 },
      };

      // Two-way contract - doesn't need to follow exception rules
      const contract = {
        contractType: 'Two-Way',
        salariesByYear: [{ season: '2025-26', salary: 500_000 }],
      };

      const result = validateSigning({
        team,
        player,
        contract,
        signedUsing: 'Minimum',
        year,
      });

      // Should NOT have first_year_max_invalid for two-way
      const maxViolation = result.violations.find((v) => v.rule === 'first_year_max_invalid');
      expect(maxViolation).toBeUndefined();
    });

    it('confirms first_year_max_invalid is a HARD_BLOCK rule', () => {
      expect(HARD_BLOCK_RULES).toContain('first_year_max_invalid');
    });
  });

  // ==========================================================================
  // SECOND APRON MINIMUM ONLY (Phase 2.5 - CBA Contract Rules)
  // ==========================================================================

  describe('validateSigning - Second Apron Minimum Only', () => {
    // 2025-26 thresholds (from capProjections.js):
    // Second Apron: $207,824,000
    // Rookie minimum: $1,164,345
    const SECOND_APRON_2026 = 207_824_000;
    const ROOKIE_MIN_2026 = 1_164_345;

    it('blocks above-second-apron signing when salary exceeds minimum (even UNKNOWN mechanism)', () => {
      const team = {
        teamCode: 'LAL',
        teamName: 'Los Angeles Lakers',
        players: [],
        roster: [],
        totals: { capHit: SECOND_APRON_2026 + 1_000_000 }, // Already above second apron
      };

      const player = {
        player_id: 'player_1',
        name: 'Test Player',
        displayName: 'Test Player',
        bio: { experience: 0 },
      };

      // Contract at $2M (above rookie min of $1.164M)
      // No signedUsing specified (UNKNOWN mechanism)
      const contract = {
        contractType: 'Standard',
        salariesByYear: [{ season: '2025-26', salary: 2_000_000 }],
      };

      const result = validateSigning({
        team,
        player,
        contract,
        signedUsing: null, // UNKNOWN mechanism
        year,
      });

      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.rule === 'second_apron_minimum_only')).toBe(true);
      expect(result.violations.find((v) => v.rule === 'second_apron_minimum_only').message).toMatch(/at\/above second apron/);
    });

    it('allows above-second-apron signing when salary exactly equals minimum', () => {
      const team = {
        teamCode: 'LAL',
        teamName: 'Los Angeles Lakers',
        players: [],
        roster: [],
        totals: { capHit: SECOND_APRON_2026 + 1_000_000 }, // Already above second apron
      };

      const player = {
        player_id: 'rookie_1',
        name: 'Rookie Player',
        displayName: 'Rookie Player',
        bio: { experience: 0 },
      };

      // Contract exactly at rookie minimum
      const contract = {
        contractType: 'Standard',
        salariesByYear: [{ season: '2025-26', salary: ROOKIE_MIN_2026 }],
      };

      const result = validateSigning({
        team,
        player,
        contract,
        signedUsing: 'Minimum',
        year,
      });

      // Should NOT have second_apron_minimum_only violation
      const apronViolation = result.violations.find((v) => v.rule === 'second_apron_minimum_only');
      expect(apronViolation).toBeUndefined();
    });

    it('allows below-second-apron signing at any valid salary', () => {
      const team = {
        teamCode: 'LAL',
        teamName: 'Los Angeles Lakers',
        players: [],
        roster: [],
        totals: { capHit: 150_000_000 }, // Well below second apron
      };

      const player = {
        player_id: 'player_1',
        name: 'Test Player',
        displayName: 'Test Player',
        bio: { experience: 5 },
      };

      // Contract at $10M (above minimum but below second apron)
      const contract = {
        contractType: 'Standard',
        salariesByYear: [{ season: '2025-26', salary: 10_000_000 }],
      };

      const result = validateSigning({
        team,
        player,
        contract,
        signedUsing: 'MLE',
        year,
      });

      // Should NOT have second_apron_minimum_only violation
      const apronViolation = result.violations.find((v) => v.rule === 'second_apron_minimum_only');
      expect(apronViolation).toBeUndefined();
    });

    it('excludes two-way contracts from second apron minimum-only rule', () => {
      const team = {
        teamCode: 'LAL',
        teamName: 'Los Angeles Lakers',
        players: [],
        roster: [],
        totals: { capHit: SECOND_APRON_2026 + 1_000_000 }, // Above second apron
      };

      const player = {
        player_id: 'twoway_player',
        name: 'Two-Way Player',
        displayName: 'Two-Way Player',
        bio: { experience: 0 },
      };

      // Two-way contract - doesn't count against cap rules
      const contract = {
        contractType: 'Two-Way',
        salariesByYear: [{ season: '2025-26', salary: 500_000 }],
      };

      const result = validateSigning({
        team,
        player,
        contract,
        signedUsing: null,
        year,
      });

      // Should NOT have second_apron_minimum_only for two-way
      const apronViolation = result.violations.find((v) => v.rule === 'second_apron_minimum_only');
      expect(apronViolation).toBeUndefined();
    });

    it('uses projected cap hit (current + contract) for apron check', () => {
      // Team is just below second apron, but signing would push them over
      const team = {
        teamCode: 'LAL',
        teamName: 'Los Angeles Lakers',
        players: [],
        roster: [],
        totals: { capHit: SECOND_APRON_2026 - 1_000_000 }, // Just below second apron
      };

      const player = {
        player_id: 'player_1',
        name: 'Test Player',
        displayName: 'Test Player',
        bio: { experience: 0 },
      };

      // Contract at $2M would push team over second apron
      const contract = {
        contractType: 'Standard',
        salariesByYear: [{ season: '2025-26', salary: 2_000_000 }],
      };

      const result = validateSigning({
        team,
        player,
        contract,
        signedUsing: null,
        year,
      });

      // Should trigger second_apron_minimum_only because projected cap hit >= second apron
      expect(result.violations.some((v) => v.rule === 'second_apron_minimum_only')).toBe(true);
    });

    it('uses capHit (not salary) for second apron projection when capHit differs (Phase 2.5 patch)', () => {
      // Team is $1.5M below second apron
      // Contract has salary that WOULDN'T push over ($1.2M), but capHit ($2M) WOULD
      // This tests that we use capHit for the apron threshold check
      const team = {
        teamCode: 'LAL',
        teamName: 'Los Angeles Lakers',
        players: [],
        roster: [],
        totals: { capHit: SECOND_APRON_2026 - 1_500_000 }, // $1.5M below second apron
      };

      const player = {
        player_id: 'player_1',
        name: 'Test Player',
        displayName: 'Test Player',
        bio: { experience: 0 }, // Rookie - min salary ~$1.164M
      };

      // Contract where salary ($1.2M) wouldn't push over apron, but capHit ($2M) does
      // salary is above minimum ($1.164M for rookie) so the violation check will trigger
      // capHit ($2M) > $1.5M needed to push over second apron
      const contract = {
        contractType: 'Standard',
        salariesByYear: [{
          season: '2025-26',
          salary: 1_200_000,   // Above min salary, but below $1.5M needed to push over
          capHit: 2_000_000,   // Above the $1.5M needed to push over
        }],
      };

      const result = validateSigning({
        team,
        player,
        contract,
        signedUsing: null,
        year,
      });

      // With salary-based projection: apron - 1.5M + 1.2M = apron - 300k (NOT above apron)
      // With capHit-based projection: apron - 1.5M + 2M = apron + 500k (ABOVE apron)
      // Phase 2.5 patch ensures we use capHit, so this SHOULD trigger second_apron_minimum_only
      // because salary ($1.2M) > min salary ($1.164M) while team is above second apron
      expect(result.violations.some((v) => v.rule === 'second_apron_minimum_only')).toBe(true);
    });

    it('confirms second_apron_minimum_only is a HARD_BLOCK rule', () => {
      expect(HARD_BLOCK_RULES).toContain('second_apron_minimum_only');
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

  // ==========================================================================
  // EXTENSION VALIDATION (Phase 3 - CBA Contract Rules)
  // ==========================================================================

  describe('validateExtension - Phase 3 Extension Validation', () => {
    // Helper to create player with contract
    const createPlayerWithContract = (lastYearSalary, options = {}) => ({
      player_id: 'player_1',
      name: 'Test Player',
      displayName: 'Test Player',
      bio: { experience: options.experience ?? 5 },
      contract: {
        contractType: options.contractType ?? 'Standard',
        salariesByYear: [
          { season: '2024-25', salary: lastYearSalary, guaranteed: true },
        ],
      },
    });

    const createTeam = () => ({
      teamCode: 'LAL',
      teamName: 'Los Angeles Lakers',
      players: [],
      roster: [],
      totals: { capHit: 100_000_000 },
    });

    it('blocks extension for two-way contracts', () => {
      const team = createTeam();
      const player = createPlayerWithContract(500_000, { contractType: 'Two-Way' });

      const extension = {
        salariesByYear: [
          { season: '2025-26', salary: 2_000_000 },
        ],
      };

      const result = validateExtension({
        team,
        player,
        extension,
        year,
      });

      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.rule === 'extension_ineligible')).toBe(true);
      expect(result.violations.find((v) => v.rule === 'extension_ineligible').message).toMatch(/Two-way contracts cannot be extended/);
    });

    it('blocks extension when years exceed max (5-year extension)', () => {
      const team = createTeam();
      const player = createPlayerWithContract(10_000_000);

      // 5-year extension (max is 4 for baseline)
      const extension = {
        salariesByYear: [
          { season: '2025-26', salary: 12_000_000 },
          { season: '2026-27', salary: 12_960_000 },
          { season: '2027-28', salary: 13_996_800 },
          { season: '2028-29', salary: 15_116_544 },
          { season: '2029-30', salary: 16_325_867 },
        ],
      };

      const result = validateExtension({
        team,
        player,
        extension,
        year,
      });

      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.rule === 'extension_years_invalid')).toBe(true);
      expect(result.violations.find((v) => v.rule === 'extension_years_invalid').message).toMatch(/exceeds maximum.*4 years/);
    });

    it('blocks extension when first year exceeds max (150% exceeds any baseline/engine max)', () => {
      const team = createTeam();
      const lastYearSalary = 10_000_000;
      const player = createPlayerWithContract(lastYearSalary);

      // First year at 150% of last year (exceeds both 120% baseline and typical 140% engine max)
      const firstYearSalary = lastYearSalary * 1.5; // $15M
      const extension = {
        salariesByYear: [
          { season: '2025-26', salary: firstYearSalary },
          { season: '2026-27', salary: firstYearSalary * 1.08 },
        ],
      };

      const result = validateExtension({
        team,
        player,
        extension,
        year,
      });

      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.rule === 'extension_first_year_max_invalid')).toBe(true);
      expect(result.violations.find((v) => v.rule === 'extension_first_year_max_invalid').message).toMatch(/exceeds maximum/);
    });

    it('blocks extension when raises exceed 8%', () => {
      const team = createTeam();
      const lastYearSalary = 10_000_000;
      const player = createPlayerWithContract(lastYearSalary);

      // First year at 120% (valid under baseline), but second year at 15% raise (invalid)
      const firstYearSalary = lastYearSalary * 1.20; // $12M (valid under 120% baseline)
      const secondYearSalary = firstYearSalary * 1.15; // $13.8M (15% raise - exceeds 8%)
      const extension = {
        salariesByYear: [
          { season: '2025-26', salary: firstYearSalary },
          { season: '2026-27', salary: secondYearSalary },
        ],
      };

      const result = validateExtension({
        team,
        player,
        extension,
        year,
      });

      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.rule === 'extension_raise_invalid')).toBe(true);
      expect(result.violations.find((v) => v.rule === 'extension_raise_invalid').message).toMatch(/exceeds allowed 8% raise/);
    });

    it('allows extension at baseline boundary values (4 years, 120%, 8% raises)', () => {
      const team = createTeam();
      const lastYearSalary = 10_000_000;
      const player = createPlayerWithContract(lastYearSalary);

      // Exactly at baseline limits: 4 years, 120% first year, 8% raises
      const firstYearSalary = lastYearSalary * EXTENSION_FIRST_YEAR_MAX_PERCENT; // $12M (120% baseline)
      const extension = {
        salariesByYear: [
          { season: '2025-26', salary: firstYearSalary },
          { season: '2026-27', salary: Math.round(firstYearSalary * (1 + EXTENSION_MAX_RAISE_PERCENT)) },
          { season: '2027-28', salary: Math.round(firstYearSalary * Math.pow(1 + EXTENSION_MAX_RAISE_PERCENT, 2)) },
          { season: '2028-29', salary: Math.round(firstYearSalary * Math.pow(1 + EXTENSION_MAX_RAISE_PERCENT, 3)) },
        ],
      };

      const result = validateExtension({
        team,
        player,
        extension,
        year,
      });

      // Should NOT have any extension-related violations
      const extensionViolations = result.violations.filter((v) =>
        v.rule.startsWith('extension_years') ||
        v.rule.startsWith('extension_first_year') ||
        v.rule.startsWith('extension_raise')
      );
      expect(extensionViolations).toHaveLength(0);
    });

    it('blocks extension when player has no contract (existing behavior)', () => {
      const team = createTeam();
      const player = {
        player_id: 'player_1',
        name: 'Test Player',
        displayName: 'Test Player',
        bio: { experience: 5 },
        contract: null, // No contract
      };

      const extension = {
        salariesByYear: [
          { season: '2025-26', salary: 10_000_000 },
        ],
      };

      const result = validateExtension({
        team,
        player,
        extension,
        year,
      });

      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.rule === 'no_contract')).toBe(true);
    });

    it('confirms extension rule IDs are in HARD_BLOCK_RULES', () => {
      expect(HARD_BLOCK_RULES).toContain('extension_ineligible');
      expect(HARD_BLOCK_RULES).toContain('extension_years_invalid');
      expect(HARD_BLOCK_RULES).toContain('extension_raise_invalid');
      expect(HARD_BLOCK_RULES).toContain('extension_first_year_max_invalid');
    });

    it('exports extension constants correctly (Phase 3.25: baseline is now 120%)', () => {
      expect(EXTENSION_YEARS_LIMITS.min).toBe(1);
      expect(EXTENSION_YEARS_LIMITS.max).toBe(4);
      expect(EXTENSION_FIRST_YEAR_MAX_PERCENT).toBe(1.20); // Changed from 1.40 in Phase 3.25
      expect(EXTENSION_MAX_RAISE_PERCENT).toBe(0.08);
    });

    // ==========================================================================
    // Phase 3.25: 120% Baseline + Engine Override Tests
    // ==========================================================================

    it('blocks extension at 125% of last-year salary under 120% baseline (Phase 3.25)', () => {
      // This test verifies the 120% baseline is enforced
      // 125% would have passed under the old 140% baseline but should fail now
      const team = createTeam();
      const lastYearSalary = 10_000_000;
      const player = createPlayerWithContract(lastYearSalary);

      // First year at 125% of last year (exceeds 120% baseline but would pass 140%)
      const firstYearSalary = lastYearSalary * 1.25; // $12.5M
      const extension = {
        salariesByYear: [
          { season: '2025-26', salary: firstYearSalary },
          { season: '2026-27', salary: Math.round(firstYearSalary * 1.08) },
        ],
      };

      const result = validateExtension({
        team,
        player,
        extension,
        year,
      });

      // Should block because 125% > 120% baseline
      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.rule === 'extension_first_year_max_invalid')).toBe(true);
      expect(result.violations.find((v) => v.rule === 'extension_first_year_max_invalid').message).toMatch(/exceeds maximum/);
    });

    it('allows extension at exactly 120% of last-year salary (Phase 3.25 baseline)', () => {
      const team = createTeam();
      const lastYearSalary = 10_000_000;
      const player = createPlayerWithContract(lastYearSalary);

      // First year at exactly 120% of last year
      const firstYearSalary = lastYearSalary * 1.20; // $12M
      const extension = {
        salariesByYear: [
          { season: '2025-26', salary: firstYearSalary },
          { season: '2026-27', salary: Math.round(firstYearSalary * 1.08) },
        ],
      };

      const result = validateExtension({
        team,
        player,
        extension,
        year,
      });

      // Should NOT have first-year max violation at exactly 120%
      const firstYearViolation = result.violations.find((v) => v.rule === 'extension_first_year_max_invalid');
      expect(firstYearViolation).toBeUndefined();
    });

    it('validateExtensionTermsAndRaises uses engine maxFirstYearSalary when provided (Phase 3.25)', () => {
      // This tests the pure validation function directly with mocked engine terms
      // validateExtensionTermsAndRaises is imported at the top of the file
      
      const lastYearSalary = 10_000_000;
      const player = {
        player_id: 'test_player',
        contract: {
          salariesByYear: [
            { season: '2024-25', salary: lastYearSalary, guaranteed: true },
          ],
        },
      };

      // Extension at 135% - would fail 120% baseline but should pass with engine terms
      const firstYearSalary = lastYearSalary * 1.35; // $13.5M
      const extension = {
        salariesByYear: [
          { season: '2025-26', salary: firstYearSalary },
          { season: '2026-27', salary: Math.round(firstYearSalary * 1.08) },
        ],
      };

      // WITHOUT engine terms (baseline 120% should reject 135%)
      const resultWithoutEngine = validateExtensionTermsAndRaises({
        player,
        extension,
        extensionTerms: null,
      });
      expect(resultWithoutEngine.violations.some((v) => v.rule === 'extension_first_year_max_invalid')).toBe(true);

      // WITH engine terms that allow 140% ($14M max)
      const engineTerms = {
        maxYears: 4,
        maxFirstYearSalary: 14_000_000, // 140% of $10M
        raisePercentage: 0.08,
      };
      const resultWithEngine = validateExtensionTermsAndRaises({
        player,
        extension,
        extensionTerms: engineTerms,
      });
      // Should pass because $13.5M < $14M engine max
      expect(resultWithEngine.violations.find((v) => v.rule === 'extension_first_year_max_invalid')).toBeUndefined();
    });
  });
});
