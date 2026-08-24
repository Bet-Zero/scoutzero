/**
 * Wave 15 Step 1: Per-team season-transition logic extracted from seasonManager.ts.
 * Contains processTeamSeasonTransitionWithOptions, updateDraftPicksWithStepien,
 * and all private types/helpers they depend on.
 */

import { resolveOffseasonTransition } from '@/features/architect/utils/offseason';
import {
  normalizeTeamTpeSchema,
  assertPersistableOrThrow,
  PERSISTENCE_CONTRACTS,
} from '@/features/architect/utils/persistenceContracts';
import { sanitizeTransientFieldsForPersistence } from '@/features/architect/utils/persistenceContracts/enforcement';
import { createCanonicalTeamTotalsSnapshot } from '@/features/architect/utils/capTotals';
import { resolveEntitlementsForTeam } from '@/features/architect/utils/entitlements/entitlementResolver';
import {
  resolvePickRulesByIds,
  pickRulesMapToObject,
} from '@/features/architect/utils/entitlements/pickRulesResolver';
import {
  projectEntitlementsToSeasonManagerView,
  logDerivedPicksCreation,
} from '@/features/architect/utils/entitlements/seasonManagerProjection';
import { toEndYear } from '@/features/architect/utils/seasonFormat';
import {
  isNonEmptyString,
  toDraftPickCarrier,
  getSeasonManagerDraftPicks,
  hasDraftPickIngressArray,
  toSeasonManagerDraftPicks,
  resolveDraftPickConveyanceForYear,
  resolveDraftPickSwapsForYear,
  type DraftPickCarrier,
  type SeasonManagerDraftPick,
  type SeasonManagerDraftPickIngressSource,
  type SeasonManagerDraftPickIngressList,
} from './seasonManager.draftResolution';
import type {
  OffseasonTeamCapSheet,
  OffseasonOptionDecisionMap,
  OffseasonTransitionContext,
  OffseasonTransitionResult,
} from '@/features/architect/utils/offseason/resolveOffseasonTransition';
import type { LoadedWorldTeamCapSheet } from '@/features/architect/utils/worldTeamData';
import type { CapProjectionOverrides } from '@/features/architect/utils/capRulesProfile';
// type-only back-reference to seasonManager.ts — erased at runtime, no circular dep
import type {
  SeasonAdvanceCommittedTeamSnapshot,
  SeasonAdvanceTeamSummary,
} from './seasonManager';

/* ============================
   HYDRATION STRIP HELPERS
   ============================ */

const HYDRATION_ONLY_KEYS = [
  'id', // hydrateBaseTeam display identifier
  'activeContracts', // derived from players for display
  'draftAssets', // derived from entitlements
  'mle', // flattened from exceptions.mle (already inside exceptions)
  'tpMle', // flattened from exceptions.taxpayerMle
  'bae', // flattened from exceptions.bae
  'baseline', // reference to original base doc
  '_derivedDraftPicks', // transient entitlement projection used only inside season advance
] as const;

type HydrationOnlyKey = (typeof HYDRATION_ONLY_KEYS)[number];
type HydrationStrippableTeam<T extends object> = T &
  Partial<Record<HydrationOnlyKey, unknown>>;

function stripHydrationOnlyFields<T extends object>(
  team: T | null | undefined
): T | null | undefined {
  if (!team || typeof team !== 'object') return team;
  const result: HydrationStrippableTeam<T> = { ...team };
  for (const key of HYDRATION_ONLY_KEYS) {
    delete result[key];
  }
  return result as T;
}

/**
 * Recursively removes undefined values from objects/arrays (Firestore-safe).
 * Exported because advanceSeasonInWorld uses it for batch-event sanitization.
 */
export function removeUndefinedDeep<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => removeUndefinedDeep(item)) as T;
  }
  if (typeof obj === 'object') {
    const result: Partial<T> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        result[key as keyof T] = removeUndefinedDeep(value) as T[keyof T];
      }
    }
    return result as T;
  }
  return obj;
}

/* ============================
   PRIVATE TYPES
   ============================ */

type StepienUpdate = {
  pickId: string;
  year: number;
  status: string;
  reason: string;
};
type ConveyanceResolutionEntry = {
  pickId?: string;
  year?: number;
  outcome?: string;
  position?: number;
};
type SwapResolutionEntry = {
  pickId?: string;
  year?: number;
  resolvedOwner?: string | null;
  resolvedPosition?: number | null;
};

