/**
 * FILE: src/features/architect/utils/entitlements/entitlementPickRowProjection.js
 * PURPOSE: Project EffectiveEntitlement objects into canonical PickRow shape for display.
 *          Provides structured protection/conveyance visibility derived from entitlement data.
 * OWNERSHIP: Feature: architect/tradeMachine (Phase 12.3C)
 *
 * HISTORY:
 *  - 2026-01-30: Created for Phase 12.3C - Entitlement PickRow Projection Layer
 *
 * LINKS:
 *  - Plan: docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md (Phase 12.3C)
 *  - Related: entitlementResolver.ts, formatEntitlement.js
 */

/**
 * @typedef {object} PickRowProtectionMeta
 * @property {string} [type] - Protection type (e.g., 'top_n', 'lottery', 'range')
 * @property {{ start: number, end: number }} [protectedRange] - Protected pick range
 * @property {number[]} [appliesToYears] - Years this protection applies to
 */

/**
 * @typedef {object} PickRuleDoc
 * @property {string} pickId - Base pick ID (e.g., "LAL_2027_1st")
 * @property {number} seasonYear - Draft year
 * @property {1|2} round - Draft round
 * @property {Array<{type?: string, protectedRange?: string, appliesToYears?: number[], description?: string}>} [protections]
 * @property {Array<{kind: string, description: string, relatedPickIds?: string[], appliesToYears?: number[], controller?: string}>} [conditions]
 * @property {string} [ownershipSource]
 * @property {string[]} [evidenceRowRefs]
 * @property {string} updatedAtISO
 * @property {string} source
 */

/**
 * @typedef {object} ProjectionOptions
 * @property {string} [teamCode] - Team code of the holder
 * @property {Record<string, PickRuleDoc>} [pickRulesById] - Pre-fetched pick rules keyed by pickId
 */

/**
 * @typedef {object} PickRow
 * @property {string} id - Entitlement ID
 * @property {number} year - Draft year (seasonYear)
 * @property {number} round - Draft round (1 or 2)
 * @property {string} kind - Entitlement kind ('pick_ownership' | 'conveyance_right' | 'swap_right')
 * @property {'outright_pick' | 'conditional_right' | 'swap_right'} assetType - Asset classification
 * @property {string} originalTeam - Original team code (best-effort)
 * @property {string} [via] - Via team code if different from holder (best-effort)
 * @property {string} protectionText - Human-readable protection details (never blank)
 * @property {PickRowProtectionMeta|null} protectionMeta - Structured protection data if available
 * @property {string} [conditionsText] - Conditions/conveyance text if applicable
 * @property {string|null} [ladderSummary] - Protection ladder summary (optional)
 * @property {string|null} [termsShort] - Concise entitlement terms summary (optional)
 * @property {string} [note] - Additional notes
 * @property {object} [_debug] - Debug info (when VITE_DEBUG_ENTITLEMENT_PICKROWS=true)
 */

import {
  formatEntitlementTermsShort,
  normalizeEntitlementTerms,
} from '@/features/architect/utils/entitlements/entitlementTerms';

/**
 * Regex patterns to extract protection details from description text.
 * These handle common PST description formats.
 */
const PROTECTION_PATTERNS = [
  // "protected 1-10" or "top 10 protected"
  /(?:protected|top)\s*(\d+)(?:\s*-\s*(\d+))?/i,
  // "lottery protected"
  /lottery\s*protected/i,
  // "protected through lottery"
  /protected\s*(?:through|in)\s*lottery/i,
  // "top N protected"
  /top\s*(\d+)\s*protected/i,
];

/**
 * Extract original team code from entitlement.
 * @param {object} entitlement - EffectiveEntitlement object
 * @returns {string} - 3-letter team code
 */
const extractOriginalTeam = (entitlement) => {
  if (entitlement.originalTeamId) return entitlement.originalTeamId;
  if (entitlement.originalTeam) return entitlement.originalTeam;

  // Try to parse from underlyingPickId (format: "BOS_2026_1st")
  if (entitlement.underlyingPickId) {
    const match = entitlement.underlyingPickId.match(/^([A-Z]{3})_/);
    if (match) return match[1];
  }

  // Try to parse from id (format: "BOS_pick_ownership_2026_R1")
  if (entitlement.id) {
    const match = entitlement.id.match(/^([A-Z]{3})_/);
    if (match) return match[1];
  }

  return 'UNK';
};

/**
 * Extract via team from entitlement if different from holder.
 * @param {object} entitlement - EffectiveEntitlement object
 * @param {string} holderTeam - Team code of the holder
 * @returns {string|null} - Via team code or null if same as holder
 */
const extractViaTeam = (entitlement, holderTeam) => {
  const originalTeam = extractOriginalTeam(entitlement);
  if (originalTeam !== holderTeam && originalTeam !== 'UNK') {
    return originalTeam;
  }
  return null;
};

