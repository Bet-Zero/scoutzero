// src/utils/seasonManagement/seasonHelpers.js

import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  query,
  orderBy,
  where,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/firebaseConfig';

/**
 * Current season utilities
 */
export const getCurrentSeason = () => {
  const now = new Date();
  const currentMonth = now.getMonth(); // 0 = January, 11 = December
  
  // NBA season runs roughly October (month 9) to June (month 5)
  // If we're in July-September, we're in the offseason preparing for next season
  if (currentMonth >= 6 && currentMonth <= 8) {
    // July-September: Next season
    return now.getFullYear() + 1;
  } else if (currentMonth >= 9) {
    // October-December: Current season year
    return now.getFullYear() + 1;
  } else {
    // January-June: Current season year
    return now.getFullYear();
  }
};

export const getSeasonDisplayName = (season) => {
  return `${season - 1}-${season.toString().slice(-2)}`;
};

export const parseSeasonFromDisplay = (displayName) => {
  // Convert "2024-25" back to 2025
  const parts = displayName.split('-');
  if (parts.length === 2) {
    return parseInt(parts[0]) + 1;
  }
  return parseInt(displayName);
};

/**
 * Season root management - organize all data by season
 */

/**
 * Initialize a new season in Firestore
 * @param {number} season - Season year (e.g., 2025 for 2024-25 season)
 * @param {Object} seasonInfo - Season metadata
 * @returns {Promise<boolean>} Success status
 */
export const initializeSeason = async (season, seasonInfo = {}) => {
  try {
    const seasonData = {
      season,
      display_name: getSeasonDisplayName(season),
      created_date: new Date().toISOString(),
      created_timestamp: Date.now(),
      status: 'active', // active, completed, archived
      
      // Season-specific information
      start_date: seasonInfo.start_date || null,
      end_date: seasonInfo.end_date || null,
      playoff_start: seasonInfo.playoff_start || null,
      trade_deadline: seasonInfo.trade_deadline || null,
      
      // Data tracking
      data_snapshots: {
        players_count: 0,
        teams_count: 30,
        last_updated: Date.now()
      },
      
      ...seasonInfo
    };
    
    // Create season document
    await setDoc(doc(db, 'seasons', season.toString()), seasonData);
    
    // Create season-specific subcollections structure
    const batch = writeBatch(db);
    
    // Initialize season metadata
    const metaRef = doc(db, 'seasons', season.toString(), 'metadata', 'info');
    batch.set(metaRef, {
      initialized_date: new Date().toISOString(),
      version: '1.0',
      collections_created: []
    });
    
    await batch.commit();
    
    console.log(`🏀 Initialized season ${getSeasonDisplayName(season)} (${season})`);
    return true;
    
  } catch (error) {
    console.error(`❌ Error initializing season ${season}:`, error);
    return false;
  }
};

/**
 * Get all available seasons
 * @returns {Promise<Array>} Array of season documents
 */
