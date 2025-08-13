import { wouldExceedHardCap } from '@/utils/architect/tradeHelpers.js';
import { formatCurrency } from '@/utils/architect/tradeHelpers.js';
import { validatorDebug } from './validatorDebug.js';
import { TradeTeam, HardCapResult } from './types';

type HardCapType = 'FirstApron' | 'SecondApron' | null;

/**
 * Validates hard cap restrictions:
 * - First apron hard cap (triggered by S&T, BAE, NTMLE)
 * - Second apron hard cap
 */
export function validateHardCap(team: TradeTeam): HardCapResult {
  const { projectedSalary, context } = team;
  const { capSettings } = context;

  // Apply appropriate hard cap type
  const capSheet = team.hardCapped
    ? { ...team.team, hardCapTriggered: 'FirstApron' as HardCapType }
    : team.team;

  const hardCapPass = !wouldExceedHardCap(
    capSheet,
    projectedSalary,
    capSettings
  );

  const hardCapType = capSheet.hardCapTriggered as HardCapType;
  const hardCapMsg =
    hardCapType === 'SecondApron'
      ? 'Hard cap exceeded (2nd Apron)'
      : 'Hard cap exceeded (1st Apron)';

  const result: HardCapResult = {
    passed: hardCapPass,
    violations: hardCapPass ? [] : [hardCapMsg],
    message: hardCapPass ? 'Hard-cap compliant' : 'Hard-cap violation',
    details: hardCapPass
      ? ''
      : `Projected salary ${formatCurrency(projectedSalary)} would exceed ${hardCapType} hard cap.`,
    projectedSalary,
    hardCapType: hardCapType,
    trigger: team.hardCapTrigger || null,
  };

  validatorDebug.logValidation('Hard Cap', team, result);
  return result;
}
