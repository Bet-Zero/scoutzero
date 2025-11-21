/**
 * Firestore Collection Constants
 *
 * Centralized collection names for all Firestore queries.
 * Use these constants instead of hardcoded strings.
 */

/**
 * Main players collection (v2 schema)
 * Can be overridden via environment variable for testing/migration
 */
export const PLAYERS_COLLECTION =
  import.meta.env.VITE_PLAYERS_COLLECTION || 'players_v2';

/**
 * Architect base players path (collection or collection group)
 * Defaults to the canonical `architect_basePlayers` (single collection name)
 * Note: Using underscore instead of slash because Firestore requires odd number of segments for collections
 */
export const ARCHITECT_BASE_PLAYERS_PATH =
  import.meta.env.VITE_ARCHITECT_BASE_PLAYERS_PATH || 'architect_basePlayers';

/**
 * Architect base teams path (collection or collection group)
 * Defaults to the canonical `architect_baseTeams` (single collection name)
 * Note: Using underscore instead of slash because Firestore requires odd number of segments for collections
 */
export const ARCHITECT_BASE_TEAMS_PATH =
  import.meta.env.VITE_ARCHITECT_BASE_TEAMS_PATH || 'architect_baseTeams';

/**
 * Subcollection names (under players)
 */
export const CONTRACTS_SUBCOLLECTION = 'contracts';
export const SEASONS_SUBCOLLECTION = 'seasons';
export const EVALUATIONS_SUBCOLLECTION = 'evaluations';
