/**
 * Firebase collection constants
 * This allows easy switching between collection names
 */

// Primary players collection - can be switched at cutover
export const PLAYERS_COLLECTION = process.env.PLAYERS_COLLECTION || 'players_v2';

// Subcollection names
export const CONTRACTS_SUBCOLLECTION = 'contracts';
export const SEASONS_SUBCOLLECTION = 'seasons';
export const EVALUATIONS_SUBCOLLECTION = 'evaluations';
