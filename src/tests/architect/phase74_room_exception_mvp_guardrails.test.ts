/**
 * FILE: src/tests/architect/phase74_room_exception_mvp_guardrails.test.js
 * PURPOSE: Phase 74 guardrails for Room Exception MVP - tracking, validation, persistence, reload proof
 * OWNERSHIP: Feature: architect/cap-sheet
 *
 * HISTORY:
 *  - 2026-02-01: Phase 74 - Created for Room Exception MVP Completion
 *
 * LINKS:
 *  - Master Doc: docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
 *  - Plan: Phase 74 execution prompt
 *
 * TESTS:
 * 1. Source scan: room exception referenced in signing validation layer
 * 2. Behavioral: signing blocked when room exception not available (apron status)
 * 3. Behavioral: signing blocked when amount exceeds room exception max
 * 4. Behavioral: signing succeeds and updates usedAmount/remainingAmount
 * 5. Persistence: verify exceptions.room shape, no legacy tradeExceptions
 * 6. Reload proof: mutation → persist → reload → assert usage remains correct
 */

import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  validateSigning,
  validateExceptionEligibility,
  HARD_BLOCK_RULES,
  getOverridePolicy,
} from '@/features/architect/utils/capLegalityValidation';
import { computeWorldMutation } from '@/features/architect/utils/mutationPipeline';
import { capProjections } from '@/features/architect/utils/capProjections';

vi.mock(
  '@/features/architect/utils/capTotals/computeTeamCapTotals',
  async (importOriginal) => {
    const actual = (await importOriginal()) as Record<string, unknown>;
    return {
      ...actual,
      computeTeamCapTotals: vi.fn((team) => ({
        totalCapAllocations:
          team?.totals?.capHit ??
          team?.totals?.totalSalary ??
          team?.totals?.totalCapAllocations ??
          0,
      })),
    };
  }
);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==============================================================================
// TEST HELPERS
// ==============================================================================

const YEAR = 2026; // 2025-26 season
const CAP = capProjections['2025-26'];
const SALARY_CAP = CAP.cap;
const FIRST_APRON = CAP.firstApron;
const SECOND_APRON = CAP.secondApron;

type RoomExceptionOptions = {
  enabled?: boolean;
  totalAmount?: number;
  usedAmount?: number;
  remainingAmount?: number;
};

type ComputeWorldMutationArgs = Parameters<typeof computeWorldMutation>[0];
type SignFreeAgentMutationArgs = Extract<
  ComputeWorldMutationArgs,
  { mutationType: 'signFreeAgent' }
>;
type MutationCurrentState = SignFreeAgentMutationArgs['currentState'];
type CurrentStateTeam = NonNullable<MutationCurrentState['team']>;
type ExceptionEligibilityTeam = Parameters<typeof validateExceptionEligibility>[0]['team'];
type SigningValidationTeam = Parameters<typeof validateSigning>[0]['team'];

type RoomExceptionTeam = CurrentStateTeam & {
  teamCode: string;
  teamName: string;
  players: unknown[];
  roster: unknown[];
  capHolds: unknown[];
  deadCap: CurrentStateTeam['deadCap'];
  exceptions: NonNullable<CurrentStateTeam['exceptions']> & {
    room: {
      enabled: boolean;
      totalAmount: number;
      usedAmount: number;
      remainingAmount: number;
      seasonKey: string;
    };
  };
  totals: NonNullable<CurrentStateTeam['totals']> & {
    capHit: number;
    totalSalary: number;
    totalCapAllocations: number;
    isHardCapped?: boolean;
    hardCapLevel?: string | null;
    hardCapDetail?: string | null;
  };
};

const asCurrentState = (value: unknown) => value as MutationCurrentState;

function requireValue<T>(value: T | null | undefined, message: string): T {
  expect(value, message).toBeDefined();

  if (value == null) {
    throw new Error(message);
  }

  return value;
}

function getUpdatedTeam(
  result: ReturnType<typeof computeWorldMutation>,
  message: string
) {
  return requireValue(result.teamUpdates?.[0]?.team, message);
}

