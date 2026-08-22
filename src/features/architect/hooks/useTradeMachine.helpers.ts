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
import { toSeasonKey } from '@/features/architect/utils/seasonFormat';
import { getTeamTpeList } from '@/features/architect/utils/persistenceContracts';

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
   Helpers: FA buckets & test TPE seeding
   ============================ */

function getMLEBAEForYear(
  endYear: number,
  capProjections: UnknownRecord | null | undefined
) {
  if (!capProjections) return { fullMLE: 0, roomMLE: 0, bae: 0 };

  const key = toSeasonKey(endYear);
  const fromComposite = capProjections?.[key] || {};
  const fromNumeric = capProjections?.[endYear] || {};
  const src = (
    Object.keys(fromComposite as object).length ? fromComposite : fromNumeric
  ) as Record<string, unknown>;

  return {
    fullMLE: Number(src.fullMLE ?? src.mle ?? 0),
    roomMLE: Number(src.roomMLE ?? src.rmle ?? 0),
    bae: Number(src.bae ?? 0),
  };
}

export function augmentTeamWithExceptions(
  team: UnknownRecord | null,
  endYear: number,
  capProjections: UnknownRecord | null | undefined
) {
  if (!team) return team;

  if (!Array.isArray(team.faExceptionBuckets)) {
    const { fullMLE, roomMLE, bae } = getMLEBAEForYear(endYear, capProjections);
    const buckets = [];
    if (fullMLE > 0)
      buckets.push({ type: 'NTMLE', remaining: fullMLE, expiresAt: null });
    if (roomMLE > 0)
      buckets.push({ type: 'RMLE', remaining: roomMLE, expiresAt: null });
    if (bae > 0) buckets.push({ type: 'BAE', remaining: bae, expiresAt: null });
    if (buckets.length) team.faExceptionBuckets = buckets;
  }

  // Phase 65: Use canonical TPE accessor for reading
  const existingTpes = getTeamTpeList(team);
  if (existingTpes.length === 0) {
    team.tradeExceptions = [
      {
        id: `${team.id}-tpe-a`,
        name: 'Test TPE A',
        amount: 6_500_000,
        expiresOn: null,
      },
      {
        id: `${team.id}-tpe-b`,
        name: 'Test TPE B',
        amount: 2_800_000,
        expiresOn: new Date(
          Date.now() + 1000 * 60 * 60 * 24 * 30
        ).toISOString(),
      },
    ];
  }

  return team;
}
