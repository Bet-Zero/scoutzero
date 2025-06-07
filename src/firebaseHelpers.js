import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';

// 🔁 Save a single player to Firestore
export const savePlayerData = async (playerId, playerData) => {
  try {
    await setDoc(doc(db, 'players', playerId), playerData, { merge: true });
    console.log(`✅ Player ${playerId} saved to Firebase`);
  } catch (error) {
    console.error('❌ Error saving player:', error);
  }
};

// 📥 Load a single player from Firestore
export const loadPlayerData = async (playerId) => {
  try {
    const docRef = doc(db, 'players', playerId);
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
