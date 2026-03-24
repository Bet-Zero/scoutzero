/**
 * FILE: src/features/architect/utils/entitlements/seasonManagerProjection.ts
 * PURPOSE: Project entitlements into draftPick-like objects for SeasonManager consumption.
 *          This is a READ-ONLY projection layer - no writes to entitlements.
 * OWNERSHIP: Feature: architect/seasonManager (Phase 16.1)
 *
 * HISTORY:
 *  - 2026-02-01: Created for Phase 16.1 - SeasonManager Entitlement SSOT View
 *  - 2026-03-11: E52 - TS-backed authoritative implementation with JS shim compatibility
 *
 * LINKS:
 *  - Plan: docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md (Phase 16.1)
 *  - Preflight: docs/team-scrape/return_packages/PST_PHASE_16_SEASONMANAGER_ENTITLEMENTS_PREFLIGHT_RETURN_PACKAGE.md
 */

import type { EffectiveEntitlement } from './entitlementResolver';
import type { PickRuleDoc } from './pickRulesResolver';

type ProjectionEntitlement = EffectiveEntitlement & {
  id?: string;
  kind?: string;
  seasonYear?: number;
  round?: number | string;
  underlyingPickId?: string;
  swapControllerPickId?: string;
  underlyingStatus?: unknown;
};

type ConveyanceLike = {
  conditions: { active: true } | undefined;
  description: string | undefined;
  affects: string[];
};

type DraftPickLike = {
  id: string | undefined;
  year: number | undefined;
  round: number | string | undefined;
  owner: string;
  currentOwner: string;
  originalTeam: string | null;
  via: string | undefined;
  isSwap: boolean;
  swapType: 'best_of' | undefined;
  swapWithTeamId: string | null;
  protection: string | undefined;
  conveyance: ConveyanceLike | undefined;
  status: 'owned';
  resolved: false;
  resolvedOwner: null;
  resolvedPosition: null;
  stepienBlocked: false;
  stepienReason: null;
  conveyanceResult: undefined;
  tradeable: true;
  resolutionMeta: null;
  _sourceEntitlementId: string | undefined;
  _sourceKind: string | undefined;
  _underlyingStatus: unknown;
  _projectedAt: string;
};

export type SeasonManagerProjectedDraftPickView = DraftPickLike;

type ProjectionArgs = {
  entitlements: ProjectionEntitlement[] | null | undefined;
  pickRulesById?: Record<string, PickRuleDoc> | null;
  teamCode: string | null | undefined;
};

/**
 * Parse team code from a pick ID string (format: "LAL_2027_1st" -> "LAL").
 *
 * @param pickId - The pick ID to parse
 * @returns 3-letter team code or null if unparseable
 */
function parseTeamFromPickId(pickId: string | null | undefined): string | null {
  if (!pickId || typeof pickId !== 'string') return null;
  const match = pickId.match(/^([A-Z]{3})_/);
  return match ? match[1] : null;
}

/**
 * Build a minimal conveyance object from pick rule conditions.
 * SeasonManager checks for `conveyance.conditions` existence to trigger conveyance logic.
 *
 * @param pickRule - The pick rule document
 * @returns Conveyance object or undefined
 */
function buildConveyanceFromPickRule(
  pickRule: PickRuleDoc | null | undefined
): ConveyanceLike | undefined {
  if (!pickRule) return undefined;

  // Check for conditions that indicate conveyance behavior
  const hasConditions =
    Array.isArray(pickRule.conditions) && pickRule.conditions.length > 0;
  const hasProtections =
    Array.isArray(pickRule.protections) && pickRule.protections.length > 0;

  // Only build conveyance if there are conditions or protections
  if (!hasConditions && !hasProtections) return undefined;

  // Find conveyance-related conditions
  const conveyCondition = pickRule.conditions?.find(
    (c) => c.kind === 'conveys' || c.kind === 'did_not_convey'
  );

  return {
    // SeasonManager checks for truthy conditions
    conditions: hasConditions || hasProtections ? { active: true } : undefined,
    description: conveyCondition?.description || pickRule.protections?.[0]?.description,
    affects: conveyCondition?.relatedPickIds || [],
  };
}

/**
 * Extract protection string from pick rule.
 *
 * @param pickRule - The pick rule document
 * @returns Protection description or undefined
 */
function extractProtectionFromPickRule(
  pickRule: PickRuleDoc | null | undefined
): string | undefined {
  if (!pickRule?.protections?.length) return undefined;

  const protection = pickRule.protections[0];

  // Build human-readable protection text
  if (protection.type === 'lottery') {
    return 'Lottery protected';
  }

  if (protection.type === 'top_n' && protection.protectedRange) {
    const parts = protection.protectedRange.split('-').map(Number);
    const end = parts[1] ?? parts[0];
    return `Top ${end} protected`;
  }

  if (protection.type === 'range' && protection.protectedRange) {
    const [start, end] = protection.protectedRange.split('-').map(Number);
    return start === end
      ? `Pick ${start} protected`
      : `Protected ${start}-${end ?? start}`;
  }

  return protection.description || 'Protected';
}