/**
 * Creates a mock team with the specified cap hit and optional room exception.
 */
function createTeamWithRoomException(
  capHit: number,
  roomExceptionOptions: RoomExceptionOptions = {}
): RoomExceptionTeam {
  const {
    enabled = true,
    totalAmount = CAP.roomMLE || 8_000_000,
    usedAmount = 0,
    remainingAmount = totalAmount - usedAmount,
  } = roomExceptionOptions;

  return {
    teamCode: 'TST',
    teamName: 'Test Team',
    players: [],
    roster: [],
    capHolds: [],
    deadCap: [] as CurrentStateTeam['deadCap'],
    exceptions: {
      room: {
        enabled,
        totalAmount,
        usedAmount,
        remainingAmount,
        seasonKey: '2025-26',
      },
    },
    totals: {
      capHit,
      totalSalary: capHit,
      totalCapAllocations: capHit,
    },
  };
}

/**
 * Creates a mock contract.
 */
function createContract(salary = 5_000_000, totalValue: number | null = null) {
  return {
    contractType: 'Standard',
    totalValue: totalValue ?? salary,
    salariesByYear: [{ season: '2025-26', salary, capHit: salary }],
    startSeason: '2025-26',
    endSeason: '2025-26',
    contractLength: 1,
  };
}

// ==============================================================================
// SOURCE SCAN GUARDRAILS
// ==============================================================================

describe('Phase 74: Room Exception Source Scan Guardrails', () => {
  const capLegalityAuthorityPath = path.resolve(
    __dirname,
    '../../features/architect/utils/capLegalityValidation.ts'
  );
  // Room exception blocking logic moved to signing.ts submodule (Wave 4 Step 2c)
  const capLegalitySigningPath = path.resolve(
    __dirname,
    '../../features/architect/utils/capLegalityValidation/signing.ts'
  );
  const mutationPipelinePath = path.resolve(
    __dirname,
    '../../features/architect/utils/mutationPipeline.ts'
  );

  it('TEST 1: capLegalityValidation.ts contains room exception blocking logic', () => {
    // Stage 6B: signing.ts was further split into
    // capLegalityValidation/signing.validators.ts; the room-blocking
    // logic lives there alongside the rest of the canonical exception
    // validators. Scan both files so the invariant remains findable.
    const validatorsPath = path.resolve(
      __dirname,
      '../../features/architect/utils/capLegalityValidation/signing.validators.ts'
    );
    const content =
      fs.readFileSync(capLegalitySigningPath, 'utf8') +
      fs.readFileSync(validatorsPath, 'utf8');

    // Must contain room exception variants in blocked exceptions
    expect(content).toContain("'room'");
    expect(content).toContain("'roommle'");
    expect(content).toContain("'rmle'");

    // Must contain room exception blocking message
    expect(content).toContain('Room Exception unavailable above first apron');
  });

  it('TEST 2: mutationPipeline.ts contains room exception usage tracking', () => {
    // Wave 4 Step 4d: room exception tracking moved to
    // mutationPipeline.compute.ts. Wave 8 Step 2: further extracted to
    // mutationPipeline.compute.signings.ts. Stage 6B: a later wave
    // generalized usage tracking into consumeSigningExceptionUsage in
    // mutationPipeline.compute.signings.signing.ts, which dispatches by
    // canonical exception key (covering 'room', 'mle', 'bae', 'tpe',
    // etc.) rather than special-casing 'room' inline. Verify the
    // generic canonical-key tracker still drives room exception state.
    const computePath = mutationPipelinePath.replace('mutationPipeline.ts', 'mutationPipeline.compute.ts');
    const signingsPath = mutationPipelinePath.replace('mutationPipeline.ts', 'mutationPipeline.compute.signings.ts');
    const signingsSigningPath = mutationPipelinePath.replace('mutationPipeline.ts', 'mutationPipeline.compute.signings.signing.ts');
    const content =
      fs.readFileSync(mutationPipelinePath, 'utf8') +
      fs.readFileSync(computePath, 'utf8') +
      fs.readFileSync(signingsPath, 'utf8') +
      fs.readFileSync(signingsSigningPath, 'utf8');

    // Canonical usage-tracking entrypoint must still exist.
    expect(content).toContain('consumeSigningExceptionUsage');

    // The tracker must continue to mutate the exception's usedAmount
    // and remainingAmount fields canonically (the substantive Phase 74
    // invariant) when a contract value is consumed.
    expect(content).toMatch(/normalizedState\.usedAmount\s*=/);
    expect(content).toMatch(/normalizedState\.remainingAmount\s*=/);

    // And the canonical 'room' exception key must still resolve through
    // the canonical-key dispatch (Room MLE signings still update the
    // 'room' canonical entry).
    expect(content).toContain("'room'");
  });

  it('TEST 3: exception_blocked is a HARD_BLOCK rule', () => {
    expect(HARD_BLOCK_RULES).toContain('exception_blocked');
  });
});

