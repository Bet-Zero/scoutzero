import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  type DocumentData,
  type WithFieldValue,
} from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { PLAYERS_COLLECTION } from '@/constants/collections';

export type PlayerFirestoreData = WithFieldValue<DocumentData>;
export type LoadedPlayerData = DocumentData | null;
export type PlayerDataMap = Record<string, DocumentData>;

// 🔁 Save a single player to Firestore
export const savePlayerData = async (
  playerId: string,
  playerData: PlayerFirestoreData
): Promise<void> => {
  try {
    await setDoc(doc(db, PLAYERS_COLLECTION, playerId), playerData, { merge: true });
    console.log(`✅ Player ${playerId} saved to Firebase`);
  } catch (error) {
    console.error('❌ Error saving player:', error);
  }
};

// 📥 Load a single player from Firestore
export const loadPlayerData = async (
  playerId: string
): Promise<LoadedPlayerData> => {
  try {
    const docRef = doc(db, PLAYERS_COLLECTION, playerId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      console.log(`📥 Player ${playerId} loaded from Firebase`);
      return docSnap.data(); // Return all saved player data
    } else {
      console.log('⚠️ No such player data!');
      return null;
    }
  } catch (error) {
    console.error('❌ Error loading player:', error);
    return null;
  }
};

// 📤 Load all players from Firebase
export const getAllPlayers = async (): Promise<PlayerDataMap> => {
  try {
    const snapshot = await getDocs(collection(db, PLAYERS_COLLECTION));
    const players: PlayerDataMap = {};
    snapshot.forEach((doc) => {
      players[doc.id] = doc.data();
    });
    console.log(
      `📤 Loaded ${Object.keys(players).length} players from Firebase`
    );
    return players;
  } catch (error) {
    console.error('❌ Error loading players:', error);
    return {};
  }
};
