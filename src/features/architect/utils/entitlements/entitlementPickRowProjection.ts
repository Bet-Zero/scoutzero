/**
 * FILE: src/features/architect/utils/entitlements/entitlementPickRowProjection.ts
 * PURPOSE: Project EffectiveEntitlement objects into canonical PickRow shape for display.
 *          Provides structured protection/conveyance visibility derived from entitlement data.
 * OWNERSHIP: Feature: architect/tradeMachine (Phase 12.3C)
 *
 * HISTORY:
 *  - 2026-01-30: Created for Phase 12.3C - Entitlement PickRow Projection Layer
 *  - 2026-03-12: E66 - Moved authoritative implementation to TypeScript with JS shim compatibility
 *
 * LINKS:
 *  - Plan: docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md (Phase 12.3C)
 *  - Related: entitlementResolver.ts, formatEntitlement.js
 */

import {
  formatEntitlementTermsShort,
  normalizeEntitlementTerms,
} from '@/features/architect/utils/entitlements/entitlementTerms';
import type { EffectiveEntitlement } from '@/features/architect/utils/entitlements/entitlementResolver';
import type { PickRuleDoc } from '@/features/architect/utils/entitlements/pickRulesResolver';

export type PickRowProtectionMeta = {
  type?: string;
  protectedRange?: {
    start: number;
    end: number;
  };
  appliesToYears?: number[];
};

export type ProjectionOptions = {
  teamCode?: string;
  pickRulesById?: Record<string, unknown>;
};

type PickRowAssetType = 'outright_pick' | 'conditional_right' | 'swap_right';

type PickRowDebug = {
  sourceHints: {
    id: unknown;
    description: unknown;
    underlyingPickId: unknown;
    underlyingStatus: unknown;
    evidenceRowRefs: unknown;
    derivedFromDescription: boolean;
    usedPickRule: boolean;
    pickRuleId: string | undefined;
  };
};

export type PickRow = {
  id: string;
  year: number;
  round: number;
  kind: string;
  assetType: PickRowAssetType;
  originalTeam: string;
  via: string | null;
  protectionText: string;
  protectionMeta: PickRowProtectionMeta | null;
  conditionsText?: string | null;
  ladderSummary?: string | null;
  termsShort?: string | null;
  note?: string | null;
  _debug?: PickRowDebug | null;
};

type ProtectionLadderTierLike = {
  year?: number;
  condition?: string;
  ifTriggered?: string;
} | null;

type ProjectionEntitlement = EffectiveEntitlement & {
  id?: string | number;
  seasonYear?: number | string;
  round?: number | string;
  kind?: string;
  originalTeamId?: string | number;
  originalTeam?: string | number;
  underlyingPickId?: string | number;
  holderTeam?: string | number;
  description?: string;
  protectionLadder?: ProtectionLadderTierLike[];
  swapTargetDefinition?: string;
  poolUnderlyingPickIds?: Array<string | number>;
  receivesComparator?: 'less_favorable' | 'more_favorable' | 'middle' | string;
  receivesRank?: Array<number | string>;
  termsShort?: string;
  underlyingStatus?: unknown;
  evidenceRowRefs?: unknown;
};

type LadderProtectionDetails = {
  protectionText: string;
  protectionMeta: PickRowProtectionMeta | null;
  ladderSummary: string | null;
};

type ProtectionDetails = {
  protectionText: string;
  protectionMeta: PickRowProtectionMeta | null;
};

/**
 * Regex patterns to extract protection details from description text.
 * These handle common PST description formats.
 */
const PROTECTION_PATTERNS = [
  /(?:protected|top)\s*(\d+)(?:\s*-\s*(\d+))?/i,
  /lottery\s*protected/i,
  /protected\s*(?:through|in)\s*lottery/i,
  /top\s*(\d+)\s*protected/i,
];

void PROTECTION_PATTERNS;

/**
 * Extract original team code from entitlement.
 */
