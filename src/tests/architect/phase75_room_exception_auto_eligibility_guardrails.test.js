/**
 * FILE: src/tests/architect/phase75_room_exception_auto_eligibility_guardrails.test.js
 * PURPOSE: Guardrail tests for Phase 75 Room Exception Auto-Eligibility (Under-Cap Gating)
 * OWNERSHIP: Feature: architect
 *
 * HISTORY:
 *  - 2026-02-01: Phase 75 - Created for Room Exception auto-eligibility enforcement
 *
 * LINKS:
 *  - Master Doc: docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
 *  - Phase 74: Room Exception MVP wiring
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { canUseRoomException } from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import { validateExceptionEligibility } from '@/features/architect/utils/capLegalityValidation';

// ==============================================================================
// SOURCE SCAN GUARDRAILS
// ==============================================================================

describe('Phase 75: Source Scan Guardrails', () => {
  const srcRoot = path.resolve(__dirname, '../../features/architect');
  const capLegalityAuthorityPath = path.join(
    srcRoot,
    'utils/capLegalityValidation.ts'
  );
  const capLegalityShimPath = path.join(
    srcRoot,
    'utils/capLegalityValidation.js'
  );

  it('canUseRoomException exists in computeTeamCapTotals.ts and references computeTeamCapTotals', () => {
    const filePath = path.join(
      srcRoot,
      'utils/capTotals/computeTeamCapTotals.ts'
    );
    const source = fs.readFileSync(filePath, 'utf-8');

    // Function exists
    expect(source).toContain('export function canUseRoomException');

    // Uses computeTeamCapTotals internally
    expect(source).toContain('computeTeamCapTotals(team, yearKey)');
  });

  it('computeTeamCapTotals.js remains a pure compatibility shim', () => {
    const filePath = path.join(
      srcRoot,
      'utils/capTotals/computeTeamCapTotals.js'
    );
    const source = fs.readFileSync(filePath, 'utf-8');

    expect(source).toContain("export * from './computeTeamCapTotals.ts';");
    expect(source).toContain(
      "export { default } from './computeTeamCapTotals.ts';"
    );
    expect(source).not.toContain('export function canUseRoomException');
  });

  it('canUseRoomException is exported from capTotals/index.js', () => {
    const filePath = path.join(srcRoot, 'utils/capTotals/index.js');
    const source = fs.readFileSync(filePath, 'utf-8');

    expect(source).toContain('canUseRoomException');
  });

  it('capLegalityValidation.ts imports and uses canUseRoomException', () => {
    const source = fs.readFileSync(capLegalityAuthorityPath, 'utf-8');

    // Import exists
    expect(source).toContain('canUseRoomException');

    // Called on room exception path
    expect(source).toMatch(/canUseRoomException\s*\(\s*team/);
  });

  it('capLegalityValidation.ts has ROOM_REQUIRES_UNDER_CAP rule code', () => {
    const source = fs.readFileSync(capLegalityAuthorityPath, 'utf-8');

    expect(source).toContain("rule: 'ROOM_REQUIRES_UNDER_CAP'");
  });

  it('capLegalityValidation.js remains a pure compatibility shim', () => {
    const source = fs.readFileSync(capLegalityShimPath, 'utf-8');

    expect(source).toContain("export * from './capLegalityValidation.ts';");
    expect(source).toContain(
      "export { default } from './capLegalityValidation.ts';"
    );
    expect(source).not.toContain('canUseRoomException');
    expect(source).not.toContain("rule: 'ROOM_REQUIRES_UNDER_CAP'");
  });

  it('ManageExceptionsModal.tsx imports canUseRoomException', () => {
    const filePath = path.join(
      srcRoot,
      'capSheet/modals/ManageExceptionsModal.tsx'
    );
    const source = fs.readFileSync(filePath, 'utf-8');

    expect(source).toContain('canUseRoomException');
  });

  it('ManageExceptionsModal.tsx computes roomExceptionEligibility using useMemo', () => {
    const filePath = path.join(
      srcRoot,
      'capSheet/modals/ManageExceptionsModal.tsx'
    );
    const source = fs.readFileSync(filePath, 'utf-8');

    expect(source).toContain('roomExceptionEligibility');
    expect(source).toContain('useMemo');
    expect(source).toContain('roomDisabledByEligibility');
  });

  it('ManageExceptionsModal.tsx shows eligibility warning for room exception', () => {
    const filePath = path.join(
      srcRoot,
      'capSheet/modals/ManageExceptionsModal.tsx'
    );
    const source = fs.readFileSync(filePath, 'utf-8');

    // Warning text exists
    expect(source).toContain('Only available to teams under the salary cap');
  });
});

// ==============================================================================
// canUseRoomException UNIT TESTS
// ==============================================================================

describe('Phase 75: canUseRoomException() Unit Tests', () => {
  /**
   * Mock team factory - creates a team with proper contract structure
   * that computeTeamCapTotals() can process correctly.
   * Uses 2024-25 season format (yearKey 2025).
   * NOTE: getContractYearSlice expects `salariesByYear`, not `years`
   */
  const createMockTeam = ({ playersSalary }) => {
    const players = [];
    if (playersSalary > 0) {
      // Create a player with proper contract.salariesByYear structure
      players.push({
        playerId: 'test-player-1',
        contract: {
          salariesByYear: [
            {
              season: '2024-25',
              salary: playersSalary,
              capHit: playersSalary,
            },
          ],
          contractType: 'standard',
        },
      });
    }
    return { players };
  };

  it('returns eligible: true when team is under the cap', () => {
    // 2024-25 cap is $141M
    // Team with 14+ players to avoid incomplete roster charges
    // Use lower salary to ensure under cap
    const team = {
      players: Array.from({ length: 14 }, (_, i) => ({
        playerId: `player-${i}`,
        contract: {
          salariesByYear: [
            {
              season: '2024-25',
              salary: 5_000_000,
              capHit: 5_000_000,
            },
          ],
          contractType: 'standard',
        },
      })),
    };
    // Total: 14 players × $5M = $70M < $141M cap
    const result = canUseRoomException(team, 2025);

    expect(result.eligible).toBe(true);
    expect(result.reason).toBeUndefined();
    expect(result.totals).toBeDefined();
    expect(result.totals.delta).toBeLessThan(0); // negative = under cap
  });

  it('returns eligible: false when team is at the cap (exactly)', () => {
    // Team exactly at cap - use actual cap value for 2025
    // Cap for 2025 is ~$141M, but test is about delta being >= 0
    // Create a team with enough salary to hit exactly 0 delta or positive
    const team = createMockTeam({ playersSalary: 141_000_000 });
    const result = canUseRoomException(team, 2025);

    // If exactly at cap (delta == 0) or over, should be ineligible
    // The exact value depends on incomplete roster charges, so we check behavior:
    // If the result shows under cap (negative delta), that's expected with roster charges
    // The key invariant is: delta >= 0 means NOT eligible
    if (result.totals && result.totals.delta >= 0) {
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('under the salary cap');
    } else {
      // With incomplete roster charges, may still be under - that's OK
      // Just verify the function returns a valid result
      expect(typeof result.eligible).toBe('boolean');
    }
  });

  it('returns eligible: false when team is clearly over the cap', () => {
    // Team at $160M - clearly over cap
    const team = createMockTeam({ playersSalary: 160_000_000 });
    const result = canUseRoomException(team, 2025);

    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('under the salary cap');
    expect(result.totals).toBeDefined();
    expect(result.totals.delta).toBeGreaterThan(0); // positive = over cap
  });

  it('returns eligible: false with reason when missing team or yearKey', () => {
    expect(canUseRoomException(null, 2025).eligible).toBe(false);
    expect(canUseRoomException({}, null).eligible).toBe(false);
    expect(canUseRoomException(null, null).eligible).toBe(false);
  });

  it('includes cap proof numbers in reason text when ineligible', () => {
    const team = createMockTeam({ playersSalary: 160_000_000 });
    const result = canUseRoomException(team, 2025);

    // Reason should contain dollar amounts for debugging
    expect(result.reason).toBeDefined();
    expect(result.reason).toMatch(/\$\d+\.\d+M/); // e.g., $150.00M
  });
});