export type DraftResolutionContext = {
  positionsMap?: Record<string, number>;
  draftYear?: number;
  worldId?: string | null;
  fromYear?: number;
  toYear?: number;
  transitionEffectiveAt?: string;
  capProjections?: CapProjectionOverrides | null;
  preserveDraftEntitlements?: boolean;
};

export type TeamSeasonTransitionResult = {
  committedTeam: SeasonAdvanceCommittedTeamSnapshot | null;
  teamSummary: SeasonAdvanceTeamSummary;
};

type SeasonManagerProjectionEntitlements = NonNullable<
  Parameters<typeof projectEntitlementsToSeasonManagerView>[0]['entitlements']
>;

type SeasonTransitionTeam = OffseasonTeamCapSheet &
  SeasonManagerDraftPickIngressSource & {
    entitlementIds?: string[];
    entitlements?: SeasonManagerProjectionEntitlements;
    _derivedDraftPicks?: SeasonManagerDraftPick[];
  };

/* ============================
   SEASON-TRANSITION HELPERS
   ============================ */

export function toSeasonTransitionTeam(
  team: LoadedWorldTeamCapSheet
): SeasonTransitionTeam {
  return {
    ...team,
    players: Array.isArray(team.players)
      ? (team.players as SeasonTransitionTeam['players'])
      : [],
    roster: Array.isArray(team.roster)
      ? (team.roster as SeasonTransitionTeam['roster'])
      : [],
    capHolds: Array.isArray(team.capHolds)
      ? (team.capHolds as SeasonTransitionTeam['capHolds'])
      : [],
    exceptions: (team.exceptions ?? null) as SeasonTransitionTeam['exceptions'],
    draftPicks: Array.isArray(team.draftPicks)
      ? (team.draftPicks as SeasonManagerDraftPickIngressList)
      : [],
    entitlementIds: Array.isArray(team.entitlementIds)
      ? team.entitlementIds
          .map((entitlementId) =>
            entitlementId == null ? null : String(entitlementId)
          )
          .filter((entitlementId): entitlementId is string =>
            Boolean(entitlementId)
          )
      : [],
  };
}

const FALLBACK_SEASON_YEAR = new Date().getFullYear();

function resolveSeasonEndYear(
  season: string | null | undefined,
  fallback = FALLBACK_SEASON_YEAR
): number {
  return toEndYear(season) ?? fallback;
}

function getUnderlyingPickId(entitlement: unknown): string | null {
  if (!entitlement || typeof entitlement !== 'object') {
    return null;
  }
  const rawPickId = (entitlement as { underlyingPickId?: unknown })
    .underlyingPickId;
  return typeof rawPickId === 'string' && rawPickId.trim().length > 0
    ? rawPickId
    : null;
}

function buildSeasonAdvanceCommittedTeamSnapshot(
  team: SeasonTransitionTeam
): SeasonAdvanceCommittedTeamSnapshot {
  // Bridge Gate: match persistWorldMutation hygiene order
  // strip hydration → sanitize transients → normalize TPE → validate contract → removeUndefined → write
  const afterHydrationStrip = stripHydrationOnlyFields(team);
  const afterSanitize =
    sanitizeTransientFieldsForPersistence(afterHydrationStrip);
  const normalizedTeam = normalizeTeamTpeSchema(
    afterSanitize as SeasonAdvanceCommittedTeamSnapshot
  ) as SeasonAdvanceCommittedTeamSnapshot;
  assertPersistableOrThrow({
    obj: normalizedTeam,
    contract: PERSISTENCE_CONTRACTS.TEAM,
    label: 'TEAM',
  });
  return removeUndefinedDeep(normalizedTeam);
}

/* ============================
   STEPIEN RECALCULATION
   ============================ */

