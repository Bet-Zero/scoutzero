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
 * @property {string} [note] - Additional notes
 * @property {object} [_debug] - Debug info (when VITE_DEBUG_ENTITLEMENT_PICKROWS=true)
 */

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
    if (entitlement.swapTarget) {
      return `Can swap for ${entitlement.swapTarget}`;
    }
    if (entitlement.poolUnderlyingPickIds?.length) {
      return `Swap from pool of ${entitlement.poolUnderlyingPickIds.length} picks`;
    }
    return null;
  }

  // For conveyance rights with pool
  if (
    entitlement.kind === 'conveyance_right' &&
    entitlement.poolUnderlyingPickIds?.length
  ) {
    return `From pool of ${entitlement.poolUnderlyingPickIds.length} picks`;
  }

  return null;
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
 * @param {{ teamCode?: string }} [options={}] - Options
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

  const { teamCode } = options;
  const year = entitlement.seasonYear || 0;
  const round = entitlement.round || 0;
  const kind = entitlement.kind || 'unknown';
  const originalTeam = extractOriginalTeam(entitlement);
  const via = extractViaTeam(entitlement, teamCode);
  const assetType = deriveAssetType(entitlement);
  const { protectionText, protectionMeta } =
    deriveProtectionDetails(entitlement);
  const conditionsText = deriveConditionsText(entitlement);

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

  if (pickRow.protectionText && pickRow.protectionText !== 'Unprotected') {
    parts.push(pickRow.protectionText);
  }

  if (pickRow.conditionsText) {
    parts.push(pickRow.conditionsText);
  }

  return parts.length > 0 ? parts.join(' · ') : null;
};
