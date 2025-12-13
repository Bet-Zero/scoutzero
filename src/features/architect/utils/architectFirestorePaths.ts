/**
 * Architect Firestore Path Helpers
 *
 * Centralized path helpers for all Architect collections:
 * - architect_worlds: World metadata and team snapshots
 * - architect_baseTeams: Base team data (unchanged)
 * - architect_basePlayers: Base player data (unchanged)
 *
 * Path Structure:
 * - World metadata:    architect_worlds/{worldId}
 * - Team snapshot:     architect_worlds/{worldId}/teams/{teamCode}
 * - Player override:   architect_worlds/{worldId}/teams/{teamCode}/players/{playerId}
 * - Base teams:        architect_baseTeams/{teamCode}
 * - Base players:      architect_basePlayers/{playerId}
 *
 * @file src/features/architect/utils/architectFirestorePaths.ts
 * @module architectFirestorePaths
 */

import { doc, collection, DocumentReference, CollectionReference } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { ARCHITECT_WORLDS_COLLECTION } from '@/constants/collections';

// Re-export base collection helpers for convenience
export { baseTeamRef, baseTeamsCol, basePlayerRef, basePlayersCol } from '@/data/firestorePaths';

/**
 * Get reference to the architect_worlds collection
 */
export const worldsCol = (): CollectionReference =>
  collection(db, ARCHITECT_WORLDS_COLLECTION);

/**
 * Get reference to a world's metadata document
 * Path: architect_worlds/{worldId}
 *
 * @param worldId - World ID
 */
export const worldMetadataRef = (worldId: string): DocumentReference =>
  doc(db, ARCHITECT_WORLDS_COLLECTION, worldId);

/**
 * Get reference to a world's teams subcollection
 * Path: architect_worlds/{worldId}/teams
 *
 * @param worldId - World ID
 */
export const worldTeamsCol = (worldId: string): CollectionReference =>
  collection(db, ARCHITECT_WORLDS_COLLECTION, worldId, 'teams');

/**
 * Get reference to a specific team snapshot within a world
 * Path: architect_worlds/{worldId}/teams/{teamCode}
 *
 * @param worldId - World ID
 * @param teamCode - Team code (e.g., "LAL")
 */
export const worldTeamRef = (worldId: string, teamCode: string): DocumentReference =>
  doc(db, ARCHITECT_WORLDS_COLLECTION, worldId, 'teams', teamCode);

/**
 * Get reference to a world's team's players subcollection
 * Path: architect_worlds/{worldId}/teams/{teamCode}/players
 *
 * @param worldId - World ID
 * @param teamCode - Team code (e.g., "LAL")
 */
export const worldPlayersCol = (worldId: string, teamCode: string): CollectionReference =>
  collection(db, ARCHITECT_WORLDS_COLLECTION, worldId, 'teams', teamCode, 'players');

/**
 * Get reference to a specific player override within a world team
 * Path: architect_worlds/{worldId}/teams/{teamCode}/players/{playerId}
 *
 * @param worldId - World ID
 * @param teamCode - Team code (e.g., "LAL")
 * @param playerId - Player ID
 */
export const worldPlayerRef = (
  worldId: string,
  teamCode: string,
  playerId: string
): DocumentReference =>
  doc(db, ARCHITECT_WORLDS_COLLECTION, worldId, 'teams', teamCode, 'players', playerId);
