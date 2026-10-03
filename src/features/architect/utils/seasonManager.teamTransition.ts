/** Existing browser/legacy entrypoint; supported preservation computation is shared with the server. */
import { resolveEntitlementsForTeam } from './entitlements/entitlementResolver';
import {
  pickRulesMapToObject,
  resolvePickRulesByIds,
} from './entitlements/pickRulesResolver';
import { processTeamSeasonTransitionWithOptions as processCore } from './seasonManager.teamTransition.core';
export {
  removeUndefinedDeep,
  toSeasonTransitionTeam,
} from './seasonManager.teamTransition.core';
export type {
  DraftResolutionContext,
  TeamSeasonTransitionResult,
} from './seasonManager.teamTransition.core';
export function processTeamSeasonTransitionWithOptions(
  ...args: Parameters<typeof processCore>
) {
  return processCore(args[0], args[1], args[2], args[3], args[4], {
    resolveEntitlementsForTeam,
    resolvePickRulesByIds,
    pickRulesMapToObject,
  });
}
