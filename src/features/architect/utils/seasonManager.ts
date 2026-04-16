/**
 * Season Manager
 *
 * Handles season advancement logic: contract expirations, options, empty roster charges,
 * draft pick updates, cap hold processing, and Stepien recalculation.
 *
 * ARCHITECT OWNERSHIP:
 * - Season-transition authority.
 * - Owns advanceSeasonInWorld(...) and the committed write path for season/world advancement.
 * - Sibling committed-write authority to mutationPipeline.ts with a different scope.
 * - Shares lower-level persistence hygiene with mutationPipeline.ts via persistenceContracts/enforcement.ts.
 * - Not a general-purpose substitute for applyWorldMutation(...).
 *
 * @file src/features/architect/utils/seasonManager.ts
 * @module seasonManager
 *
 * HISTORY:
 *  - 2025-12-20: Phase 3B - Added advanceSeasonInWorld with explicit option decisions
 *                         - Added Stepien recalculation for draft picks
 *                         - Refactored processOptions to accept optionDecisions
 *  - 2026-01-04: Phase 3 - Added resolveDraftPickSwapsForYear for swap resolution
 *  - 2026-01-07: Phase 5 - Added auto-resolution of conveyance + swaps during season advance
 *                         - Reads positionsMap from world.draftPositionsByYear
 *  - 2026-01-18: Phase 7.2 - Option decline FA-year derivation + cap hold multipliers
 *  - 2026-02-01: Phase 77 - Replaced legacy updateTeamCapTotals with SSOT computeTeamCapTotals
 *                         - Totals recompute uses toYear yearKey for correct season
 *                         - Removed dynamic imports of tradeManager for totals
 *  - 2026-02-03: Phase 86 - Route season transitions through OSTE SSOT
 */

import { db } from '@/firebaseConfig';
import {
  writeBatch,
  serverTimestamp,
  increment,
  doc,
} from 'firebase/firestore';
import { getLeague } from '@/features/architect/utils/teamLoader';
import {
  getWorldMetadata,
  getDraftPositionsMap,
} from '@/features/architect/utils/worldManager';
import {
  getSeasonAdvanceDraftContext,
  toEndYear,
  toSeasonCode,
} from '@/features/architect/utils/seasonFormat';
import {
  worldTeamRef,
  worldMetadataRef,
} from '@/features/architect/utils/architectFirestorePaths';
import { getCapSettings } from '@/features/architect/utils/tradeMachine/utils/capSettingsProvider';
import { resolvePickSwap } from '@/features/architect/utils/tradeMachine/utils/swapResolution';
import { resolveConveyanceForPick } from '@/features/architect/utils/tradeMachine/utils/conveyanceResolution';
import { resolveOffseasonTransition } from '@/features/architect/utils/offseason';
// Phase 65: Canonical TPE normalization for persistence
import {
  normalizeTeamTpeSchema,
  assertPersistableOrThrow,
  PERSISTENCE_CONTRACTS,
} from '@/features/architect/utils/persistenceContracts';
import { sanitizeTransientFieldsForPersistence } from '@/features/architect/utils/persistenceContracts/enforcement';
import {
  POST_STATE_CAP_VALIDATOR_VERSION,
  validatePostStateCapLegality,
} from '@/features/architect/utils/capLegality/postStateCapValidator';
import type {
  PostStateCapValidationInput,
  PostStateCapValidationIssue,
} from '@/features/architect/utils/capLegality/postStateCapValidator';
import {
  ARCHITECT_WORLDS_COLLECTION,
  ARCHITECT_WORLD_EVENTS_SUBCOLLECTION,
} from '@/constants/collections';
// Phase 77: SSOT cap totals for season advance
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals';
// Phase 16.1: Entitlement SSOT for season manager
import { resolveEntitlementsForTeam } from '@/features/architect/utils/entitlements/entitlementResolver';
import {
  resolvePickRulesByIds,
  pickRulesMapToObject,
} from '@/features/architect/utils/entitlements/pickRulesResolver';
import {
  projectEntitlementsToSeasonManagerView,
  logDerivedPicksCreation,
} from '@/features/architect/utils/entitlements/seasonManagerProjection';
import type { SeasonManagerProjectedDraftPickView } from '@/features/architect/utils/entitlements/seasonManagerProjection';
// DARE: Draft Asset Resolution Engine for entitlement lifecycle persistence (B2/B3)
import {
  resolveAllDraftAssets,
  applyGatedDAREResultsToBatch,
  formatReceiptAsSummary,
} from '@/features/architect/utils/entitlements/dare';
import type { DAREResolutionReceipt } from '@/features/architect/utils/entitlements/dare';
import type {
  OffseasonAppliedChangesSummary,
  OffseasonOptionDecisionMap,
  OffseasonTeamCapSheet,
  OffseasonTransitionContext,
  OffseasonTransitionResult,
} from '@/features/architect/utils/offseason/resolveOffseasonTransition';
import type { TeamHistoryCapSheetLike } from '@/features/architect/history/TeamHistoryTab/types';
import type { LoadedWorldTeamCapSheet } from '@/features/architect/utils/worldTeamData';