// ==============================================================================
// VALIDATION BEHAVIORAL GUARDRAILS
// ==============================================================================

describe('Phase 74: Room Exception Validation Behavioral Guardrails', () => {
  describe('validateExceptionEligibility - Room Exception Blocking', () => {
    it('TEST 4: Room exception blocked when team is above second apron', () => {
      const team = createTeamWithRoomException(SECOND_APRON + 1_000_000);

      const result = validateExceptionEligibility({
        team: team as ExceptionEligibilityTeam,
        signedUsing: 'Room MLE',
        year: YEAR,
      });

      const violation = requireValue(
        result.violation,
        'Expected room exception block above second apron'
      );

      expect(result.blocked).toBe(true);
      expect(violation.rule).toBe('exception_blocked');
      expect(violation.message).toContain('second apron');
    });

    it('TEST 5: Room exception blocked when team is above first apron', () => {
      // Team above first apron but below second apron
      const team = createTeamWithRoomException(FIRST_APRON + 1_000_000);

      const result = validateExceptionEligibility({
        team: team as ExceptionEligibilityTeam,
        signedUsing: 'room',
        year: YEAR,
      });

      const violation = requireValue(
        result.violation,
        'Expected room exception block above first apron'
      );

      expect(result.blocked).toBe(true);
      expect(violation.rule).toBe('exception_blocked');
      expect(violation.message).toContain('Room Exception');
      expect(violation.message).toContain('above first apron');
    });

    it('TEST 6: Room exception allowed when team is under cap (below first apron)', () => {
      const team = createTeamWithRoomException(SALARY_CAP - 10_000_000);

      const result = validateExceptionEligibility({
        team: team as ExceptionEligibilityTeam,
        signedUsing: 'Room MLE',
        year: YEAR,
      });

      expect(result.blocked).toBe(false);
      expect(result.violation).toBeNull();
    });

    it('TEST 7: validateExceptionEligibility recognizes all room exception name variants', () => {
      const team = createTeamWithRoomException(FIRST_APRON + 500_000);

      const variants = ['room', 'Room MLE', 'ROOM_MLE', 'roommle', 'rmle'];

      for (const variant of variants) {
        const result = validateExceptionEligibility({
          team: team as ExceptionEligibilityTeam,
          signedUsing: variant,
          year: YEAR,
        });

        expect(result.blocked).toBe(true);
        expect(
          requireValue(
            result.violation,
            `Expected room exception block for variant ${variant}`
          ).rule
        ).toBe('exception_blocked');
      }
    });
  });

  describe('validateSigning - Room Exception Integration', () => {
    it('TEST 8: validateSigning blocks room exception signing above first apron (hard block)', () => {
      const team = createTeamWithRoomException(FIRST_APRON + 500_000);

      const result = validateSigning({
        team: team as SigningValidationTeam,
        player: { player_id: 'p1', displayName: 'Test Player' },
        contract: createContract(5_000_000),
        signedUsing: 'Room MLE',
        year: YEAR,
      });

      expect(result.valid).toBe(false);
      expect(
        result.violations.some((v) => v.rule === 'exception_blocked')
      ).toBe(true);

      // Verify it's a hard block
      const policy = getOverridePolicy(result.violations, result.warnings);
      expect(policy.hasHardBlock).toBe(true);
      expect(policy.canOverride).toBe(false);
    });

    it('TEST 9: validateSigning allows room exception signing when under cap', () => {
      const team = createTeamWithRoomException(SALARY_CAP - 20_000_000);

      const result = validateSigning({
        team: team as SigningValidationTeam,
        player: { player_id: 'p1', displayName: 'Test Player' },
        contract: createContract(5_000_000),
        signedUsing: 'Room MLE',
        year: YEAR,
      });

      // Should not have exception_blocked violation
      const hasExceptionBlocked = result.violations.some(
        (v) => v.rule === 'exception_blocked'
      );
      expect(hasExceptionBlocked).toBe(false);
    });
  });
});