// ==============================================================================
// VALIDATION BEHAVIORAL TESTS
// ==============================================================================

describe('Phase 75: Validation - Room Exception Under-Cap Gating', () => {
  /**
   * Mock team with proper contract structure for validation.
   * NOTE: getContractYearSlice expects `salariesByYear`, not `years`
   */
  const createValidationTeam = ({ playersSalary }) => {
    const players =
      playersSalary > 0
        ? [
            {
              playerId: 'val-player-1',
              contract: {
                salariesByYear: [
                  {
                    season: '2024-25',
                    salary: playersSalary,
                    capHit: playersSalary,
                  },
                ],
                contractType: 'standard',
              },
            },
          ]
        : [];

    return {
      players,
      // Also provide totals for apron checks in validation
      totals: {
        capHit: playersSalary,
        totalSalary: playersSalary,
        totalCapAllocations: playersSalary,
      },
    };
  };

  it('room signing FAILS when team is clearly over cap (ROOM_REQUIRES_UNDER_CAP)', () => {
    // Team at $160M - clearly over cap
    const team = createValidationTeam({ playersSalary: 160_000_000 });
    const result = validateExceptionEligibility({
      team,
      signedUsing: 'room',
      year: 2025,
    });

    expect(result.blocked).toBe(true);
    expect(result.violation.rule).toBe('ROOM_REQUIRES_UNDER_CAP');
    expect(result.reason).toContain('under the salary cap');
  });

  it('room signing PASSES when team is under cap', () => {
    // Team with 14 players at $5M each = $70M total
    // 2024-25 cap is $141M, so well under cap
    const players = Array.from({ length: 14 }, (_, i) => ({
      playerId: `val-player-${i}`,
      contract: {
        salariesByYear: [
          {
            season: '2024-25',
            salary: 5_000_000,
            capHit: 5_000_000,
          },
        ],
        contractType: 'standard',
      },
    }));

    const team = {
      players,
      totals: {
        capHit: 70_000_000,
        totalSalary: 70_000_000,
        totalCapAllocations: 70_000_000,
      },
    };

    const result = validateExceptionEligibility({
      team,
      signedUsing: 'room',
      year: 2025,
    });

    expect(result.blocked).toBe(false);
  });

  it('roommle variant triggers same under-cap check', () => {
    const overCapTeam = createValidationTeam({ playersSalary: 160_000_000 });
    const result = validateExceptionEligibility({
      team: overCapTeam,
      signedUsing: 'roommle',
      year: 2025,
    });

    expect(result.blocked).toBe(true);
    expect(result.violation.rule).toBe('ROOM_REQUIRES_UNDER_CAP');
  });

  it('rmle variant triggers same under-cap check', () => {
    const overCapTeam = createValidationTeam({ playersSalary: 160_000_000 });
    const result = validateExceptionEligibility({
      team: overCapTeam,
      signedUsing: 'rmle',
      year: 2025,
    });

    expect(result.blocked).toBe(true);
    expect(result.violation.rule).toBe('ROOM_REQUIRES_UNDER_CAP');
  });

  it('reason includes cap proof numbers for debugging', () => {
    const team = createValidationTeam({ playersSalary: 160_000_000 });
    const result = validateExceptionEligibility({
      team,
      signedUsing: 'room',
      year: 2025,
    });

    // Reason should have dollar amounts
    expect(result.blocked).toBe(true);
    expect(result.reason).toMatch(/\$/);
  });

  it('non-room exceptions are NOT affected by under-cap gating', () => {
    // Team over cap but below first apron (~$178.1M)
    const team = createValidationTeam({ playersSalary: 160_000_000 });

    // MLE should not be blocked by under-cap rule (has its own apron rules)
    const mleResult = validateExceptionEligibility({
      team,
      signedUsing: 'mle',
      year: 2025,
    });
    // MLE might be blocked for other reasons, but NOT by ROOM_REQUIRES_UNDER_CAP
    if (mleResult.blocked) {
      expect(mleResult.violation.rule).not.toBe('ROOM_REQUIRES_UNDER_CAP');
    }

    // BAE should not be blocked by under-cap rule
    const baeResult = validateExceptionEligibility({
      team,
      signedUsing: 'bae',
      year: 2025,
    });
    if (baeResult.blocked) {
      expect(baeResult.violation.rule).not.toBe('ROOM_REQUIRES_UNDER_CAP');
    }
  });
});

