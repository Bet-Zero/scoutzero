import { describe, it, expect, vi } from 'vitest';
import { validateExceptionEligibility } from '../../features/architect/utils/capLegalityValidation';

// Mock getCapRulesForYear to return stable values
vi.mock('../../features/architect/utils/capRulesProfile', () => ({
  getCapRulesForYear: vi.fn(() => ({
    cap: {
      salaryCap: 140_000_000,
      firstApron: 178_000_000,
      secondApron: 190_000_000,
    },
    // Mock minimal exceptions object if needed by other internal calls
    exceptions: {
        taxpayerMLE: 5_000_000,
    }
  })),
}));

// Mock getHardCapStatus to control hard cap logic explicitly
vi.mock('../../features/architect/utils/hardCapUtils', () => ({
  getHardCapStatus: vi.fn((team, rules) => {
    const total = team.totals?.capHit || 0;
    // Strict hard cap logic (Plan 38)
    if (total > rules.cap.secondApron) {
      return { isHardCapped: true, hardCapLevel: 'secondApron', ceiling: rules.cap.secondApron };
    }
    return { isHardCapped: false, hardCapLevel: null, ceiling: null };
  }),
}));

vi.mock(
  '../../features/architect/utils/capTotals/computeTeamCapTotals',
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

describe('Phase 39: Second Apron Exact Boundary Guardrails', () => {
  const SECOND_APRON = 190_000_000;

  it('should ALLOW Taxpayer MLE when team is EXACTLY at Second Apron (Strict >)', () => {
    // Team has exactly 190M
    const team = {
      totals: { capHit: SECOND_APRON, totalSalary: SECOND_APRON },
    };

    const result = validateExceptionEligibility({
      team,
      signedUsing: 'TPMLE', // Taxpayer MLE
      year: 2025,
    });

    // Should NOT be blocked by "Second Apron teams cannot use exceptions"
    // Because 190M is NOT > 190M
    expect(result.blocked).toBe(false);
  });

  it('should BLOCK Taxpayer MLE when team is $1 OVER Second Apron', () => {
    // Team has 190M + 1
    const team = {
      totals: { capHit: SECOND_APRON + 1, totalSalary: SECOND_APRON + 1 },
    };

    const result = validateExceptionEligibility({
      team,
      signedUsing: 'TPMLE', // Taxpayer MLE
      year: 2025,
    });

    // Should BE blocked
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('Second apron teams cannot use exceptions');
  });
});
