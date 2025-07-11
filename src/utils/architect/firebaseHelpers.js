import { doc, setDoc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseConfig';

// Save a team's cap sheet
export const saveTeamCapSheet = async (teamId, capSheet) => {
  try {
    await setDoc(doc(db, 'teams', teamId), { capSheet }, { merge: true });
    console.log(`Saved ${teamId} successfully`);
    return true;
  } catch (error) {
    console.error('Error saving cap sheet:', error);
    return false;
  }
};

// Load a team's cap sheet
export const loadTeamCapSheet = async (teamId) => {
  try {
    const docSnap = await getDoc(doc(db, 'teams', teamId));
    if (docSnap.exists()) {
      return docSnap.data().capSheet || null;
    }

    console.warn('No data found for team:', teamId);
    return null;
  } catch (error) {
    console.error('Error loading cap sheet:', error);
    return null;
  }
};

// Save free agent pool

// Get list of all teams
export const getAllTeams = async () => {
  try {
    const snapshot = await getDocs(collection(db, 'teams'));
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().meta?.teamName || doc.id,
    }));
  } catch (error) {
    console.error('Error getting teams:', error);
    return [];
  }
};
