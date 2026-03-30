import { describe, it, expect, vi } from 'vitest';
import {
  validateSigning,
  HARD_BLOCK_RULES,
  getOverridePolicy,
} from '@/features/architect/utils/capLegalityValidation';
import capProjections from '@/features/architect/utils/capProjections';

vi.mock(
  '@/features/architect/utils/capTotals/computeTeamCapTotals',
  async (importOriginal) => {
    const actual = await importOriginal();
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

describe('validateSigning - Post-Apron Exception Blocking (G0-2)', () => {
  const YEAR = 2025; // 2024-25 season
  // Use capProjections as that's what getCapSettingsForYear uses
  const CAP = capProjections['2024-25'];
  const SALARY_CAP = CAP.cap;
  const FIRST_APRON = CAP.firstApron;
  const SECOND_APRON = CAP.secondApron;

  /**
   * Creates a mock team with the specified cap hit.
   */
  function createTeamWithCapHit(capHit, options = {}) {
    const { isHardCapped = false, hardCapLevel = null } = options;
    return {
      teamCode: 'TST',
      players: [],
      capHolds: [],
      totals: {
        capHit,
        totalSalary: capHit,
        totalCapAllocations: capHit,
        isHardCapped,
        hardCapLevel,
      },
    };
  }

  /**
   * Creates a mock contract.
   */
  function createContract(salary = 5_000_000) {
    return {
      contractType: 'Standard',
      salariesByYear: [{ season: '2024-25', salary }],
    };
  }

  describe('exception_blocked is in HARD_BLOCK_RULES', () => {
    it('should include exception_blocked in hard block rules', () => {
      expect(HARD_BLOCK_RULES).toContain('exception_blocked');
    });
  });

  describe('Second Apron Exception Blocking', () => {
    it('Case A: Team above second apron CANNOT use MLE (HARD BLOCK)', () => {
      const team = createTeamWithCapHit(SECOND_APRON + 1_000_000);
      const result = validateSigning({
        team,
        player: { player_id: 'p1' },
        contract: createContract(),
        signedUsing: 'MLE',
        year: YEAR,
      });

      expect(result.valid).toBe(false);
      expect(result.violations.some(v => v.rule === 'exception_blocked')).toBe(true);
      expect(result.violations.some(v => v.message.includes('second apron'))).toBe(true);

      // Verify it's a hard block
      const policy = getOverridePolicy(result.violations, result.warnings);
      expect(policy.hasHardBlock).toBe(true);
      expect(policy.canOverride).toBe(false);
    });

    it('Case B: Team above second apron CANNOT use BAE (HARD BLOCK)', () => {
      const team = createTeamWithCapHit(SECOND_APRON + 500_000);
      const result = validateSigning({
        team,
        player: { player_id: 'p1' },
        contract: createContract(),
        signedUsing: 'BAE',
        year: YEAR,
      });

      expect(result.valid).toBe(false);
      expect(result.violations.some(v => v.rule === 'exception_blocked')).toBe(true);
    });

    it('Case C: Team above second apron CANNOT use TPE (HARD BLOCK)', () => {
      const team = createTeamWithCapHit(SECOND_APRON + 100_000);
      const result = validateSigning({
        team,
        player: { player_id: 'p1' },
        contract: createContract(),
        signedUsing: 'TPE',
        year: YEAR,
      });

      expect(result.valid).toBe(false);
      expect(result.violations.some(v => v.rule === 'exception_blocked')).toBe(true);
    });

    it('Case D: Team above second apron CANNOT use Taxpayer MLE', () => {
      const team = createTeamWithCapHit(SECOND_APRON + 1_000_000);
      const result = validateSigning({
        team,
        player: { player_id: 'p1' },
        contract: createContract(),
        signedUsing: 'TPMLE',
        year: YEAR,
      });

      expect(result.valid).toBe(false);
      expect(result.violations.some(v => v.rule === 'exception_blocked')).toBe(true);
    });
  });

  describe('First Apron Exception Blocking', () => {
    it('Case E: Team above first apron but NOT hard-capped CANNOT use NTMLE', () => {
      const team = createTeamWithCapHit(FIRST_APRON + 1_000_000);
      const result = validateSigning({
        team,
        player: { player_id: 'p1' },
        contract: createContract(),
        signedUsing: 'Full MLE',
        year: YEAR,
      });

      expect(result.valid).toBe(false);
      expect(result.violations.some(v => v.rule === 'exception_blocked')).toBe(true);
      expect(result.violations.some(v => v.message.includes('first apron'))).toBe(true);
    });

    it('Case F: Team above first apron but NOT hard-capped CANNOT use BAE', () => {
      const team = createTeamWithCapHit(FIRST_APRON + 500_000);
      const result = validateSigning({
        team,
        player: { player_id: 'p1' },
        contract: createContract(),
        signedUsing: 'BAE',
        year: YEAR,
      });

      expect(result.valid).toBe(false);
      expect(result.violations.some(v => v.rule === 'exception_blocked')).toBe(true);
    });

    it('Case G: Team above first apron CAN use Taxpayer MLE (not blocked)', () => {
      // Team is between first and second apron
      const team = createTeamWithCapHit(FIRST_APRON + 1_000_000);
      const result = validateSigning({
        team,
        player: { player_id: 'p1' },
        contract: createContract(2_000_000),
        signedUsing: 'Taxpayer MLE',
        year: YEAR,
      });

      // Should not have exception_blocked violation for TPMLE between aprons
      const hasExceptionBlock = result.violations.some(v => v.rule === 'exception_blocked');
      expect(hasExceptionBlock).toBe(false);
    });

    it('Case H: First apron hard-capped team CANNOT use BAE', () => {
      const team = createTeamWithCapHit(FIRST_APRON - 1_000_000, {
        isHardCapped: true,
        hardCapLevel: 'firstApron',
      });
      const result = validateSigning({
        team,
        player: { player_id: 'p1' },
        contract: createContract(),
        signedUsing: 'BAE',
        year: YEAR,
      });

      expect(result.valid).toBe(false);
      expect(result.violations.some(v => v.rule === 'exception_blocked')).toBe(true);
      expect(result.violations.some(v => v.message.includes('hard-capped'))).toBe(true);
    });
  });

  describe('Allowed Exception Usage', () => {
    it('Case I: Team below first apron CAN use MLE (no block)', () => {
      const team = createTeamWithCapHit(FIRST_APRON - 5_000_000);
      const result = validateSigning({
        team,
        player: { player_id: 'p1' },
        contract: createContract(),
        signedUsing: 'MLE',
        year: YEAR,
      });

      const hasExceptionBlock = result.violations.some(v => v.rule === 'exception_blocked');
      expect(hasExceptionBlock).toBe(false);
    });

    it('Case J: Team below first apron CAN use BAE (no block)', () => {
      const team = createTeamWithCapHit(FIRST_APRON - 10_000_000);
      const result = validateSigning({
        team,
        player: { player_id: 'p1' },
        contract: createContract(2_000_000),
        signedUsing: 'BAE',
        year: YEAR,
      });

      const hasExceptionBlock = result.violations.some(v => v.rule === 'exception_blocked');
      expect(hasExceptionBlock).toBe(false);
    });

    it('Case K: Signing with no exception (null) is allowed', () => {
      const team = createTeamWithCapHit(SECOND_APRON + 1_000_000);
      const result = validateSigning({
        team,
        player: { player_id: 'p1' },
        contract: createContract(1_000_000),
        signedUsing: null,
        year: YEAR,
      });

      const hasExceptionBlock = result.violations.some(v => v.rule === 'exception_blocked');
      expect(hasExceptionBlock).toBe(false);
    });

    it('Case L: Signing with minimum salary (no exception) is allowed above second apron', () => {
      const team = createTeamWithCapHit(SECOND_APRON + 5_000_000);
      const result = validateSigning({
        team,
        player: { player_id: 'p1' },
        contract: createContract(1_119_563), // Minimum salary
        signedUsing: '', // No exception
        year: YEAR,
      });

      const hasExceptionBlock = result.violations.some(v => v.rule === 'exception_blocked');
      expect(hasExceptionBlock).toBe(false);
    });
  });

  describe('Override Policy Integration', () => {
    it('exception_blocked violations cannot be overridden', () => {
      const team = createTeamWithCapHit(SECOND_APRON + 1_000_000);
      const result = validateSigning({
        team,
        player: { player_id: 'p1' },
        contract: createContract(),
        signedUsing: 'MLE',
        year: YEAR,
      });

      const policy = getOverridePolicy(result.violations, result.warnings);
      expect(policy.hasHardBlock).toBe(true);
      expect(policy.canOverride).toBe(false);
      expect(policy.hardBlockReasons.length).toBeGreaterThan(0);
    });
  });
});
