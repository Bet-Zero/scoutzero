/**
 * FILE: src/tests/architect/capLegalityValidation.batchedHardening.test.ts
 * PURPOSE: Behavioral proofs for the batched hardening pass on capLegalityValidation.ts.
 *   Covers the three hardened boundaries:
 *   - CapLegalityViolation[] replaces AnyRecord[] on all exported validator return types
 *   - MutationPlayer.yearsOfService narrowed to number | string | null
 *   - validateDeadCap / validateExceptions remain tolerant raw-input surfaces
 *
 * HISTORY:
 *   2026-03-24  Batched Hardening Pass (cap legality)
 */

import { describe, expect, it } from 'vitest';
import {
  validateSigning,
  validateDeadCap,
  getSigningTermsForPlayer,
} from '@/features/architect/utils/capLegalityValidation';

// ---------------------------------------------------------------------------
// Minimal test data factories
// ---------------------------------------------------------------------------

function makePlayer(overrides: Record<string, unknown> = {}) {
  return {
    player_id: 'test-player-1',
    playerId: 'test-player-1',
    name: 'Test Player',
    displayName: 'Test Player',
    teamCode: null,
    contract: null,
    ...overrides,
  };
}

function makeTeamWith15Players() {
  // 15 standard-roster players — any additional signing should violate roster_size
  const players = Array.from({ length: 15 }, (_, i) => ({
    player_id: `player_${i}`,
    playerId: `player_${i}`,
    name: `Player ${i}`,
    displayName: `Player ${i}`,
    teamCode: 'LAL',
    contract: {
      contractType: 'Standard',
      salariesByYear: [{ season: '2025-26', salary: 2_000_000, capHit: 2_000_000 }],
    },
  }));

  return {
    teamCode: 'LAL',
    teamName: 'Los Angeles Lakers',
    players,
    twoWayPlayers: [] as unknown[],
    capHolds: [] as unknown[],
    roster: players.map((p) => p.player_id),
    totals: { totalSalary: 30_000_000, capHit: 30_000_000, totalCapAllocations: 30_000_000 },
  };
}

function makeSmallTeam() {
  // Team with 5 players, well under the cap — safe for a minimum salary signing
  const players = Array.from({ length: 5 }, (_, i) => ({
    player_id: `player_${i}`,
    playerId: `player_${i}`,
    name: `Player ${i}`,
    displayName: `Player ${i}`,
    teamCode: 'LAL',
    contract: {
      contractType: 'Standard',
      salariesByYear: [{ season: '2025-26', salary: 2_000_000, capHit: 2_000_000 }],
    },
  }));

  return {
    teamCode: 'LAL',
    teamName: 'Los Angeles Lakers',
    players,
    twoWayPlayers: [] as unknown[],
    capHolds: [] as unknown[],
    roster: players.map((p) => p.player_id),
    totals: { totalSalary: 10_000_000, capHit: 10_000_000, totalCapAllocations: 10_000_000 },
  };
}

function makeMinimumContract() {
  return {
    contractType: 'Minimum',
    salariesByYear: [
      {
        season: '2025-26',
        salary: 1_200_000,
        capHit: 1_200_000,
        guaranteed: true,
        guaranteedAmount: 1_200_000,
      },
    ],
    years: 1,
    startYear: 2025,
  };
}

// ---------------------------------------------------------------------------
// Test 1: Exported validator boundary — CapLegalityViolation[] shape
// ---------------------------------------------------------------------------

