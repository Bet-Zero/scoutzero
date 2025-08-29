// src/utils/gradeArchiving/gradeHistoryHelpers.js

import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  query,
  orderBy,
  where,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '@/firebaseConfig';

/**
 * Archive current player grades for historical tracking
 * @param {string} playerId - Player ID
 * @param {Object} gradeData - Current grade data to archive
 * @param {string|number} season - Season year (defaults to current year)
 * @param {string} reason - Reason for archiving (e.g., "season_end", "manual_save", "trade_evaluation")
 * @returns {Promise<boolean>} Success status
 */
export const archivePlayerGrades = async (playerId, gradeData, season = null, reason = "manual_save") => {
  try {
    const currentSeason = season || new Date().getFullYear();
    const timestamp = Date.now();
    
    const archiveData = {
      // Core grade data
      overall_grade: gradeData.overall_grade,
      roles: gradeData.roles || {},
      subRoles: gradeData.subRoles || {},
      traits: gradeData.traits || {},
      badges: gradeData.badges || [],
      blurbs: gradeData.blurbs || {},
      
      // Archive metadata
      season: currentSeason,
      timestamp,
      archived_date: new Date().toISOString(),
      reason,
      player_id: playerId,
      
      // Snapshot of key bio data at time of archiving
      bio_snapshot: {
        age: gradeData.bio?.age,
        team: gradeData.team,
        position: gradeData.bio?.position || gradeData.formattedPosition
      },
      
      // Performance context
      stats_snapshot: gradeData.system?.stats ? {
        PPG: gradeData.system.stats.PPG,
        RPG: gradeData.system.stats.RPG || gradeData.system.stats.TRB,
        APG: gradeData.system.stats.APG || gradeData.system.stats.AST,
        "FG%": gradeData.system.stats["FG%"],
        "3P%": gradeData.system.stats["3P%"]
      } : null
    };
    
    // Store in grade history subcollection with unique timestamp-based ID
    const archiveRef = doc(db, 'players', playerId, 'gradeHistory', `${currentSeason}_${timestamp}`);
    await setDoc(archiveRef, archiveData);
    
    console.log(`📚 Archived grades for ${playerId} (Season ${currentSeason}, reason: ${reason})`);
    return true;
    
  } catch (error) {
    console.error(`❌ Error archiving grades for ${playerId}:`, error);
    return false;
  }
};

/**
 * Get grade history for a player
 * @param {string} playerId - Player ID
 * @param {string|number} season - Optional season filter
 * @returns {Promise<Array>} Array of archived grades
 */
