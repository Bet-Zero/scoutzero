/**
 * FILE: src/features/architect/utils/entitlements/dare/protectionLadderFactory.ts
 * PURPOSE: Transform pick rules into year-by-year protection ladders for conveyance resolution.
 * OWNERSHIP: Feature: architect/entitlements
 *
 * HISTORY:
 *  - 2026-02-03: Created for Draft Asset Terms + Lifecycle Closure (B4)
 *
 * LINKS:
 *  - Audit: docs/architect/DRAFT_ASSET_TERMS_AND_LIFECYCLE_COMPLETION_AUDIT.md
 *
 * KEY DEFINITIONS:
 *  - Protection Ladder: Array of year-by-year protection tiers
 *  - Tier: { year, condition, ifTriggered, rollToYear?, convertToRound? }
 *  - Condition: Human-readable protection (e.g., "Top 3", "Lottery")
 */

import type { PickRuleDoc, PickRuleProtection, PickRuleCondition } from '../pickRulesResolver';
import type { EffectiveEntitlement } from '../entitlementResolver';
import type { ProtectionLadder, ProtectionLadderTier } from './types';

// =============================================================================
// MAIN FACTORY FUNCTION
// =============================================================================

/**
 * Build a protection ladder from pick rules and entitlement data.
 *
 * The ladder represents year-by-year protection tiers that determine
 * conveyance behavior during resolution.
 *
 * @param pickRule - Pick rule document with protections[] and conditions[]
 * @param entitlement - The entitlement being resolved
 * @returns Protection ladder array, or null if no protections
 *
 * @example
 * // Input pickRule.protections:
 * [
 *   { type: 'top_n', protectedRange: '1-3', appliesToYears: [2026] },
 *   { type: 'top_n', protectedRange: '1-5', appliesToYears: [2027] },
 *   { type: 'lottery', appliesToYears: [2028] }
 * ]
 *
 * // Output:
 * [
 *   { year: 2026, condition: 'Top 3', ifTriggered: 'roll', rollToYear: 2027 },
 *   { year: 2027, condition: 'Top 5', ifTriggered: 'roll', rollToYear: 2028 },
 *   { year: 2028, condition: 'Lottery', ifTriggered: 'cancel' }
 * ]
 */
export function buildProtectionLadder(
  pickRule: PickRuleDoc | null | undefined,
  entitlement: EffectiveEntitlement | null | undefined
): ProtectionLadder | null {
  // Guard: No pick rule or no protections
  if (!pickRule?.protections?.length) {
    return null;
  }

  const ladder: ProtectionLadder = [];
  const protections = pickRule.protections;
  const conditions = pickRule.conditions || [];

  // Expand protections to individual years if appliesToYears has multiple
  const expandedProtections = expandProtectionsToYears(protections);

  // Sort by year ascending
  const sortedProtections = [...expandedProtections].sort((a, b) => {
    return (a.year ?? 0) - (b.year ?? 0);
  });

  // If no valid years found, try to use entitlement's seasonYear
  if (sortedProtections.length === 0 && entitlement?.seasonYear) {
    // Single-year protection from entitlement
    const singleTier: ProtectionLadderTier = {
      year: entitlement.seasonYear as number,
      condition: 'Unprotected',
      ifTriggered: 'cancel',
      source: 'entitlement_fallback',
    };
    return [singleTier];
  }

  // Build ladder from sorted protections
  for (let i = 0; i < sortedProtections.length; i++) {
    const protection = sortedProtections[i];
    const year = protection.year!;
    const nextProtection = sortedProtections[i + 1];
    const nextYear = nextProtection?.year ?? year + 1;
    const isLastTier = i === sortedProtections.length - 1;

    // Parse condition string from protection
    const condition = parseProtectionCondition(protection.protection);

    // Determine action when protection triggers
    let ifTriggered: 'roll' | 'convert' | 'cancel' = isLastTier ? 'cancel' : 'roll';
    let convertToRound: number | undefined;

    // Check for conversion conditions in pick rules
    const conversionCondition = findConversionCondition(conditions, year);
    if (conversionCondition) {
      ifTriggered = 'convert';
      convertToRound = conversionCondition.convertToRound ?? 2;
    }

    const tier: ProtectionLadderTier = {
      year,
      condition,
      ifTriggered,
      rollToYear: ifTriggered === 'roll' ? nextYear : undefined,
      convertToRound: ifTriggered === 'convert' ? convertToRound : undefined,
      source: `pickRule.protections[${i}]`,
    };

    ladder.push(tier);
  }

  return ladder.length > 0 ? ladder : null;
}

// =============================================================================
// HELPER: Expand protections to individual years
// =============================================================================

interface ExpandedProtection {
  year: number;
  protection: PickRuleProtection;
}

/**
 * Expand protections array so each year gets its own entry.
 */
function expandProtectionsToYears(
  protections: PickRuleProtection[]
): ExpandedProtection[] {
  const expanded: ExpandedProtection[] = [];

  for (const protection of protections) {
    const years = protection.appliesToYears || [];

    if (years.length === 0) {
      // No years specified - skip (or could use a default)
      continue;
    }

    for (const year of years) {
      expanded.push({ year, protection });
    }
  }

  return expanded;
}

// =============================================================================
// HELPER: Find conversion condition
// =============================================================================

interface ConversionInfo {
  convertToRound: number;
}

/**
 * Check if there's a conversion condition for this year.
 */