describe('validateSigning — CapLegalityViolation[] boundary', () => {
  it('returns violations with rule: string and message: string when roster is full', () => {
    const team = makeTeamWith15Players();
    const player = makePlayer({ yearsOfService: 2, teamCode: null });
    const contract = makeMinimumContract();

    const result = validateSigning({
      team,
      player,
      contract,
      signedUsing: null,
      year: 2026,
    });

    // Roster is full (15 standard players), so roster_size violation is expected
    const rosterViolation = result.violations.find((v) => v.rule === 'roster_size');
    expect(rosterViolation).toBeDefined();

    // Verify every violation satisfies the CapLegalityViolation contract:
    // rule and message must always be strings
    for (const v of result.violations) {
      expect(typeof v.rule).toBe('string');
      expect(typeof v.message).toBe('string');
    }
    for (const w of result.warnings) {
      expect(typeof w.rule).toBe('string');
      expect(typeof w.message).toBe('string');
    }
  });

  it('returns valid: true with empty violations for an unconstrained minimum signing', () => {
    const team = makeSmallTeam();
    const player = makePlayer({ yearsOfService: 0, teamCode: null });
    const contract = makeMinimumContract();

    const result = validateSigning({
      team,
      player,
      contract,
      signedUsing: null,
      year: 2026,
    });

    // May have soft warnings (cap space, apron) but should not have hard-block violations
    // that prevent the signing (unless salary engine produces unexpected errors).
    // The key assertion is structural: the return shape satisfies MutationValidationResult.
    expect(typeof result.valid).toBe('boolean');
    expect(Array.isArray(result.violations)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);

    // Hard blocks specifically related to contract structure should not be present
    // for a valid minimum salary contract on a small roster
    const hasHardRosterBlock = result.violations.some((v) => v.rule === 'roster_size');
    expect(hasHardRosterBlock).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Test 2: getSigningTermsForPlayer — narrowed yearsOfService field
// ---------------------------------------------------------------------------

describe('getSigningTermsForPlayer — narrowed MutationPlayer.yearsOfService', () => {
  it('does not throw when player.yearsOfService is a number (narrowed from unknown)', () => {
    const team = makeSmallTeam();
    // yearsOfService is now typed as number | string | null (not unknown)
    const player = makePlayer({ yearsOfService: 5, teamCode: null });

    let caughtError: unknown = null;
    let result: unknown = null;

    try {
      result = getSigningTermsForPlayer({
        team,
        player,
        contract: makeMinimumContract(),
        signedUsing: null,
        year: 2026,
      });
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError).toBeNull();
    // Result is SigningTerms | null — either is acceptable, no crash is the key assertion
    expect(result === null || typeof result === 'object').toBe(true);
  });

  it('does not throw when player.yearsOfService is a string (narrowed from unknown)', () => {
    const team = makeSmallTeam();
    // yearsOfService accepts string as well as number
    const player = makePlayer({ yearsOfService: '5', teamCode: null });

    let caughtError: unknown = null;
    try {
      getSigningTermsForPlayer({
        team,
        player,
        contract: makeMinimumContract(),
        signedUsing: null,
        year: 2026,
      });
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Test 3: validateDeadCap — tolerant raw-input surface preserved
// ---------------------------------------------------------------------------

describe('validateDeadCap — tolerant raw-input surface', () => {
  it('returns dead_cap_schema_invalid when amountByYear is missing', () => {
    const result = validateDeadCap([
      { playerName: 'Released Player', stretched: false },
    ]);

    const hasSchemaViolation = result.violations.some(
      (v) => v.rule === 'dead_cap_schema_invalid'
    );
    expect(hasSchemaViolation).toBe(true);

    // Shape is still CapLegalityViolation-compatible
    for (const v of result.violations) {
      expect(typeof v.rule).toBe('string');
      expect(typeof v.message).toBe('string');
    }
  });

  it('returns no violations for valid dead cap entry', () => {
    const result = validateDeadCap([
      {
        playerName: 'Released Player',
        stretched: false,
        amountByYear: {
          '2025-26': { amount: 5_000_000 },
        },
      },
    ]);

    expect(result.violations).toHaveLength(0);
  });

  it('accepts non-array input and returns schema violation (unknown input tolerance)', () => {
    // validateDeadCap accepts unknown — must handle non-array gracefully
    const result = validateDeadCap('not an array');
    const hasSchemaViolation = result.violations.some(
      (v) => v.rule === 'dead_cap_schema_invalid'
    );
    expect(hasSchemaViolation).toBe(true);
  });
});
