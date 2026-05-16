import {
  resolvePickRulesByIds,
  pickRulesMapToObject,
  type PickRuleDoc,
} from '@/features/architect/utils/entitlements/pickRulesResolver';
import type {
  UnknownRecord,
  TradeMachineTeamSlot,
  TradeMachineTeam,
  TradeMachineEntitlement,
} from './useTradeMachine.types';

export const DEBUG_ENT = Boolean(import.meta?.env?.VITE_DEBUG_ENTITLEMENTS);

export const ENABLE_PICK_RULES =
  import.meta?.env?.VITE_ENABLE_PICK_RULES !== 'false';

export const isUnknownRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const hasTeamSlot = (
  slot: TradeMachineTeamSlot
): slot is TradeMachineTeamSlot & { team: TradeMachineTeam } => {
  return slot.team !== null;
};

/**
 * Resolve a valid 3-letter team code from various team object shapes.
 * Returns the code (e.g., "LAL") or null if unable to resolve.
 */
export function resolveTeamCodeLike(
  teamObjOrId: UnknownRecord | string | null | undefined,
  teamDataMaybe: UnknownRecord | null = null
): string | null {
  const teamObj =
    teamObjOrId && typeof teamObjOrId === 'object' ? teamObjOrId : null;

  // Prefer teamData.teamCode if present
  if (typeof teamDataMaybe?.teamCode === 'string' && teamDataMaybe.teamCode) {
    return teamDataMaybe.teamCode;
  }
  // Else if teamData.id is exactly length 3, use that
  if (typeof teamDataMaybe?.id === 'string' && teamDataMaybe.id.length === 3) {
    return teamDataMaybe.id;
  }
  // Else if teamObjOrId is exactly length 3, use that (string id passed directly)
  if (typeof teamObjOrId === 'string' && teamObjOrId.length === 3) {
    return teamObjOrId;
  }
  // Else attempt teamObjOrId.code if 3 chars (from TeamMap entry)
  if (typeof teamObj?.code === 'string' && teamObj.code.length === 3) {
    return teamObj.code;
  }
  // Else attempt teamObjOrId.abbreviation if 3 chars
  if (
    typeof teamObj?.abbreviation === 'string' &&
    teamObj.abbreviation.length === 3
  ) {
    return teamObj.abbreviation;
  }
  // Else attempt teamObjOrId.id if 3 chars
  if (typeof teamObj?.id === 'string' && teamObj.id.length === 3) {
    return teamObj.id;
  }
  // Else attempt teamData.team?.id if 3 chars
  const teamDataTeam = teamDataMaybe?.team as UnknownRecord | undefined;
  if (typeof teamDataTeam?.id === 'string' && teamDataTeam.id.length === 3) {
    return teamDataTeam.id;
  }
  // Could not resolve
  if (DEBUG_ENT) {
    console.warn(
      '[DEBUG_ENT] resolveTeamCodeLike: could not resolve team code',
      { teamObjOrId, teamDataMaybe }
    );
  }
  return null;
}

const isPlainObjectValue = (value: unknown) =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const deepMergeEntitlement = (
  base: UnknownRecord,
  override: UnknownRecord
): UnknownRecord => {
  if (!isPlainObjectValue(base) || !isPlainObjectValue(override)) {
    return { ...base, ...override };
  }
  const merged = { ...base };
  Object.entries(override).forEach(([key, value]) => {
    const baseValue = base[key];
    if (isPlainObjectValue(baseValue) && isPlainObjectValue(value)) {
      merged[key] = deepMergeEntitlement(
        baseValue as UnknownRecord,
        value as UnknownRecord
      );
      return;
    }
    merged[key] = value;
  });
  return merged;
};

const extractPickIdsFromEntitlements = (
  entitlements: TradeMachineEntitlement[]
): string[] => {
  if (!Array.isArray(entitlements) || entitlements.length === 0) return [];

  const pickIds = new Set<string>();
  for (const ent of entitlements) {
    if (ent.underlyingPickId) pickIds.add(String(ent.underlyingPickId));
    if (Array.isArray(ent.poolUnderlyingPickIds)) {
      (ent.poolUnderlyingPickIds as string[]).forEach(
        (id) => id && pickIds.add(id)
      );
    }
    if (ent.swapControllerPickId) pickIds.add(String(ent.swapControllerPickId));
  }
  return Array.from(pickIds);
};

export const resolvePickRulesForEntitlements = async (
  entitlements: TradeMachineEntitlement[]
): Promise<Record<string, PickRuleDoc>> => {
  const pickIds = extractPickIdsFromEntitlements(entitlements);
  if (pickIds.length === 0) return {};

  try {
    const rulesMap = await resolvePickRulesByIds(pickIds);
    return pickRulesMapToObject(rulesMap);
  } catch (err) {
    console.warn('[resolvePickRulesForEntitlements] Error:', err);
    return {};
  }
};
