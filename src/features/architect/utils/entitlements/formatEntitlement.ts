/**
 * FILE: src/features/architect/utils/entitlements/formatEntitlement.ts
 * PURPOSE: Central formatting helpers for draft entitlements display in Trade Machine.
 * OWNERSHIP: Feature: architect/tradeMachine (Phase 11.0, E67)
 *
 * HISTORY:
 *  - 2026-01-21: Created for Phase 11.0 - Read-Only Entitlements View
 *  - 2026-03-12: E67 - Migrated to TypeScript authority with JS shim compatibility
 *
 * LINKS:
 *  - Plan: docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md (Phase 11.0)
 */

type EntitlementKindDisplay = {
  label: string;
  colorClass: string;
};

type FormatEntitlementLike = {
  description?: string | null;
  seasonYear?: number | null;
  round?: number | null;
  originalTeamId?: string | null;
  originalTeam?: string | null;
  holderTeam?: string | null;
  kind?: string | null;
};

/**
 * Map entitlement kind to display tag with color classes.
 * @param {string} kind - The entitlement kind ('pick_ownership', 'conveyance_right', 'swap_right')
 * @returns {{ label: string, colorClass: string }}
 */
export const getEntitlementKindTag = (
  kind: string | null | undefined
): EntitlementKindDisplay => {
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
const formatRound = (round: number | null | undefined): string => {
  if (round === 1) return '1st';
  if (round === 2) return '2nd';
  return `${round}`;
};

/**
 * Format an entitlement into a human-readable label for tooltips/titles.
 * This is a descriptive format that includes all key details for hover context.
 * @param {object} entitlement - The EffectiveEntitlement object
 * @returns {string}
 */
export const formatEntitlementLabel = (
  entitlement: FormatEntitlementLike | null | undefined
): string => {
  if (!entitlement) return 'Unknown Pick';

  // Use description if available (preferred for rich context)
  if (entitlement.description) {
    return entitlement.description;
  }

  // Build from properties - concise format for tooltips
  const parts: string[] = [];

  // Year and Round (once)
  if (entitlement.seasonYear && entitlement.round) {
    parts.push(`${entitlement.seasonYear} ${formatRound(entitlement.round)}`);
  } else if (entitlement.seasonYear) {
    parts.push(String(entitlement.seasonYear));
  }

  // Original team (via) - only if different from holder
  const originalTeam = entitlement.originalTeamId || entitlement.originalTeam;
  const holderTeam = entitlement.holderTeam;
  if (originalTeam && holderTeam && originalTeam !== holderTeam) {
    parts.push(`via ${originalTeam.toUpperCase()}`);
  } else if (originalTeam && !holderTeam) {
    // Show team if we don't know the holder context
    parts.push(originalTeam.toUpperCase());
  }

  // Kind indicator (simple)
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
export const getKindSortPriority = (
  kind: string | null | undefined
): number => {
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
