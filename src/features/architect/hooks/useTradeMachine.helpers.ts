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
import { TeamMap, TeamCodeMap, type TeamEntry } from '@/constants/teamList';
import { createCanonicalTeamTotalsSnapshot } from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import {
  getCanonicalExceptionAvailability,
  type CanonicalNonTpeExceptionKey,
} from '@/features/architect/utils/exceptions/exceptionOwnership';

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

export function resolveTradeSalaryBasisTeamId(
  baseTeam: UnknownRecord | string | null | undefined,
  teamData: UnknownRecord | null
): string {
  return (resolveTeamCodeLike(baseTeam, teamData) ?? '').trim().toUpperCase();
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
  entitlements: TradeMachineEntitlement[],
  worldId: string | null = null
): Promise<Record<string, PickRuleDoc>> => {
  const pickIds = extractPickIdsFromEntitlements(entitlements);
  if (pickIds.length === 0) return {};

  try {
    const rulesMap = await resolvePickRulesByIds(pickIds, worldId);
    return pickRulesMapToObject(rulesMap);
  } catch (err) {
    console.warn('[resolvePickRulesForEntitlements] Error:', err);
    return {};
  }
};

// ============================================================
// Wave 29 Step 1: helpers extracted from useTradeMachine.ts
// ============================================================

const TEAM_BY_SLUG = TeamMap as Record<string, TeamEntry | undefined>;
const TEAM_BY_CODE = TeamCodeMap as Record<string, TeamEntry | undefined>;

export const asUnknownRecord = (value: unknown): UnknownRecord => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as UnknownRecord;
  }
  return {};
};

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

/* ============================
   TEAM CODE RESOLUTION
   ============================ */

export function resolveBaseTeamLike(
  teamObjOrId: UnknownRecord | string | null | undefined,
  teamDataMaybe: UnknownRecord | null = null
) {
  if (typeof teamObjOrId === 'string') {
    const directBaseTeam =
      TEAM_BY_SLUG[teamObjOrId] ||
      TEAM_BY_CODE[teamObjOrId] ||
      TEAM_BY_CODE[teamObjOrId.toUpperCase()];

    if (directBaseTeam) {
      return directBaseTeam;
    }
  }

  const resolvedTeamCode = resolveTeamCodeLike(teamObjOrId, teamDataMaybe);
  if (resolvedTeamCode && TEAM_BY_CODE[resolvedTeamCode]) {
    return TEAM_BY_CODE[resolvedTeamCode];
  }

  return null;
}

/* ============================
   SSOT WIRING
   ============================ */

export const getCapTotalsForYear = (
  teamCapSheet: UnknownRecord | null | undefined,
  yearKey: number,
  asOfDate: string | null = null
) => {
  if (!teamCapSheet)
    return {
      playersTotal: 0,
      deadMoneyTotal: 0,
      teamSalary: null,
      apronTeamSalary: null,
      taxSalary: null,
      salaryBooks: null,
    };
  const totals = createCanonicalTeamTotalsSnapshot(teamCapSheet, yearKey, {
    asOfDate,
  });
  return {
    playersTotal: totals.playersTotal,
    deadMoneyTotal: totals.deadMoneyTotal,
    teamSalary: totals.teamSalary,
    apronTeamSalary: totals.apronTeamSalary,
    taxSalary: totals.taxSalary,
    salaryBooks: totals.salaryBooks,
  };
};

/* ============================
   Helpers: free-agent exception buckets
   ============================ */

/** Trade Machine bucket type for each canonical team exception it may use. */
const FA_EXCEPTION_BUCKET_SOURCES = [
  ['mle', 'NTMLE'],
  ['room', 'RMLE'],
  ['bae', 'BAE'],
] as const satisfies readonly (readonly [
  CanonicalNonTpeExceptionKey,
  string,
])[];

/**
 * Builds the Trade Machine's free-agent exception buckets from the team's own
 * recorded exception state, the same source the Cap Sheet shows. An exception
 * the team does not hold, has disabled, or has no record of gets no bucket.
 * Never default to the league's full exception amounts: that would hand every
 * team spending room it may not have.
 */
export function augmentTeamWithExceptions(team: UnknownRecord | null) {
  if (!team) return team;

  if (!Array.isArray(team.faExceptionBuckets)) {
    const buckets = [];
    for (const [key, type] of FA_EXCEPTION_BUCKET_SOURCES) {
      const exception = getCanonicalExceptionAvailability(team, key);
      if (!exception.present || !exception.enabled) continue;
      buckets.push({
        type,
        amount: exception.totalAmount,
        used: exception.usedAmount,
        remaining: exception.remainingAmount,
        expiresAt: null,
      });
    }
    if (buckets.length) team.faExceptionBuckets = buckets;
  }

  // A team with no recorded Traded Player Exceptions has none. Never invent
  // placeholder exceptions: they would become spending room in validation.
  return team;
}
