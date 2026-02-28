/**
 * Firestore Collection Constants
 *
 * Centralized collection names for all Firestore queries.
 * Use these constants instead of hardcoded strings.
 */

const env =
  typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env
    : process.env;

/**
 * Main players collection (v2 schema)
 * Can be overridden via environment variable for testing/migration
 */
export const PLAYERS_COLLECTION = env.VITE_PLAYERS_COLLECTION || 'players_v2';

/**
 * Architect base players path (collection or collection group)
 * Defaults to the canonical `architect_basePlayers` (single collection name)
 * Note: Using underscore instead of slash because Firestore requires odd number of segments for collections
 */
export const ARCHITECT_BASE_PLAYERS_PATH =
  env.VITE_ARCHITECT_BASE_PLAYERS_PATH || 'architect_basePlayers';

/**
 * Architect base teams path (collection or collection group)
 * Defaults to the canonical `architect_baseTeams` (single collection name)
 * Note: Using underscore instead of slash because Firestore requires odd number of segments for collections
 */
export const ARCHITECT_BASE_TEAMS_PATH =
  env.VITE_ARCHITECT_BASE_TEAMS_PATH || 'architect_baseTeams';

/**
 * Architect base entitlements path
 * Defaults to the canonical `architect_baseEntitlements` (single collection name)
 */
export const ARCHITECT_BASE_ENTITLEMENTS_PATH =
  env.VITE_ARCHITECT_BASE_ENTITLEMENTS_PATH || 'architect_baseEntitlements';

/**
 * Architect base pick rules path
 * Stores structured protection and condition rules for picks
 */
export const ARCHITECT_BASE_PICK_RULES_PATH =
  env.VITE_ARCHITECT_BASE_PICK_RULES_PATH || 'architect_basePickRules';

/**
 * Architect worlds collection (for world metadata and team snapshots)
 * Path structure:
 * - architect_worlds/{worldId} - World metadata
 * - architect_worlds/{worldId}/teams/{teamCode} - Team snapshot
 * - architect_worlds/{worldId}/teams/{teamCode}/players/{playerId} - Player override
 */
export const ARCHITECT_WORLDS_COLLECTION =
  env.VITE_ARCHITECT_WORLDS_COLLECTION || 'architect_worlds';

/**
 * Architect world entitlements subcollection name
 */
export const ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION = 'entitlements';

/**
 * Architect world events subcollection name
 */
export const ARCHITECT_WORLD_EVENTS_SUBCOLLECTION = 'events';

/**
 * Subcollection names (under players)
 */
export const CONTRACTS_SUBCOLLECTION = 'contracts';
export const SEASONS_SUBCOLLECTION = 'seasons';
export const EVALUATIONS_SUBCOLLECTION = 'evaluations';

/**
 * Ranker sessions collection (user-owned tool)
 * Stores in-progress and completed ranking sessions per user.
 */
export const RANKER_SESSIONS_COLLECTION = 'rankerSessions';
