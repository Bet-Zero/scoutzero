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
import {
  baseTeamRef,
  baseTeamsCol,
  basePlayerRef,
} from '@/data/firestorePaths';
import {
  TeamListFull,
  TeamSlugToCode,
  TeamCodeMap,
} from '@/constants/teamList';

// ===== Utility to Prepare Cap Sheet =====

// In the new model, cap holds are managed in the `capHolds` array in state.
// We no longer need to calculate them on every save from player attributes.
// Logic for creating them happens on "Decline Option" or similar events.
export const prepareCapSheet = (capSheet, capProjections /* , year = 2025 */) => {
  // Just pass through, or maybe sort the capHolds if needed?
  return {
    ...capSheet,
    capHolds: capSheet.capHolds || [],
    updatedAt: new Date().toISOString(),
  };
};

// ===== Load Real-World Base Team Data (read-only) =====

const resolveTeamCode = (teamId) => {
  if (!teamId) return null;
  if (TeamSlugToCode[teamId]) return TeamSlugToCode[teamId];
  if (TeamCodeMap[teamId]) return teamId;
  return teamId.toUpperCase();
};

// Simplified player entry builder - returns new schema format directly
const buildPlayerEntry = (playerId, playerData) => {
  if (!playerData) {
    return {
      id: playerId,
      player_id: playerId,
      name: playerId,
      displayName: playerId,
      contract: null,
      bio: {},
      original: null,
    };
  }

  // Return player in new schema format - no conversion needed
  return {
    id: playerData.playerId || playerId,
    player_id: playerData.playerId || playerId,
    name: playerData.displayName || playerId,
    displayName: playerData.displayName || playerId,
    position: playerData.bio?.position || '',
    age: playerData.bio?.age || null,
    teamCode: playerData.teamCode || null,
    teamName: playerData.teamName || null,
    contract: playerData.contract || null,
    futureContract: playerData.futureContract || null,
    bio: {
      ...(playerData.bio || {}),
      playerId: playerData.playerId || playerId,
      displayName: playerData.displayName || playerId,
    },
    representation: playerData.representation || null,
    original: playerData,
  };
};

export const hydrateBaseTeam = async (teamCode, baseDoc) => {
  const players = [];
  for (const playerId of baseDoc.roster || []) {
    try {
      const playerSnap = await getDoc(basePlayerRef(playerId));
      if (!playerSnap.exists()) {
        players.push(buildPlayerEntry(playerId, null));
        continue;
      }

      const playerData = playerSnap.data();
      // Return player in new schema format - no conversion needed
      const playerEntry = buildPlayerEntry(playerId, playerData);
      players.push(playerEntry);
    } catch (err) {
      console.warn(`Failed to hydrate player ${playerId}`, err);
      players.push(buildPlayerEntry(playerId, null));
    }
  }

  // Build activeContracts from new schema format
  const activeContracts = players
    .filter((p) => p.contract?.salariesByYear?.length > 0)
    .map((p) => {
      const contract = p.contract;
      return {
        name: p.name,
        player_id: p.player_id,
        contract: contract,
        years: contract?.yearsRemaining || 0,
        type: contract?.contractType || 'Contract',
        signAndTrade: false,
        guaranteed: true,
        isMinimum: false,
        yearsOfService:
          p.bio?.experience || contract?.birdRights?.yearsOfService || null,
      };
    });

  const exceptionData = baseDoc.exceptions || {};
  const tradeExceptions =
    exceptionData.tpe?.map((tpe) => ({
      id: tpe.id,
      name: tpe.label || tpe.id,
      amount: tpe.remainingAmount ?? tpe.totalAmount ?? 0,
      used: tpe.usedAmount ?? 0,
      createdFrom: tpe.createdFrom ?? null,
      expires: tpe.expiresOn ?? tpe.expires ?? null,
    })) || [];

  const toSimpleException = (value) =>
    value
      ? {
          amount: value.totalAmount ?? 0,
          used: value.usedAmount ?? 0,
          remaining: value.remainingAmount ?? value.totalAmount ?? 0,
        }
      : null;

  const teamMeta = TeamCodeMap[teamCode] || null;

  // Return team in new schema format - no conversion needed
  return {
    id: teamMeta?.id || teamCode.toLowerCase(),
    teamCode,
    teamName: baseDoc.teamName,
    season: baseDoc.season,
    abbreviation: baseDoc.abbreviation || teamCode,
    players,
    roster: players,
    activeContracts,
    capHolds: baseDoc.capHolds || [],
    draftPicks: baseDoc.draftPicks || [],
    exceptions: exceptionData,
    mle: toSimpleException(exceptionData.mle),
    tpMle: toSimpleException(exceptionData.taxpayerMle || exceptionData.tpMle),
    bae: toSimpleException(exceptionData.bae),
    tradeExceptions,
    hardCapped: baseDoc.totals?.hardCapLevel
      ? baseDoc.totals.hardCapLevel !== 'none'
      : false,
    deadCap: baseDoc.deadCap || [],
    baseline: baseDoc,
    totals: baseDoc.totals || {},
  };
};

export const loadTeamCapSheet = async (teamId) => {
  try {
    const teamCode = resolveTeamCode(teamId);
    if (!teamCode) {
      console.warn('Unable to resolve team code for:', teamId);
      return null;
    }
    const docSnap = await getDoc(baseTeamRef(teamCode));
    if (!docSnap.exists()) {
      console.warn('No base team data found for:', teamCode);
      return null;
    }
    const baseDoc = docSnap.data();
    return hydrateBaseTeam(teamCode, baseDoc);
  } catch (error) {
    console.error('Error loading base team:', error);
    return null;
  }
};

export const getAllTeams = async () => {
  try {
    const snapshot = await getDocs(baseTeamsCol());
    if (!snapshot.empty) {
      return snapshot.docs.map((docSnap) => {
        const code = docSnap.id;
        const meta = TeamCodeMap[code];
        return {
          id: meta?.id || code.toLowerCase(),
          code,
          name: meta?.teamName || docSnap.data()?.teamName || code,
          conference: meta?.conference || null,
        };
      });
    }
  } catch (error) {
    console.error('Error getting base teams:', error);
  }
  // Fallback to static list if architect data unavailable
  return TeamListFull.map((team) => ({
    id: team.id,
    code: team.code,
    name: team.teamName,
    conference: team.conference,
  }));
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