// ==============================================================================
// MUTATION PIPELINE BEHAVIORAL GUARDRAILS
// ==============================================================================

describe('Phase 74: Room Exception Mutation Pipeline Guardrails', () => {
  it('TEST 10: computeSigningResult updates room exception usedAmount on signing', () => {
    const initialRoomAmount = 8_000_000;
    const signingValue = 3_000_000;

    const team = createTeamWithRoomException(SALARY_CAP - 20_000_000, {
      totalAmount: initialRoomAmount,
      usedAmount: 0,
      remainingAmount: initialRoomAmount,
    });

    const result = computeWorldMutation({
      mutationType: 'signFreeAgent',
      payload: {
        teamCode: 'TST',
        playerId: 'new_player_1',
        contract: createContract(signingValue, signingValue),
        signedUsing: 'room',
      },
      currentState: asCurrentState({
        team,
        player: { player_id: 'new_player_1', displayName: 'New Player' },
        teamCode: 'TST',
      }),
      seasonId: '2025-26',
      timestamp: Date.now(),
    });

    expect(result.success).toBe(true);

    const updatedRoom = requireValue(
      getUpdatedTeam(result, 'Expected updated team for room signing test')
        .exceptions?.room,
      'Expected room exception after room signing test'
    );
    expect(updatedRoom.usedAmount).toBe(signingValue);
    expect(updatedRoom.remainingAmount).toBe(
      initialRoomAmount - signingValue
    );
  });

  it('TEST 11: computeSigningResult handles room exception with "Room MLE" string', () => {
    const initialRoomAmount = 8_000_000;
    const signingValue = 4_000_000;

    const team = createTeamWithRoomException(SALARY_CAP - 20_000_000, {
      totalAmount: initialRoomAmount,
      usedAmount: 0,
      remainingAmount: initialRoomAmount,
    });

    const result = computeWorldMutation({
      mutationType: 'signFreeAgent',
      payload: {
        teamCode: 'TST',
        playerId: 'new_player_2',
        contract: createContract(signingValue, signingValue),
        signedUsing: 'Room MLE',
      },
      currentState: asCurrentState({
        team,
        player: { player_id: 'new_player_2', displayName: 'New Player 2' },
        teamCode: 'TST',
      }),
      seasonId: '2025-26',
      timestamp: Date.now(),
    });

    expect(result.success).toBe(true);

    const updatedTeam = getUpdatedTeam(
      result,
      'Expected updated team for Room MLE string test'
    );
    // "Room MLE" lowercased is "room mle" which should match
    expect(
      requireValue(
        updatedTeam.exceptions?.room,
        'Expected room exception for Room MLE string test'
      ).usedAmount
    ).toBe(signingValue);
  });

  it('TEST 12: Room exception signing does NOT trigger hard cap', () => {
    const team = createTeamWithRoomException(SALARY_CAP - 10_000_000, {
      totalAmount: 8_000_000,
    });

    // Ensure team is not hard capped initially
    team.totals.isHardCapped = false;
    team.totals.hardCapLevel = null;

    const result = computeWorldMutation({
      mutationType: 'signFreeAgent',
      payload: {
        teamCode: 'TST',
        playerId: 'new_player_3',
        contract: createContract(5_000_000, 5_000_000),
        signedUsing: 'room',
      },
      currentState: asCurrentState({
        team,
        player: { player_id: 'new_player_3', displayName: 'New Player 3' },
        teamCode: 'TST',
      }),
      seasonId: '2025-26',
      timestamp: Date.now(),
    });

    expect(result.success).toBe(true);

    const updatedTeam = getUpdatedTeam(
      result,
      'Expected updated team for hard-cap detail room test'
    );
    // Room exception should NOT trigger hard cap
    // (hardCapLevel may be set by other logic, but not by room exception usage)
    expect(updatedTeam.totals?.hardCapDetail).not.toBe(
      'Triggered by Room Exception'
    );
  });

  it('TEST 13: Multiple room exception signings accumulate usedAmount correctly', () => {
    const initialRoomAmount = 8_000_000;

    const team = createTeamWithRoomException(SALARY_CAP - 20_000_000, {
      totalAmount: initialRoomAmount,
      usedAmount: 2_000_000, // Already used 2M
      remainingAmount: initialRoomAmount - 2_000_000,
    });

    const newSigningValue = 3_000_000;

    const result = computeWorldMutation({
      mutationType: 'signFreeAgent',
      payload: {
        teamCode: 'TST',
        playerId: 'new_player_4',
        contract: createContract(newSigningValue, newSigningValue),
        signedUsing: 'room',
      },
      currentState: asCurrentState({
        team,
        player: { player_id: 'new_player_4', displayName: 'New Player 4' },
        teamCode: 'TST',
      }),
      seasonId: '2025-26',
      timestamp: Date.now(),
    });

    expect(result.success).toBe(true);

    const updatedTeam = getUpdatedTeam(
      result,
      'Expected updated team for accumulated room usage test'
    );
    // Should accumulate: 2M existing + 3M new = 5M used
    expect(
      requireValue(
        updatedTeam.exceptions?.room,
        'Expected room exception for accumulated room usage test'
      ).usedAmount
    ).toBe(
      2_000_000 + newSigningValue
    );
    expect(
      requireValue(
        updatedTeam.exceptions?.room,
        'Expected room exception for accumulated room usage test'
      ).remainingAmount
    ).toBe(
      initialRoomAmount - 2_000_000 - newSigningValue
    );
  });
});