function findConversionCondition(
  conditions: PickRuleCondition[],
  year: number
): ConversionInfo | null {
  for (const condition of conditions) {
    // Look for 'conveys' or 'did_not_convey' conditions
    if (condition.kind !== 'conveys' && condition.kind !== 'did_not_convey') {
      continue;
    }

    // Check if applies to this year
    const appliesToYear =
      !condition.appliesToYears?.length ||
      condition.appliesToYears.includes(year);

    if (!appliesToYear) continue;

    // Check for 2nd round conversion indicator in relatedPickIds
    if (condition.relatedPickIds?.some((id) => id.includes('2nd'))) {
      return { convertToRound: 2 };
    }

    // Check description for conversion hints
    if (condition.description) {
      const desc = condition.description.toLowerCase();
      if (desc.includes('convert') || desc.includes('becomes 2nd')) {
        return { convertToRound: 2 };
      }
    }
  }

  return null;
}

// =============================================================================
// CONDITION PARSING
// =============================================================================

/**
 * Parse a PickRuleProtection into a human-readable condition string.
 */
export function parseProtectionCondition(
  protection: PickRuleProtection | null | undefined
): string {
  if (!protection) return 'Unprotected';

  const { type, protectedRange, description } = protection;

  switch (type) {
    case 'lottery':
      return 'Lottery';

    case 'top_n':
      if (protectedRange) {
        const parts = protectedRange.split('-').map(Number);
        const end = parts[1] ?? parts[0];
        if (!isNaN(end)) {
          return `Top ${end}`;
        }
      }
      return 'Protected';

    case 'range':
      if (protectedRange) {
        const [start, end] = protectedRange.split('-').map(Number);
        if (!isNaN(start) && !isNaN(end)) {
          if (start === 1) {
            return `Top ${end}`;
          }
          return `Protected ${start}-${end}`;
        }
      }
      return 'Protected';

    default:
      // Try to parse from description
      if (description) {
        return parseProtectionFromDescription(description);
      }
      return 'Unprotected';
  }
}

/**
 * Parse protection from a description string.
 */
function parseProtectionFromDescription(description: string): string {
  if (!description || typeof description !== 'string') {
    return 'Unprotected';
  }

  const desc = description.toLowerCase();

  // Match "Top N" patterns
  const topMatch = desc.match(/top\s*(\d+)/i);
  if (topMatch) {
    return `Top ${topMatch[1]}`;
  }

  // Match "Lottery"
  if (desc.includes('lottery')) {
    return 'Lottery';
  }

  // Match "1-14" explicit
  if (desc.includes('1-14')) {
    return 'Lottery';
  }

  // Match "Unprotected"
  if (desc.includes('unprotected')) {
    return 'Unprotected';
  }

  return description;
}

// =============================================================================
// THRESHOLD PARSING (for resolution)
// =============================================================================

/**
 * Parse protection condition string to numeric threshold.
 * Matches existing conveyanceResolution.js:30-52 pattern.
 *
 * @param condition - Protection condition (e.g., "Top 3", "Lottery")
 * @returns Max protected position (inclusive), or null if unprotected
 *
 * @example
 * parseProtectionThreshold("Top 3") // => 3
 * parseProtectionThreshold("Lottery") // => 14
 * parseProtectionThreshold("Unprotected") // => null
 */
export function parseProtectionThreshold(
  condition: string | null | undefined
): number | null {
  if (!condition || typeof condition !== 'string') {
    return null;
  }

  // "Top N" patterns
  const topMatch = condition.match(/top\s*(\d+)/i);
  if (topMatch) {
    return parseInt(topMatch[1], 10);
  }

  // "Lottery" = positions 1-14
  if (/lottery/i.test(condition)) {
    return 14;
  }

  // "1-14" explicit
  if (/1-14/i.test(condition)) {
    return 14;
  }

  // "Unprotected" = no protection
  if (/unprotected/i.test(condition)) {
    return null;
  }

  return null;
}

/**
 * Determines if protection is triggered based on draft position.
 *
 * @param condition - Protection condition string
 * @param position - Draft position (1-60)
 * @returns True if protection triggers (pick doesn't convey)
 *
 * @example
 * protectionTriggers("Top 3", 2) // => true (position 2 is protected)
 * protectionTriggers("Top 3", 7) // => false (position 7 conveys)
 */
export function protectionTriggers(
  condition: string | null | undefined,
  position: number
): boolean {
  const threshold = parseProtectionThreshold(condition);

  // No protection or invalid position = no trigger
  if (threshold === null || typeof position !== 'number' || position < 1) {
    return false;
  }

  // Protection triggers if position is within threshold
  return position <= threshold;
}

// =============================================================================
// LADDER LOOKUP
// =============================================================================

/**
 * Get the current protection tier for a given year.
 */
export function getCurrentProtectionTier(
  ladder: ProtectionLadder | null | undefined,
  year: number
): ProtectionLadderTier | null {
  if (!ladder) return null;
  return ladder.find((tier) => tier.year === year) ?? null;
}

/**
 * Get the next protection tier after a given year.
 */
export function getNextProtectionTier(
  ladder: ProtectionLadder | null | undefined,
  year: number
): ProtectionLadderTier | null {
  if (!ladder) return null;

  // Find tiers after the given year
  const futureTiers = ladder
    .filter((tier) => tier.year > year)
    .sort((a, b) => a.year - b.year);

  return futureTiers[0] ?? null;
}

/**
 * Check if a year is the final year in the protection ladder.
 */
export function isFinalProtectionYear(
  ladder: ProtectionLadder | null | undefined,
  year: number
): boolean {
  if (!ladder || ladder.length === 0) return true;

  const maxYear = Math.max(...ladder.map((t) => t.year));
  return year >= maxYear;
}
