// firebaseHelpers.js

import {
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { calculateCapHold } from '@/utils/architect/contractUtils';
import { attachDefaultPicks } from '@/utils/architect/defaultPicks';

// Save a team's cap sheet under `/teams/{teamId}.capSheet`
export const saveTeamCapSheet = async (
  teamId,
  capSheet,
  capProjections,
  year = 2025
) => {
  try {
    const updatedPlayers = capSheet.players.map((player) => {
      const capHold = calculateCapHold(player, capProjections, year);
      return {
        ...player,
        cap_hold: capHold,
      };
    });

    const updatedCapSheet = {
      ...capSheet,
      players: updatedPlayers,
    };

    await setDoc(
      doc(db, 'teams', teamId),
      { capSheet: updatedCapSheet },
      { merge: true }
    );
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
      const data = docSnap.data();
      const sheet = data?.capSheet;
      return sheet ? attachDefaultPicks(sheet) : null;
    } else {
      console.warn('No data found for team:', teamId);
      return null;
    }
  } catch (error) {
    console.error('Error loading cap sheet:', error);
    return null;
  }
};

// ===== User-Specific Team Plans =====
export const saveUserTeamPlan = async (userId, teamId, capSheet) => {
  try {
    const planId = `${userId}_${teamId}`;
    const planRef = doc(db, 'teamPlans', planId);
    await setDoc(planRef, { capSheet, updatedAt: serverTimestamp() });
    console.log(`Saved plan for ${userId} – ${teamId}`);
    return true;
  } catch (error) {
    console.error('Error saving team plan:', error);
    return false;
  }
};

export const loadUserTeamPlan = async (userId, teamId) => {
  try {
    const planId = `${userId}_${teamId}`;
    const planRef = doc(db, 'teamPlans', planId);
    const docSnap = await getDoc(planRef);
    if (!docSnap.exists()) return null;
    const data = docSnap.data();
    return data.capSheet || data;
  } catch (error) {
    console.error('Error loading team plan:', error);
    return null;
  }
};

// ===== Named Plans (Subcollection) =====
export const listUserTeamPlans = async (userId, teamId) => {
  try {
    const planId = `${userId}_${teamId}`;
    const plansRef = collection(db, 'teamPlans', planId, 'namedPlans');
    const snap = await getDocs(plansRef);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('Error listing team plans:', error);
    return [];
  }
};

export const saveNamedTeamPlan = async (userId, teamId, name, capSheet) => {
  try {
    const planId = `${userId}_${teamId}`;
    const ref = doc(db, 'teamPlans', planId, 'namedPlans', name);
    await setDoc(ref, { name, capSheet, updatedAt: serverTimestamp() });
    console.log(`Saved plan ${name} for ${userId} – ${teamId}`);
    return true;
  } catch (error) {
    console.error('Error saving named plan:', error);
    return false;
  }
};

export const loadNamedTeamPlan = async (userId, teamId, name) => {
  try {
    const planId = `${userId}_${teamId}`;
    const ref = doc(db, 'teamPlans', planId, 'namedPlans', name);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data();
    return data.capSheet || data;
  } catch (error) {
    console.error('Error loading named plan:', error);
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
