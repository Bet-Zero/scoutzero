/**
 * TM-1C OWNERSHIP NOTE:
 * validateSecondApronRules / enforceSecondApronHandcuffs enforce one second-apron restriction:
 *
 * 1. Cash sent — SSOT; not enforced elsewhere.
 *
 * Prior-year TPE restriction: validateTradeExceptions.ts is the sole canonical authority
 * (fires only when the team actively uses a prior-year TPE in this trade; holding a prior-year
 * TPE while not using it does not block the trade per CBA). The existence guard previously in
 * this file was removed in TM-1C followup as it over-blocked relative to the CBA usage rule.
 *
 * Multi-player outgoing restriction: validateAggregation.ts is the sole canonical authority
 * (fires only when combining multiple smaller salaries to acquire a higher-paid player;
 * equal-value multi-player trades are allowed per CBA). The broad 2+ player block previously
 * in this file was removed in TM-1C followup as it over-blocked relative to the CBA rule.
 */
import {
  SECOND_APRON_CASH_BLOCKED,
} from '@/features/architect/utils/tradeMachine/constants/secondApronMessages';
import { isSecondApronTeam } from '../utils/capUtils';

interface BasicRulesCapSettings {
  secondApron?: number | null;
}

interface BasicRulesTeamContextLike {
  isAtOrAboveSecondApron?: boolean;
}

interface BasicRulesTeamData {
  teamTotalSalary?: number;
  totalSalary?: number;
}

interface BasicRulesTeam {
  teamTotalSalary?: number;
  projectedSalary?: number;
  cashSent?: number | null;
  postTradeStatus?: {
    isAtOrAboveSecondApron?: boolean;
  };
  context?: BasicRulesTeamContextLike;
  team?: BasicRulesTeamData | null;
}

interface BasicRulesContext {
  capSettings?: BasicRulesCapSettings | null;
}

interface BasicRulesValidationResult {
  passed: boolean;
  violations: string[];
  warningsOnly: boolean;
}

interface BasicRulesEnforcementCallbacks {
  reject?: (message: string) => void;
}

export function validateSecondApronRules(
  team: BasicRulesTeam,
  context: BasicRulesContext = {}
): BasicRulesValidationResult {
  const capSettings = context.capSettings || {};
  const violations: string[] = [];

  const teamTotalSalary =
    team?.teamTotalSalary ||
    team?.team?.teamTotalSalary ||
    team?.team?.totalSalary ||
    0;

  const projectedSalary = team?.projectedSalary || teamTotalSalary;

  const isAboveSecondApron =
    team?.postTradeStatus?.isAtOrAboveSecondApron ||
    isSecondApronTeam({ totalSalary: teamTotalSalary }, capSettings) ||
    isSecondApronTeam({ totalSalary: projectedSalary }, capSettings) ||
    team?.context?.isAtOrAboveSecondApron ||
    false;

  if (!isAboveSecondApron) {
    return {
      passed: true,
      violations: [],
      warningsOnly: false,
    };
  }

  const cashSent = team.cashSent || 0;
  if (cashSent > 0) {
    violations.push(SECOND_APRON_CASH_BLOCKED);
  }

  return {
    passed: violations.length === 0,
    violations,
    warningsOnly: false,
  };
}

export function enforceSecondApronHandcuffs(
  team: BasicRulesTeam,
  ctx: BasicRulesContext = {},
  callbacks: BasicRulesEnforcementCallbacks = {}
): string[] {
  const reject = callbacks.reject || (() => {});
  const result = validateSecondApronRules(team, ctx);

  result.violations.forEach((message) => reject(message));

  return result.violations;
}

export { validateSecondApronRules as validateSecondApron };
export * from '../constants/cbaConstants';
