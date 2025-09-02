// firebaseTeamPlanHelpers.js

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
import { attachDefaultPicks } from '@/utils/architect/basicArchitectUtils';

// ===== Utility to Prepare Cap Sheet =====

export const prepareCapSheet = (capSheet, capProjections, year = 2025) => {
  const updatedPlayers = capSheet.players.map((player) => {
    const capHold = calculateCapHold(player, capProjections, year);
    return { ...player, cap_hold: capHold };
  });

  return {
    ...capSheet,
    players: updatedPlayers,
  };
};

// ===== Load Real-World Base Team Data (read-only) =====

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

// ===== GM Tools: User Plan System =====

export const saveUserTeamPlan = async (
  userId,
  teamId,
  capSheet,
  capProjections,
  year = 2025
) => {
  try {
    const updatedCapSheet = prepareCapSheet(capSheet, capProjections, year);

    const planId = `${userId}_${teamId}`;
    const planRef = doc(db, 'teamPlans', planId);
    await setDoc(planRef, {
      capSheet: updatedCapSheet,
      updatedAt: serverTimestamp(),
    });
    console.log(`Saved active plan for ${userId} – ${teamId}`);
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

// ===== GM Tools: Named Saved Plans =====

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

export const saveNamedTeamPlan = async (
  userId,
  teamId,
  name,
  capSheet,
  capProjections,
  year = 2025
) => {
  try {
    const updatedCapSheet = prepareCapSheet(capSheet, capProjections, year);

    const planId = `${userId}_${teamId}`;
    const ref = doc(db, 'teamPlans', planId, 'namedPlans', name);
    await setDoc(ref, {
      name,
      capSheet: updatedCapSheet,
      updatedAt: serverTimestamp(),
    });
    console.log(`Saved named plan ${name} for ${userId} – ${teamId}`);
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

// ===== Free Agent Pool Management =====

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
