/**
 * FILE: src/features/architect/utils/seasonManager.draftResolution.ts
 * PURPOSE: Draft-pick swap and conveyance resolution — extracted from seasonManager.ts (Wave 4 Step 1).
 * OWNERSHIP: Feature: architect
 *
 * Contains the two pure draft-resolution functions and their full normalization/helper chain.
 * The main seasonManager.ts imports and re-exports the two public functions from here.
 */
import { resolvePickSwap } from '@/features/architect/utils/tradeMachine/utils/swapResolution';
import { resolveConveyanceForPick } from '@/features/architect/utils/tradeMachine/utils/conveyanceResolution';
import type { SeasonManagerProjectedDraftPickView } from '@/features/architect/utils/entitlements/seasonManagerProjection';

// ============================================================
// Draft pick type definitions
// ============================================================

type SeasonManagerDraftPickConveyanceConditionsIngress = {
  protection?: string | null;
  ifRolls?: string | null;
  // Entitlement projection uses a truthy marker here to signal that the pick
  // carries conveyance rules even when no protection string is attached yet.
  // Can be any truthy value (boolean, string, number) from legacy data.
  active?: boolean | string | number | null;
};

type SeasonManagerDraftPickConveyanceIngress = {
  conditions?: SeasonManagerDraftPickConveyanceConditionsIngress | null;
  currentYear?: number | string | null;
  finalYear?: number | string | null;
};

type SeasonManagerDraftPickConveyanceResultIngress = {
  outcome?: string | null;
  position?: number | string | null;
  resolvedAt?: string | null;
  method?: string | null;
  reason?: string | null;
  previousYear?: number | string | null;
  previousProtection?: string | null;
  originalRound?: number | string | null;
};

type SeasonManagerDraftPickResolutionPositionsIngress = {
  [teamCode: string]: number | null | undefined;
};

type SeasonManagerDraftPickResolutionMetaIngress = {
  resolvedAt?: string | null;
  method?: string | null;
  positions?: SeasonManagerDraftPickResolutionPositionsIngress | null;
};

type SeasonManagerDraftPickConveyanceResult = {
  outcome?: string;
  position?: number;
  resolvedAt?: string;
  method?: string;
  reason?: string;
  previousYear?: number;
  previousProtection?: string;
  originalRound?: number;
};

type SeasonManagerDraftPickConveyanceConditions = {
  protection?: string;
  ifRolls?: string;
};

type SeasonManagerDraftPickConveyance = {
  conditions: SeasonManagerDraftPickConveyanceConditions;
  currentYear?: number;
  finalYear?: number;
};

type SeasonManagerDraftPickProtectionLadderTier = {
  year: number;
  condition: string;
};

type SeasonManagerDraftPickConversionTarget = {
  action: 'convert';
  toYear?: number;
  toRound?: number;
};

type SeasonManagerDraftPickProtectionLadderTierIngress = {
  year?: number | string | null;
  condition?: string | null;
};

type SeasonManagerDraftPickConversionTargetIngress = {
  action?: string | null;
  toYear?: number | string | null;
  toRound?: number | string | null;
};

type SeasonManagerDraftPickResolutionMeta = {
  resolvedAt?: string;
  method?: string;
  positions?: Record<string, number>;
};

export type SeasonManagerDraftPick = Record<string, unknown> & {
  id?: string;
  year: number;
  round: number;
  owner?: string | null;
  currentOwner?: string | null;
  originalTeam?: string | null;
  isSwap?: boolean;
  swapWithTeamId?: string | null;
  protection?: string;
  conveyance?: SeasonManagerDraftPickConveyance;
  status?: SeasonManagerProjectedDraftPickView['status'] | 'future' | 'available' | string;
  resolved?: boolean;
  resolvedOwner?: string | null;
  resolvedPosition?: number | null;
  stepienBlocked?: boolean;
  stepienReason?: string | null;
  resolutionMeta?: SeasonManagerDraftPickResolutionMeta | null;
  tradedTo?: string | null;
  swapType?: 'best_of' | 'worst_of';
  conveyanceResult?: SeasonManagerDraftPickConveyanceResult | null;
  protectionLadder?: SeasonManagerDraftPickProtectionLadderTier[];
  conversionTarget?: SeasonManagerDraftPickConversionTarget;
};

