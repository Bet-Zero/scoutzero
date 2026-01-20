#!/usr/bin/env tsx
/**
 * FILE: team-scrape/draft-picks/scripts/pst/pst_owner_model_utils.ts
 * PURPOSE: Utilities for determining pick ownership vs swap rights in PST data
 * OWNERSHIP: team-scrape/pst
 *
 * HISTORY:
 *  - 2026-01-18: Created for swap-rights ownership model fix (DAL_2030_1st regression)
 *
 * LINKS:
 *  - Plan: Ownership Model Swap Rights Fix
 */

/**
 * Determines if a row/profile describes ONLY a swap right (not an ownership transfer).
 *
 * Swap-only detection rules:
 * - If evidence contains phrases like "option to swap", "right to swap", "can swap"
 * - AND does NOT contain explicit "pick traded" patterns for that specific pick:
 *   - "{YEAR} first round pick" or "second round pick" WITHOUT swap language, being part of "Traded ... for ..."
 *   - "to {TEAM} for ... {YEAR} first round pick"
 *   - "(from {TEAM})" attached to the pick mention indicating conveyance
 *
 * Important: The presence of "Traded • ..." alone is not enough. It must explicitly convey THAT specific pick,
 * not just an option to swap it.
 *
 * @param normalizedText - The normalized text evidence from the row
 * @param pickId - The pick ID (e.g., "DAL_2030_1st") to check
 * @param year - The pick year
 * @param round - The pick round (1 or 2)
 * @returns true if this is swap-only (should NOT change owner), false if explicit conveyance (can change owner)
 */
export function isSwapOnlyClause(
  normalizedText: string,
  pickId: string,
  year: number,
  round: 1 | 2
): boolean {
  const text = normalizedText.toLowerCase();
  const roundText = round === 1 ? 'first round' : 'second round';

  // Check for swap language
  const hasSwapLanguage =
    text.includes('option to swap') ||
    text.includes('right to swap') ||
    text.includes('can swap') ||
    text.includes('swap right') ||
    text.includes('swap with');

  if (!hasSwapLanguage) {
    // No swap language = not swap-only, could be explicit conveyance
    return false;
  }

  // If swap language exists, check if there's ALSO explicit conveyance for this specific pick
  // Extract year and round from pick ID to match
  const yearPattern = year.toString();
  const roundSuffix = round === 1 ? '1st' : '2nd';

  // Pattern 1: "{YEAR} {round} pick" mentioned without swap language in context of conveyance
  // Look for patterns like "2027 first round pick to BOS" or "(from BOS)" without swap mention nearby
  const explicitConveyancePatterns = [
    // "Traded ... {YEAR} {round} pick to {TEAM}"
    new RegExp(
      `traded[^•]*${yearPattern}\\s+${roundText}\\s+pick[^•]*to\\s+\\w+`,
      'i'
    ),
    // "{YEAR} {round} pick to {TEAM} for"
    new RegExp(`${yearPattern}\\s+${roundText}\\s+pick[^•]*to\\s+\\w+\\s+for`, 'i'),
    // "(from {TEAM})" pattern near pick mention (without swap nearby)
    new RegExp(
      `${yearPattern}[^•]*${roundText}[^•]*\\(from\\s+\\w+\\)`,
      'i'
    ),
    // "most favorable of" or "second most favorable of" or "least favorable of" patterns
    // These indicate ranked distribution conveyances, NOT swap rights
    new RegExp(
      `${yearPattern}\\s+${roundText}\\s+pick[^•]*(?:most\\s+favorable|second\\s+most\\s+favorable|third\\s+most\\s+favorable|least\\s+favorable)\\s+of`,
      'i'
    ),
  ];

  // Check if any explicit conveyance pattern matches AND there's no swap mention in the same clause
  for (const pattern of explicitConveyancePatterns) {
    if (pattern.test(text)) {
      // Found explicit conveyance pattern - check if swap language is in a separate clause
      // This is conservative: if both exist, we err on the side of explicit conveyance
      return false;
    }
  }

  // If we have swap language but no explicit conveyance patterns, it's swap-only
  return true;
}

/**
 * Determines if an overlay item represents only a swap right (not an ownership transfer).
 * This is a wrapper that loads the normalized text from normalized rows.
 *
 * @param overlayItem - The overlay item to check (must include sourceTeamPage; rowRef is per-page)
 * @param normalizedRowsMap - Map keyed by "sourceTeamPage|rowRef" for evidence lookup
 * @returns true if swap-only (should NOT change owner), false if explicit conveyance
 */
export function isSwapOnlyOverlayItem(
  overlayItem: {
    pickId: string;
    year: number;
    round: 1 | 2;
    rowRef: string;
    sourceTeamPage: string;
  },
  normalizedRowsMap: Map<string, { normalizedText: string }>
): boolean {
  const key = `${overlayItem.sourceTeamPage}|${overlayItem.rowRef}`;
  const normalizedRow = normalizedRowsMap.get(key);
  if (!normalizedRow) {
    // If we can't find the evidence, err on the side of caution and don't apply swap gate
    return false;
  }

  return isSwapOnlyClause(
    normalizedRow.normalizedText,
    overlayItem.pickId,
    overlayItem.year,
    overlayItem.round
  );
}
