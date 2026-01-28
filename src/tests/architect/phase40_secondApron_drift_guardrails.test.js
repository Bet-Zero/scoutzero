
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildRuleContextForPlayerMove } from '../../features/architect/utils/buildRuleContext';
import { validateSigning } from '../../features/architect/utils/capLegalityValidation';
import { canUseFaException } from '../../features/architect/utils/faExceptionUtils';
import { isFrozenPick } from '../../features/architect/utils/draftPickUtils';

// Mock capHelpers
vi.mock('../../features/architect/utils/capHelpers', () => ({
  getCapForSeason: vi.fn(),
  hasCapDataForSeason: vi.fn(() => true),
  getSupportedSeasonRange: vi.fn(() => ({ earliest: '2024-25', latest: '2028-29' })),
  // Add other helpers if needed
  getCapSettings: vi.fn(() => ({
    cap: { salaryCap: 140e6, firstApron: 178e6, secondApron: 190e6 },
    exceptions: { fullMLE: 12e6, taxpayerMLE: 5e6, roomMLE: 8e6, bae: 4e6 }
  })),
  calculateTeamCapHit: vi.fn(),
  getPlayerId: vi.fn(),
  getPlayerName: vi.fn(),
}));

// Mock salaryEngine
vi.mock('../../features/architect/utils/salaryEngine', () => ({
  getYearsOfService: vi.fn(() => 5),
  buildRuleContextForPlayerMove: vi.fn(), // If needed
  getSalaryProfile: vi.fn(),
}));

// Mock seasonHelpers
vi.mock('../../features/architect/utils/seasonHelpers', () => ({
  isValidSeasonId: vi.fn(() => true),
  parseSeasonId: vi.fn(() => ({ startYear: 2025, endYear: 2026 })),
  prevSeason: vi.fn(() => '2024-25'),
  getCurrentSeasonId: vi.fn(() => '2025-26'),
  normalizeToSeasonId: vi.fn((s) => s),
  makeSeasonIdFromEndYear: vi.fn(() => '2025-26'),
}));

// Mock capRulesProfile
vi.mock('../../features/architect/utils/capRulesProfile', () => ({
  getCapRulesForYear: vi.fn(() => ({
    cap: { salaryCap: 140e6, firstApron: 178e6, secondApron: 190e6 },
    exceptions: { fullMLE: 12e6, taxpayerMLE: 5e6, roomMLE: 8e6, bae: 4e6 },
    roster: { maxStandard: 15, maxTwoWay: 3 },
    salaries: {
      getMinimumForYOS: vi.fn(() => 1_100_000), // Mock 1.1M minimum
    },
    _meta: { sourcesSummary: 'real' } // Pass data confidence
  })),
}));

// Mock capTotals/computeTeamCapTotals - this is used by validateSigning if not fully mocked/isolated,
// but validateSigning might assume inputs are passed in.
// Actually validateSigning imports computeTeamCapTotals.
vi.mock('../../features/architect/utils/capTotals/computeTeamCapTotals', () => ({
  computeTeamCapTotals: vi.fn(),
}));

// Mock playerRulesProfile
vi.mock('../../features/architect/utils/playerRulesProfile/index.js', () => ({
  computePlayerRulesProfile: vi.fn(() => ({
    maxSalary: 35e6,
    // other props
  })),
}));
vi.mock('../../features/architect/utils/playerRulesProfile/minimumSalaryRules.js', () => ({
    getYearsOfService: vi.fn(() => 5),
}));

// Import the mocked modules to setup implementation returns
import { getCapForSeason } from '../../features/architect/utils/capHelpers';

