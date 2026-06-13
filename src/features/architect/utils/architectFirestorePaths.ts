/**
 * FILE: src/features/architect/utils/architectFirestorePaths.ts
 * PURPOSE: Centralized path helpers for all Architect collections
 * OWNERSHIP: [Team/Owner TBD]
 * HISTORY:
 *   - Created: [Date] - Initial implementation of Architect Firestore path helpers
 *   - 2026-01-21: Added base/world entitlement path helpers
 * LINKS:
 *   - Related: src/data/firestorePaths.ts (base collection helpers)
 *
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
 */

import {
  doc,
  collection,
  DocumentReference,
  CollectionReference,
} from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import {
  ARCHITECT_WORLDS_COLLECTION,
  ARCHITECT_WORLD_TEAMS_SUBCOLLECTION,
  ARCHITECT_WORLD_PLAYERS_SUBCOLLECTION,
  ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION,
  ARCHITECT_WORLD_FREE_AGENT_POOLS_SUBCOLLECTION,
} from '@/constants/collections';

// Re-export base collection helpers for convenience
export {
  baseTeamRef,
  baseTeamsCol,
  basePlayerRef,
  basePlayersCol,
  baseEntitlementRef,
  baseEntitlementsCol,
} from '@/data/firestorePaths';

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
  collection(db, ARCHITECT_WORLDS_COLLECTION, worldId, ARCHITECT_WORLD_TEAMS_SUBCOLLECTION);

/**
 * Get reference to a specific team snapshot within a world
 * Path: architect_worlds/{worldId}/teams/{teamCode}
 *
 * @param worldId - World ID
 * @param teamCode - Team code (e.g., "LAL")
 */
export const worldTeamRef = (
  worldId: string,
  teamCode: string
): DocumentReference =>
  doc(db, ARCHITECT_WORLDS_COLLECTION, worldId, ARCHITECT_WORLD_TEAMS_SUBCOLLECTION, teamCode);

/**
 * Get reference to a world's team's players subcollection
 * Path: architect_worlds/{worldId}/teams/{teamCode}/players
 *
 * @param worldId - World ID
 * @param teamCode - Team code (e.g., "LAL")
 */
export const worldPlayersCol = (
  worldId: string,
  teamCode: string
): CollectionReference =>
  collection(
    db,
    ARCHITECT_WORLDS_COLLECTION,
    worldId,
    ARCHITECT_WORLD_TEAMS_SUBCOLLECTION,
    teamCode,
    ARCHITECT_WORLD_PLAYERS_SUBCOLLECTION
  );

/**
 * Get reference to a world's entitlements subcollection
 * Path: architect_worlds/{worldId}/entitlements
 *
 * @param worldId - World ID
 */
export const worldEntitlementsCol = (worldId: string): CollectionReference =>
  collection(
    db,
    ARCHITECT_WORLDS_COLLECTION,
    worldId,
    ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION
  );

/**
 * Get reference to a specific world entitlement override
 * Path: architect_worlds/{worldId}/entitlements/{entitlementId}
 *
 * @param worldId - World ID
 * @param entitlementId - Entitlement ID
 */
export const worldEntitlementRef = (
  worldId: string,
  entitlementId: string
): DocumentReference =>
  doc(
    db,
    ARCHITECT_WORLDS_COLLECTION,
    worldId,
    ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION,
    entitlementId
  );

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
  doc(
    db,
    ARCHITECT_WORLDS_COLLECTION,
    worldId,
    ARCHITECT_WORLD_TEAMS_SUBCOLLECTION,
    teamCode,
    ARCHITECT_WORLD_PLAYERS_SUBCOLLECTION,
    playerId
  );

/**
 * Get reference to a managed free-agent pool for a world team season.
 * Path: architect_worlds/{worldId}/teams/{teamCode}/freeAgentPools/{seasonKey}
 *
 * @param worldId - World ID
 * @param teamCode - Team code (e.g. "LAL")
 * @param seasonKey - Season key (e.g. "2025-26")
 */
export const worldTeamFreeAgentPoolRef = (
  worldId: string,
  teamCode: string,
  seasonKey: string
): DocumentReference =>
  doc(
    db,
    ARCHITECT_WORLDS_COLLECTION,
    worldId,
    ARCHITECT_WORLD_TEAMS_SUBCOLLECTION,
    teamCode,
    ARCHITECT_WORLD_FREE_AGENT_POOLS_SUBCOLLECTION,
    seasonKey
  );