// ==============================================================================
// PERSISTENCE SHAPE GUARDRAILS
// ==============================================================================

describe('Phase 74: Room Exception Persistence Shape Guardrails', () => {
  it('TEST 14: Room exception persists under canonical exceptions.room path', () => {
    const team = createTeamWithRoomException(SALARY_CAP - 10_000_000);

    const result = computeWorldMutation({
      mutationType: 'signFreeAgent',
      payload: {
        teamCode: 'TST',
        playerId: 'new_player_5',
        contract: createContract(4_000_000, 4_000_000),
        signedUsing: 'room',
      },
      currentState: asCurrentState({
        team,
        player: { player_id: 'new_player_5', displayName: 'New Player 5' },
        teamCode: 'TST',
      }),
      seasonId: '2025-26',
      timestamp: Date.now(),
    });

    expect(result.success).toBe(true);

    const updatedTeam = getUpdatedTeam(
      result,
      'Expected updated team for persistence shape test'
    );
    const updatedRoom = requireValue(
      updatedTeam.exceptions?.room,
      'Expected room exception for persistence shape test'
    );

    // Verify canonical structure
    expect(updatedTeam.exceptions).toBeDefined();
    expect(updatedRoom).toBeDefined();
    expect(typeof updatedRoom.usedAmount).toBe('number');
    expect(typeof updatedRoom.remainingAmount).toBe('number');
  });

  it('TEST 15: Result does NOT contain legacy tradeExceptions field', () => {
    const team = createTeamWithRoomException(SALARY_CAP - 10_000_000);

    const result = computeWorldMutation({
      mutationType: 'signFreeAgent',
      payload: {
        teamCode: 'TST',
        playerId: 'new_player_6',
        contract: createContract(3_000_000, 3_000_000),
        signedUsing: 'room',
      },
      currentState: asCurrentState({
        team,
        player: { player_id: 'new_player_6', displayName: 'New Player 6' },
        teamCode: 'TST',
      }),
      seasonId: '2025-26',
      timestamp: Date.now(),
    });

    expect(result.success).toBe(true);

    const updatedTeam = getUpdatedTeam(
      result,
      'Expected updated team for legacy tradeExceptions absence test'
    );

    // Legacy field should NOT exist
    expect(updatedTeam.tradeExceptions).toBeUndefined();
  });
});