const extractOriginalTeam = (entitlement: ProjectionEntitlement): string => {
  if (entitlement.originalTeamId != null) {
    return String(entitlement.originalTeamId);
  }
  if (entitlement.originalTeam != null) {
    return String(entitlement.originalTeam);
  }

  if (entitlement.underlyingPickId) {
    const match = String(entitlement.underlyingPickId).match(/^([A-Z]{3})_/);
    if (match) return match[1];
  }

  if (entitlement.id) {
    const match = String(entitlement.id).match(/^([A-Z]{3})_/);
    if (match) return match[1];
  }

  return 'UNK';
};

/**
 * Extract via team from entitlement if different from holder.
 * Uses entitlement.holderTeam as authoritative source, falls back to passed teamCode.
 */
const extractViaTeam = (
  entitlement: ProjectionEntitlement,
  teamCode?: string
): string | null => {
  const originalTeam = extractOriginalTeam(entitlement);
  const holderTeam =
    entitlement.holderTeam != null
      ? String(entitlement.holderTeam)
      : teamCode || '';

  const normalizedHolder = holderTeam.toUpperCase().trim();
  const normalizedOriginal = (originalTeam || '').toUpperCase().trim();

  if (
    normalizedOriginal &&
    normalizedOriginal !== normalizedHolder &&
    normalizedOriginal !== 'UNK'
  ) {
    return originalTeam;
  }
  return null;
};

/**
 * Parse protection text from description to extract structured info.
 * Returns null if no structured info can be extracted.
 */
const parseProtectionFromDescription = (
  description: string
): PickRowProtectionMeta | null => {
  if (!description) return null;

  const lower = description.toLowerCase();

  if (
    lower.includes('lottery protected') ||
    lower.includes('lottery protection')
  ) {
    return {
      type: 'lottery',
      protectedRange: { start: 1, end: 14 },
    };
  }

  const topNMatch = lower.match(/top\s*(\d+)\s*protected/);
  if (topNMatch) {
    const n = parseInt(topNMatch[1], 10);
    return {
      type: 'top_n',
      protectedRange: { start: 1, end: n },
    };
  }

  const rangeMatch = lower.match(/protected\s*(\d+)(?:\s*-\s*(\d+))?/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10);
    const end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : start;
    return {
      type: 'range',
      protectedRange: { start, end },
    };
  }

  return null;
};

/**
 * Determine protection text from entitlement data.
 * Falls back to deterministic text when structured data unavailable.
 */
const deriveProtectionDetails = (
  entitlement: ProjectionEntitlement
): ProtectionDetails => {
  const description = (entitlement.description || '') as string;
  const lower = description.toLowerCase();

  const hasProtectionMention =
    lower.includes('protected') ||
    lower.includes('protection') ||
    lower.includes('conditional') ||
    lower.includes('convey');

  if (entitlement.kind === 'pick_ownership' && !hasProtectionMention) {
    return {
      protectionText: 'Unprotected',
      protectionMeta: null,
    };
  }

  if (entitlement.kind === 'swap_right') {
    return {
      protectionText: 'Swap option',
      protectionMeta: null,
    };
  }

  const protectionMeta = parseProtectionFromDescription(description);

  if (protectionMeta) {
    let protectionText;
    if (protectionMeta.type === 'lottery') {
      protectionText = 'Lottery protected';
    } else if (protectionMeta.type === 'top_n') {
      protectionText = `Top ${protectionMeta.protectedRange?.end} protected`;
    } else if (protectionMeta.type === 'range') {
      const { start, end } = protectionMeta.protectedRange as {
        start: number;
        end: number;
      };
      protectionText =
        start === end ? `Pick ${start} protected` : `Protected ${start}-${end}`;
    } else {
      protectionText = 'Protected (details unavailable)';
    }
    return { protectionText, protectionMeta };
  }

  if (hasProtectionMention) {
    const protMatch = description.match(/protected[^,;.]*/i);
    if (protMatch) {
      return {
        protectionText: protMatch[0].trim(),
        protectionMeta: null,
      };
    }
    return {
      protectionText: 'Protected (details unavailable)',
      protectionMeta: null,
    };
  }

  if (entitlement.kind === 'conveyance_right') {
    return {
      protectionText: 'Conditional',
      protectionMeta: null,
    };
  }

  return {
    protectionText: '',
    protectionMeta: null,
  };
};

