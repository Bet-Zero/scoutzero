import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  getDocs 
} from "firebase/firestore";
import firebaseConfig from "../firebaseConfig";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Save a team's cap sheet
export const saveTeamCapSheet = async (teamId, capSheet) => {
  try {
    await setDoc(doc(db, "teams", teamId), capSheet);
    console.log(`Saved ${teamId} successfully`);
    return true;
  } catch (error) {
    console.error("Error saving cap sheet:", error);
    return false;
  }
};

// Load a team's cap sheet
export const loadTeamCapSheet = async (teamId) => {
  try {
    const docSnap = await getDoc(doc(db, "teams", teamId));
    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      console.warn("No data found for team:", teamId);
      return null;
    }
  } catch (error) {
    console.error("Error loading cap sheet:", error);
    return null;
  }
};

// Save free agent pool
export const saveFreeAgents = async (agents) => {
  try {
    await setDoc(doc(db, "meta", "freeAgents"), { pool: agents });
    console.log("Saved free agents");
    return true;
  } catch (error) {
    console.error("Error saving free agents:", error);
    return false;
  }
};

// Load free agent pool
export const loadFreeAgents = async () => {
  try {
    const snap = await getDoc(doc(db, "meta", "freeAgents"));
    if (snap.exists()) {
      return snap.data().pool;
    } else {
      console.warn("No free agents found.");
      return [];
    }
  } catch (error) {
    console.error("Error loading free agents:", error);
    return [];
  }
};

// Get list of all teams
export const getAllTeams = async () => {
  try {
    const snapshot = await getDocs(collection(db, "teams"));
    return snapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().meta?.teamName || doc.id
    }));
  } catch (error) {
    console.error("Error getting teams:", error);
    return [];
  }
};