const CAP_AUDIT_EVENT_SCHEMA_VERSION = 'cap-audit-event-v1';
const SEASON_ADVANCE_MUTATION_TYPE = 'seasonAdvance';

function generateSeasonAdvanceOperationId(timestamp = Date.now()) {
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  return `op_${timestamp}_${randomSuffix}`;
}

function safeCloneForAudit(value: unknown): unknown {
  if (value === null || value === undefined || typeof value !== 'object') {
    return value;
  }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

function buildPostStateRulesContext(
  year: number
): NonNullable<PostStateCapValidationInput['rulesContext']> {
  const capSettingsResult = getCapSettings({ year });
  const minimumTeamSalary = Number(capSettingsResult?.settings?.floor);

  return {
    capSettings: capSettingsResult?.settings || null,
    minimumTeamSalary: Number.isFinite(minimumTeamSalary)
      ? minimumTeamSalary
      : undefined,
    capSettingsSource: capSettingsResult?.source || null,
  };
}

/**
 * Strips hydration-only or season-manager transient fields that are derived
 * during load/advance and must not be persisted.
 */
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
 * Recursively removes undefined values from objects/arrays (Firestore-safe)
 * @param {any} obj - Object or array to sanitize
 * @returns {any} Sanitized copy with no undefined values
 */
function removeUndefinedDeep<T>(obj: T): T {
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
        result[key as keyof T] = removeUndefinedDeep(
          value
        ) as T[keyof T];
      }
    }
    return result as T;
  }
  return obj;
}

type StepienUpdate = { pickId: string; year: number; status: string; reason: string };
type ConveyanceResolutionEntry = { pickId?: string; year?: number; outcome?: string; position?: number };
type SwapResolutionEntry = { pickId?: string; year?: number; resolvedOwner?: string | null; resolvedPosition?: number | null };

export type SeasonAdvanceRequest = {
  fromSeason?: string;
  toSeason?: string;
  optionDecisions?: OffseasonOptionDecisionMap;
  focusTeamCode?: string;
};

type DraftResolutionContext = {
  positionsMap?: Record<string, number>;
  draftYear?: number;
  worldId?: string | null;
};

type TeamSeasonTransitionResult = {
  committedTeam: SeasonAdvanceCommittedTeamSnapshot | null;
  teamSummary: SeasonAdvanceTeamSummary;
};

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

