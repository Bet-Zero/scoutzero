/**
 * TM-1C OWNERSHIP NOTE:
 * validateSecondApronRules / enforceSecondApronHandcuffs enforce three second-apron restrictions:
 *
 * 1. Prior-year TPE EXISTENCE guard — fires if team holds any prior-year TPEs (even unused).
 *    validateTradeExceptions.ts is the canonical USAGE guard (fires only when actively using one).
 *    Both intentionally fire; validateTradeExceptions.ts is authoritative for the CBA rule.
 *
 * 2. Multi-player outgoing BROAD BLOCK — fires for any 2+ outgoing players.
 *    validateAggregation.ts is the canonical CBA-precise AGGREGATE-UP guard (fires only when
 *    combining smaller salaries to acquire a higher-paid player; equal-value multi-player trades
 *    are allowed). Both intentionally fire; validateAggregation.ts is authoritative for the CBA rule.
 *
 * 3. Cash sent — SSOT; not enforced elsewhere.
 */
import { getTeamTpeList } from '@/features/architect/utils/persistenceContracts';
import {
  SECOND_APRON_CASH_BLOCKED,
  SECOND_APRON_MULTI_PLAYER_AGGREGATION_BLOCKED,
  SECOND_APRON_PRIOR_YEAR_TPE_BLOCKED,
} from '@/features/architect/utils/tradeMachine/constants/secondApronMessages';
import { isPriorYearTPE } from '@/features/architect/utils/tradeMachine/utils/tpeValidation';
import { isSecondApronTeam } from '../utils/capUtils';

interface BasicRulesCapSettings {
  secondApron?: number | null;
}

interface BasicRulesTpe {
  season?: number;
  createdSeason?: number;
  createdAtSeason?: number;
  id?: string;
  amount?: number;
  remaining?: number;
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
  sends?: unknown[] | null;
  outgoingPlayers?: unknown[] | null;
  cashSent?: number | null;
  tradeExceptions?: BasicRulesTpe[] | null;
  exceptions?: {
    tpe?: BasicRulesTpe[] | null;
  };
  postTradeStatus?: {
    isAtOrAboveSecondApron?: boolean;
  };
  context?: BasicRulesTeamContextLike;
  team?: BasicRulesTeamData | null;
}

interface BasicRulesContext {
  capSettings?: BasicRulesCapSettings | null;
  year?: number;
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

  // TM-1C EXISTENCE GUARD: fires if team holds any prior-year TPEs (regardless of usage in this trade).
  // validateTradeExceptions.ts is the canonical USAGE guard and CBA authority; this is a broader safety net.
  const tpes = getTeamTpeList(team) as BasicRulesTpe[];
  const priorYearTPEs = tpes.filter((tpe) =>
    isPriorYearTPE(tpe, context.year || 2025)
  );
  if (priorYearTPEs.length > 0) {
    violations.push(SECOND_APRON_PRIOR_YEAR_TPE_BLOCKED);
  }

  // TM-1C BROAD BLOCK: fires for any multi-player outgoing (2+ players sent).
  // validateAggregation.ts is the canonical CBA-precise authority (blocks aggregate-up only;
  // equal-value multi-player trades are allowed). This is a broader safety net.
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
export * from '../constants/cbaConstants';
