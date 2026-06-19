import {
  doc, collection,
  type DocumentReference,
  type CollectionReference,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import {
  PLAYERS_COLLECTION,
  ARCHITECT_BASE_PLAYERS_PATH,
  ARCHITECT_BASE_TEAMS_PATH,
  ARCHITECT_BASE_ENTITLEMENTS_PATH,
  CONTRACTS_SUBCOLLECTION,
  SEASONS_SUBCOLLECTION,
  EVALUATIONS_SUBCOLLECTION,
  PLAYER_PROFILE_EVALUATIONS_COLLECTION,
  PLAYER_PROFILE_EVALUATION_PLAYERS_SUBCOLLECTION,
} from '@/constants/collections';

type DocRef = DocumentReference<DocumentData, DocumentData>;
type ColRef = CollectionReference<DocumentData, DocumentData>;

export const playerRef = (playerId: string): DocRef =>
  doc(db, PLAYERS_COLLECTION, playerId);

export const contractsCol = (playerId: string): ColRef =>
  collection(db, PLAYERS_COLLECTION, playerId, CONTRACTS_SUBCOLLECTION);
export const seasonsCol = (playerId: string): ColRef =>
  collection(db, PLAYERS_COLLECTION, playerId, SEASONS_SUBCOLLECTION);
export const evalsCol = (playerId: string): ColRef =>
  collection(db, PLAYERS_COLLECTION, playerId, EVALUATIONS_SUBCOLLECTION);

export const contractRef = (playerId: string, contractId: string): DocRef =>
  doc(db, PLAYERS_COLLECTION, playerId, CONTRACTS_SUBCOLLECTION, contractId);
export const seasonRef = (playerId: string, seasonId: string): DocRef =>
  doc(db, PLAYERS_COLLECTION, playerId, SEASONS_SUBCOLLECTION, seasonId);
export const evalRef = (playerId: string, evalId: string): DocRef =>
  doc(db, PLAYERS_COLLECTION, playerId, EVALUATIONS_SUBCOLLECTION, evalId);

export const playersCol = (): ColRef => collection(db, PLAYERS_COLLECTION);

export const playerProfileEvaluationRef = (
  ownerUid: string,
  playerId: string
): DocRef =>
  doc(
    db,
    PLAYER_PROFILE_EVALUATIONS_COLLECTION,
    ownerUid,
    PLAYER_PROFILE_EVALUATION_PLAYERS_SUBCOLLECTION,
    playerId
  );

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