type SeasonManagerDraftPick = {
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

type SeasonManagerDraftPickIngressList = ReadonlyArray<
  SeasonManagerDraftPickIngress | null | undefined
>;

type DraftPickCarrier = {
  teamCode?: string | null;
  draftPicks?: SeasonManagerDraftPick[];
};

type SeasonManagerDraftPickIngressSource = {
  teamCode?: string | null;
  // Legacy snapshots and entitlement projection can still feed mixed pick
  // objects here, but only through this explicit ingress slice. Everything is
  // normalized immediately by toSeasonManagerDraftPicks before computation.
  _derivedDraftPicks?: SeasonManagerDraftPickIngressList;
  draftPicks?: SeasonManagerDraftPickIngressList;
};

type SeasonManagerProjectionEntitlements = NonNullable<
  Parameters<typeof projectEntitlementsToSeasonManagerView>[0]['entitlements']
>;

type SeasonTransitionTeam = OffseasonTeamCapSheet &
  SeasonManagerDraftPickIngressSource & {
    entitlementIds?: string[];
    entitlements?: SeasonManagerProjectionEntitlements;
  };

// These allowlisted persistence metadata fields are intentionally preserve-only:
// season advance does not compute them, but legacy/base/world snapshots can carry
// mixed shapes that should survive the committed team write if already present.
type SeasonAdvancePreservedPersistenceFields = {
  city?: string | null;
  conference?: string | null;
  division?: string | null;
  source?: unknown;
  lastUpdated?: unknown;
  version?: unknown;
  mergedAt?: unknown;
  _meta?: unknown;
};

type SeasonAdvancePersistedTeamSnapshot = Pick<
  LoadedWorldTeamCapSheet,
  | 'teamCode'
  | 'teamName'
  | 'season'
  | 'abbreviation'
  | 'players'
  | 'roster'
  | 'capHolds'
  | 'deadCap'
  | 'draftPicks'
  | 'draftPicksInventory'
  | 'draftPicksObligations'
  | 'draftPicksContested'
  | 'entitlementIds'
  | 'offerSheets'
  | 'incomingOfferSheets'
  | 'exceptions'
  | 'totals'
  | 'hardCapLevel'
  | 'hardCapReason'
  | 'hardCapTriggeredBy'
  | 'hardCapped'
> &
  Pick<OffseasonTeamCapSheet, 'exceptionHistory'> &
  SeasonAdvancePreservedPersistenceFields;

export type SeasonAdvanceFocusTeamSnapshot = Pick<
  SeasonAdvancePersistedTeamSnapshot,
  | 'teamCode'
  | 'teamName'
  | 'season'
  | 'abbreviation'
  | 'players'
  | 'roster'
  | 'capHolds'
  | 'deadCap'
  | 'draftPicks'
  | 'offerSheets'
  | 'incomingOfferSheets'
  | 'exceptions'
  | 'exceptionHistory'
  | 'totals'
  | 'hardCapLevel'
  | 'hardCapReason'
  | 'hardCapTriggeredBy'
  | 'hardCapped'
> &
  Pick<
    TeamHistoryCapSheetLike,
    'waivedContracts' | 'mleHistory' | 'pickLog' | 'currentPicks' | 'historyTimeline'
  >;

type SeasonAdvanceCommittedTeamSnapshot = SeasonAdvancePersistedTeamSnapshot &
  Partial<SeasonAdvanceFocusTeamSnapshot>;

type PostStateTeamSnapshots = NonNullable<
  PostStateCapValidationInput['beforeTeamsByCode']
>;

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

function toSeasonManagerDraftPick(
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

function getSeasonManagerDraftPicks(
  teamData: SeasonManagerDraftPickIngressSource | DraftPickCarrier
): SeasonManagerDraftPick[] {
  const ingressSource = teamData as SeasonManagerDraftPickIngressSource;
  if (Array.isArray(ingressSource._derivedDraftPicks)) {
    return toSeasonManagerDraftPicks(ingressSource._derivedDraftPicks) || [];
  }

  return toSeasonManagerDraftPicks(teamData.draftPicks) || [];
}

function hasDraftPickIngressArray(
  teamData: SeasonManagerDraftPickIngressSource
): boolean {
  return (
    Array.isArray(teamData._derivedDraftPicks) ||
    Array.isArray(teamData.draftPicks)
  );
}

function toDraftPickCarrier(
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

function toSeasonManagerDraftPicks(
  draftPicks: SeasonManagerDraftPickIngressList | null | undefined
): SeasonManagerDraftPick[] | null {
  if (!Array.isArray(draftPicks)) {
    return null;
  }

  return draftPicks
    .map(toSeasonManagerDraftPick)
    .filter((pick): pick is SeasonManagerDraftPick => pick !== null);
}

type SeasonAdvanceExpiredTpe =
  OffseasonAppliedChangesSummary['expiredTPEs'][number] & {
    teamCode?: string;
  };

type SeasonAdvanceTeamSummary = Pick<
  OffseasonAppliedChangesSummary,
  | 'exercisedOptions'
  | 'declinedOptions'
  | 'expiredContracts'
  | 'transitionedExceptions'
> & {
  expiredTPEs: SeasonAdvanceExpiredTpe[];
  stepienUpdates: StepienUpdate[];
  conveyanceResolutions: ConveyanceResolutionEntry[];
  swapResolutions: SwapResolutionEntry[];
};

export type SeasonAdvanceSummary = SeasonAdvanceTeamSummary & {
  dareReceipt?: DAREResolutionReceipt;
  dareWriteCount?: number;
  dareError?: string;
};

type SeasonAdvanceIssue = PostStateCapValidationIssue;

type SeasonAdvanceDraftResolutionInfo = {
  draftYear: number;
  hadPositions: boolean;
  resolvedConveyances?: number;
  resolvedSwaps?: number;
};

export type SeasonAdvanceCommittedMetadata = {
  currentSeason: string;
  currentYear: number;
  lastModifiedTeams: string[];
};

export type SeasonAdvanceCommittedEvent = {
  eventId: string;
  occurredAt: string;
};

/**
 * Commit-time season-advance artifact returned to the dashboard layer.
 * This guarantees the metadata/event written by the authoritative batch plus
 * an optional focus-team snapshot captured from that same commit window.
 * It does not replace the broader read-stack reload that may still be needed
 * for league-wide/world-visible reconciliation after season advance.
 */
export type SeasonAdvanceCommittedState = {
  metadata: SeasonAdvanceCommittedMetadata;
  event: SeasonAdvanceCommittedEvent;
  focusTeamCode?: string;
  focusTeamSnapshot?: SeasonAdvanceFocusTeamSnapshot | null;
};

type BuildSeasonAdvanceCommittedStateParams = {
  metadata: SeasonAdvanceCommittedMetadata;
  event: SeasonAdvanceCommittedEvent;
  focusTeamCode: string | null;
  focusTeamSnapshot: SeasonAdvanceFocusTeamSnapshot | null;
};

function buildSeasonAdvanceCommittedState({
  metadata,
  event,
  focusTeamCode,
  focusTeamSnapshot,
}: BuildSeasonAdvanceCommittedStateParams): SeasonAdvanceCommittedState {
  return {
    metadata,
    event,
    focusTeamCode: focusTeamCode ?? undefined,
    focusTeamSnapshot: focusTeamCode ? focusTeamSnapshot : null,
  };
}

const FOCUS_TEAM_SNAPSHOT_KEYS = [
  'teamCode',
  'teamName',
  'season',
  'abbreviation',
  'players',
  'roster',
  'capHolds',
  'deadCap',
  'draftPicks',
  'offerSheets',
  'incomingOfferSheets',
  'exceptions',
  'exceptionHistory',
  'totals',
  'hardCapLevel',
  'hardCapReason',
  'hardCapTriggeredBy',
  'hardCapped',
  'waivedContracts',
  'mleHistory',
  'pickLog',
  'currentPicks',
  'historyTimeline',
] as const satisfies readonly (keyof SeasonAdvanceFocusTeamSnapshot)[];

function copyFocusTeamSnapshotField<
  K extends keyof SeasonAdvanceFocusTeamSnapshot,
>(
  source: SeasonAdvanceCommittedTeamSnapshot,
  target: Partial<SeasonAdvanceFocusTeamSnapshot>,
  key: K
) {
  const value = source[key];
  if (value !== undefined) {
    target[key] = value as SeasonAdvanceFocusTeamSnapshot[K];
  }
}

function buildSeasonAdvanceFocusTeamSnapshot(
  team: SeasonAdvanceCommittedTeamSnapshot
): SeasonAdvanceFocusTeamSnapshot {
  const snapshot: Partial<SeasonAdvanceFocusTeamSnapshot> = {};

  for (const key of FOCUS_TEAM_SNAPSHOT_KEYS) {
    copyFocusTeamSnapshotField(team, snapshot, key);
  }

  return removeUndefinedDeep(snapshot) as SeasonAdvanceFocusTeamSnapshot;
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

export type SeasonAdvanceSuccessResult = {
  success: true;
  fromSeason: string;
  toSeason: string;
  updatedTeams: string[];
  summary: SeasonAdvanceSummary;
  draftResolutionInfo: SeasonAdvanceDraftResolutionInfo;
  committedState: SeasonAdvanceCommittedState;
};

export type SeasonAdvanceFailureResult = {
  success: false;
  error: string;
  worldSeason?: string;
  attemptedFromSeason?: string;
  attemptedToSeason?: string;
  violations?: SeasonAdvanceIssue[];
  warnings?: SeasonAdvanceIssue[];
};

type SeasonAdvanceResultBase = {
  toSeason?: string;
  summary?: SeasonAdvanceSummary;
  error?: string;
  violations?: SeasonAdvanceIssue[];
  warnings?: SeasonAdvanceIssue[];
};

export type SeasonAdvanceResult =
  | (SeasonAdvanceSuccessResult & SeasonAdvanceResultBase)
  | (SeasonAdvanceFailureResult & SeasonAdvanceResultBase);

const FALLBACK_SEASON_YEAR = new Date().getFullYear();

function resolveSeasonEndYear(
  season: string | null | undefined,
  fallback = FALLBACK_SEASON_YEAR
): number {
  return toEndYear(season) ?? fallback;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function getErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') {
    return null;
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
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

// ==============================================================================
// PHASE 3B: ENHANCED SEASON ADVANCEMENT WITH OPTION DECISIONS
// ==============================================================================

/**
 * Advance world to next season with explicit option decisions
 *
 * Architect-wide committed season transition entrypoint.
 * This authority is a sibling to mutationPipeline.ts: season/world transitions
 * stay here, while point-in-time world mutations stay in mutationPipeline.ts.
 *
 * This is the Phase 3B implementation that:
 * 1. Requires explicit option decisions (no silent defaults)
 * 2. Runs Stepien recalculation for draft picks
 * 3. Persists atomically to architect_worlds
 * 4. Updates world metadata stats
 *
 * @param {string} worldId - World ID (required)
 * @param {Object} options - Season advance options
 * @param {string} [options.fromSeason] - Current season code (defaults to world's currentSeason)
 * @param {string} [options.toSeason] - Target season code (defaults to next season)
 * @param {Object} [options.optionDecisions={}] - Map of playerId to decision
 * @param {string} [options.focusTeamCode] - Active team whose committed snapshot should be surfaced back to the UI
 *   Each entry: { decision: 'exercise' | 'decline', optionType: 'player' | 'team', season: string }
 * @returns {Promise<Object>} Season advancement result
 */
export async function advanceSeasonInWorld(
  worldId: string,
  options: SeasonAdvanceRequest = {}
): Promise<SeasonAdvanceResult> {
  if (!worldId) {
    return { success: false, error: 'worldId is required' };
  }

  const operationTimestamp = Date.now();
  const operationId = generateSeasonAdvanceOperationId(operationTimestamp);
  const occurredAt = new Date(operationTimestamp).toISOString();
  const optionDecisions = options.optionDecisions || {};
  const focusTeamCode = isNonEmptyString(options.focusTeamCode)
    ? options.focusTeamCode
    : null;

  try {
    // Get current world metadata
    const worldMeta = await getWorldMetadata(worldId);

    // Get world's actual current season - this is the single source of truth
    const worldCurrentSeason = worldMeta.currentSeason;
    if (!worldCurrentSeason) {
      return { success: false, error: 'World metadata missing currentSeason' };
    }

    // ===========================================================================
    // PHASE 5 PATCH: Mismatch safety check
    // ===========================================================================
    // If caller passes fromSeason or toSeason that conflict with worldMeta, return error.
    // This prevents desync bugs where UI shows a different year than the world.
    if (options.fromSeason && options.fromSeason !== worldCurrentSeason) {
      return {
        success: false,
        error: `Season mismatch: caller passed fromSeason="${options.fromSeason}" but world is at "${worldCurrentSeason}". Use worldMeta.currentSeason as source of truth.`,
        worldSeason: worldCurrentSeason,
        attemptedFromSeason: options.fromSeason,
      };
    }

    const seasonAdvanceDraftContext =
      getSeasonAdvanceDraftContext(worldCurrentSeason);
    if (!seasonAdvanceDraftContext) {
      throw new Error(
        `Could not resolve draft year for world season "${worldCurrentSeason}"`
      );
    }

    const expectedToSeason = seasonAdvanceDraftContext.nextSeason;
    if (options.toSeason && options.toSeason !== expectedToSeason) {
      return {
        success: false,
        error: `Season mismatch: caller passed toSeason="${options.toSeason}" but expected "${expectedToSeason}" (advancing from "${worldCurrentSeason}"). Use worldMeta.currentSeason as source of truth.`,
        worldSeason: worldCurrentSeason,
        attemptedToSeason: options.toSeason,
      };
    }

    // Always use world's current season as the source of truth
    const fromSeason = seasonAdvanceDraftContext.authoritativeSeason;
    const draftYear = seasonAdvanceDraftContext.nextUsedDraftYear;
    const fromYear = draftYear;
    const toYear = fromYear + 1;
    const toSeason = seasonAdvanceDraftContext.nextSeason;

    // ===========================================================================
    // PHASE 5: Load draft positions for the draft year being advanced past
    // ===========================================================================
    // When advancing from 2025-26 to 2026-27, we're passing the 2026 draft.
    // Load positions for fromYear (the draft that just happened).
    const positionsMap = await getDraftPositionsMap(worldId, draftYear);

    // Load all teams in the world
    const teams = await getLeague(worldId);

    const batch = writeBatch(db);
    const updatedTeams = [];
    let focusTeamSnapshot: SeasonAdvanceFocusTeamSnapshot | null = null;
    const beforeTeamsByCode: PostStateTeamSnapshots = {};
    const afterTeamsByCode: PostStateTeamSnapshots = {};
    const beforeTotalsByTeam: NonNullable<
      PostStateCapValidationInput['beforeTotalsByTeam']
    > = {};
    const afterTotalsByTeam: NonNullable<
      PostStateCapValidationInput['afterTotalsByTeam']
    > = {};
    const summary: SeasonAdvanceSummary = {
      exercisedOptions: [],
      declinedOptions: [],
      expiredContracts: [],
      transitionedExceptions: [],
      stepienUpdates: [],
      expiredTPEs: [],
      // Phase 5: Track draft pick resolutions
      conveyanceResolutions: [],
      swapResolutions: [],
    };

    // Process each team
    for (const team of teams) {
      const teamCode = team.teamCode;
      if (!isNonEmptyString(teamCode)) {
        throw new Error('Encountered team without teamCode during season advance');
      }

      // Process team for season transition with explicit option decisions
      // Phase 5: Also pass positionsMap + draftYear for auto-resolution
      // Phase 53: Pass worldId for TPE expiry history logging
      const { committedTeam, teamSummary } =
        await processTeamSeasonTransitionWithOptions(
          team,
          fromSeason,
          toSeason,
          optionDecisions,
          { positionsMap, draftYear, worldId }
        );

      // Merge summaries
      if (teamSummary.exercisedOptions.length > 0) {
        summary.exercisedOptions.push(...teamSummary.exercisedOptions);
      }
      if (teamSummary.declinedOptions.length > 0) {
        summary.declinedOptions.push(...teamSummary.declinedOptions);
      }
      if (teamSummary.expiredContracts.length > 0) {
        summary.expiredContracts.push(...teamSummary.expiredContracts);
      }
      if (teamSummary.transitionedExceptions.length > 0) {
        summary.transitionedExceptions.push(
          ...teamSummary.transitionedExceptions
        );
      }
      if (teamSummary.stepienUpdates.length > 0) {
        summary.stepienUpdates.push(...teamSummary.stepienUpdates);
      }
      if (teamSummary.expiredTPEs?.length > 0) {
        // Embellish with team info for global summary
        summary.expiredTPEs.push(
          ...teamSummary.expiredTPEs.map(
            (tpe): SeasonAdvanceExpiredTpe => ({
              ...tpe,
              teamCode,
            })
          )
        );
      }
      // Phase 5: Merge resolution summaries
      if (teamSummary.conveyanceResolutions?.length > 0) {
        summary.conveyanceResolutions.push(
          ...teamSummary.conveyanceResolutions
        );
      }
      if (teamSummary.swapResolutions?.length > 0) {
        summary.swapResolutions.push(...teamSummary.swapResolutions);
      }

      // Save snapshot if team was modified
      // Phase 65: Normalize TPE schema before persistence
      // Phase D4: Remove undefined values to prevent Firestore errors
      if (committedTeam) {
        beforeTeamsByCode[teamCode] = safeCloneForAudit(
          team
        ) as PostStateTeamSnapshots[string];
        afterTeamsByCode[teamCode] = safeCloneForAudit(
          committedTeam
        ) as PostStateTeamSnapshots[string];
        beforeTotalsByTeam[teamCode] = computeTeamCapTotals(team, toYear);
        afterTotalsByTeam[teamCode] = computeTeamCapTotals(
          committedTeam,
          toYear
        );

        const snapshotRef = worldTeamRef(worldId, teamCode);
        batch.set(snapshotRef, committedTeam);
        if (focusTeamCode && teamCode === focusTeamCode) {
          const safeTeam = buildSeasonAdvanceFocusTeamSnapshot(committedTeam);
          focusTeamSnapshot = safeCloneForAudit(safeTeam) as SeasonAdvanceFocusTeamSnapshot;
        }
        updatedTeams.push(teamCode);
      }
    }

    // Season advance intentionally reuses the shared post-state final-artifact
    // validator after all snapshots/totals are computed and before batch commit.
    const postStateValidation = validatePostStateCapLegality({
      operationId,
      mutationType: SEASON_ADVANCE_MUTATION_TYPE,
      worldId,
      year: toYear,
      toYear,
      beforeTeamsByCode,
      afterTeamsByCode,
      beforeTotalsByTeam,
      afterTotalsByTeam,
      rulesContext: buildPostStateRulesContext(toYear),
    });

    if (!postStateValidation.valid) {
      return {
        success: false,
        error: 'Post-state cap validation failed for season advance',
        violations: postStateValidation.violations,
        warnings: postStateValidation.warnings || [],
      };
    }

    // ==========================================================================
    // DARE: Draft Asset Resolution Engine - Persist entitlement lifecycle (B2/B3)
    // ==========================================================================
    // Runs AFTER all teams processed, BEFORE batch commit.
    // Resolves swap/conveyance outcomes and persists back to world entitlements.
    if (
      positionsMap &&
      typeof draftYear === 'number' &&
      Object.keys(positionsMap).length > 0
    ) {
      try {
        // Build DARE input from processed teams
        const dareTeams = teams
          .map((t) => ({
            teamCode: isNonEmptyString(t.teamCode) ? t.teamCode : null,
            entitlementIds: Array.isArray(t.entitlementIds)
              ? t.entitlementIds.filter((id): id is string => isNonEmptyString(id))
              : [],
          }))
          .filter(
            (
              team
            ): team is {
              teamCode: string;
              entitlementIds: string[];
            } => isNonEmptyString(team.teamCode)
          );
        const dareInput = {
          worldId,
          draftYear,
          positionsMap,
          teams: dareTeams,
          nowIso: new Date().toISOString(),
          method: 'season_advance' as const,
        } as Parameters<typeof resolveAllDraftAssets>[1];

        const dareResult = await resolveAllDraftAssets(db, dareInput);

        if (dareResult.success) {
          // Build full pre-DARE entitlement state for league-wide gated validation.
          // Fail closed: if any team cannot be resolved, block season advance.
          const currentEntitlementsByTeam: Parameters<
            typeof applyGatedDAREResultsToBatch
          >[4] = {};
          for (const teamEntry of teams) {
            const teamCode = teamEntry.teamCode;
            if (!isNonEmptyString(teamCode)) {
              throw new Error(
                'DARE gated persistence unavailable — encountered team without teamCode.'
              );
            }
            const resolved = await resolveEntitlementsForTeam(
              worldId,
              teamCode
            );
            if (!Array.isArray(resolved)) {
              throw new Error(
                `DARE gated persistence unavailable — entitlement set for ${teamCode} is not an array.`
              );
            }
            currentEntitlementsByTeam[teamCode] = resolved;
          }

          // Apply DARE writes to the batch through the gated mutator.
          const gatedDareWriteResult = applyGatedDAREResultsToBatch(
            db,
            batch,
            worldId,
            dareResult,
            currentEntitlementsByTeam
          );

          if (gatedDareWriteResult.ok === false) {
            const gateMessage = gatedDareWriteResult.message;
            throw new Error(
              `DARE gated persistence blocked season advance: ${gateMessage}`
            );
          }

          const dareWriteCount = gatedDareWriteResult.writeCount;

          // Merge DARE receipt into summary
          summary.dareReceipt = dareResult.resolutionReceipt;
          summary.dareWriteCount = dareWriteCount;

          // Log DARE summary
          if (dareResult.resolutionReceipt.totalResolutions > 0) {
            console.log(
              `[seasonManager] DARE: ${formatReceiptAsSummary(dareResult.resolutionReceipt)}`
            );
          }
        } else {
          // DARE failed but don't block season advance - log warning
          console.warn(
            `[seasonManager] DARE resolution failed: ${dareResult.error}`
          );
          summary.dareError = dareResult.error;
        }
      } catch (dareErr) {
        const dareMessage = getErrorMessage(dareErr);
        const invariantViolation =
          getErrorCode(dareErr) === 'ENTITLEMENT_INVARIANT_VIOLATION' ||
          dareMessage.includes('ENTITLEMENT_INVARIANT_VIOLATION');
        // Gate failures are ship blockers: fail season advance loudly.
        if (
          dareMessage.includes('DARE gated persistence') ||
          invariantViolation
        ) {
          throw new Error(
            dareMessage.includes('DARE gated persistence')
              ? dareMessage
              : `DARE gated persistence blocked season advance: ${dareMessage}`
          );
        }

        // Resolver/runtime DARE errors remain non-blocking.
        console.warn(`[seasonManager] DARE error:`, dareMessage);
        summary.dareError = dareMessage || 'Unknown DARE error';
      }
    }

    // Update world metadata
    const metadataRef = worldMetadataRef(worldId);
    batch.update(metadataRef, {
      currentSeason: toSeason,
      lastModifiedAt: serverTimestamp(),
      lastModifiedTeams: updatedTeams,
      actionCount: increment(1),
    });

    const teamCodes = updatedTeams.slice();
    const committedMetadata: SeasonAdvanceCommittedMetadata = {
      currentSeason: toSeason,
      currentYear: toYear,
      lastModifiedTeams: teamCodes,
    };
    const diffSummary = {
      teamsAdvanced: teamCodes.length,
      optionsDecisionsCount: Object.keys(optionDecisions || {}).length,
      resolvedConveyances: summary.conveyanceResolutions.length,
      resolvedSwaps: summary.swapResolutions.length,
    };
    const randomSuffix = Math.random().toString(36).slice(2, 8);
    const eventId = `${SEASON_ADVANCE_MUTATION_TYPE}_${operationTimestamp}_${randomSuffix}`;
    const eventRef = doc(
      db,
      ARCHITECT_WORLDS_COLLECTION,
      worldId,
      ARCHITECT_WORLD_EVENTS_SUBCOLLECTION,
      eventId
    );
    const eventPayload = {
      eventId,
      type: SEASON_ADVANCE_MUTATION_TYPE,
      timestamp: occurredAt,
      seasonId: toSeason,
      metadata: {
        type: SEASON_ADVANCE_MUTATION_TYPE,
        timestamp: occurredAt,
        fromSeason,
        toSeason,
        teamsInvolved: teamCodes,
      },
      teamsAffected: teamCodes,
      schemaVersion: CAP_AUDIT_EVENT_SCHEMA_VERSION,
      validatorVersion: POST_STATE_CAP_VALIDATOR_VERSION,
      operationId,
      mutationType: SEASON_ADVANCE_MUTATION_TYPE,
      occurredAt,
      worldId,
      teamCodes,
      playerIds: [] as string[],
      beforeTotalsByTeam,
      afterTotalsByTeam,
      valid: postStateValidation.valid,
      violations: postStateValidation.violations,
      warnings: postStateValidation.warnings,
      diffSummary,
      mutationMetadata: {
        mutationType: SEASON_ADVANCE_MUTATION_TYPE,
        category: 'offseason',
        worldId,
        teams: teamCodes,
        players: [] as string[],
      },
    };
    const afterEventSanitize =
      sanitizeTransientFieldsForPersistence(eventPayload);
    assertPersistableOrThrow({
      obj: afterEventSanitize,
      contract: PERSISTENCE_CONTRACTS.EVENT,
      label: 'EVENT',
    });
    const safeEvent = removeUndefinedDeep(afterEventSanitize);
    batch.set(eventRef, safeEvent);

    await batch.commit();

    const committedState = buildSeasonAdvanceCommittedState({
      metadata: committedMetadata,
      event: {
        eventId,
        occurredAt,
      },
      focusTeamCode,
      focusTeamSnapshot,
    });

    return {
      success: true,
      fromSeason,
      toSeason,
      updatedTeams,
      summary,
      committedState,
      // Phase 5: Include resolution info in result
      draftResolutionInfo: positionsMap
        ? {
            draftYear,
            hadPositions: true,
            resolvedConveyances: summary.conveyanceResolutions.length,
            resolvedSwaps: summary.swapResolutions.length,
          }
        : { draftYear, hadPositions: false },
    };
  } catch (error) {
    console.error('advanceSeasonInWorld failed:', error);
    return {
      success: false,
      error: getErrorMessage(error) || 'Season advance failed',
    };
  }
}

/**
 * Process team for season transition with explicit option decisions
 *
 * @param {Object} teamData - Team data
 * @param {string} fromSeason - Current season
 * @param {string} toSeason - Target season
 * @param {Object} optionDecisions - Map of playerId to option decision
 * @param {Object} [resolutionContext={}] - Phase 5: Draft resolution context
 * @param {Object<string, number>} [resolutionContext.positionsMap] - Positions map for resolution
 * @param {number} [resolutionContext.draftYear] - Draft year to resolve
 * @param {string} [resolutionContext.worldId] - World ID for TPE expiry history logging (Phase 53)
 * @returns {Promise<Object>} Updated team data and summary
 */
async function processTeamSeasonTransitionWithOptions(
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

  if ((hasEntitlementIds || hasInlineEntitlements) && teamCode) {
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
  if (hasDraftPickIngressArray(updatedTeam)) {
    updatedTeam.draftPicks = initialDraftPicks;
  }

  if (positionsMap && draftYear && Object.keys(positionsMap).length > 0) {
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
          !(
            typeof pick.id === 'string' && originalConveyedIds.has(pick.id)
          )
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
          !(
            typeof pick.id === 'string' && originalResolvedIds.has(pick.id)
          )
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
  const toYear = resolveSeasonEndYear(toSeason);
  const fromYear = resolveSeasonEndYear(fromSeason, toYear - 1);
  const transitionContext: OffseasonTransitionContext = {
    worldId: worldId || null,
    teamCode,
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

  // ===========================================================================
  // PHASE 77: Recalculate cap totals using SSOT
  // ===========================================================================
  // Always recompute totals for the new year using SSOT function.
  // This replaces the legacy updateTeamCapTotals() dynamic import.
  // Runs AFTER TPE expiry (Phase 53), non-TPE reset (Phase 76), and all roster changes.
  if (hasChanges) {
    updatedTeam.totals = computeTeamCapTotals(updatedTeam, toYear);
  }

  const committedTeam = hasChanges
    ? buildSeasonAdvanceCommittedTeamSnapshot(updatedTeam)
    : null;

  return {
    committedTeam,
    teamSummary,
  };
}

/**
 * Update draft picks for season transition with Stepien recalculation
 *
 * Implements Phase 3B Stepien rule:
 * - A team cannot trade consecutive future first-round picks
 * - Marks picks as "stepienBlocked" if trading them would violate this rule
 *
 * @param {Object} teamData - Team data
 * @param {string} fromSeason - Current season
 * @param {string} toSeason - Target season
 * @returns {Object} Result with updated draft picks and Stepien updates
 */
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

// ==============================================================================
// PHASE 3: SWAP RESOLUTION HELPER
// ==============================================================================

/**
 * Resolve draft pick swaps for a specific year
 *
 * This is a pure function that processes a team's draft picks and resolves
 * any swap rights for the specified draft year, using the provided lottery
 * results (positionsMap).
 *
 * CRITICAL: This function is a NO-OP unless positionsMap is provided with
 * actual position data. Default behavior returns the team unchanged.
 *
 * Only processes picks that:
 * - Are first-round picks (round === 1)
 * - Are swap picks (isSwap === true)
 * - Match the specified draft year
 * - Are not already resolved (resolved !== true)
 *
 * Picks that cannot be resolved (missing partner or missing positions) are
 * left unresolved (no throw during season advance).
 *
 * @param {Object} team - Team data with draftPicks array
 * @param {number} draftYear - Year to resolve swaps for
 * @param {Object<string, number>} [positionsMap] - Map of team codes to draft positions
 * @param {Object} [opts={}] - Options
 * @param {string} [opts.nowIso] - ISO timestamp for resolution
 * @param {string} [opts.method='lottery'] - Resolution method for audit trail
 * @returns {Object} - Team with updated draftPicks array
 */
export function resolveDraftPickSwapsForYear(
  team: SeasonManagerDraftPickIngressSource,
  draftYear: number,
  positionsMap: Record<string, number> | null | undefined,
  opts: { nowIso?: string; method?: string } = {}
): DraftPickCarrier {
  // Return team unchanged if no positions provided (NO-OP)
  if (
    !positionsMap ||
    typeof positionsMap !== 'object' ||
    Object.keys(positionsMap).length === 0
  ) {
    return team as DraftPickCarrier;
  }

  const carrier = toDraftPickCarrier(team);
  const draftPicksSource = carrier.draftPicks;

  // Return team unchanged if no draft picks
  if (!draftPicksSource || !Array.isArray(draftPicksSource)) {
    return team as DraftPickCarrier;
  }
  if (draftPicksSource.length === 0) {
    return hasDraftPickIngressArray(team)
      ? { ...team, draftPicks: [] }
      : (team as DraftPickCarrier);
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
          resolvePickSwap(pick, positionsMap, { nowIso, method })
        ) || pick
      );
    } catch {
      // Resolution failed - leave pick unresolved
      return pick;
    }
  });

  return {
    ...team,
    draftPicks: updatedPicks,
  };
}

/**
 * Phase 4: Resolves draft pick conveyance for a specific year.
 *
 * This function processes picks with conveyance conditions and lottery results
 * to determine whether picks convey, roll forward, or convert.
 *
 * NO-OP conditions (returns team unchanged):
 * - positionsMap is null, undefined, or empty
 * - team has no draftPicks array
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
  // Return team unchanged if no positions provided (NO-OP)
  if (
    !positionsMap ||
    typeof positionsMap !== 'object' ||
    Object.keys(positionsMap).length === 0
  ) {
    return team as DraftPickCarrier;
  }

  const carrier = toDraftPickCarrier(team);
  const draftPicksSource = carrier.draftPicks;

  // Return team unchanged if no draft picks
  if (!draftPicksSource || !Array.isArray(draftPicksSource)) {
    return team as DraftPickCarrier;
  }
  if (draftPicksSource.length === 0) {
    return hasDraftPickIngressArray(team)
      ? { ...team, draftPicks: [] }
      : (team as DraftPickCarrier);
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
          })
        ) || pick
      );
    } catch {
      // Resolution failed - leave pick unchanged
      return pick;
    }
  });

  return {
    ...team,
    draftPicks: updatedPicks,
  };
}
