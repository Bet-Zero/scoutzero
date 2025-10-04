/**
 * Firestore Collection Constants
 * 
 * Centralized collection names to support schema versioning
 */

// Main players collection - defaults to v2 schema, can be overridden via env
// eslint-disable-next-line no-undef
export const PLAYERS_COLLECTION = process.env.VITE_PLAYERS_COLLECTION || 'players_v2';

// Team collection
export const TEAMS_COLLECTION = 'teams';

// Team plans collection for GM tools
export const TEAM_PLANS_COLLECTION = 'teamPlans';
