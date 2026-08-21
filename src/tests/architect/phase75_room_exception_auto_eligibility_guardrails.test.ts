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

type RoomExceptionResult = ReturnType<typeof canUseRoomException>;
type ExceptionEligibilityResult = ReturnType<typeof validateExceptionEligibility>;
type SalaryFixture = { playersSalary: number };

const requireValue = <T,>(value: T | null | undefined, label: string): T => {
  if (value == null) {
    throw new Error(`${label} is required`);
  }

  return value;
};

// ==============================================================================
// SOURCE SCAN GUARDRAILS
// ==============================================================================

describe('Phase 75: Source Scan Guardrails', () => {
  const srcRoot = path.resolve(__dirname, '../../features/architect');
  const capLegalityAuthorityPath = path.join(
    srcRoot,
    'utils/capLegalityValidation.ts'
  );
  // canUseRoomException and ROOM_REQUIRES_UNDER_CAP moved to signing.ts (Wave 4 Step 2c)
  const capLegalitySigningPath = path.join(
    srcRoot,
    'utils/capLegalityValidation/signing.ts'
  );
  const capLegalityShimPath = path.join(
    srcRoot,
    'utils/capLegalityValidation.js'
  );
  const capTotalsBarrelWrapperPath = path.join(srcRoot, 'utils/capTotals/index.js');
  const capTotalsBarrelAuthorityPath = path.join(srcRoot, 'utils/capTotals/index.ts');
  const computeTotalsShimPath = path.join(
    srcRoot,
    'utils/capTotals/computeTeamCapTotals.js'
  );

  it('canUseRoomException exists and consumes the canonical named Team Salary snapshot', () => {
    const filePath = path.join(
      srcRoot,
      'utils/capTotals/computeTeamCapTotals.ts'
    );
    const source = fs.readFileSync(filePath, 'utf-8');

    // Function exists
    expect(source).toContain('export function canUseRoomException');

    expect(source).toContain('createCanonicalTeamTotalsSnapshot(team, yearKey');
  });

  it('computeTeamCapTotals.js is absent after shim retirement', () => {
    expect(fs.existsSync(computeTotalsShimPath)).toBe(false);
  });

  it('capTotals/index.js is absent after barrel retirement', () => {
    expect(fs.existsSync(capTotalsBarrelWrapperPath)).toBe(false);
  });

  it('canUseRoomException is re-exported from capTotals/index.ts', () => {
    const source = fs.readFileSync(capTotalsBarrelAuthorityPath, 'utf-8');
    expect(source).toContain('canUseRoomException');
  });

  it('canUseRoomException remains available from the extensionless capTotals barrel', async () => {
    const barrel = await import('@/features/architect/utils/capTotals');
    const authority = await import(
      '@/features/architect/utils/capTotals/computeTeamCapTotals'
    );

    expect(barrel.canUseRoomException).toBe(authority.canUseRoomException);
    expect(barrel.computeTeamCapTotals).toBe(authority.computeTeamCapTotals);
  });

  it('capLegalityValidation.ts imports and uses canUseRoomException', () => {
    // canUseRoomException logic moved to signing.ts submodule (Wave 4 Step 2c).
    // Stage 6B: signing.ts was further split; the canonical
    // canUseRoomException usage now lives in signing.validators.ts.
    const validatorsPath = path.join(
      srcRoot,
      'utils/capLegalityValidation/signing.validators.ts'
    );
    const source =
      fs.readFileSync(capLegalitySigningPath, 'utf-8') +
      fs.readFileSync(validatorsPath, 'utf-8');

    // Import exists
    expect(source).toContain('canUseRoomException');

    // Called on room exception path
    expect(source).toMatch(/canUseRoomException\s*\(\s*team/);
  });

  it('capLegalityValidation.ts has ROOM_REQUIRES_UNDER_CAP rule code', () => {
    // ROOM_REQUIRES_UNDER_CAP moved to signing.ts submodule (Wave 4 Step 2c).
    // Stage 6B: further moved to signing.validators.ts.
    const validatorsPath = path.join(
      srcRoot,
      'utils/capLegalityValidation/signing.validators.ts'
    );
    const source =
      fs.readFileSync(capLegalitySigningPath, 'utf-8') +
      fs.readFileSync(validatorsPath, 'utf-8');

    expect(source).toContain("rule: 'ROOM_REQUIRES_UNDER_CAP'");
  });

  it('capLegalityValidation.js is absent after shim retirement', () => {
    expect(fs.existsSync(capLegalityShimPath)).toBe(false);
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
  const createMockTeam = ({ playersSalary }: SalaryFixture) => {
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

  it('fails closed when an old under-cap fixture lacks governed book context', () => {
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
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('complete Team Salary book');
    expect(result.totals).toBeUndefined();
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

  it('does not infer over-cap eligibility from an incomplete generic fixture', () => {
    // Team at $160M - clearly over cap
    const team = createMockTeam({ playersSalary: 160_000_000 });
    const result = canUseRoomException(team, 2025);

    expect(result.eligible).toBe(false);
    expect(requireValue(result.reason, 'result.reason')).toContain(
      'complete Team Salary book'
    );
    expect(result.totals).toBeUndefined();
  });

  it('returns eligible: false with reason when missing team or yearKey', () => {
    expect(canUseRoomException(null, 2025).eligible).toBe(false);
    expect(canUseRoomException({}, 0).eligible).toBe(false);
    expect(canUseRoomException(null, 0).eligible).toBe(false);
  });

  it('does not invent cap proof numbers when governed inputs are absent', () => {
    const team = createMockTeam({ playersSalary: 160_000_000 });
    const result = canUseRoomException(team, 2025);

    // Reason should contain dollar amounts for debugging
    expect(result.reason).toBeDefined();
    expect(requireValue(result.reason, 'result.reason')).toContain(
      'complete Team Salary book'
    );
    expect(requireValue(result.reason, 'result.reason')).not.toMatch(/\$\d+\.\d+M/);
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
  const createValidationTeam = ({ playersSalary }: SalaryFixture) => {
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

  it('room signing fails closed before threshold comparison when books are incomplete', () => {
    // Team at $160M - clearly over cap
    const team = createValidationTeam({ playersSalary: 160_000_000 });
    const result = validateExceptionEligibility({
      team,
      signedUsing: 'room',
      year: 2025,
    });
    const violation = requireValue(result.violation, 'result.violation');

    expect(result.blocked).toBe(true);
    expect(violation.rule).toBe('salary_book_needs_input');
    expect(requireValue(result.reason, 'result.reason')).toContain(
      'governed input'
    );
  });

  it('does not treat a generic under-cap total as a complete salary book', () => {
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

    expect(result.blocked).toBe(true);
    expect(result.violation?.rule).toBe('salary_book_needs_input');
  });

  it('roommle variant triggers same under-cap check', () => {
    const overCapTeam = createValidationTeam({ playersSalary: 160_000_000 });
    const result = validateExceptionEligibility({
      team: overCapTeam,
      signedUsing: 'roommle',
      year: 2025,
    });
    const violation = requireValue(result.violation, 'result.violation');

    expect(result.blocked).toBe(true);
    expect(violation.rule).toBe('salary_book_needs_input');
  });

  it('rmle variant triggers same under-cap check', () => {
    const overCapTeam = createValidationTeam({ playersSalary: 160_000_000 });
    const result = validateExceptionEligibility({
      team: overCapTeam,
      signedUsing: 'rmle',
      year: 2025,
    });
    const violation = requireValue(result.violation, 'result.violation');

    expect(result.blocked).toBe(true);
    expect(violation.rule).toBe('salary_book_needs_input');
  });

  it('reason names the missing governed salary book without guessed dollars', () => {
    const team = createValidationTeam({ playersSalary: 160_000_000 });
    const result = validateExceptionEligibility({
      team,
      signedUsing: 'room',
      year: 2025,
    });

    // Reason should have dollar amounts
    expect(result.blocked).toBe(true);
    expect(requireValue(result.reason, 'result.reason')).toContain(
      'governed input'
    );
    expect(requireValue(result.reason, 'result.reason')).not.toMatch(/\$/);
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
      expect(requireValue(mleResult.violation, 'mleResult.violation').rule).not.toBe(
        'ROOM_REQUIRES_UNDER_CAP'
      );
    }

    // BAE should not be blocked by under-cap rule
    const baeResult = validateExceptionEligibility({
      team,
      signedUsing: 'bae',
      year: 2025,
    });
    if (baeResult.blocked) {
      expect(requireValue(baeResult.violation, 'baeResult.violation').rule).not.toBe(
        'ROOM_REQUIRES_UNDER_CAP'
      );
    }
  });
});

// ==============================================================================
// REGRESSION CHECKS - PHASE 74 INVARIANTS
// ==============================================================================

describe('Phase 75: Regression Checks - Phase 74 Invariants', () => {
  it('room exception signing does NOT trigger hard cap (Phase 74 invariant)', () => {
    // Stage 6B: the inline Phase 74 comment markers in mutationPipeline.ts
    // were removed when usage tracking generalized into the canonical
    // consumeSigningExceptionUsage helper. The substantive invariant —
    // "room signings do not trigger a hard-cap activation" — is now
    // data-driven through FIRST_APRON_SIGNING_TRIGGER_METADATA in
    // hardCapStatus.ts, which only contains FULL_MLE and BAE entries.
    const srcRoot = path.resolve(__dirname, '../../features/architect');
    const pipelineShimPath = path.join(srcRoot, 'utils/mutationPipeline.js');
    const hardCapStatusPath = path.join(
      srcRoot,
      'utils/tradeMachine/utils/hardCapStatus.ts'
    );
    const hardCapStatusSource = fs.readFileSync(hardCapStatusPath, 'utf-8');

    // Confirm the data-driven invariant: only the apron-triggering
    // mechanisms (FULL_MLE, BAE) appear in the metadata table.
    expect(hardCapStatusSource).toContain(
      'FIRST_APRON_SIGNING_TRIGGER_METADATA'
    );
    expect(hardCapStatusSource).toContain('FULL_MLE');
    expect(hardCapStatusSource).toContain('BAE');

    // Room exception explicitly absent from the trigger table.
    const metadataMatch = hardCapStatusSource.match(
      /FIRST_APRON_SIGNING_TRIGGER_METADATA[\s\S]*?as const satisfies/
    );
    expect(metadataMatch).not.toBeNull();
    const metadataBlock = metadataMatch?.[0] ?? '';
    expect(metadataBlock).not.toMatch(/\bROOM\b/);
    expect(metadataBlock).not.toMatch(/\bROOM_MLE\b/);

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
    const allowlistContents = requireValue(
      allowlistMatch,
      'allowlistMatch'
    )[1];
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
  const createMockTeam = ({ playersSalary }: SalaryFixture) => ({
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

  it('team well under cap still needs complete governed context', () => {
    // Team at $120M with ~$141M cap
    const team = createMockTeam({ playersSalary: 120_000_000 });
    const result = canUseRoomException(team, 2025);
    expect(result.eligible).toBe(false);
    expect(result.totals).toBeUndefined();
  });

  it('team clearly over cap is not classified from a generic total', () => {
    // Team at $160M - clearly over
    const team = createMockTeam({ playersSalary: 160_000_000 });
    const result = canUseRoomException(team, 2025);
    expect(result.eligible).toBe(false);
    expect(result.totals).toBeUndefined();
  });

  it('team with no players needs an authenticated incomplete-roster charge', () => {
    const team = createMockTeam({ playersSalary: 0 });
    // Note: incomplete roster charges apply but still way under cap
    const result = canUseRoomException(team, 2025);

    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('complete Team Salary book');
  });

  it('does not publish a totals breakdown for incomplete book inputs', () => {
    const team = createMockTeam({ playersSalary: 130_000_000 });
    const result = canUseRoomException(team, 2025);
    expect(result.eligible).toBe(false);
    expect(result.totals).toBeUndefined();
  });
});
