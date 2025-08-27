// firebaseTeamPlanHelpers.js

import {
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  collection,
  getDocs,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { calculateCapHold } from '@/utils/architect/contractUtils';
import { attachDefaultPicks } from '@/utils/architect/defaultPicks';

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

// ===== ENHANCED VIRTUAL WORLD MANAGEMENT =====

/**
 * Create a virtual plan with inheritance from base plan
 * @param {string} userId - User ID
 * @param {string} teamId - Team ID
 * @param {string} planName - Name for the virtual plan
 * @param {string} basePlan - Base plan to inherit from ("real_world" or plan name)
 * @param {Object} metadata - Additional metadata for the plan
 * @returns {Promise<boolean>} Success status
 */
export const createVirtualPlan = async (userId, teamId, planName, basePlan = "real_world", metadata = {}) => {
  try {
    const planId = `${userId}_${teamId}`;
    
    // Get base plan data
    let basePlanData;
    if (basePlan === "real_world") {
      basePlanData = await loadTeamCapSheet(teamId);
    } else {
      basePlanData = await loadNamedTeamPlan(userId, teamId, basePlan);
    }
    
    if (!basePlanData) {
      throw new Error(`Base plan "${basePlan}" not found`);
    }
    
    // Create virtual plan with inheritance metadata
    const virtualPlanData = {
      name: planName,
      capSheet: { ...basePlanData },
      inheritedFrom: basePlan,
      parentPlan: basePlan,
      isVirtual: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      metadata: {
        description: metadata.description || '',
        tags: metadata.tags || [],
        scenario: metadata.scenario || 'custom',
        ...metadata
      },
      virtualSettings: {
        allowTrades: metadata.allowTrades !== false,
        allowSigning: metadata.allowSigning !== false,
        capFlexibility: metadata.capFlexibility || 'normal', // strict, normal, flexible
        timeHorizon: metadata.timeHorizon || 'current_season' // current_season, multi_year, dynasty
      }
    };
    
    const ref = doc(db, 'teamPlans', planId, 'virtualPlans', planName);
    await setDoc(ref, virtualPlanData);
    
    console.log(`Created virtual plan "${planName}" for ${userId} – ${teamId}, inheriting from "${basePlan}"`);
    return true;
    
  } catch (error) {
    console.error('Error creating virtual plan:', error);
    return false;
  }
};

/**
 * Get list of virtual plans for a user and team
 * @param {string} userId - User ID
 * @param {string} teamId - Team ID
 * @returns {Promise<Array>} Array of virtual plans
 */
export const listVirtualPlans = async (userId, teamId) => {
  try {
    const planId = `${userId}_${teamId}`;
    const plansRef = collection(db, 'teamPlans', planId, 'virtualPlans');
    const snap = await getDocs(plansRef);
    
    const plans = snap.docs.map((d) => ({ 
      id: d.id, 
      ...d.data(),
      // Convert Firestore timestamps to dates
      createdAt: d.data().createdAt?.toDate?.() || d.data().createdAt,
      updatedAt: d.data().updatedAt?.toDate?.() || d.data().updatedAt
    }));
    
    // Sort by creation date, most recent first
    plans.sort((a, b) => {
      const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
      const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
      return dateB - dateA;
    });
    
    return plans;
    
  } catch (error) {
    console.error('Error listing virtual plans:', error);
    return [];
  }
};

/**
 * Load a virtual plan
 * @param {string} userId - User ID
 * @param {string} teamId - Team ID
 * @param {string} planName - Virtual plan name
 * @returns {Promise<Object|null>} Virtual plan data or null
 */
export const loadVirtualPlan = async (userId, teamId, planName) => {
  try {
    const planId = `${userId}_${teamId}`;
    const ref = doc(db, 'teamPlans', planId, 'virtualPlans', planName);
    const snap = await getDoc(ref);
    
    if (!snap.exists()) return null;
    
    const data = snap.data();
    return {
      ...data,
      // Convert Firestore timestamps to dates
      createdAt: data.createdAt?.toDate?.() || data.createdAt,
      updatedAt: data.updatedAt?.toDate?.() || data.updatedAt
    };
    
  } catch (error) {
    console.error('Error loading virtual plan:', error);
    return null;
  }
};

/**
 * Update a virtual plan
 * @param {string} userId - User ID
 * @param {string} teamId - Team ID
 * @param {string} planName - Virtual plan name
 * @param {Object} updates - Updates to apply
 * @returns {Promise<boolean>} Success status
 */
export const updateVirtualPlan = async (userId, teamId, planName, updates) => {
  try {
    const planId = `${userId}_${teamId}`;
    const ref = doc(db, 'teamPlans', planId, 'virtualPlans', planName);
    
    const updateData = {
      ...updates,
      updatedAt: serverTimestamp()
    };
    
    await setDoc(ref, updateData, { merge: true });
    
    console.log(`Updated virtual plan "${planName}" for ${userId} – ${teamId}`);
    return true;
    
  } catch (error) {
    console.error('Error updating virtual plan:', error);
    return false;
  }
};

/**
 * Clone a virtual plan to create a new variation
 * @param {string} userId - User ID
 * @param {string} teamId - Team ID
 * @param {string} sourcePlanName - Source plan to clone
 * @param {string} newPlanName - New plan name
 * @param {Object} modifications - Modifications to apply to the clone
 * @returns {Promise<boolean>} Success status
 */
export const cloneVirtualPlan = async (userId, teamId, sourcePlanName, newPlanName, modifications = {}) => {
  try {
    const sourcePlan = await loadVirtualPlan(userId, teamId, sourcePlanName);
    if (!sourcePlan) {
      throw new Error(`Source plan "${sourcePlanName}" not found`);
    }
    
    const clonedPlan = {
      ...sourcePlan,
      name: newPlanName,
      inheritedFrom: sourcePlanName,
      parentPlan: sourcePlan.parentPlan || sourcePlanName,
      isClone: true,
      clonedFrom: sourcePlanName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      metadata: {
        ...sourcePlan.metadata,
        ...modifications.metadata,
        description: modifications.description || `Clone of ${sourcePlanName}`,
        originalPlan: sourcePlanName
      }
    };
    
    // Apply any modifications to the cap sheet
    if (modifications.capSheet) {
      clonedPlan.capSheet = {
        ...clonedPlan.capSheet,
        ...modifications.capSheet
      };
    }
    
    const planId = `${userId}_${teamId}`;
    const ref = doc(db, 'teamPlans', planId, 'virtualPlans', newPlanName);
    await setDoc(ref, clonedPlan);
    
    console.log(`Cloned virtual plan "${sourcePlanName}" to "${newPlanName}" for ${userId} – ${teamId}`);
    return true;
    
  } catch (error) {
    console.error('Error cloning virtual plan:', error);
    return false;
  }
};

/**
 * Delete a virtual plan
 * @param {string} userId - User ID
 * @param {string} teamId - Team ID
 * @param {string} planName - Virtual plan name to delete
 * @returns {Promise<boolean>} Success status
 */
export const deleteVirtualPlan = async (userId, teamId, planName) => {
  try {
    const planId = `${userId}_${teamId}`;
    const ref = doc(db, 'teamPlans', planId, 'virtualPlans', planName);
    await deleteDoc(ref);
    
    console.log(`Deleted virtual plan "${planName}" for ${userId} – ${teamId}`);
    return true;
    
  } catch (error) {
    console.error('Error deleting virtual plan:', error);
    return false;
  }
};

/**
 * Compare two virtual plans
 * @param {string} userId - User ID
 * @param {string} teamId - Team ID
 * @param {string} plan1Name - First plan name
 * @param {string} plan2Name - Second plan name
 * @returns {Promise<Object|null>} Comparison data or null
 */
export const compareVirtualPlans = async (userId, teamId, plan1Name, plan2Name) => {
  try {
    const [plan1, plan2] = await Promise.all([
      loadVirtualPlan(userId, teamId, plan1Name),
      loadVirtualPlan(userId, teamId, plan2Name)
    ]);
    
    if (!plan1 || !plan2) {
      throw new Error('One or both plans not found');
    }
    
    const comparison = {
      plan1: { name: plan1Name, ...plan1.metadata },
      plan2: { name: plan2Name, ...plan2.metadata },
      differences: {
        salary: {
          plan1_total: plan1.capSheet?.totalCommitted || 0,
          plan2_total: plan2.capSheet?.totalCommitted || 0,
          difference: (plan2.capSheet?.totalCommitted || 0) - (plan1.capSheet?.totalCommitted || 0)
        },
        players: {
          plan1_count: plan1.capSheet?.players?.length || 0,
          plan2_count: plan2.capSheet?.players?.length || 0,
          difference: (plan2.capSheet?.players?.length || 0) - (plan1.capSheet?.players?.length || 0)
        }
      },
      created_at: new Date().toISOString()
    };
    
    return comparison;
    
  } catch (error) {
    console.error('Error comparing virtual plans:', error);
    return null;
  }
};

/**
 * Get plan inheritance tree
 * @param {string} userId - User ID
 * @param {string} teamId - Team ID
 * @param {string} planName - Plan name to trace
 * @returns {Promise<Array>} Inheritance chain
 */
export const getPlanInheritanceTree = async (userId, teamId, planName) => {
  try {
    const tree = [];
    let currentPlan = planName;
    
    while (currentPlan && currentPlan !== "real_world") {
      const planData = await loadVirtualPlan(userId, teamId, currentPlan);
      if (!planData) break;
      
      tree.push({
        name: currentPlan,
        inheritedFrom: planData.inheritedFrom,
        createdAt: planData.createdAt,
        isVirtual: planData.isVirtual,
        isClone: planData.isClone
      });
      
      currentPlan = planData.inheritedFrom;
    }
    
    // Add real world as root
    if (currentPlan === "real_world") {
      tree.push({
        name: "real_world",
        inheritedFrom: null,
        createdAt: null,
        isVirtual: false,
        isClone: false,
        isRoot: true
      });
    }
    
    return tree;
    
  } catch (error) {
    console.error('Error getting plan inheritance tree:', error);
    return [];
  }
};