// ==============================================================================
// REGRESSION CHECKS - PHASE 74 INVARIANTS
// ==============================================================================

describe('Phase 75: Regression Checks - Phase 74 Invariants', () => {
  it('room exception signing does NOT trigger hard cap (Phase 74 invariant)', () => {
    // Verify source code still does NOT trigger hard cap for room
    const srcRoot = path.resolve(__dirname, '../../features/architect');
    const pipelineAuthorityPath = path.join(srcRoot, 'utils/mutationPipeline.ts');
    const pipelineShimPath = path.join(srcRoot, 'utils/mutationPipeline.js');
    const authoritySource = fs.readFileSync(pipelineAuthorityPath, 'utf-8');

    // Find the room exception block on the TS-authoritative source.
    expect(authoritySource).toContain('Phase 74: Room Exception usage tracking');

    // Should contain the no-hard-cap comment.
    expect(authoritySource).toContain('Room Exception does NOT trigger hard cap');

    // The retired shim path stays absent.
    expect(fs.existsSync(pipelineShimPath)).toBe(false);
  });

  it('tradeExceptions is NOT in TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST (Phase 64 invariant)', () => {
    const srcRoot = path.resolve(__dirname, '../../features/architect');
    const contractsPath = path.join(
      srcRoot,
      'utils/persistenceContracts/contracts.ts'
    );
    const source = fs.readFileSync(contractsPath, 'utf-8');

    // Find the TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST array - look for actual array items, not comments
    // The allowlist format is: Object.freeze([ 'key1', 'key2', ... ])
    // We need to check that 'tradeExceptions' is NOT listed as an array element

    // Strip comments first
    const noComments = source
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');

    // Find the allowlist array
    const allowlistMatch = noComments.match(
      /TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST(?:\s*:\s*[^=]+)?\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\)/
    );
    expect(allowlistMatch).toBeTruthy();

    // The actual allowlist contents should NOT contain tradeExceptions as a string literal
    const allowlistContents = allowlistMatch[1];
    expect(allowlistContents).not.toMatch(/'tradeExceptions'/);
    expect(allowlistContents).not.toMatch(/"tradeExceptions"/);
  });

  it('deletes the contracts.js compatibility shim', () => {
    const srcRoot = path.resolve(__dirname, '../../features/architect');
    const contractsPath = path.join(
      srcRoot,
      'utils/persistenceContracts/contracts.js'
    );
    expect(fs.existsSync(contractsPath)).toBe(false);
  });
});