/**
 * Derive protection details from a protection ladder override.
 */
const deriveProtectionDetailsFromLadder = (
  entitlement: ProjectionEntitlement
): LadderProtectionDetails | null => {
  const ladder = entitlement?.protectionLadder;
  if (!Array.isArray(ladder) || ladder.length === 0) return null;

  const normalized = ladder
    .filter((tier): tier is Exclude<ProtectionLadderTierLike, null> =>
      Boolean(tier && typeof tier === 'object')
    )
    .map((tier) => ({
      year: tier.year,
      condition: tier.condition,
      ifTriggered: tier.ifTriggered,
    }))
    .filter((tier) => typeof tier.year === 'number' && Boolean(tier.condition)) as
    Array<{
      year: number;
      condition: string;
      ifTriggered?: string;
    }>;

  if (normalized.length === 0) return null;

  const sorted = [...normalized].sort((a, b) => a.year - b.year);
  const targetYear = entitlement?.seasonYear;
  const currentTier =
    sorted.find((tier) => tier.year === targetYear) || sorted[0];

  const protectionText = currentTier?.condition || 'Protected';
  const ladderSummaryParts = sorted
    .slice(0, 3)
    .map((tier) => `${tier.year} ${tier.condition}`);
  const ladderSummary =
    ladderSummaryParts.length > 0
      ? `Ladder: ${ladderSummaryParts.join(' → ')}${
          sorted.length > 3 ? ' …' : ''
        }`
      : null;

  return {
    protectionText,
    protectionMeta: null,
    ladderSummary,
  };
};

/**
 * Derive conditions/conveyance text from entitlement.
 */
const deriveConditionsText = (
  entitlement: ProjectionEntitlement
): string | null => {
  const description = (entitlement.description || '') as string;
  const lower = description.toLowerCase();

  if (lower.includes('convey') || lower.includes('convert')) {
    const conveyMatch = description.match(/convey[^,;.]*/i);
    if (conveyMatch) {
      return conveyMatch[0].trim();
    }
  }

  if (entitlement.kind === 'swap_right') {
    if (entitlement.swapTargetDefinition) {
      return entitlement.swapTargetDefinition;
    }
    if (entitlement.poolUnderlyingPickIds?.length) {
      return `Swap pool (${entitlement.poolUnderlyingPickIds.length} picks)`;
    }
    return null;
  }

  if (
    entitlement.kind === 'conveyance_right' &&
    entitlement.poolUnderlyingPickIds?.length
  ) {
    const poolCount = entitlement.poolUnderlyingPickIds.length;
    const comparator = entitlement.receivesComparator;
    const ranks = Array.isArray(entitlement.receivesRank)
      ? entitlement.receivesRank
      : [];
    const comparatorLabel =
      comparator === 'less_favorable'
        ? 'Less favorable'
        : comparator === 'more_favorable'
          ? 'More favorable'
          : comparator === 'middle'
            ? 'Middle'
            : null;
    if (comparatorLabel && ranks.length > 0) {
      return `${comparatorLabel} #${ranks.join(', ')} of ${poolCount}`;
    }
    if (comparatorLabel) {
      return `${comparatorLabel} of ${poolCount}`;
    }
    return `Pool of ${poolCount} picks`;
  }

  return null;
};

/**
 * Lookup pick rule for an entitlement's underlying pick.
 */