function updateDraftPicksWithStepien(
  teamData: DraftPickCarrier,
  fromSeason: string,
  toSeason: string
) {
  void fromSeason;
  const toYear = resolveSeasonEndYear(toSeason);
  const teamCode = isNonEmptyString(teamData.teamCode)
    ? teamData.teamCode
    : null;
  const draftPicks = getSeasonManagerDraftPicks(teamData);
  let hasChanges = false;
  const stepienUpdates: StepienUpdate[] = [];

  // Separate picks into owned and owed
  const owedFirsts: SeasonManagerDraftPick[] = []; // First-round picks the team has traded away

  for (const pick of draftPicks) {
    const isFirstRound = pick.round === 1;
    if (!isFirstRound) continue;

    // Check if this is an owned pick or owed pick
    // Owned: originalTeam === teamCode AND NOT traded
    // Owed: originalTeam === teamCode AND traded/conveyed to another team
    const isOwned =
      (teamCode !== null && pick.currentOwner === teamCode) ||
      (teamCode !== null && pick.owner === teamCode && !pick.tradedTo);
    const isOwed =
      teamCode !== null &&
      pick.originalTeam === teamCode &&
      (pick.tradedTo || pick.currentOwner !== teamCode);

    if (!isOwned && isOwed) {
      owedFirsts.push(pick);
    }
  }

  // Sort owed picks by year
  owedFirsts.sort((a, b) => a.year - b.year);

  const owedYears = new Set(owedFirsts.map((p) => p.year));

  // Update each pick's status
  const updatedPicks = draftPicks.map((pick) => {
    const updatedPick = { ...pick };
    const isFirstRound = pick.round === 1;

    // Advance pick year status if needed
    if (pick.year < toYear) {
      if (pick.status === 'future' || !pick.status) {
        hasChanges = true;
        updatedPick.status = 'available';
      }
    }

    // Stepien check only for first-round picks the team owns
    if (isFirstRound && pick.year >= toYear) {
      const pickYear = pick.year;
      const isOwnedByTeam =
        (teamCode !== null && pick.currentOwner === teamCode) ||
        (teamCode !== null && pick.owner === teamCode && !pick.tradedTo);

      if (isOwnedByTeam) {
        // Check if trading this pick would create consecutive years without a first
        const prevYear = pickYear - 1;
        const nextYear = pickYear + 1;

        // A pick is Stepien-blocked if trading it would leave no first-round pick
        // in either the previous or next year
        const prevYearOwed = owedYears.has(prevYear);
        const nextYearOwed = owedYears.has(nextYear);

        // If both adjacent years are owed out, this pick is locked (Stepien)
        const isStepienBlocked = prevYearOwed && nextYearOwed;

        if (updatedPick.stepienBlocked !== isStepienBlocked) {
          hasChanges = true;
          updatedPick.stepienBlocked = isStepienBlocked;

          if (isStepienBlocked) {
            updatedPick.stepienReason = `Cannot trade: would create consecutive years (${prevYear}, ${pickYear}, ${nextYear}) without a 1st`;
            stepienUpdates.push({
              pickId: pick.id || `${teamCode}_${pickYear}_1`,
              year: pickYear,
              status: 'blocked',
              reason: updatedPick.stepienReason,
            });
          }
        }
      }
    }

    return updatedPick;
  });

  return {
    hasChanges,
    draftPicks: updatedPicks,
    stepienUpdates,
  };
}

/* ============================
   PER-TEAM SEASON TRANSITION
   ============================ */

/**
 * Process team for season transition with explicit option decisions.
 * Called once per team inside advanceSeasonInWorld's batch loop.
 */
