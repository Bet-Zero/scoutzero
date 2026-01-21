/**
 * FILE: src/features/architect/utils/entitlements/formatEntitlement.js
 * PURPOSE: Central formatting helpers for draft entitlements display in Trade Machine.
 * OWNERSHIP: Feature: architect/tradeMachine (Phase 11.0)
 *
 * HISTORY:
 *  - 2026-01-21: Created for Phase 11.0 - Read-Only Entitlements View
 *
 * LINKS:
 *  - Plan: docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md (Phase 11.0)
 */

/**
 * Map entitlement kind to display tag with color classes.
 * @param {string} kind - The entitlement kind ('pick_ownership', 'conveyance_right', 'swap_right')
 * @returns {{ label: string, colorClass: string }}
 */
export const getEntitlementKindTag = (kind) => {
  switch (kind) {
    case 'pick_ownership':
      return {
        label: 'Own',
        colorClass: 'bg-green-600/30 text-green-400',
      };
    case 'conveyance_right':
      return {
        label: 'Conditional',
        colorClass: 'bg-amber-600/30 text-amber-400',
      };
    case 'swap_right':
      return {
        label: 'Swap Option',
        colorClass: 'bg-purple-600/30 text-purple-400',
      };
    default:
      return {
        label: kind || 'Unknown',
        colorClass: 'bg-gray-600/30 text-gray-400',
      };
  }
};

/**
 * Format round number to display label.
 * @param {number} round - Round number (1 or 2)
 * @returns {string}
 */
const formatRound = (round) => {
  if (round === 1) return '1st';
  if (round === 2) return '2nd';
  return `${round}`;
};

/**
 * Format an entitlement into a human-readable label.
 * Uses entitlement.description if available, otherwise builds from properties.
 * @param {object} entitlement - The EffectiveEntitlement object
 * @returns {string}
 */
export const formatEntitlementLabel = (entitlement) => {
  if (!entitlement) return 'Unknown Pick';

  // Use description if available (preferred)
  if (entitlement.description) {
    return entitlement.description;
  }

  // Build from properties
  const parts = [];

  // Year
  if (entitlement.seasonYear) {
    parts.push(entitlement.seasonYear);
  }

  // Round
  if (entitlement.round) {
    parts.push(formatRound(entitlement.round));
  }

  // Original team (via)
  if (entitlement.originalTeamId || entitlement.originalTeam) {
    const via = entitlement.originalTeamId || entitlement.originalTeam;
    parts.push(`via ${via.toUpperCase()}`);
  }

  // Kind suffix for non-ownership
  if (entitlement.kind === 'swap_right') {
    parts.push('(Swap)');
  } else if (entitlement.kind === 'conveyance_right') {
    parts.push('(Conditional)');
  }

  return parts.join(' ') || 'Unknown Pick';
};

/**
 * Get sort priority for entitlement kind.
 * Lower number = higher priority in list.
 * @param {string} kind - The entitlement kind
 * @returns {number}
 */
export const getKindSortPriority = (kind) => {
  switch (kind) {
    case 'pick_ownership':
      return 1;
    case 'conveyance_right':
      return 2;
    case 'swap_right':
      return 3;
    default:
      return 99;
  }
};
