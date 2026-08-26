/**
 * Compatibility surface only. Governed Transaction Restrictions Table rows,
 * including Row I cash, are owned by evaluateTradeApronRestriction.
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
type BasicRulesTeam = object;
type BasicRulesContext = object;

interface BasicRulesValidationResult {
  passed: boolean;
  violations: string[];
  warningsOnly: boolean;
}

interface BasicRulesEnforcementCallbacks {
  reject?: (message: string) => void;
}

export function validateSecondApronRules(
  _team: BasicRulesTeam,
  _context: BasicRulesContext = {}
): BasicRulesValidationResult {
  return {
    passed: true,
    violations: [],
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