type SeasonManagerRawDraftPickIngress = {
  id?: string | number | null;
  year?: number | string | null;
  round?: number | string | null;
  owner?: string | null;
  currentOwner?: string | null;
  originalTeam?: string | null;
  isSwap?: boolean | null;
  swapWithTeamId?: string | null;
  protection?: string | null;
  conveyance?: SeasonManagerDraftPickConveyanceIngress | null;
  status?: string | null;
  resolved?: boolean | null;
  resolvedOwner?: string | null;
  resolvedPosition?: number | null;
  stepienBlocked?: boolean | null;
  stepienReason?: string | null;
  resolutionMeta?: SeasonManagerDraftPickResolutionMetaIngress | null;
  tradedTo?: string | null;
  swapType?: 'best_of' | 'worst_of' | string | null;
  conveyanceResult?: SeasonManagerDraftPickConveyanceResultIngress | null;
  protectionLadder?: SeasonManagerDraftPickProtectionLadderTierIngress[] | null;
  conversionTarget?: SeasonManagerDraftPickConversionTargetIngress | null;
};

type SeasonManagerDraftPickIngress =
  | SeasonManagerDraftPick
  | SeasonManagerProjectedDraftPickView
  | SeasonManagerRawDraftPickIngress;

export type SeasonManagerDraftPickIngressList = ReadonlyArray<
  SeasonManagerDraftPickIngress | null | undefined
>;

export type DraftPickCarrier = {
  teamCode?: string | null;
  draftPicks: SeasonManagerDraftPick[];
};

export type SeasonManagerDraftPickIngressSource = {
  teamCode?: string | null;
  // Legacy snapshots and entitlement projection can still feed mixed pick
  // objects here, but only through this explicit ingress slice. Everything is
  // normalized immediately by toSeasonManagerDraftPicks before computation.
  _derivedDraftPicks?: SeasonManagerDraftPickIngressList;
  draftPicks?: SeasonManagerDraftPickIngressList;
};

// ============================================================
// Primitive helpers
// ============================================================

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isPlainObject(value: unknown): value is object {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asSeasonManagerDraftPickIngress(
  value: SeasonManagerDraftPickIngress | null | undefined
): SeasonManagerRawDraftPickIngress | null {
  return isPlainObject(value)
    ? (value as SeasonManagerRawDraftPickIngress)
    : null;
}

function asSeasonManagerConveyanceIngress(
  value:
    | SeasonManagerDraftPickConveyance
    | SeasonManagerDraftPickConveyanceIngress
    | null
    | undefined
): SeasonManagerDraftPickConveyance | SeasonManagerDraftPickConveyanceIngress | null {
  return isPlainObject(value)
    ? value
    : null;
}

function asSeasonManagerConveyanceConditionsIngress(
  value:
    | SeasonManagerDraftPickConveyanceConditions
    | SeasonManagerDraftPickConveyanceConditionsIngress
    | null
    | undefined
):
  | SeasonManagerDraftPickConveyanceConditions
  | SeasonManagerDraftPickConveyanceConditionsIngress
  | null {
  return isPlainObject(value)
    ? value
    : null;
}

function asSeasonManagerConveyanceResultIngress(
  value:
    | SeasonManagerDraftPickConveyanceResult
    | SeasonManagerDraftPickConveyanceResultIngress
    | null
    | undefined
):
  | SeasonManagerDraftPickConveyanceResult
  | SeasonManagerDraftPickConveyanceResultIngress
  | null {
  return isPlainObject(value)
    ? value
    : null;
}

function asSeasonManagerResolutionMetaIngress(
  value:
    | SeasonManagerDraftPickResolutionMeta
    | SeasonManagerDraftPickResolutionMetaIngress
    | null
    | undefined
):
  | SeasonManagerDraftPickResolutionMeta
  | SeasonManagerDraftPickResolutionMetaIngress
  | null {
  return isPlainObject(value)
    ? value
    : null;
}

function asSeasonManagerProtectionLadderTierIngress(
  value:
    | SeasonManagerDraftPickProtectionLadderTier
    | SeasonManagerDraftPickProtectionLadderTierIngress
    | null
    | undefined
):
  | SeasonManagerDraftPickProtectionLadderTier
  | SeasonManagerDraftPickProtectionLadderTierIngress
  | null {
  return isPlainObject(value)
    ? value
    : null;
}

function asSeasonManagerConversionTargetIngress(
  value:
    | SeasonManagerDraftPickConversionTarget
    | SeasonManagerDraftPickConversionTargetIngress
    | null
    | undefined
):
  | SeasonManagerDraftPickConversionTarget
  | SeasonManagerDraftPickConversionTargetIngress
  | null {
  return isPlainObject(value)
    ? value
    : null;
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value
    : undefined;
}

function toOptionalNullableString(
  value: unknown
): string | null | undefined {
  if (value === null) {
    return null;
  }
  return toOptionalString(value);
}

function toFiniteInteger(value: unknown): number | undefined {
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value)
    ? value
    : undefined;
}

