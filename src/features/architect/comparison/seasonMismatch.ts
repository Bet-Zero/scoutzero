/**
 * FILE: src/features/architect/comparison/seasonMismatch.ts
 * PURPOSE: Pure helper for detecting season-advance events in the committed event stream.
 * OWNERSHIP: Feature: architect/comparison
 *
 * When season-advance events are present, cap deltas span multiple seasons and
 * must be labeled multi-season / accumulated. This helper flags that condition.
 * No Firestore reads, no React, no state, no mutation authority.
 */

export type EventRowForSeasonCheck = {
  mutationType: string | null;
  category?: string | null;
};

// Explicit season-advance mutation type strings known from the codebase.
const SEASON_ADVANCE_MUTATION_TYPES = new Set([
  'advanceSeason',
  'seasonAdvanced',
  'seasonAdvance',
  'advanceSeasonInWorld',
  'season_advance',
]);

function isSeasonAdvanceEvent(event: EventRowForSeasonCheck): boolean {
  const mutationType = event.mutationType ?? '';
  const category = (event.category ?? '').toLowerCase();

  if (SEASON_ADVANCE_MUTATION_TYPES.has(mutationType)) {
    return true;
  }
  // Defensive fallback: any mutationType containing both 'season' and 'advance'
  const typeLower = mutationType.toLowerCase();
  if (typeLower.includes('season') && typeLower.includes('advance')) {
    return true;
  }
  // Category-based fallback
  if (category.includes('season') && category.includes('advance')) {
    return true;
  }
  return false;
}

export interface SeasonMismatchResult {
  /** True when at least one season-advance event is present. */
  hasMismatch: boolean;
  /** Number of season-advance events detected. */
  seasonAdvanceEventCount: number;
}

/**
 * Checks whether the committed event stream includes season-advance events.
 * When true, any cap delta covers multiple seasons and must be labeled as such.
 */
export function detectSeasonMismatch(
  events: EventRowForSeasonCheck[]
): SeasonMismatchResult {
  const seasonAdvanceEvents = events.filter(isSeasonAdvanceEvent);
  return {
    hasMismatch: seasonAdvanceEvents.length > 0,
    seasonAdvanceEventCount: seasonAdvanceEvents.length,
  };
}
