import {
  buildFirstRoundCalendar,
  passesStepienRule,
} from '@/features/architect/utils/stepienUtils.js';
import { isFrozenPick } from '@/features/architect/utils/draftPickUtils.js';
import { validatorDebug } from '../engine/validatorDebug';
import { TradeTeam, StepienResult, TeamContext } from '../constants/types';

// Interface for normalized draft picks with number types
interface NormalizedDraftPick {
  year: number;
  round: number;
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
  console.log('=== validateStepien TypeScript DEBUG ===');
  console.log('team.teamId:', team.teamId);
  console.log('outgoingPicks:', team.outgoingPicks);
  console.log(
    'team.postTradeStatus?.isAtOrAboveSecondApron:',
    team.postTradeStatus?.isAtOrAboveSecondApron
  );

  const violations: string[] = [];
  const outgoingPicks = team.outgoingPicks || [];
  const context = team.context as TeamContext;
  const yearKey = typeof context.yearKey === 'number' 
    ? context.yearKey 
    : (typeof context.yearKey === 'string' ? parseInt(context.yearKey, 10) : new Date().getFullYear());

  console.log('yearKey:', yearKey);

  // Normalize outgoing picks to have proper typing
  const normalizedOutgoingPicks: NormalizedDraftPick[] = outgoingPicks.map((p) => ({
    year: typeof p.year === 'number' ? p.year : 
          typeof p.year === 'string' ? parseInt(p.year, 10) : 0,
    round: typeof p.round === 'number' ? p.round :
           typeof p.round === 'string' ? parseInt(p.round, 10) : 1,
    isSwap: p.isSwap === true,
    protection: typeof p.protection === 'string' ? p.protection : undefined,
    originalTeam: typeof p.originalTeam === 'string' ? p.originalTeam : undefined,
  }));

  // Build calendar with existing and outgoing picks
  const existingPicks: NormalizedDraftPick[] = (team.team?.picks || []).map((p) => ({
    year: typeof p.year === 'number' ? p.year : 
          typeof p.year === 'string' ? parseInt(p.year, 10) : 0,
    round: typeof p.round === 'number' ? p.round :
           typeof p.round === 'string' ? parseInt(p.round, 10) : 1,
    isSwap: p.isSwap === true,
    protection: typeof p.protection === 'string' ? p.protection : undefined,
    originalTeam: typeof p.originalTeam === 'string' ? p.originalTeam : undefined,
  }));

  const calendar = buildFirstRoundCalendar({
    existingPicks,
    picksOfferedInTrade: normalizedOutgoingPicks,
  });

  // Check consecutive unprotected firsts
  if (!passesStepienRule(calendar)) {
    violations.push('Violates Stepien Rule (consecutive future 1sts)');
  }

  // Check 7-year limit
  const farthestYear = Math.max(
    ...normalizedOutgoingPicks.map((p) => p.year || 0),
    yearKey
  );
  if (farthestYear - yearKey > 7) {
    violations.push('Cannot trade picks beyond 7 years out');
  }

  // Check second apron frozen pick restriction
  if (team.postTradeStatus?.isAtOrAboveSecondApron) {
    console.log('Team is at or above second apron, checking frozen picks...');
    const hasOwnFrozenPick = normalizedOutgoingPicks.some((p) => {
      const result = isFrozenPick(p, {
        teamId: team.teamId || '',
        teamIsAtOrAboveSecondApron: true,
        currentSeason: yearKey,
      });
      console.log(`Pick ${p.year} frozen check result:`, result);
      return result;
    });

    console.log('hasOwnFrozenPick:', hasOwnFrozenPick);

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

  console.log('TypeScript validateStepien result:', result);
  console.log('=== END validateStepien TypeScript DEBUG ===');

  validatorDebug.logValidation('Stepien Rule', team, result);
  return result;
}