// ==============================================================================
// RELOAD PROOF GUARDRAILS (Simulated)
// ==============================================================================

describe('Phase 74: Room Exception Reload Proof Guardrails', () => {
  it('TEST 16: Room exception usage survives serialize/deserialize cycle', () => {
    const team = createTeamWithRoomException(SALARY_CAP - 15_000_000, {
      totalAmount: 8_000_000,
      usedAmount: 0,
      remainingAmount: 8_000_000,
    });

    // Apply signing mutation
    const signingResult = computeWorldMutation({
      mutationType: 'signFreeAgent',
      payload: {
        teamCode: 'TST',
        playerId: 'reload_player_1',
        contract: createContract(2_500_000, 2_500_000),
        signedUsing: 'room',
      },
      currentState: asCurrentState({
        team,
        player: { player_id: 'reload_player_1', displayName: 'Reload Player' },
        teamCode: 'TST',
      }),
      seasonId: '2025-26',
      timestamp: Date.now(),
    });

    expect(signingResult.success).toBe(true);

    const mutatedTeam = getUpdatedTeam(
      signingResult,
      'Expected updated team for reload serialization test'
    );

    // Simulate Firestore persist/reload via JSON serialization
    const serialized = JSON.stringify(mutatedTeam);
    const reloaded = JSON.parse(serialized);

    // Verify room exception usage is preserved after reload
    expect(reloaded.exceptions.room.usedAmount).toBe(2_500_000);
    expect(reloaded.exceptions.room.remainingAmount).toBe(
      8_000_000 - 2_500_000
    );
    expect(reloaded.exceptions.room.totalAmount).toBe(8_000_000);
  });

  it('TEST 17: Sequential room exception signings accumulate correctly after simulated reload', () => {
    // Initial team
    let team = createTeamWithRoomException(SALARY_CAP - 20_000_000, {
      totalAmount: 8_000_000,
      usedAmount: 0,
      remainingAmount: 8_000_000,
    });

    // First signing
    const result1 = computeWorldMutation({
      mutationType: 'signFreeAgent',
      payload: {
        teamCode: 'TST',
        playerId: 'seq_player_1',
        contract: createContract(2_000_000, 2_000_000),
        signedUsing: 'room',
      },
      currentState: asCurrentState({
        team,
        player: { player_id: 'seq_player_1', displayName: 'Seq Player 1' },
        teamCode: 'TST',
      }),
      seasonId: '2025-26',
      timestamp: Date.now(),
    });

    expect(result1.success).toBe(true);

    // Simulate reload
    team = JSON.parse(
      JSON.stringify(
        getUpdatedTeam(
          result1,
          'Expected updated team for first sequential room signing'
        )
      )
    );

    // Second signing using reloaded team
    const result2 = computeWorldMutation({
      mutationType: 'signFreeAgent',
      payload: {
        teamCode: 'TST',
        playerId: 'seq_player_2',
        contract: createContract(3_000_000, 3_000_000),
        signedUsing: 'room',
      },
      currentState: asCurrentState({
        team,
        player: { player_id: 'seq_player_2', displayName: 'Seq Player 2' },
        teamCode: 'TST',
      }),
      seasonId: '2025-26',
      timestamp: Date.now(),
    });

    expect(result2.success).toBe(true);

    const finalTeam = getUpdatedTeam(
      result2,
      'Expected updated team for second sequential room signing'
    );

    // Total used should be 2M + 3M = 5M
    expect(
      requireValue(
        finalTeam.exceptions?.room,
        'Expected room exception after sequential room signings'
      ).usedAmount
    ).toBe(5_000_000);
    expect(
      requireValue(
        finalTeam.exceptions?.room,
        'Expected room exception after sequential room signings'
      ).remainingAmount
    ).toBe(3_000_000);
  });
});