function toDraftRound(value: unknown): number | undefined {
  const numericRound = toFiniteInteger(value);
  if (numericRound !== undefined) {
    return numericRound;
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    return undefined;
  }

  const parsed = Number.parseInt(value.replace(/\D/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toNullableFiniteInteger(value: unknown): number | null | undefined {
  if (value === null) {
    return null;
  }
  return toFiniteInteger(value);
}

function toSeasonManagerConveyance(
  value:
    | SeasonManagerDraftPickConveyance
    | SeasonManagerDraftPickConveyanceIngress
    | null
    | undefined
): SeasonManagerDraftPickConveyance | undefined {
  const record = asSeasonManagerConveyanceIngress(value);
  if (!record) {
    return undefined;
  }

  const conditionsRecord = asSeasonManagerConveyanceConditionsIngress(
    record.conditions
  );
  if (!conditionsRecord) {
    return undefined;
  }

  const conveyance: SeasonManagerDraftPickConveyance = {
    conditions: {},
  };
  const protection = toOptionalString(conditionsRecord.protection);
  const ifRolls = toOptionalString(conditionsRecord.ifRolls);
  const currentYear = toFiniteInteger(record.currentYear);
  const finalYear = toFiniteInteger(record.finalYear);

  if (protection !== undefined) {
    conveyance.conditions.protection = protection;
  }
  if (ifRolls !== undefined) {
    conveyance.conditions.ifRolls = ifRolls;
  }
  if (currentYear !== undefined) {
    conveyance.currentYear = currentYear;
  }
  if (finalYear !== undefined) {
    conveyance.finalYear = finalYear;
  }

  return conveyance;
}

function toSeasonManagerConveyanceResult(
  value:
    | SeasonManagerDraftPickConveyanceResult
    | SeasonManagerDraftPickConveyanceResultIngress
    | null
    | undefined
): SeasonManagerDraftPickConveyanceResult | null | undefined {
  if (value === null) {
    return null;
  }

  const record = asSeasonManagerConveyanceResultIngress(value);
  if (!record) {
    return undefined;
  }

  const result: SeasonManagerDraftPickConveyanceResult = {};
  const outcome = toOptionalString(record.outcome);
  const position = toFiniteInteger(record.position);
  const resolvedAt = toOptionalString(record.resolvedAt);
  const method = toOptionalString(record.method);
  const reason = toOptionalString(record.reason);
  const previousYear = toFiniteInteger(record.previousYear);
  const previousProtection = toOptionalString(record.previousProtection);
  const originalRound = toDraftRound(record.originalRound);

  if (outcome !== undefined) {
    result.outcome = outcome;
  }
  if (position !== undefined) {
    result.position = position;
  }
  if (resolvedAt !== undefined) {
    result.resolvedAt = resolvedAt;
  }
  if (method !== undefined) {
    result.method = method;
  }
  if (reason !== undefined) {
    result.reason = reason;
  }
  if (previousYear !== undefined) {
    result.previousYear = previousYear;
  }
  if (previousProtection !== undefined) {
    result.previousProtection = previousProtection;
  }
  if (originalRound !== undefined) {
    result.originalRound = originalRound;
  }

  return result;
}

function toSeasonManagerResolutionPositions(
  value:
    | Record<string, number>
    | SeasonManagerDraftPickResolutionPositionsIngress
    | null
    | undefined
): Record<string, number> | undefined {
  if (!isPlainObject(value)) {
    return undefined;
  }

  const positions: Record<string, number> = {};
  for (const [teamCode, position] of Object.entries(value)) {
    const normalizedPosition = toFiniteInteger(position);
    if (normalizedPosition !== undefined) {
      positions[teamCode] = normalizedPosition;
    }
  }

  return Object.keys(positions).length > 0 ? positions : undefined;
}

function toSeasonManagerResolutionMeta(
  value:
    | SeasonManagerDraftPickResolutionMeta
    | SeasonManagerDraftPickResolutionMetaIngress
    | null
    | undefined
): SeasonManagerDraftPickResolutionMeta | null | undefined {
  if (value === null) {
    return null;
  }

  const record = asSeasonManagerResolutionMetaIngress(value);
  if (!record) {
    return undefined;
  }

  const result: SeasonManagerDraftPickResolutionMeta = {};
  const resolvedAt = toOptionalString(record.resolvedAt);
  const method = toOptionalString(record.method);
  const positions = toSeasonManagerResolutionPositions(record.positions);

  if (resolvedAt !== undefined) {
    result.resolvedAt = resolvedAt;
  }
  if (method !== undefined) {
    result.method = method;
  }
  if (positions !== undefined) {
    result.positions = positions;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function toSeasonManagerProtectionLadder(
  value:
    | SeasonManagerDraftPickProtectionLadderTier[]
    | SeasonManagerDraftPickProtectionLadderTierIngress[]
    | null
    | undefined
): SeasonManagerDraftPickProtectionLadderTier[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const tiers = value
    .map((entry) => {
      const record = asSeasonManagerProtectionLadderTierIngress(entry);
      if (!record) {
        return null;
      }

      const year = toFiniteInteger(record.year);
      const condition = toOptionalString(record.condition);
      return year !== undefined && condition !== undefined
        ? { year, condition }
        : null;
    })
    .filter(
      (
        tier
      ): tier is SeasonManagerDraftPickProtectionLadderTier => tier !== null
    );

  return tiers.length > 0 ? tiers : undefined;
}

function toSeasonManagerConversionTarget(
  value:
    | SeasonManagerDraftPickConversionTarget
    | SeasonManagerDraftPickConversionTargetIngress
    | null
    | undefined
): SeasonManagerDraftPickConversionTarget | undefined {
  const record = asSeasonManagerConversionTargetIngress(value);
  if (!record || record.action !== 'convert') {
    return undefined;
  }

  const conversionTarget: SeasonManagerDraftPickConversionTarget = {
    action: 'convert',
  };
  const toYear = toFiniteInteger(record.toYear);
  const toRound = toDraftRound(record.toRound);

  if (toYear !== undefined) {
    conversionTarget.toYear = toYear;
  }
  if (toRound !== undefined) {
    conversionTarget.toRound = toRound;
  }

  return conversionTarget;
}

export function toSeasonManagerDraftPick(
  value: SeasonManagerDraftPickIngress | null | undefined
): SeasonManagerDraftPick | null {
  const record = asSeasonManagerDraftPickIngress(value);
  if (!record) {
    return null;
  }

  const year = toFiniteInteger(record.year);
  const round = toDraftRound(record.round);
  if (year === undefined || round === undefined) {
    return null;
  }

  const pick: SeasonManagerDraftPick = { year, round };
  const id = toOptionalString(record.id);
  const owner = toOptionalNullableString(record.owner);
  const currentOwner = toOptionalNullableString(record.currentOwner);
  const originalTeam = toOptionalNullableString(record.originalTeam);
  const swapWithTeamId = toOptionalNullableString(record.swapWithTeamId);
  const protection = toOptionalString(record.protection);
  const conveyance = toSeasonManagerConveyance(record.conveyance);
  const status = toOptionalString(record.status);
  const resolvedOwner = toOptionalNullableString(record.resolvedOwner);
  const resolvedPosition = toNullableFiniteInteger(record.resolvedPosition);
  const stepienReason = toOptionalNullableString(record.stepienReason);
  const resolutionMeta = toSeasonManagerResolutionMeta(record.resolutionMeta);
  const tradedTo = toOptionalNullableString(record.tradedTo);
  const conveyanceResult = toSeasonManagerConveyanceResult(
    record.conveyanceResult
  );
  const protectionLadder = toSeasonManagerProtectionLadder(
    record.protectionLadder
  );
  const conversionTarget = toSeasonManagerConversionTarget(
    record.conversionTarget
  );

  if (id !== undefined) {
    pick.id = id;
  }
  if (owner !== undefined) {
    pick.owner = owner;
  }
  if (currentOwner !== undefined) {
    pick.currentOwner = currentOwner;
  }
  if (originalTeam !== undefined) {
    pick.originalTeam = originalTeam;
  }
  if (typeof record.isSwap === 'boolean') {
    pick.isSwap = record.isSwap;
  }
  if (record.swapType === 'best_of' || record.swapType === 'worst_of') {
    pick.swapType = record.swapType;
  }
  if (swapWithTeamId !== undefined) {
    pick.swapWithTeamId = swapWithTeamId;
  }
  if (protection !== undefined) {
    pick.protection = protection;
  }
  if (conveyance !== undefined) {
    pick.conveyance = conveyance;
  }
  if (status !== undefined) {
    pick.status = status;
  }
  if (typeof record.resolved === 'boolean') {
    pick.resolved = record.resolved;
  }
  if (resolvedOwner !== undefined) {
    pick.resolvedOwner = resolvedOwner;
  }
  if (resolvedPosition !== undefined) {
    pick.resolvedPosition = resolvedPosition;
  }
  if (typeof record.stepienBlocked === 'boolean') {
    pick.stepienBlocked = record.stepienBlocked;
  }
  if (stepienReason !== undefined) {
    pick.stepienReason = stepienReason;
  }
  if (resolutionMeta !== undefined) {
    pick.resolutionMeta = resolutionMeta;
  }
  if (tradedTo !== undefined) {
    pick.tradedTo = tradedTo;
  }
  if (conveyanceResult !== undefined) {
    pick.conveyanceResult = conveyanceResult;
  }
  if (protectionLadder !== undefined) {
    pick.protectionLadder = protectionLadder;
  }
  if (conversionTarget !== undefined) {
    pick.conversionTarget = conversionTarget;
  }

  return pick;
}

export function getSeasonManagerDraftPicks(
  teamData: SeasonManagerDraftPickIngressSource | DraftPickCarrier
): SeasonManagerDraftPick[] {
  const ingressSource = teamData as SeasonManagerDraftPickIngressSource;
  if (Array.isArray(ingressSource._derivedDraftPicks)) {
    return toSeasonManagerDraftPicks(ingressSource._derivedDraftPicks) || [];
  }

  return toSeasonManagerDraftPicks(teamData.draftPicks) || [];
}

export function hasDraftPickIngressArray(
  teamData: SeasonManagerDraftPickIngressSource
): boolean {
  return (
    Array.isArray(teamData._derivedDraftPicks) ||
    Array.isArray(teamData.draftPicks)
  );
}

export function toDraftPickCarrier(
  teamData: SeasonManagerDraftPickIngressSource | DraftPickCarrier,
  fallbackTeamCode?: string | null
): DraftPickCarrier {
  const teamCode = isNonEmptyString(teamData.teamCode)
    ? teamData.teamCode
    : isNonEmptyString(fallbackTeamCode)
      ? fallbackTeamCode
      : null;

  return {
    teamCode,
    draftPicks: getSeasonManagerDraftPicks(teamData),
  };
}

export function toSeasonManagerDraftPicks(
  draftPicks: SeasonManagerDraftPickIngressList | null | undefined
): SeasonManagerDraftPick[] | null {
  if (!Array.isArray(draftPicks)) {
    return null;
  }

  return draftPicks
    .map(toSeasonManagerDraftPick)
    .filter((pick): pick is SeasonManagerDraftPick => pick !== null);
}

// ============================================================
// Exported draft-resolution functions
// ============================================================

export function resolveDraftPickSwapsForYear(
  team: SeasonManagerDraftPickIngressSource,
  draftYear: number,
  positionsMap: Record<string, number> | null | undefined,
  opts: { nowIso?: string; method?: string } = {}
): DraftPickCarrier {
  const carrier = toDraftPickCarrier(team);
  const draftPicksSource = carrier.draftPicks;

  // Return a normalized carrier if no positions are provided (NO-OP)
  if (
    !positionsMap ||
    typeof positionsMap !== 'object' ||
    Object.keys(positionsMap).length === 0
  ) {
    return carrier;
  }

  if (draftPicksSource.length === 0) {
    return {
      teamCode: carrier.teamCode,
      draftPicks: [],
    };
  }

  const nowIso = opts.nowIso;
  const method = opts.method ?? 'lottery';

  const updatedPicks = draftPicksSource.map((pick) => {
    // Skip non-swap picks
    if (pick.isSwap !== true) {
      return pick;
    }

    // Skip non-first-round picks (Phase 3 only resolves first round)
    if (pick.round !== 1) {
      return pick;
    }

    // Skip picks not in the specified year
    if (pick.year !== draftYear) {
      return pick;
    }

    // Skip already resolved
    if (pick.resolved === true) {
      return pick;
    }

    // Skip if missing swap partner
    if (!pick.swapWithTeamId) {
      return pick;
    }

    // Check if we have positions for both teams
    const teamA = pick.originalTeam || 'UNK';
    const teamB = pick.swapWithTeamId;

    if (!(teamA in positionsMap) || !(teamB in positionsMap)) {
      // Missing position data - leave unresolved (no throw)
      return pick;
    }

    // Attempt resolution - catch any errors and leave unresolved
    try {
      return (
        toSeasonManagerDraftPick(
          resolvePickSwap(pick, positionsMap, {
            nowIso,
            method,
          }) as SeasonManagerDraftPickIngress | null | undefined
        ) || pick
      );
    } catch {
      // Resolution failed - leave pick unresolved
      return pick;
    }
  });

  return {
    teamCode: carrier.teamCode,
    draftPicks: updatedPicks,
  };
}

/**
 * Phase 4: Resolves draft pick conveyance for a specific year.
 *
 * This function processes picks with conveyance conditions and lottery results
 * to determine whether picks convey, roll forward, or convert.
 *
 * NO-OP conditions (returns normalized carrier without resolving picks):
 * - positionsMap is null, undefined, or empty
 * - team has no normalized draft picks
 * - no picks match the specified draftYear with conveyance conditions
 *
 * This function mirrors the pattern of resolveDraftPickSwapsForYear()
 * and is intended to be called during season advance when draft results exist.
 *
 * @param {Object} team - Team data with draftPicks array
 * @param {number} draftYear - Year to resolve conveyance for
 * @param {Object<string, number>} [positionsMap] - Map of team codes to draft positions
 * @param {Object} [opts={}] - Options
 * @param {string} [opts.nowIso] - ISO timestamp for resolution
 * @param {string} [opts.method='lottery'] - Resolution method for audit trail
 * @returns {Object} - Team with updated draftPicks array
 */
export function resolveDraftPickConveyanceForYear(
  team: SeasonManagerDraftPickIngressSource,
  draftYear: number,
  positionsMap: Record<string, number> | null | undefined,
  opts: { nowIso?: string; method?: string } = {}
): DraftPickCarrier {
  const carrier = toDraftPickCarrier(team);
  const draftPicksSource = carrier.draftPicks;

  // Return a normalized carrier if no positions are provided (NO-OP)
  if (
    !positionsMap ||
    typeof positionsMap !== 'object' ||
    Object.keys(positionsMap).length === 0
  ) {
    return carrier;
  }

  if (draftPicksSource.length === 0) {
    return {
      teamCode: carrier.teamCode,
      draftPicks: [],
    };
  }

  const nowIso = opts.nowIso;
  const method = opts.method ?? 'lottery';

  const updatedPicks = draftPicksSource.map((pick) => {
    // Skip non-first-round picks (Phase 4 only resolves first round conveyance)
    if (pick.round !== 1) {
      return pick;
    }

    // Skip picks not in the specified year
    if (pick.year !== draftYear) {
      return pick;
    }

    // Skip picks without conveyance data
    if (!pick.conveyance || !pick.conveyance.conditions) {
      return pick;
    }

    // Skip already resolved
    if (pick.conveyanceResult) {
      return pick;
    }

    // Attempt resolution - catch any errors and leave unresolved
    try {
      return (
        toSeasonManagerDraftPick(
          resolveConveyanceForPick(pick, positionsMap, {
            draftYear,
            nowIso,
            method,
          }) as SeasonManagerDraftPickIngress | null | undefined
        ) || pick
      );
    } catch {
      // Resolution failed - leave pick unchanged
      return pick;
    }
  });

  return {
    teamCode: carrier.teamCode,
    draftPicks: updatedPicks,
  };
}