/**
 * Parse protection text from description to extract structured info.
 * Returns null if no structured info can be extracted.
 * @param {string} description - Description text
 * @returns {PickRowProtectionMeta|null}
 */
const parseProtectionFromDescription = (description) => {
  if (!description) return null;

  const lower = description.toLowerCase();

  // Check for lottery protected
  if (
    lower.includes('lottery protected') ||
    lower.includes('lottery protection')
  ) {
    return {
      type: 'lottery',
      protectedRange: { start: 1, end: 14 },
    };
  }

  // Check for top N protected pattern
  const topNMatch = lower.match(/top\s*(\d+)\s*protected/);
  if (topNMatch) {
    const n = parseInt(topNMatch[1], 10);
    return {
      type: 'top_n',
      protectedRange: { start: 1, end: n },
    };
  }

  // Check for "protected 1-N" or "protected N"
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
 * @param {object} entitlement - EffectiveEntitlement object
 * @returns {{ protectionText: string, protectionMeta: PickRowProtectionMeta|null }}
 */
const deriveProtectionDetails = (entitlement) => {
  const description = entitlement.description || '';
  const lower = description.toLowerCase();

  // Check if this even has protections mentioned
  const hasProtectionMention =
    lower.includes('protected') ||
    lower.includes('protection') ||
    lower.includes('conditional') ||
    lower.includes('convey');

  // For pick_ownership without protection mentions - it's unprotected
  if (entitlement.kind === 'pick_ownership' && !hasProtectionMention) {
    return {
      protectionText: 'Unprotected',
      protectionMeta: null,
    };
  }

  // For swap_right - no protections apply
  if (entitlement.kind === 'swap_right') {
    return {
      protectionText: 'Swap option',
      protectionMeta: null,
    };
  }

  // Try to parse structured data from description
  const protectionMeta = parseProtectionFromDescription(description);

  if (protectionMeta) {
    // Build human-readable text from structured data
    let protectionText;
    if (protectionMeta.type === 'lottery') {
      protectionText = 'Lottery protected';
    } else if (protectionMeta.type === 'top_n') {
      protectionText = `Top ${protectionMeta.protectedRange.end} protected`;
    } else if (protectionMeta.type === 'range') {
      const { start, end } = protectionMeta.protectedRange;
      protectionText =
        start === end ? `Pick ${start} protected` : `Protected ${start}-${end}`;
    } else {
      protectionText = 'Protected (details unavailable)';
    }
    return { protectionText, protectionMeta };
  }

  // Fallback: use description if it mentions protection
  if (hasProtectionMention) {
    // Extract just the protection part from description if possible
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

  // For conveyance_right with no explicit protection - mark as conditional
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
 * @param {object} entitlement - EffectiveEntitlement object
 * @returns {{ protectionText: string, protectionMeta: PickRowProtectionMeta|null, ladderSummary: string|null }|null}
 */
const deriveProtectionDetailsFromLadder = (entitlement) => {
  const ladder = entitlement?.protectionLadder;
  if (!Array.isArray(ladder) || ladder.length === 0) return null;

  const normalized = ladder
    .filter((tier) => tier && typeof tier === 'object')
    .map((tier) => ({
      year: tier.year,
      condition: tier.condition,
      ifTriggered: tier.ifTriggered,
    }))
    .filter((tier) => typeof tier.year === 'number' && tier.condition);

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
      ? `Ladder: ${ladderSummaryParts.join(' \u2192 ')}${
          sorted.length > 3 ? ' \u2026' : ''
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
 * @param {object} entitlement - EffectiveEntitlement object
 * @returns {string|null}
 */
const deriveConditionsText = (entitlement) => {
  const description = entitlement.description || '';
  const lower = description.toLowerCase();

  // Look for conveyance chains
  if (lower.includes('convey') || lower.includes('convert')) {
    // Extract conveyance info
    const conveyMatch = description.match(/convey[^,;.]*/i);
    if (conveyMatch) {
      return conveyMatch[0].trim();
    }
  }

  // For swap rights, explain the swap
  if (entitlement.kind === 'swap_right') {
    if (entitlement.swapTargetDefinition) {
      return entitlement.swapTargetDefinition;
    }
    if (entitlement.poolUnderlyingPickIds?.length) {
      return `Swap pool (${entitlement.poolUnderlyingPickIds.length} picks)`;
    }
    return null;
  }

  // For conveyance rights with pool
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
 * @param {object} entitlement - EffectiveEntitlement object
 * @param {Record<string, PickRuleDoc>} [pickRulesById] - Pre-fetched rules map
 * @returns {PickRuleDoc|null}
 */
const lookupPickRule = (entitlement, pickRulesById) => {
  if (!pickRulesById) return null;

  const pickId = entitlement.underlyingPickId;
  if (!pickId) return null;

  return pickRulesById[pickId] || null;
};

/**
 * Derive protection details, preferring structured rules over description parsing.
 * @param {object} entitlement - EffectiveEntitlement object
 * @param {PickRuleDoc|null} pickRule - The pick rule document if available
 * @returns {{ protectionText: string, protectionMeta: PickRowProtectionMeta|null }}
 */
const deriveProtectionDetailsWithRules = (entitlement, pickRule) => {
  // If we have a pick rule with protections, use that
  if (pickRule?.protections?.length > 0) {
    const protection = pickRule.protections[0]; // Use first (most relevant) protection

    let protectionText;
    let protectionMeta = null;

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

  // Fall back to existing description-based parsing
  return deriveProtectionDetails(entitlement);
};

/**
 * Derive conditions text, preferring structured rules over description parsing.
 * @param {object} entitlement - EffectiveEntitlement object
 * @param {PickRuleDoc|null} pickRule - The pick rule document if available
 * @returns {string|null}
 */
const deriveConditionsTextWithRules = (entitlement, pickRule) => {
  // If we have pick rule conditions, use those
  if (pickRule?.conditions?.length > 0) {
    const relevantConditions = pickRule.conditions
      .filter((c) => c.kind !== 'did_not_convey')
      .slice(0, 2); // Limit to avoid overly long text

    if (relevantConditions.length > 0) {
      return relevantConditions
        .map((c) => {
          if (c.kind === 'swap_right' || c.kind === 'swap') {
            return c.controller ? `${c.controller} swap option` : 'Swap option';
          }
          if (c.kind === 'conveys') {
            return 'Conveyance right';
          }
          // Truncate long descriptions
          return c.description?.slice(0, 50);
        })
        .filter(Boolean)
        .join('; ');
    }
  }

  // Fall back to existing derivation
  return deriveConditionsText(entitlement);
};

/**
 * Determine asset type from entitlement kind and properties.
 * @param {object} entitlement - EffectiveEntitlement object
 * @returns {'outright_pick' | 'conditional_right' | 'swap_right'}
 */
const deriveAssetType = (entitlement) => {
  if (entitlement.kind === 'swap_right') {
    return 'swap_right';
  }

  if (entitlement.kind === 'conveyance_right') {
    return 'conditional_right';
  }

  // For pick_ownership, check if there are protections
  const description = (entitlement.description || '').toLowerCase();
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
 * @param {number} round - Round number
 * @returns {string}
 */
const formatRound = (round) => {
  if (round === 1) return '1st';
  if (round === 2) return '2nd';
  return `R${round}`;
};

/**
 * Project an EffectiveEntitlement into a canonical PickRow object.
 *
 * @param {object} entitlement - The EffectiveEntitlement object
 * @param {ProjectionOptions} [options={}] - Options including teamCode and pickRulesById
 * @returns {PickRow}
 */
export const projectEntitlementToPickRow = (entitlement, options = {}) => {
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

  // Lookup pick rule for this entitlement's underlying pick
  const pickRule = lookupPickRule(entitlement, pickRulesById);

  const year = entitlement.seasonYear || 0;
  const round = entitlement.round || 0;
  const kind = entitlement.kind || 'unknown';
  const originalTeam = extractOriginalTeam(entitlement);
  const via = extractViaTeam(entitlement, teamCode);
  const assetType = deriveAssetType(entitlement);

  const termsShort =
    typeof entitlement?.termsShort === 'string'
      ? entitlement.termsShort
      : formatEntitlementTermsShort(normalizeEntitlementTerms(entitlement));

  // Prefer protection ladder override when present
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
  const conditionsText = [baseConditionsText, ladderSummary]
    .filter(Boolean)
    .join(' \u00b7 ') || null;

  // Build debug info if enabled
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
    id: entitlement.id || 'unknown',
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
 *
 * @param {PickRow} pickRow - The projected PickRow
 * @returns {string}
 */
export const getPickRowDisplayLabel = (pickRow) => {
  if (!pickRow || !pickRow.year) {
    return 'Unknown Pick';
  }

  const parts = [];

  // Year and round
  parts.push(`${pickRow.year} ${formatRound(pickRow.round)}`);

  // Via team
  if (pickRow.via) {
    parts.push(`via ${pickRow.via}`);
  }

  // Asset type suffix for non-outright
  if (pickRow.assetType === 'swap_right') {
    parts.push('(Swap)');
  } else if (pickRow.assetType === 'conditional_right') {
    parts.push('(Cond.)');
  }

  return parts.join(' ');
};

/**
 * Get secondary line text for PickRow display.
 * Returns protectionText and/or conditionsText combined.
 *
 * @param {PickRow} pickRow - The projected PickRow
 * @returns {string|null}
 */
export const getPickRowSecondaryText = (pickRow) => {
  if (!pickRow) return null;

  const parts = [];

  if (pickRow.termsShort) {
    parts.push(pickRow.termsShort);
  }

  if (pickRow.protectionText && pickRow.protectionText !== 'Unprotected') {
    parts.push(pickRow.protectionText);
  }

  if (pickRow.conditionsText) {
    parts.push(pickRow.conditionsText);
  }

  return parts.length > 0 ? parts.join(' · ') : null;
};