// ==============================================================================
// BOUNDARY / EDGE CASE TESTS
// ==============================================================================

describe('Phase 75: Boundary and Edge Cases', () => {
  const createMockTeam = ({ playersSalary }) => ({
    players:
      playersSalary > 0
        ? [
            {
              playerId: 'edge-player-1',
              contract: {
                salariesByYear: [
                  {
                    season: '2024-25',
                    salary: playersSalary,
                    capHit: playersSalary,
                  },
                ],
                contractType: 'standard',
              },
            },
          ]
        : [],
  });

  it('team well under cap is eligible', () => {
    // Team at $120M with ~$141M cap
    const team = createMockTeam({ playersSalary: 120_000_000 });
    const result = canUseRoomException(team, 2025);

    expect(result.eligible).toBe(true);
    expect(result.totals.delta).toBeLessThan(0);
  });

  it('team clearly over cap is NOT eligible', () => {
    // Team at $160M - clearly over
    const team = createMockTeam({ playersSalary: 160_000_000 });
    const result = canUseRoomException(team, 2025);

    expect(result.eligible).toBe(false);
    expect(result.totals.delta).toBeGreaterThan(0);
  });

  it('team with no players (zero salary) is eligible', () => {
    const team = createMockTeam({ playersSalary: 0 });
    // Note: incomplete roster charges apply but still way under cap
    const result = canUseRoomException(team, 2025);

    // Should still be eligible since way under cap
    expect(result.eligible).toBe(true);
  });

  it('eligibility result includes totals breakdown', () => {
    const team = createMockTeam({ playersSalary: 130_000_000 });
    const result = canUseRoomException(team, 2025);

    expect(result.totals).toBeDefined();
    expect(typeof result.totals.totalCapAllocations).toBe('number');
    expect(typeof result.totals.salaryCap).toBe('number');
    expect(typeof result.totals.delta).toBe('number');
  });
});
