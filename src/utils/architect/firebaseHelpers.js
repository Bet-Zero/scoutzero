import {
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/firebaseConfig';

// Save a team's cap sheet
export const saveTeamCapSheet = async (teamId, capSheet) => {
  try {
    await setDoc(doc(db, 'teams', teamId), capSheet);
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
      return docSnap.data();
    } else {
      console.warn('No data found for team:', teamId);
      return null;
    }
  } catch (error) {
    console.error('Error loading cap sheet:', error);
    return null;
  }
};

// Save free agent pool
export const saveFreeAgents = async (agents) => {
  try {
    const batch = writeBatch(db);
    agents.forEach((agent) => {
      const agentRef = doc(db, 'freeAgents', agent.id || agent.name);
      batch.set(agentRef, agent);
    });
    await batch.commit();
    console.log('Saved free agents');
    return true;
  } catch (error) {
    console.error('Error saving free agents:', error);
    return false;
  }
};

// Load free agent pool
export const loadFreeAgents = async () => {
  try {
    const snap = await getDocs(collection(db, 'freeAgents'));
    const agents = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return agents;
  } catch (error) {
    console.error('Error loading free agents:', error);
    return [];
  }
};

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