const lookupPickRule = (
  entitlement: ProjectionEntitlement,
  pickRulesById?: Record<string, unknown>
): PickRuleDoc | null => {
  if (!pickRulesById) return null;

  const pickId = entitlement.underlyingPickId;
  if (!pickId) return null;

  const candidate = pickRulesById[String(pickId)];
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return null;
  }

  if (
    !('pickId' in candidate) ||
    !('seasonYear' in candidate) ||
    !('round' in candidate)
  ) {
    return null;
  }

  return candidate as PickRuleDoc;
};

/**
 * Derive protection details, preferring structured rules over description parsing.
 */
const deriveProtectionDetailsWithRules = (
  entitlement: ProjectionEntitlement,
  pickRule: PickRuleDoc | null
): ProtectionDetails => {
  if (pickRule?.protections?.length) {
    const protection = pickRule.protections[0];

    let protectionText;
    let protectionMeta: PickRowProtectionMeta | null = null;

    if (protection.type === 'lottery') {
      protectionText = 'Lottery protected';
      protectionMeta = {
        type: 'lottery',
        protectedRange: { start: 1, end: 14 },
        appliesToYears: protection.appliesToYears,
      };
    } else if (protection.type === 'top_n' && protection.protectedRange) {
      const parts = protection.protectedRange.split('-').map(Number);
      const end = parts[1] ?? parts[0];
      protectionText = `Top ${end} protected`;
      protectionMeta = {
        type: 'top_n',
        protectedRange: { start: 1, end },
        appliesToYears: protection.appliesToYears,
      };
    } else if (protection.type === 'range' && protection.protectedRange) {
      const [start, end] = protection.protectedRange.split('-').map(Number);
      protectionText =
        start === end ? `Pick ${start} protected` : `Protected ${start}-${end}`;
      protectionMeta = {
        type: 'range',
        protectedRange: { start, end: end ?? start },
        appliesToYears: protection.appliesToYears,
      };
    } else {
      protectionText = protection.description || 'Protected';
    }

    return { protectionText, protectionMeta };
  }

  return deriveProtectionDetails(entitlement);
};

/**
 * Derive conditions text, preferring structured rules over description parsing.
 */
const deriveConditionsTextWithRules = (
  entitlement: ProjectionEntitlement,
  pickRule: PickRuleDoc | null
): string | null => {
  if (pickRule?.conditions?.length) {
    const relevantConditions = pickRule.conditions
      .filter((condition) => condition.kind !== 'did_not_convey')
      .slice(0, 2);

    if (relevantConditions.length > 0) {
      return relevantConditions
        .map((condition) => {
          if (
            condition.kind === 'swap_right' ||
            condition.kind === 'swap'
          ) {
            return condition.controller
              ? `${condition.controller} swap option`
              : 'Swap option';
          }
          if (condition.kind === 'conveys') {
            return 'Conveyance right';
          }
          return condition.description?.slice(0, 50);
        })
        .filter(Boolean)
        .join('; ');
    }
  }

  return deriveConditionsText(entitlement);
};

/**
 * Determine asset type from entitlement kind and properties.
 */
const deriveAssetType = (
  entitlement: ProjectionEntitlement
): PickRowAssetType => {
  if (entitlement.kind === 'swap_right') {
    return 'swap_right';
  }

  if (entitlement.kind === 'conveyance_right') {
    return 'conditional_right';
  }

  const description = ((entitlement.description || '') as string).toLowerCase();
  const hasProtection =
    description.includes('protected') ||
    description.includes('conditional') ||
    description.includes('convey');

  if (hasProtection) {
    return 'conditional_right';
  }

  return 'outright_pick';
};

/**
 * Format round number for display.
 */
const formatRound = (round: number): string => {
  if (round === 1) return '1st';
  if (round === 2) return '2nd';
  return `R${round}`;
};

/**
 * Project an EffectiveEntitlement into a canonical PickRow object.
 */
