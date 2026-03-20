/**
 * Draft pick and related rule utilities
 * Consolidated from: stepienRule.js, validateDraftPicks.js
 *
 * Phase 1 SSOT-1: hasStepienViolation now delegates to canonical validateStepien
 */

import { isMeaningfulProtection } from '../utils/tradeUtilityMisc';
import { validateStepien } from './validateStepien.js';

type DraftRulesYearLike = number | string | null | undefined;
type DraftRulesRoundLike = number | string | null | undefined;

interface DraftRulesPickLike {
  year?: DraftRulesYearLike;
  round?: DraftRulesRoundLike;
  isSwap?: boolean;
  protection?: unknown;
}

interface DraftRulesTeamLike {
  tradedPicks?: DraftRulesPickLike[] | null;
}

/**
 * Checks if a set of outgoing picks violates the Stepien Rule
 * (No consecutive future first round picks without protection)
 *
 * @param {Array} picks - Array of draft picks being traded
 * @returns {boolean} True if a violation exists
 *
 * @note Phase 1 SSOT-1: This now delegates to canonical validateStepien()
 */
export function hasStepienViolation(
  picks: DraftRulesPickLike[] = []
): boolean {
  if (!picks || picks.length === 0) return false;

  // Delegate to canonical validateStepien with minimal team wrapper
  const result = validateStepien(
    {
      outgoingPicks:
        picks as Parameters<typeof validateStepien>[0]['outgoingPicks'],
    },
    {}
  );
  return !result.passed;
}

/**
 * Validates draft pick trading rules
 * (From validateDraftPicks.js)
 */
export function validateDraftPicks(
  team: DraftRulesTeamLike,
  // Keep the legacy second parameter for compatibility.
  _allTeams?: unknown
): string[] {
  const violations: string[] = [];
  const currentYear = new Date().getFullYear();

  const unprotectedYears = (team.tradedPicks || [])
    .filter(
      (pick) =>
        pick.round === 1 &&
        !pick.isSwap &&
        !isMeaningfulProtection(pick.protection) &&
        (pick.year as number) > currentYear
    )
    .map((pick) => pick.year as number | string)
    .sort();

  // Check for consecutive unprotected first round picks (Stepien Rule)
  for (let index = 1; index < unprotectedYears.length; index++) {
    if (
      unprotectedYears[index] ===
      (unprotectedYears[index - 1] as number) + 1
    ) {
      violations.push(
        `Stepien Rule violation: Cannot trade consecutive first round picks (${
          unprotectedYears[index - 1]
        } and ${unprotectedYears[index]})`
      );
    }
  }

  // Check 7-year rule
  const maxTradeYear = currentYear + 7;
  (team.tradedPicks || []).forEach((pick) => {
    if ((pick.year as number) > maxTradeYear) {
      violations.push(
        `Cannot trade picks more than 7 years out (${pick.year})`
      );
    }
  });

  return violations;
}
