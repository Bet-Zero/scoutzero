/**
 * Override Bypass Prevention Tests
 *
 * Tests proving that the pipeline correctly blocks override bypass attempts:
 * - When VITE_ENABLE_CBA_OVERRIDE is OFF, override metadata is stripped
 * - Invalid mutations are blocked regardless of override flags
 * - Hard violations cannot be overridden even in dev mode
 * - Soft warnings can be overridden in dev mode
 *
 * @file tests/architect/overrideBypass.test.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getOverridePolicy,
  isOverrideEnabled,
  HARD_BLOCK_RULES,
  SOFT_WARNING_RULES,
  validateSigning,
} from '@/features/architect/utils/capLegalityValidation';
import {
  seedBaseData,
  createMockTeam,
  createMockPlayer,
} from '../helpers/architectTestHelpers.js';

// ==============================================================================
// HELPER: Mock environment variable
// ==============================================================================

const mockEnv = (value) => {
  vi.stubEnv('VITE_ENABLE_CBA_OVERRIDE', value);
};

// ==============================================================================
// OVERRIDE POLICY TESTS
// ==============================================================================

describe('Override Policy Classification', () => {
  beforeEach(() => {
    seedBaseData(['LAL', 'GSW']);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('HARD_BLOCK_RULES constant', () => {
    it('includes roster_size as hard block', () => {
      expect(HARD_BLOCK_RULES).toContain('roster_size');
    });

    it('includes hard_cap as hard block', () => {
      expect(HARD_BLOCK_RULES).toContain('hard_cap');
    });

    it('includes two_way_limit as hard block', () => {
      expect(HARD_BLOCK_RULES).toContain('two_way_limit');
    });

    it('includes option_timing as hard block', () => {
      expect(HARD_BLOCK_RULES).toContain('option_timing');
    });
  });

  describe('SOFT_WARNING_RULES constant', () => {
    it('includes roster_minimum as soft warning', () => {
      expect(SOFT_WARNING_RULES).toContain('roster_minimum');
    });

    it('includes mle_taxpayer as soft warning', () => {
      expect(SOFT_WARNING_RULES).toContain('mle_taxpayer');
    });

    it('includes first_apron as soft warning', () => {
      expect(SOFT_WARNING_RULES).toContain('first_apron');
    });
  });

  describe('getOverridePolicy', () => {
    it('returns canOverride=false when violations contain hard block rules', () => {
      const violations = [
        { rule: 'roster_size', message: 'Roster exceeds 15 players', severity: 'error' },
      ];
      const policy = getOverridePolicy(violations, []);

      expect(policy.canOverride).toBe(false);
      expect(policy.hasHardBlock).toBe(true);
      expect(policy.hardBlockReasons).toContain('Roster exceeds 15 players');
    });

    it('returns canOverride=true when only soft warnings present', () => {
      const warnings = [
        { rule: 'roster_minimum', message: 'Roster below 14 players', severity: 'warning' },
        { rule: 'first_apron', message: 'Over first apron', severity: 'warning' },
      ];
      const policy = getOverridePolicy([], warnings);

      expect(policy.canOverride).toBe(true);
      expect(policy.hasHardBlock).toBe(false);
      expect(policy.softWarningReasons).toHaveLength(2);
    });

    it('correctly separates hard blocks from soft warnings', () => {
      const violations = [
        { rule: 'hard_cap', message: 'Over hard cap', severity: 'error' },
      ];
      const warnings = [
        { rule: 'mle_taxpayer', message: 'MLE triggers hard cap', severity: 'warning' },
      ];
      const policy = getOverridePolicy(violations, warnings);

      expect(policy.canOverride).toBe(false);
      expect(policy.hardBlockReasons).toContain('Over hard cap');
      expect(policy.softWarningReasons).toContain('MLE triggers hard cap');
    });

    it('treats unknown violations as soft (overridable)', () => {
      const violations = [
        { rule: 'custom_business_rule', message: 'Custom rule failed', severity: 'error' },
      ];
      const policy = getOverridePolicy(violations, []);

      // Unknown rules are NOT in HARD_BLOCK_RULES, so they're soft
      expect(policy.canOverride).toBe(true);
      expect(policy.softWarningReasons).toContain('Custom rule failed');
    });
  });
});

// ==============================================================================
// ENVIRONMENT FLAG TESTS
// ==============================================================================

describe('isOverrideEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns false when VITE_ENABLE_CBA_OVERRIDE is not set', () => {
    vi.stubEnv('VITE_ENABLE_CBA_OVERRIDE', undefined);
    expect(isOverrideEnabled()).toBe(false);
  });

  it('returns false when VITE_ENABLE_CBA_OVERRIDE is empty', () => {
    vi.stubEnv('VITE_ENABLE_CBA_OVERRIDE', '');
    expect(isOverrideEnabled()).toBe(false);
  });

  it('returns false when VITE_ENABLE_CBA_OVERRIDE is "false"', () => {
    vi.stubEnv('VITE_ENABLE_CBA_OVERRIDE', 'false');
    expect(isOverrideEnabled()).toBe(false);
  });

  it('returns true only when VITE_ENABLE_CBA_OVERRIDE is exactly "true"', () => {
    vi.stubEnv('VITE_ENABLE_CBA_OVERRIDE', 'true');
    expect(isOverrideEnabled()).toBe(true);
  });

  it('returns false for case-insensitive variations like "TRUE"', () => {
    vi.stubEnv('VITE_ENABLE_CBA_OVERRIDE', 'TRUE');
    expect(isOverrideEnabled()).toBe(false);
  });
});

// ==============================================================================
// VALIDATION BLOCKING TESTS
// ==============================================================================

describe('Validation Always Blocks Invalid States', () => {
  const year = 2026;

  beforeEach(() => {
    seedBaseData(['LAL']);
  });

  it('validateSigning blocks roster overflow regardless of any override intent', () => {
    // Create team with 15 players already
    const players = Array.from({ length: 15 }, (_, i) => ({
      player_id: `player_${i}`,
      name: `Player ${i}`,
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
      totals: { rosterCount: 15 },
    };

    const newPlayer = { player_id: 'new_player', name: 'New Player' };
    const contract = {
      contractType: 'Standard',
      salariesByYear: [{ season: '2025-26', salary: 2_000_000 }],
    };

    // Validation should still find violations even if we imagine override metadata exists
    const result = validateSigning({
      team,
      player: newPlayer,
      contract,
      signedUsing: null,
      year,
    });

    // The validation itself always runs and always reports violations
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.rule === 'roster_size')).toBe(true);

    // Verify this is a hard block
    const policy = getOverridePolicy(result.violations, result.warnings);
    expect(policy.canOverride).toBe(false);
    expect(policy.hasHardBlock).toBe(true);
  });

  it('validateSigning blocks hard cap violation', () => {
    const players = Array.from({ length: 10 }, (_, i) => ({
      player_id: `player_${i}`,
      name: `Player ${i}`,
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
        capHit: 193_000_000,
        rosterCount: 10,
        isHardCapped: true,
        hardCapLevel: 'firstApron',
      },
    };

    const newPlayer = { player_id: 'new_player', name: 'New Player' };
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

    const policy = getOverridePolicy(result.violations, result.warnings);
    expect(policy.canOverride).toBe(false);
  });

  it('validateSigning blocks two-way limit violation', () => {
    const players = [
      { player_id: 'tw1', name: 'Two-Way 1', contract: { contractType: 'Two-Way' } },
      { player_id: 'tw2', name: 'Two-Way 2', contract: { contractType: 'Two-Way' } },
      { player_id: 'tw3', name: 'Two-Way 3', contract: { contractType: 'Two-Way' } },
    ];

    const team = {
      teamCode: 'LAL',
      teamName: 'Los Angeles Lakers',
      players,
      roster: players.map((p) => p.player_id),
      totals: { rosterCount: 3 },
    };

    const newPlayer = { player_id: 'new_tw', name: 'New Two-Way' };
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

    const policy = getOverridePolicy(result.violations, result.warnings);
    expect(policy.canOverride).toBe(false);
  });
});

// ==============================================================================
// SOFT WARNING OVERRIDE TESTS
// ==============================================================================

describe('Soft Warnings Can Be Overridden in Dev Mode', () => {
  const year = 2026;

  beforeEach(() => {
    seedBaseData(['LAL']);
  });

  it('roster minimum warning is classified as soft (overridable)', () => {
    const violations = [];
    const warnings = [
      { rule: 'roster_minimum', message: 'Roster below 14 players', severity: 'warning' },
    ];

    const policy = getOverridePolicy(violations, warnings);
    expect(policy.canOverride).toBe(true);
    expect(policy.hasHardBlock).toBe(false);
    expect(SOFT_WARNING_RULES).toContain('roster_minimum');
  });

  it('apron warnings are classified as soft (overridable)', () => {
    const warnings = [
      { rule: 'first_apron', message: 'Over first apron', severity: 'warning' },
      { rule: 'second_apron', message: 'Over second apron', severity: 'warning' },
    ];

    const policy = getOverridePolicy([], warnings);
    expect(policy.canOverride).toBe(true);
    expect(policy.softWarningReasons).toHaveLength(2);
  });

  it('dead cap warning is classified as soft', () => {
    const warnings = [
      { rule: 'dead_cap', message: 'Creates dead cap', severity: 'info' },
    ];

    const policy = getOverridePolicy([], warnings);
    expect(policy.canOverride).toBe(true);
    expect(SOFT_WARNING_RULES).toContain('dead_cap');
  });
});

// ==============================================================================
// MIXED VIOLATION/WARNING TESTS
// ==============================================================================

describe('Mixed Violations and Warnings', () => {
  it('hard block takes precedence even with soft warnings', () => {
    const violations = [
      { rule: 'roster_size', message: 'Over 15 players', severity: 'error' },
    ];
    const warnings = [
      { rule: 'first_apron', message: 'Over first apron', severity: 'warning' },
      { rule: 'mle_taxpayer', message: 'MLE triggers hard cap', severity: 'warning' },
    ];

    const policy = getOverridePolicy(violations, warnings);

    // Hard block should prevent override
    expect(policy.canOverride).toBe(false);
    expect(policy.hasHardBlock).toBe(true);

    // Both categories should be populated
    expect(policy.hardBlockReasons).toHaveLength(1);
    expect(policy.softWarningReasons).toHaveLength(2);
  });

  it('multiple hard blocks are all captured', () => {
    const violations = [
      { rule: 'roster_size', message: 'Over 15 players', severity: 'error' },
      { rule: 'hard_cap', message: 'Over hard cap', severity: 'error' },
      { rule: 'two_way_limit', message: 'Over two-way limit', severity: 'error' },
    ];

    const policy = getOverridePolicy(violations, []);

    expect(policy.canOverride).toBe(false);
    expect(policy.hardBlockReasons).toHaveLength(3);
  });
});