describe('Phase 40: Second Apron Strict Drift Guardrails', () => {
  const CAP_CONTEXT = {
    salaryCap: 140e6,
    firstApron: 178e6,
    secondApron: 190e6,
    fullMLE: 12e6,
    taxpayerMLE: 5e6,
    roomMLE: 8e6,
    bae: 4e6,
    legacy: false,
    season: '2025-26',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    getCapForSeason.mockReturnValue(CAP_CONTEXT);
  });

  describe('buildRuleContext.ts: deriveApronLevel', () => {
    // We test this via buildRuleContextForPlayerMove's output
    // Input must be rigorous enough to pass validation

    const baseInput = {
      player: { id: 'p1' },
      teamState: { teamId: 't1', totals: { totalSalary: 0 } },
      operationType: 'UFA_SIGNING',
      operationSeasonId: '2025-26',
    };

    it('should classify team as FIRST_APRON (not SECOND) when salary is EXACTLY equal to second apron', () => {
      const input = {
        ...baseInput,
        teamState: {
          teamId: 't1',
          totals: {
            // Salary exactly at second apron
            totalSalary: CAP_CONTEXT.secondApron,
            capHits: { '2025-26': CAP_CONTEXT.secondApron },
          },
        },
      };

      const ctx = buildRuleContextForPlayerMove(input);
      // Logic: if (salary > secondApron) -> SECOND; else if (salary >= firstApron) -> FIRST
      // 190M >= 190M is false for > check, so it falls through.
      // 190M >= 178M is true.
      expect(ctx.team.apronLevelAtOperation).toBe('FIRST_APRON');
    });

    it('should classify team as SECOND_APRON when salary is > second apron', () => {
      const input = {
        ...baseInput,
        teamState: {
          teamId: 't1',
          totals: {
            totalSalary: CAP_CONTEXT.secondApron + 1,
            capHits: { '2025-26': CAP_CONTEXT.secondApron + 1 },
          },
        },
      };

      const ctx = buildRuleContextForPlayerMove(input);
      expect(ctx.team.apronLevelAtOperation).toBe('SECOND_APRON');
    });
  });

  describe('capLegalityValidation.js: validateSigning (Rule 1.8)', () => {
    it('should ALLOW signing above minimum when projected salary is EXACTLY at second apron', () => {
        // Mock inputs for validateSigning
        const team = {
            totals: { capHit: CAP_CONTEXT.secondApron - 5e6 } // Room for 5M signing
        };
        const contract = {
            salariesByYear: [{ salary: 5e6, capHit: 5e6, season: '2025-26' }],
        };
        // Projected: 185 + 5 = 190M (Exactly 2nd Apron)
        // Rule: If > 2nd Apron, block unless minimum.
        // At 190M, it should be allowed (not hard blocked by this rule).

        const result = validateSigning({
            team,
            contract,
            year: '2025-26',
            signedUsing: 'TPMLE', // Non-minimum
        });

        const blockedByApron = result.violations.find(v => v.rule === 'second_apron_minimum_only');
        expect(blockedByApron).toBeUndefined();
    });

    it('should BLOCK signing above minimum when projected salary is > second apron', () => {
        const team = {
            totals: { capHit: CAP_CONTEXT.secondApron - 5e6 + 1 } // Room for 5M signing + $1
        };
        const contract = {
            salariesByYear: [{ salary: 5e6, capHit: 5e6, season: '2025-26' }],
        };
        // Projected: 185.000001 + 5 = 190.000001M (> 2nd Apron)

        const result = validateSigning({
            team,
            contract,
            year: '2025-26',
            signedUsing: 'TPMLE',
        });

        const blockedByApron = result.violations.find(v => v.rule === 'second_apron_minimum_only');
        expect(blockedByApron).toBeDefined();
        expect(blockedByApron.rule).toBe('second_apron_minimum_only');
    });
  });

  describe('faExceptionUtils.js: canUseFaException', () => {
    it('should ALLOW use when salary is EXACTLY at second apron', () => {
       const teamCtx = {
           teamTotalSalary: CAP_CONTEXT.secondApron,
           teamSeasonState: {
               faExceptionBuckets: [{ type: 'NTMLE', remaining: 10e6, expiresAt: undefined }] // Fake bucket
           },
           context: { 
               capSettings: {
                   secondApron: CAP_CONTEXT.secondApron,
                   // firstApron undefined to isolate second apron check
               }
           }
       };

       // Should allow because 190 is NOT > 190
       const allowed = canUseFaException(teamCtx, 'NTMLE');
       expect(allowed).toBe(true);
    });

    it('should BLOCK use when salary is > second apron', () => {
        const teamCtx = {
            teamTotalSalary: CAP_CONTEXT.secondApron + 1,
            teamSeasonState: {
                faExceptionBuckets: [{ type: 'NTMLE', remaining: 10e6 }]
            },
            context: { 
                capSettings: {
                    secondApron: CAP_CONTEXT.secondApron,
                    // firstApron undefined
                }
            }
        };
 
        const allowed = canUseFaException(teamCtx, 'NTMLE');
        expect(allowed).toBe(false);
     });
  });

  describe('draftPickUtils.js: isFrozenPick', () => {
    const pick = { round: 1, year: 2032, teamId: 't1' }; // 7 years from 2025
    const opts = { teamId: 't1', currentSeason: 2025 };

    it('should IGNORE legacy parameter teamIsAtOrAboveSecondApron', () => {
        // Should behave as false (frozen=false) because teamIsSecondApron is undefined,
        // even though legacy key is true.
        expect(isFrozenPick(pick, { ...opts, teamIsAtOrAboveSecondApron: true })).toBe(false);
    });

    it('should support new parameter teamIsSecondApron', () => {
        expect(isFrozenPick(pick, { ...opts, teamIsSecondApron: true })).toBe(true);
        expect(isFrozenPick(pick, { ...opts, teamIsSecondApron: false })).toBe(false);
    });
  });
});

// Helper for calling validateSigning since it's an export from capLegalityValidation
// We need to import it at top level.
