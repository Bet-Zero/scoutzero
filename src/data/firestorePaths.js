import { doc, collection } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import {
  PLAYERS_COLLECTION,
  ARCHITECT_BASE_PLAYERS_PATH,
  ARCHITECT_BASE_TEAMS_PATH,
  CONTRACTS_SUBCOLLECTION,
  SEASONS_SUBCOLLECTION,
  EVALUATIONS_SUBCOLLECTION,
} from '@/constants/collections';

const splitPath = (path) => path.split('/').filter(Boolean);

const playerSegments = splitPath(PLAYERS_COLLECTION);
const basePlayerSegments = splitPath(ARCHITECT_BASE_PLAYERS_PATH);
const baseTeamSegments = splitPath(ARCHITECT_BASE_TEAMS_PATH);

/**
 * Centralized Firestore path helpers for V2 schema
 * Provides helpers for players_v2 collection and its subcollections
 */

// Player document reference
export const playerRef = (playerId) => doc(db, ...playerSegments, playerId);

// Player subcollection references
export const contractsCol = (playerId) =>
  collection(db, ...playerSegments, playerId, CONTRACTS_SUBCOLLECTION);
export const seasonsCol = (playerId) =>
  collection(db, ...playerSegments, playerId, SEASONS_SUBCOLLECTION);
export const evalsCol = (playerId) =>
  collection(db, ...playerSegments, playerId, EVALUATIONS_SUBCOLLECTION);

// Specific document references within subcollections
export const contractRef = (playerId, contractId) =>
  doc(db, ...playerSegments, playerId, CONTRACTS_SUBCOLLECTION, contractId);
export const seasonRef = (playerId, seasonId) =>
  doc(db, ...playerSegments, playerId, SEASONS_SUBCOLLECTION, seasonId);
export const evalRef = (playerId, evalId) =>
  doc(db, ...playerSegments, playerId, EVALUATIONS_SUBCOLLECTION, evalId);

// Collection references
export const playersCol = () => collection(db, ...playerSegments);

// Architect base collections (for GM tools and trade machine)
// Canonical paths (documentation): /architect/baseTeams/{teamCode} and /architect/basePlayers/{playerId}
// Actual Firestore collections: architect_baseTeams and architect_basePlayers
export const basePlayersCol = () => collection(db, ...basePlayerSegments);
export const basePlayerRef = (playerId) =>
  doc(db, ...basePlayerSegments, playerId);

export const baseTeamsCol = () => collection(db, ...baseTeamSegments);
export const baseTeamRef = (teamCode) => doc(db, ...baseTeamSegments, teamCode);
