import { doc, collection } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import {
  PLAYERS_COLLECTION,
  ARCHITECT_BASE_PLAYERS_PATH,
  ARCHITECT_BASE_TEAMS_PATH,
  ARCHITECT_BASE_ENTITLEMENTS_PATH,
  CONTRACTS_SUBCOLLECTION,
  SEASONS_SUBCOLLECTION,
  EVALUATIONS_SUBCOLLECTION,
} from '@/constants/collections';

export const playerRef = (playerId: string) =>
  doc(db, PLAYERS_COLLECTION, playerId);

export const contractsCol = (playerId: string) =>
  collection(db, PLAYERS_COLLECTION, playerId, CONTRACTS_SUBCOLLECTION);
export const seasonsCol = (playerId: string) =>
  collection(db, PLAYERS_COLLECTION, playerId, SEASONS_SUBCOLLECTION);
export const evalsCol = (playerId: string) =>
  collection(db, PLAYERS_COLLECTION, playerId, EVALUATIONS_SUBCOLLECTION);

export const contractRef = (playerId: string, contractId: string) =>
  doc(db, PLAYERS_COLLECTION, playerId, CONTRACTS_SUBCOLLECTION, contractId);
export const seasonRef = (playerId: string, seasonId: string) =>
  doc(db, PLAYERS_COLLECTION, playerId, SEASONS_SUBCOLLECTION, seasonId);
export const evalRef = (playerId: string, evalId: string) =>
  doc(db, PLAYERS_COLLECTION, playerId, EVALUATIONS_SUBCOLLECTION, evalId);

export const playersCol = () => collection(db, PLAYERS_COLLECTION);

// Architect base collections (for GM tools and trade machine)
// Canonical paths (documentation): /architect/baseTeams/{teamCode} and /architect/basePlayers/{playerId}
// Actual Firestore collections: architect_baseTeams and architect_basePlayers
export const basePlayersCol = () => collection(db, ARCHITECT_BASE_PLAYERS_PATH);
export const basePlayerRef = (playerId: string) =>
  doc(db, ARCHITECT_BASE_PLAYERS_PATH, playerId);

export const baseTeamsCol = () => collection(db, ARCHITECT_BASE_TEAMS_PATH);
export const baseTeamRef = (teamCode: string) =>
  doc(db, ARCHITECT_BASE_TEAMS_PATH, teamCode);

export const baseEntitlementsCol = () =>
  collection(db, ARCHITECT_BASE_ENTITLEMENTS_PATH);
export const baseEntitlementRef = (entitlementId: string) =>
  doc(db, ARCHITECT_BASE_ENTITLEMENTS_PATH, entitlementId);
