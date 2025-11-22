import { doc, collection } from 'firebase/firestore';
import { db } from '@/firebaseConfig';

/**
 * Centralized Firestore path helpers for V2 schema
 * Provides helpers for players_v2 collection and its subcollections
 */

// Player document reference
export const playerRef = (playerId) => doc(db, 'players_v2', playerId);

// Player subcollection references
export const contractsCol = (playerId) =>
  collection(db, 'players_v2', playerId, 'contracts');
export const seasonsCol = (playerId) =>
  collection(db, 'players_v2', playerId, 'seasons');
export const evalsCol = (playerId) =>
  collection(db, 'players_v2', playerId, 'evaluations');

// Specific document references within subcollections
export const contractRef = (playerId, contractId) =>
  doc(db, 'players_v2', playerId, 'contracts', contractId);
export const seasonRef = (playerId, seasonId) =>
  doc(db, 'players_v2', playerId, 'seasons', seasonId);
export const evalRef = (playerId, evalId) =>
  doc(db, 'players_v2', playerId, 'evaluations', evalId);

// Collection references
export const playersCol = () => collection(db, 'players_v2');
export const teamsCol = () => collection(db, 'teams');

// Architect base collections (for GM tools and trade machine)
// Canonical paths (documentation): /architect/baseTeams/{teamCode} and /architect/basePlayers/{playerId}
// Actual Firestore collections: architect_baseTeams and architect_basePlayers
export const baseTeamsCol = () => collection(db, 'architect_baseTeams');
export const baseTeamRef = (teamCode) => doc(db, 'architect_baseTeams', teamCode);
export const basePlayerRef = (playerId) => doc(db, 'architect_basePlayers', playerId);
