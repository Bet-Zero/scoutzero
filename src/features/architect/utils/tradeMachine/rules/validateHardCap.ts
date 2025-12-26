import {
  wouldExceedHardCap,
  formatCurrency,
} from '@/features/architect/utils/tradeHelpers';
import { validatorDebug } from '../engine/validatorDebug';
import { TradeTeam, HardCapResult } from '../constants/types';

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

  // Normalize hardCapType to null when no hard cap is triggered (avoid undefined)
  const hardCapType = capSheet.hardCapTriggered 
    ? (capSheet.hardCapTriggered as HardCapType) 
    : null;
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
