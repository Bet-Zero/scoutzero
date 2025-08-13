import {
  buildFirstRoundCalendar,
  passesStepienRule,
} from '@/utils/architect/stepienUtils.js';
import { isFrozenPick } from '@/utils/architect/draftPickUtils.js';
import { isMeaningfulProtection } from '@/utils/architect/tradeMachine/tradeUtils.js';
import { validatorDebug } from './validatorDebug.js';
import { TradeTeam, StepienResult, TeamContext } from './types';

interface DraftPick {
  year: number | string;
  round: number | string;
  isSwap?: boolean;
  protection?: string;
  originalTeam?: string;
}

/**
 * Validates Stepien Rule compliance:
 * - No consecutive future unprotected first round picks
 * - Cannot trade picks more than 7 years out
 * - Second apron teams cannot trade their own 7-year-out first
 */
export function validateStepien(team: TradeTeam): StepienResult {
  const violations: string[] = [];
  const outgoingPicks = team.outgoingPicks || [];
  const context = team.context as TeamContext;
  const yearKey = context.yearKey || new Date().getFullYear();

  // Build calendar with existing and outgoing picks
  const calendar = buildFirstRoundCalendar({
    existingPicks: team.team?.picks || [],
    picksOfferedInTrade: outgoingPicks as DraftPick[],
  });

  // Check consecutive unprotected firsts
  if (!passesStepienRule(calendar)) {
    violations.push('Violates Stepien Rule (consecutive future 1sts)');
  }

  // Check 7-year limit
  const farthestYear = Math.max(
    ...outgoingPicks.map((p) =>
      typeof p.year === 'string' ? parseInt(p.year) : p.year || 0
    ),
    yearKey
  );
  if (farthestYear - yearKey > 7) {
    violations.push('Cannot trade picks beyond 7 years out');
  }

  // Check second apron frozen pick restriction
  if (team.postTradeStatus?.isAtOrAboveSecondApron) {
    const hasOwnFrozenPick = (outgoingPicks as DraftPick[]).some((p) =>
      isFrozenPick(p, {
        teamId: team.teamId || '',
        teamIsAtOrAboveSecondApron: true,
        currentSeason: yearKey,
      })
    );
    if (hasOwnFrozenPick) {
      violations.push(
        'Second apron team cannot trade its own 7-year-out first-round pick'
      );
    }
  }

  const result: StepienResult = {
    passed: violations.length === 0,
    violations,
    message: violations.length
      ? 'Stepien Rule violation'
      : 'Stepien Rule compliant',
    details: violations.join('; '),
    calendar,
    farthestYear,
    currentYear: yearKey,
  };

  validatorDebug.logValidation('Stepien Rule', team, result);
  return result;
}
