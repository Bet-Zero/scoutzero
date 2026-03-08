import { getTeamTpeList } from '@/features/architect/utils/persistenceContracts';
import {
  SECOND_APRON_CASH_BLOCKED,
  SECOND_APRON_MULTI_PLAYER_AGGREGATION_BLOCKED,
  SECOND_APRON_PRIOR_YEAR_TPE_BLOCKED,
} from '@/features/architect/utils/tradeMachine/constants/secondApronMessages.js';
import { isPriorYearTPE } from '@/features/architect/utils/tradeMachine/utils/tradeUtilities.js';
import { isSecondApronTeam } from '../utils/capUtils.js';

interface BasicRulesCapSettings {
  secondApron?: number | null;
  [key: string]: unknown;
}

interface BasicRulesTpe {
  season?: number;
  createdSeason?: number;
  createdAtSeason?: number;
  [key: string]: unknown;
}

interface BasicRulesTeamContextLike {
  isAtOrAboveSecondApron?: boolean;
  [key: string]: unknown;
}

interface BasicRulesTeamData {
  teamTotalSalary?: number;
  totalSalary?: number;
  [key: string]: unknown;
}

interface BasicRulesTeam {
  teamTotalSalary?: number;
  projectedSalary?: number;
  sends?: unknown[] | null;
  outgoingPlayers?: unknown[] | null;
  cashSent?: number | null;
  tradeExceptions?: BasicRulesTpe[] | null;
  exceptions?: {
    tpe?: BasicRulesTpe[] | null;
    [key: string]: unknown;
  };
  postTradeStatus?: {
    isAtOrAboveSecondApron?: boolean;
  };
  context?: BasicRulesTeamContextLike;
  team?: BasicRulesTeamData | null;
  [key: string]: unknown;
}

interface BasicRulesContext {
  capSettings?: BasicRulesCapSettings | null;
  year?: number;
  [key: string]: unknown;
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

  const tpes = getTeamTpeList(team) as BasicRulesTpe[];
  const priorYearTPEs = tpes.filter((tpe) =>
    isPriorYearTPE(tpe, context.year || 2025)
  );
  if (priorYearTPEs.length > 0) {
    violations.push(SECOND_APRON_PRIOR_YEAR_TPE_BLOCKED);
  }

  const outgoingPlayers = (team.sends || team.outgoingPlayers || []) as unknown[];
  if (outgoingPlayers.length > 1) {
    violations.push(SECOND_APRON_MULTI_PLAYER_AGGREGATION_BLOCKED);
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
export * from '../constants/cbaConstants.js';
