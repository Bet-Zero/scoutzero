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
 * Architect world subcollection names
 */
export const ARCHITECT_WORLD_TEAMS_SUBCOLLECTION = 'teams';
export const ARCHITECT_WORLD_PLAYERS_SUBCOLLECTION = 'players';
export const ARCHITECT_WORLD_ENTITLEMENTS_SUBCOLLECTION = 'entitlements';
export const ARCHITECT_WORLD_EVENTS_SUBCOLLECTION = 'events';

/**
 * Free agents collection
 * Used by Architect team plan helpers for free agent pool management
 */
export const FREE_AGENTS_COLLECTION =
  env.VITE_FREE_AGENTS_COLLECTION || 'freeAgents';

/**
 * Subcollection names (under players)
 */
export const CONTRACTS_SUBCOLLECTION = 'contracts';
export const SEASONS_SUBCOLLECTION = 'seasons';
export const EVALUATIONS_SUBCOLLECTION = 'evaluations';

/**
 * Player lists collection (user-owned)
 * Stores user-created ranked player lists.
 */
export const LISTS_COLLECTION = 'lists';

/**
 * Tier lists collection (user-owned)
 * Stores user-created tier lists (standard and pyramid modes).
 */
export const TIER_LISTS_COLLECTION = 'tierLists';

/**
 * Ranker sessions collection (user-owned tool)
 * Stores in-progress and completed ranking sessions per user.
 */
export const RANKER_SESSIONS_COLLECTION = 'rankerSessions';

/**
 * Roster projects collection (user-owned tool)
 * Stores saved 5/4/6 roster builder snapshots.
 */
export const ROSTER_PROJECTS_COLLECTION = 'rosterProjects';
