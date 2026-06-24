/**
 * FILE: src/features/architect/comparison/rosterDelta.ts
 * PURPOSE: Pure helpers for classifying roster changes from the committed event stream.
 * OWNERSHIP: Feature: architect/comparison
 *
 * Classification is anchored to current-roster presence and event mutation type.
 * All outputs are labeled 'committed-world / event-derived'. Does not claim
 * exhaustive roster diff — only reports what committed events record.
 * No Firestore reads, no React, no state, no mutation authority.
 */

import type { Stage3RosterEntry } from './types';

export type EventRowForRoster = {
  playerIds: string[];
  mutationType: string | null;
};

// Mutations that indicate a player was added to the active team.
const ADDING_MUTATION_TYPES = new Set([
  'signFreeAgent',
  'matchOfferSheet',
  'finalizeMatchedOfferSheet',
]);

// Mutations that indicate a player was removed from the active team.
const REMOVING_MUTATION_TYPES = new Set([
  'waivePlayer',
  'waiveAndStretch',
  'buyoutPlayer',
]);

// Trade mutations: players can move TO or FROM the active team.
// Current-roster presence disambiguates direction.
const TRADE_MUTATION_TYPES = new Set([
  'executeTrade',
  'signAndTrade',
]);

// Mutations that modify existing roster members' contracts without changing membership.
const CONTRACT_MUTATION_TYPES = new Set([
  'extendPlayer',
  'renounceRights',
  'declineOfferSheet',
  'finalizeDeclinedOfferSheet',
  'storeOfferSheet',
  'setDeadCap',
  'setExceptions',
]);

function uniqueIds(ids: string[]): string[] {
  return Array.from(
    new Set(ids.filter((id) => typeof id === 'string' && id.trim() !== ''))
  );
}

function toEntry(playerId: string): Stage3RosterEntry {
  return {
    playerId,
    displayName: null,
    authority: 'committed-world / event-derived',
  };
}

export interface RosterDeltaResult {
  rosterAdditions: Stage3RosterEntry[];
  rosterRemovals: Stage3RosterEntry[];
  rosterChangedPlayers: Stage3RosterEntry[];
}

/**
 * Derives roster change classifications from committed event rows.
 *
 * @param events - Normalized committed event rows (mutationType + playerIds).
 * @param currentRosterPlayerIds - Player IDs currently on the active team roster.
 *   The caller derives this from teamCapSheet.players using their own ID normalization.
 */
export function deriveRosterDelta(
  events: EventRowForRoster[],
  currentRosterPlayerIds: string[]
): RosterDeltaResult {
  const currentRosterSet = new Set(
    currentRosterPlayerIds.filter((id) => typeof id === 'string' && id.trim() !== '')
  );

  const addingIds: string[] = [];
  const removingIds: string[] = [];
  const contractIds: string[] = [];

  for (const event of events) {
    const mutationType =
      typeof event.mutationType === 'string' ? event.mutationType : '';
    const validIds = (event.playerIds ?? []).filter(
      (id) => typeof id === 'string' && id.trim() !== ''
    );

    if (ADDING_MUTATION_TYPES.has(mutationType)) {
      addingIds.push(...validIds);
    } else if (REMOVING_MUTATION_TYPES.has(mutationType)) {
      removingIds.push(...validIds);
    } else if (TRADE_MUTATION_TYPES.has(mutationType)) {
      // Trade players are in both buckets; roster presence disambiguates direction.
      addingIds.push(...validIds);
      removingIds.push(...validIds);
    } else if (mutationType === 'optionDecision') {
      for (const id of validIds) {
        if (currentRosterSet.has(id)) {
          contractIds.push(id);
        } else {
          removingIds.push(id);
        }
      }
    } else if (CONTRACT_MUTATION_TYPES.has(mutationType)) {
      contractIds.push(...validIds);
    }
  }

  // Additions: appeared in acquisition events AND are currently on roster.
  const rosterAdditions = uniqueIds(addingIds)
    .filter((id) => currentRosterSet.has(id))
    .map(toEntry);

  // Removals: appeared in removal events AND are NOT on roster.
  const rosterRemovals = uniqueIds(removingIds)
    .filter((id) => !currentRosterSet.has(id))
    .map(toEntry);

  // Changed: appeared in contract events AND are still on roster.
  const rosterChangedPlayers = uniqueIds(contractIds)
    .filter((id) => currentRosterSet.has(id))
    .map(toEntry);

  return { rosterAdditions, rosterRemovals, rosterChangedPlayers };
}
