import { doc, setDoc, getDoc, getDocs, collection } from 'firebase/firestore';
import { db } from './firebaseConfig.js';
import { PLAYERS_COLLECTION } from './constants/collections.js';

// 🔁 Save a single player to Firestore
export const savePlayerData = async (playerId, playerData) => {
  try {
    await setDoc(doc(db, PLAYERS_COLLECTION, playerId), playerData, { merge: true });
    console.log(`✅ Player ${playerId} saved to Firebase`);
  } catch (error) {
    console.error('❌ Error saving player:', error);
  }
};

// 📥 Load a single player from Firestore
export const loadPlayerData = async (playerId) => {
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
export const getAllPlayers = async () => {
  try {
    const snapshot = await getDocs(collection(db, PLAYERS_COLLECTION));
    const players = {};
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