export const getPlayerGradeHistory = async (playerId, season = null) => {
  try {
    const historyRef = collection(db, 'players', playerId, 'gradeHistory');
    
    let q;
    if (season) {
      q = query(
        historyRef,
        where('season', '==', season),
        orderBy('timestamp', 'desc')
      );
    } else {
      q = query(historyRef, orderBy('timestamp', 'desc'));
    }
    
    const snapshot = await getDocs(q);
    const history = [];
    
    snapshot.forEach(doc => {
      history.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`📖 Retrieved ${history.length} grade history entries for ${playerId}`);
    return history;
    
  } catch (error) {
    console.error(`❌ Error retrieving grade history for ${playerId}:`, error);
    return [];
  }
};

/**
 * Compare grades between two time periods
 * @param {string} playerId - Player ID
 * @param {string} fromArchiveId - Starting archive ID
 * @param {string} toArchiveId - Ending archive ID (or "current" for latest)
 * @returns {Promise<Object>} Comparison object showing changes
 */
export const compareGrades = async (playerId, fromArchiveId, toArchiveId = "current") => {
  try {
    let fromGrades, toGrades;
    
    // Get "from" grades
    if (fromArchiveId === "current") {
      const playerDoc = await getDoc(doc(db, 'players', playerId));
      fromGrades = playerDoc.exists() ? playerDoc.data() : null;
    } else {
      const fromDoc = await getDoc(doc(db, 'players', playerId, 'gradeHistory', fromArchiveId));
      fromGrades = fromDoc.exists() ? fromDoc.data() : null;
    }
    
    // Get "to" grades
    if (toArchiveId === "current") {
      const playerDoc = await getDoc(doc(db, 'players', playerId));
      toGrades = playerDoc.exists() ? playerDoc.data() : null;
    } else {
      const toDoc = await getDoc(doc(db, 'players', playerId, 'gradeHistory', toArchiveId));
      toGrades = toDoc.exists() ? toDoc.data() : null;
    }
    
    if (!fromGrades || !toGrades) {
      throw new Error('Could not find one or both grade sets for comparison');
    }
    
    const comparison = {
      player_id: playerId,
      from_date: fromGrades.archived_date || fromGrades.last_updated,
      to_date: toGrades.archived_date || toGrades.last_updated,
      overall_grade: {
        from: fromGrades.overall_grade,
        to: toGrades.overall_grade,
        changed: fromGrades.overall_grade !== toGrades.overall_grade
      },
      changes: {
        traits: compareTraits(fromGrades.traits || {}, toGrades.traits || {}),
        roles: compareRoles(fromGrades.roles || {}, toGrades.roles || {}),
        badges: compareBadges(fromGrades.badges || [], toGrades.badges || [])
      }
    };
    
    return comparison;
    
  } catch (error) {
    console.error(`❌ Error comparing grades for ${playerId}:`, error);
    return null;
  }
};

/**
 * Batch archive grades for multiple players (useful for season end)
 * @param {Array} playerIds - Array of player IDs
 * @param {string|number} season - Season year
 * @param {string} reason - Reason for archiving
 * @returns {Promise<Object>} Results summary
 */
export const batchArchiveGrades = async (playerIds, season, reason = "batch_archive") => {
  const results = {
    success: 0,
    failed: 0,
    errors: []
  };
  
  console.log(`🚀 Starting batch grade archive for ${playerIds.length} players...`);
  
  for (const playerId of playerIds) {
    try {
      // Get current player data
      const playerDoc = await getDoc(doc(db, 'players', playerId));
      if (!playerDoc.exists()) {
        results.failed++;
        results.errors.push(`Player ${playerId} not found`);
        continue;
      }
      
      const playerData = playerDoc.data();
      const success = await archivePlayerGrades(playerId, playerData, season, reason);
      
      if (success) {
        results.success++;
      } else {
        results.failed++;
        results.errors.push(`Failed to archive grades for ${playerId}`);
      }
      
      // Small delay to avoid overwhelming Firestore
      await new Promise(resolve => setTimeout(resolve, 50));
      
    } catch (error) {
      results.failed++;
      results.errors.push(`Error processing ${playerId}: ${error.message}`);
    }
  }
  
  console.log(`📊 Batch archive complete: ${results.success} success, ${results.failed} failed`);
  return results;
};

// Helper functions for comparing different types of grade data
function compareTraits(fromTraits, toTraits) {
  const changes = {};
  const allTraits = new Set([...Object.keys(fromTraits), ...Object.keys(toTraits)]);
  
  for (const trait of allTraits) {
    const fromValue = fromTraits[trait];
    const toValue = toTraits[trait];
    
    if (fromValue !== toValue) {
      changes[trait] = { from: fromValue, to: toValue };
    }
  }
  
  return changes;
}

function compareRoles(fromRoles, toRoles) {
  const changes = {};
  const allRoles = new Set([...Object.keys(fromRoles), ...Object.keys(toRoles)]);
  
  for (const role of allRoles) {
    const fromValue = fromRoles[role];
    const toValue = toRoles[role];
    
    if (fromValue !== toValue) {
      changes[role] = { from: fromValue, to: toValue };
    }
  }
  
  return changes;
}

function compareBadges(fromBadges, toBadges) {
  const added = toBadges.filter(badge => !fromBadges.includes(badge));
  const removed = fromBadges.filter(badge => !toBadges.includes(badge));
  
  return {
    added,
    removed,
    hasChanges: added.length > 0 || removed.length > 0
  };
}

/**
 * Auto-archive grades when significant changes are detected
 * @param {string} playerId - Player ID
 * @param {Object} oldData - Previous player data
 * @param {Object} newData - Updated player data
 * @returns {Promise<boolean>} Whether auto-archive was triggered
 */
export const autoArchiveOnChange = async (playerId, oldData, newData) => {
  // Check if there are significant changes worth archiving
  const overallGradeChanged = oldData.overall_grade !== newData.overall_grade;
  const rolesChanged = JSON.stringify(oldData.roles || {}) !== JSON.stringify(newData.roles || {});
  const traitsChanged = JSON.stringify(oldData.traits || {}) !== JSON.stringify(newData.traits || {});
  const badgesChanged = JSON.stringify(oldData.badges || []) !== JSON.stringify(newData.badges || []);
  
  if (overallGradeChanged || rolesChanged || traitsChanged || badgesChanged) {
    console.log(`🤖 Auto-archiving grades for ${playerId} due to significant changes`);
    return await archivePlayerGrades(playerId, oldData, null, "auto_save_on_change");
  }
  
  return false;
};