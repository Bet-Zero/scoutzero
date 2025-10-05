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
 * Teams collection
 */
export const TEAMS_COLLECTION = 'teams';

/**
 * Subcollection names (under players)
 */
export const CONTRACTS_SUBCOLLECTION = 'contracts';
export const SEASONS_SUBCOLLECTION = 'seasons';
export const EVALUATIONS_SUBCOLLECTION = 'evaluations';