export const getAllSeasons = async () => {
  try {
    const seasonsSnapshot = await getDocs(collection(db, 'seasons'));
    const seasons = [];
    
    seasonsSnapshot.forEach(doc => {
      seasons.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Sort by season year descending (most recent first)
    seasons.sort((a, b) => b.season - a.season);
    
    console.log(`📅 Retrieved ${seasons.length} seasons`);
    return seasons;
    
  } catch (error) {
    console.error('❌ Error retrieving seasons:', error);
    return [];
  }
};

/**
 * Get specific season data
 * @param {number} season - Season year
 * @returns {Promise<Object|null>} Season data or null
 */
export const getSeasonData = async (season) => {
  try {
    const seasonDoc = await getDoc(doc(db, 'seasons', season.toString()));
    
    if (seasonDoc.exists()) {
      return {
        id: seasonDoc.id,
        ...seasonDoc.data()
      };
    }
    
    return null;
    
  } catch (error) {
    console.error(`❌ Error retrieving season ${season}:`, error);
    return null;
  }
};

/**
 * Archive end-of-season data
 * @param {number} season - Season to archive
 * @param {Object} options - Archive options
 * @returns {Promise<Object>} Archive results
 */
export const archiveSeasonData = async (season, options = {}) => {
  const {
    includePlayerGrades = true,
    includeTeamData = true,
    includeUserLists = false,
    reason = "end_of_season"
  } = options;
  
  const results = {
    players: { success: 0, failed: 0 },
    teams: { success: 0, failed: 0 },
    lists: { success: 0, failed: 0 },
    errors: []
  };
  
  try {
    console.log(`📦 Starting season archive for ${getSeasonDisplayName(season)}...`);
    
    // Archive player grades if requested
    if (includePlayerGrades) {
      console.log('📚 Archiving player grades...');
      
      const playersSnapshot = await getDocs(collection(db, 'players'));
      const batch = writeBatch(db);
      let batchCount = 0;
      
      for (const playerDoc of playersSnapshot.docs) {
        try {
          const playerData = playerDoc.data();
          const playerId = playerDoc.id;
          
          // Create archived grade data
          const archiveData = {
            player_id: playerId,
            season,
            overall_grade: playerData.overall_grade,
            roles: playerData.roles || {},
            traits: playerData.traits || {},
            badges: playerData.badges || [],
            team: playerData.team,
            archived_date: new Date().toISOString(),
            reason
          };
          
          // Store in season archive
          const archiveRef = doc(db, 'seasons', season.toString(), 'playerGrades', playerId);
          batch.set(archiveRef, archiveData);
          batchCount++;
          
          // Commit batch every 450 operations (Firestore limit is 500)
          if (batchCount >= 450) {
            await batch.commit();
            const newBatch = writeBatch(db);
            Object.assign(batch, newBatch);
            batchCount = 0;
          }
          
          results.players.success++;
          
        } catch (error) {
          results.players.failed++;
          results.errors.push(`Player ${playerDoc.id}: ${error.message}`);
        }
      }
      
      // Commit remaining batch
      if (batchCount > 0) {
        await batch.commit();
      }
    }
    
    // Archive team data if requested
    if (includeTeamData) {
      console.log('🏀 Archiving team data...');
      
      const teamsSnapshot = await getDocs(collection(db, 'teams'));
      
      for (const teamDoc of teamsSnapshot.docs) {
        try {
          const teamData = teamDoc.data();
          const teamId = teamDoc.id;
          
          const archiveData = {
            team_id: teamId,
            season,
            capSheet: teamData.capSheet,
            players: teamData.players,
            totalSalaryByYear: teamData.totalSalaryByYear,
            archived_date: new Date().toISOString(),
            reason
          };
          
          await setDoc(doc(db, 'seasons', season.toString(), 'teamData', teamId), archiveData);
          results.teams.success++;
          
        } catch (error) {
          results.teams.failed++;
          results.errors.push(`Team ${teamDoc.id}: ${error.message}`);
        }
      }
    }
    
    // Update season status
    await setDoc(doc(db, 'seasons', season.toString()), {
      status: 'archived',
      archived_date: new Date().toISOString(),
      archive_results: results
    }, { merge: true });
    
    console.log(`✅ Season ${getSeasonDisplayName(season)} archived successfully`);
    console.log(`📊 Results: ${results.players.success} players, ${results.teams.success} teams`);
    
    return results;
    
  } catch (error) {
    console.error(`❌ Error archiving season ${season}:`, error);
    results.errors.push(`Archive failed: ${error.message}`);
    return results;
  }
};

/**
 * Restore archived season data for viewing
 * @param {number} season - Season to restore data from
 * @param {string} dataType - Type of data to restore ('players', 'teams', 'all')
 * @returns {Promise<Object>} Restored data
 */
export const getArchivedSeasonData = async (season, dataType = 'all') => {
  try {
    const seasonData = await getSeasonData(season);
    if (!seasonData) {
      throw new Error(`Season ${season} not found`);
    }
    
    const result = {
      season,
      seasonInfo: seasonData,
      data: {}
    };
    
    if (dataType === 'players' || dataType === 'all') {
      console.log(`📚 Loading archived player grades for ${getSeasonDisplayName(season)}...`);
      
      const playerGradesSnapshot = await getDocs(
        collection(db, 'seasons', season.toString(), 'playerGrades')
      );
      
      const playerGrades = {};
      playerGradesSnapshot.forEach(doc => {
        playerGrades[doc.id] = doc.data();
      });
      
      result.data.playerGrades = playerGrades;
      console.log(`📖 Loaded ${Object.keys(playerGrades).length} player grade archives`);
    }
    
    if (dataType === 'teams' || dataType === 'all') {
      console.log(`🏀 Loading archived team data for ${getSeasonDisplayName(season)}...`);
      
      const teamDataSnapshot = await getDocs(
        collection(db, 'seasons', season.toString(), 'teamData')
      );
      
      const teamData = {};
      teamDataSnapshot.forEach(doc => {
        teamData[doc.id] = doc.data();
      });
      
      result.data.teamData = teamData;
      console.log(`📖 Loaded ${Object.keys(teamData).length} team data archives`);
    }
    
    return result;
    
  } catch (error) {
    console.error(`❌ Error loading archived season data for ${season}:`, error);
    return null;
  }
};

/**
 * Season comparison utilities
 */

/**
 * Compare player grades between two seasons
 * @param {string} playerId - Player ID
 * @param {number} fromSeason - Starting season
 * @param {number} toSeason - Ending season
 * @returns {Promise<Object>} Comparison data
 */
export const comparePlayerBetweenSeasons = async (playerId, fromSeason, toSeason) => {
  try {
    const fromData = await getDoc(doc(db, 'seasons', fromSeason.toString(), 'playerGrades', playerId));
    const toData = await getDoc(doc(db, 'seasons', toSeason.toString(), 'playerGrades', playerId));
    
    if (!fromData.exists() || !toData.exists()) {
      throw new Error('Player data not found in one or both seasons');
    }
    
    const fromGrades = fromData.data();
    const toGrades = toData.data();
    
    return {
      player_id: playerId,
      from_season: fromSeason,
      to_season: toSeason,
      from_season_display: getSeasonDisplayName(fromSeason),
      to_season_display: getSeasonDisplayName(toSeason),
      overall_grade: {
        from: fromGrades.overall_grade,
        to: toGrades.overall_grade,
        changed: fromGrades.overall_grade !== toGrades.overall_grade
      },
      team_change: {
        from: fromGrades.team,
        to: toGrades.team,
        changed: fromGrades.team !== toGrades.team
      },
      // Additional comparison logic can be added here
    };
    
  } catch (error) {
    console.error(`❌ Error comparing player ${playerId} between seasons:`, error);
    return null;
  }
};

/**
 * Update season status
 * @param {number} season - Season year
 * @param {string} status - New status ('active', 'completed', 'archived')
 * @param {Object} additionalData - Additional data to update
 * @returns {Promise<boolean>} Success status
 */
export const updateSeasonStatus = async (season, status, additionalData = {}) => {
  try {
    const updateData = {
      status,
      last_updated: new Date().toISOString(),
      ...additionalData
    };
    
    await setDoc(doc(db, 'seasons', season.toString()), updateData, { merge: true });
    
    console.log(`📅 Updated season ${getSeasonDisplayName(season)} status to: ${status}`);
    return true;
    
  } catch (error) {
    console.error(`❌ Error updating season ${season} status:`, error);
    return false;
  }
};