export async function processTeamSeasonTransitionWithOptions(
  teamData: SeasonTransitionTeam,
  fromSeason: string,
  toSeason: string,
  optionDecisions: OffseasonOptionDecisionMap,
  resolutionContext: DraftResolutionContext = {}
): Promise<TeamSeasonTransitionResult> {
  let updatedTeam: SeasonTransitionTeam = { ...teamData };
  let hasChanges = false;
  const teamCode = teamData.teamCode as string;
  const teamSummary: SeasonAdvanceTeamSummary = {
    exercisedOptions: [],
    declinedOptions: [],
    expiredContracts: [],
    expiredTPEs: [],
    stepienUpdates: [],
    // Phase 5: Track draft pick resolutions
    conveyanceResolutions: [],
    swapResolutions: [],
    // Phase 76: Track non-TPE exception transitions
    transitionedExceptions: [],
  };

  // Update team season
  updatedTeam.season = toSeason;

  // ===========================================================================
  // PHASE 16.1: Derive draft picks view from entitlements (SSOT)
  // ===========================================================================
  // If team has entitlementIds, resolve and project to draftPicks-like view.
  // This is READ-ONLY - no writes to entitlements. The projection is normalized
  // once here before entering the season-manager draft-pick carrier.
  const { worldId } = resolutionContext;
  const hasEntitlementIds =
    Array.isArray(teamData.entitlementIds) &&
    teamData.entitlementIds.length > 0;
  const hasInlineEntitlements =
    Array.isArray(teamData.entitlements) && teamData.entitlements.length > 0;

  if (
    !resolutionContext.preserveDraftEntitlements &&
    (hasEntitlementIds || hasInlineEntitlements) &&
    teamCode
  ) {
    try {
      // Use inline entitlements if provided, else resolve from Firestore
      const entitlements: SeasonManagerProjectionEntitlements =
        hasInlineEntitlements
          ? teamData.entitlements || []
          : await resolveEntitlementsForTeam(worldId || null, teamCode);

      if (Array.isArray(entitlements) && entitlements.length > 0) {
        // Extract underlying pick IDs for pick rules lookup (best-effort)
        const pickIds = entitlements
          .map(getUnderlyingPickId)
          .filter((pickId): pickId is string => Boolean(pickId));

        // Resolve pick rules in batch (graceful if fails or returns empty)
        let pickRulesById: ReturnType<typeof pickRulesMapToObject> = {};
        if (pickIds.length > 0) {
          try {
            const rulesMap = await resolvePickRulesByIds(pickIds);
            pickRulesById = pickRulesMapToObject(rulesMap);
          } catch {
            // Pick rules optional - continue without them
          }
        }

        const derivedDraftPicks = projectEntitlementsToSeasonManagerView({
          entitlements,
          pickRulesById,
          teamCode,
        });
        const normalizedDerivedDraftPicks =
          toSeasonManagerDraftPicks(derivedDraftPicks) || [];

        // Attach as NON-PERSISTED field for downstream dual-read
        if (normalizedDerivedDraftPicks.length > 0) {
          updatedTeam._derivedDraftPicks = normalizedDerivedDraftPicks;
          logDerivedPicksCreation(
            teamCode,
            entitlements.length,
            normalizedDerivedDraftPicks.length,
            Object.keys(pickRulesById).length
          );
        }
      }
    } catch {
      // Entitlement resolution failed - continue with legacy draftPicks
      // This ensures graceful degradation
    }
  }

  // ===========================================================================
  // PHASE 5: Auto-resolve draft picks BEFORE other processing
  // ===========================================================================
  // Resolution order: conveyance first, then swaps
  // This ensures that rolled picks are properly tracked before swap resolution
  const positionsMap = resolutionContext.positionsMap;
  const draftYear = resolutionContext.draftYear;
  const initialDraftPicks = getSeasonManagerDraftPicks(updatedTeam);
  if (
    !resolutionContext.preserveDraftEntitlements &&
    hasDraftPickIngressArray(updatedTeam)
  ) {
    updatedTeam.draftPicks = initialDraftPicks;
  }

  if (
    !resolutionContext.preserveDraftEntitlements &&
    positionsMap &&
    draftYear &&
    Object.keys(positionsMap).length > 0
  ) {
    const resolutionOpts = {
      nowIso: new Date().toISOString(),
      method: 'season_advance',
    };

    // 1) Resolve conveyance (protections rolling forward / converting)
    const conveyanceInput = toDraftPickCarrier(updatedTeam, teamCode);
    const afterConveyance = resolveDraftPickConveyanceForYear(
      conveyanceInput,
      draftYear,
      positionsMap,
      resolutionOpts
    );

    // Track conveyance resolutions
    // Build a Set of original pick IDs that already had conveyanceResult for O(1) lookup
    const originalConveyedIds = new Set(
      getSeasonManagerDraftPicks(teamData)
        .filter((pick) => pick?.conveyanceResult)
        .map((pick) => pick.id)
        .filter((pickId): pickId is string => typeof pickId === 'string')
    );

    const afterConveyanceDraftPicks = afterConveyance.draftPicks || [];

    if (afterConveyanceDraftPicks.length > 0) {
      const conveyedPicks = afterConveyanceDraftPicks.filter(
        (pick) =>
          pick?.conveyanceResult &&
          !(typeof pick.id === 'string' && originalConveyedIds.has(pick.id))
      );
      for (const pick of conveyedPicks) {
        const convResult = pick.conveyanceResult || undefined;
        teamSummary.conveyanceResolutions.push({
          pickId: pick.id,
          year: pick.year,
          outcome: convResult?.outcome,
          position: convResult?.position,
        });
        hasChanges = true;
      }
      updatedTeam.draftPicks = afterConveyanceDraftPicks;
    }

    // 2) Resolve swaps (best_of / worst_of resolution)
    // IMPORTANT: Pass afterConveyance (not updatedTeam) so swaps see post-conveyance state
    const swapResolutionInput: DraftPickCarrier = {
      teamCode,
      draftPicks: afterConveyanceDraftPicks,
    };
    const afterSwaps = resolveDraftPickSwapsForYear(
      swapResolutionInput,
      draftYear,
      positionsMap,
      resolutionOpts
    );

    // Track swap resolutions
    // Build a Set of original pick IDs that were already resolved for O(1) lookup
    const originalResolvedIds = new Set(
      getSeasonManagerDraftPicks(teamData)
        .filter((pick) => pick?.resolved === true)
        .map((pick) => pick.id)
        .filter((pickId): pickId is string => typeof pickId === 'string')
    );

    const afterSwapsDraftPicks = afterSwaps.draftPicks || [];

    if (afterSwapsDraftPicks.length > 0) {
      const resolvedSwaps = afterSwapsDraftPicks.filter(
        (pick) =>
          pick?.resolved === true &&
          !(typeof pick.id === 'string' && originalResolvedIds.has(pick.id))
      );
      for (const pick of resolvedSwaps) {
        teamSummary.swapResolutions.push({
          pickId: pick.id,
          year: pick.year,
          resolvedOwner: pick.resolvedOwner,
          resolvedPosition: pick.resolvedPosition,
        });
        hasChanges = true;
      }
      updatedTeam.draftPicks = afterSwapsDraftPicks;
    }
  }

  // Offseason transition SSOT (OSTE)
  const toYear = resolutionContext.toYear ?? resolveSeasonEndYear(toSeason);
  const fromYear =
    resolutionContext.fromYear ?? resolveSeasonEndYear(fromSeason, toYear - 1);
  const transitionContext: OffseasonTransitionContext = {
    worldId: worldId || null,
    teamCode,
    capProjections: resolutionContext.capProjections,
    effectiveAt: resolutionContext.transitionEffectiveAt,
  };
  const transitionResult: OffseasonTransitionResult =
    resolveOffseasonTransition({
      teamCapSheet: updatedTeam,
      fromYear,
      toYear,
      optionDecisions,
      context: transitionContext,
    });

  if (!transitionResult.success) {
    const message =
      transitionResult.error ||
      transitionResult.violations?.[0]?.message ||
      'Offseason transition blocked';
    throw new Error(`[OSTE] ${teamCode}: ${message}`);
  }

  updatedTeam = {
    ...updatedTeam,
    ...(transitionResult.nextTeamCapSheet || {}),
  };
  hasChanges = true;

  if (transitionResult.appliedChangesSummary) {
    teamSummary.exercisedOptions =
      transitionResult.appliedChangesSummary.exercisedOptions || [];
    teamSummary.declinedOptions =
      transitionResult.appliedChangesSummary.declinedOptions || [];
    teamSummary.expiredContracts =
      transitionResult.appliedChangesSummary.expiredContracts || [];
    teamSummary.expiredTPEs =
      transitionResult.appliedChangesSummary.expiredTPEs || [];
    teamSummary.transitionedExceptions =
      transitionResult.appliedChangesSummary.transitionedExceptions || [];
  }

  // Update draft picks with Stepien recalculation
  if (!resolutionContext.preserveDraftEntitlements) {
    const draftPicksResult = updateDraftPicksWithStepien(
      toDraftPickCarrier(updatedTeam, teamCode),
      fromSeason,
      toSeason
    );
    if (draftPicksResult.hasChanges) {
      hasChanges = true;
      updatedTeam.draftPicks = draftPicksResult.draftPicks;
      teamSummary.stepienUpdates = draftPicksResult.stepienUpdates || [];
    }
  }

  // ===========================================================================
  // PHASE 77: Recalculate cap totals using SSOT
  // ===========================================================================
  // Always recompute totals for the new year using SSOT function.
  // This replaces the legacy updateTeamCapTotals() dynamic import.
  // Runs AFTER TPE expiry (Phase 53), non-TPE reset (Phase 76), and all roster changes.
  if (hasChanges) {
    updatedTeam.totals = createCanonicalTeamTotalsSnapshot(
      updatedTeam,
      toYear,
      {
        asOfDate: resolutionContext.transitionEffectiveAt,
        capProjections: resolutionContext.capProjections,
      }
    );
  }

  const committedTeam = hasChanges
    ? buildSeasonAdvanceCommittedTeamSnapshot(updatedTeam)
    : null;

  return {
    committedTeam,
    teamSummary,
  };
}