/**
 * Project entitlements into draftPick-like objects for SeasonManager.
 *
 * This is a READ-ONLY projection that creates objects with the shape
 * SeasonManager functions expect (updateDraftPicksWithStepien,
 * resolveDraftPickSwapsForYear, resolveDraftPickConveyanceForYear).
 *
 * MINIMUM OUTPUT SHAPE (per preflight spec):
 * - year (number)
 * - round (number)
 * - owner, currentOwner (teamCode)
 * - originalTeam (parsed from underlyingPickId)
 * - isSwap (boolean)
 * - swapWithTeamId (parsed from swapControllerPickId)
 * - conveyance (optional object with conditions)
 * - protection (optional string)
 * - status, resolved, stepienBlocked defaults
 *
 * @param args
 * @returns draftPicksLike[] compatible with SeasonManager functions
 */
export function projectEntitlementsToSeasonManagerView({
  entitlements,
  pickRulesById = {},
  teamCode,
}: ProjectionArgs): DraftPickLike[] {
  if (!Array.isArray(entitlements) || entitlements.length === 0) {
    return [];
  }

  if (!teamCode) {
    // Graceful degradation - return empty if no teamCode
    return [];
  }

  return entitlements.map((ent) => {
    // Parse team codes from pick IDs
    const originalTeam = parseTeamFromPickId(ent.underlyingPickId);
    const swapTargetTeam = parseTeamFromPickId(ent.swapControllerPickId);

    // Get pick rule if available (graceful if missing)
    const pickRule =
      ent.underlyingPickId && pickRulesById
        ? pickRulesById[ent.underlyingPickId]
        : null;

    // Build conveyance data from pick rule (undefined if no rule or no conditions)
    const conveyance = buildConveyanceFromPickRule(pickRule);

    // Extract protection text from pick rule (undefined if no rule or no protections)
    const protection = extractProtectionFromPickRule(pickRule);

    // Determine if this is a swap entitlement
    const isSwap = ent.kind === 'swap_right';

    return {
      // Core identity - use entitlement ID for tracking
      id: ent.id,

      // Year and round - required by all SeasonManager functions
      year: ent.seasonYear,
      round: typeof ent.round === 'string' ? parseInt(ent.round, 10) || ent.round : ent.round,

      // Ownership fields - SeasonManager uses these for Stepien analysis
      owner: teamCode,
      currentOwner: teamCode,
      originalTeam: originalTeam, // null if unparseable (per spec)

      // Via field for UI context (optional)
      via: originalTeam && originalTeam !== teamCode ? originalTeam : undefined,

      // Swap fields - required by resolveDraftPickSwapsForYear
      isSwap: isSwap,
      swapType: isSwap ? 'best_of' : undefined, // Conservative default per spec
      swapWithTeamId: isSwap ? swapTargetTeam : null,

      // Protection and conveyance - from pick rules (optional, graceful if missing)
      protection: protection,
      conveyance: conveyance,

      // Status fields - SeasonManager writes to these
      status: 'owned',
      resolved: false,
      resolvedOwner: null,
      resolvedPosition: null,
      stepienBlocked: false,
      stepienReason: null,
      conveyanceResult: undefined,

      // Tradeable flag
      tradeable: true,

      // Resolution metadata placeholder
      resolutionMeta: null,

      // Debug/tracing metadata
      _sourceEntitlementId: ent.id,
      _sourceKind: ent.kind,
      _underlyingStatus: ent.underlyingStatus,
      _projectedAt: new Date().toISOString(),
    };
  });
}

/**
 * Select the draft picks source for SeasonManager operations.
 * Implements dual-read pattern: prefer _derivedDraftPicks, fallback to draftPicks.
 *
 * EXPORTED FOR TESTING ONLY - used by phase16 guardrail tests.
 *
 * @param teamData - Team data object
 * @returns The selected draft picks array
 */
export function __test__selectDraftPicksSource(teamData: {
  _derivedDraftPicks?: DraftPickLike[];
  draftPicks?: DraftPickLike[];
} | null | undefined): DraftPickLike[] {
  return teamData?._derivedDraftPicks || teamData?.draftPicks || [];
}

/**
 * Check if debug logging is enabled for entitlements.
 * @returns boolean
 */
function isDebugEnabled(): boolean {
  try {
    return (
      typeof import.meta !== 'undefined' &&
      import.meta.env?.VITE_DEBUG_ENTITLEMENTS === 'true'
    );
  } catch {
    return false;
  }
}

/**
 * Log debug info when derived picks are created (if debug flag enabled).
 *
 * @param teamCode
 * @param entitlementsCount
 * @param derivedPicksCount
 * @param pickRulesCount
 */
export function logDerivedPicksCreation(
  teamCode: string,
  entitlementsCount: number,
  derivedPicksCount: number,
  pickRulesCount: number
): void {
  if (isDebugEnabled()) {
    console.debug('[Phase16] Derived picks created:', {
      teamCode,
      entitlementsCount,
      derivedPicksCount,
      pickRulesCount,
    });
  }
}