export const projectEntitlementToPickRow = (
  entitlement?: ProjectionEntitlement | null,
  options: ProjectionOptions = {}
): PickRow => {
  if (!entitlement) {
    return {
      id: 'unknown',
      year: 0,
      round: 0,
      kind: 'unknown',
      assetType: 'outright_pick',
      originalTeam: 'UNK',
      via: null,
      protectionText: 'Unknown',
      protectionMeta: null,
      conditionsText: null,
      note: null,
      _debug: null,
    };
  }

  const { teamCode, pickRulesById } = options;

  const pickRule = lookupPickRule(entitlement, pickRulesById);

  const year = Number(entitlement.seasonYear || 0) || 0;
  const round = Number(entitlement.round || 0) || 0;
  const kind =
    typeof entitlement.kind === 'string' ? entitlement.kind : 'unknown';
  const originalTeam = extractOriginalTeam(entitlement);
  const via = extractViaTeam(entitlement, teamCode);
  const assetType = deriveAssetType(entitlement);

  const termsShort =
    typeof entitlement?.termsShort === 'string'
      ? entitlement.termsShort
      : formatEntitlementTermsShort(normalizeEntitlementTerms(entitlement));

  const ladderDetails = deriveProtectionDetailsFromLadder(entitlement);
  const { protectionText, protectionMeta } = ladderDetails
    ? ladderDetails
    : pickRulesById
      ? deriveProtectionDetailsWithRules(entitlement, pickRule)
      : deriveProtectionDetails(entitlement);

  const baseConditionsText = pickRulesById
    ? deriveConditionsTextWithRules(entitlement, pickRule)
    : deriveConditionsText(entitlement);
  const ladderSummary = ladderDetails?.ladderSummary || null;
  const conditionsText =
    [baseConditionsText, ladderSummary].filter(Boolean).join(' · ') || null;

  const debugEnabled =
    typeof import.meta !== 'undefined' &&
    import.meta.env?.VITE_DEBUG_ENTITLEMENT_PICKROWS === 'true';

  const debug = debugEnabled
    ? {
        sourceHints: {
          id: entitlement.id,
          description: entitlement.description,
          underlyingPickId: entitlement.underlyingPickId,
          underlyingStatus: entitlement.underlyingStatus,
          evidenceRowRefs: entitlement.evidenceRowRefs,
          derivedFromDescription: !protectionMeta,
          usedPickRule: !!pickRule,
          pickRuleId: pickRule?.pickId,
        },
      }
    : null;

  return {
    id: entitlement.id != null ? String(entitlement.id) : 'unknown',
    year,
    round,
    kind,
    assetType,
    originalTeam,
    via,
    protectionText,
    protectionMeta,
    conditionsText,
    ladderSummary,
    termsShort: termsShort || null,
    note: null,
    _debug: debug,
  };
};

/**
 * Generate a display label for a PickRow.
 * Format: "{year} {round}" with optional "via {team}" and kind suffix.
 */
export const getPickRowDisplayLabel = (pickRow?: PickRow | null): string => {
  if (!pickRow || !pickRow.year) {
    return 'Unknown Pick';
  }

  const roundStr = formatRound(pickRow.round);
  let label = `${pickRow.year} ${roundStr}`;

  if (pickRow.via) {
    label += ` via ${pickRow.via}`;
  }

  if (pickRow.assetType === 'swap_right') {
    label += ' (Swap)';
  } else if (pickRow.assetType === 'conditional_right') {
    label += ' (Cond.)';
  }

  return label;
};

/**
 * Get secondary line text for PickRow display.
 * Returns protectionText and/or conditionsText combined with " · " separator.
 * Returns null for unprotected picks with no conditions.
 */
export const getPickRowSecondaryText = (
  pickRow?: PickRow | null
): string | null => {
  if (!pickRow) return null;

  const parts: string[] = [];

  if (pickRow.protectionText && pickRow.protectionText !== 'Unprotected') {
    parts.push(pickRow.protectionText);
  }

  if (pickRow.conditionsText) {
    parts.push(pickRow.conditionsText);
  }

  return parts.length > 0 ? parts.join(' · ') : null;
};
