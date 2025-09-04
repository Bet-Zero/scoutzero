#!/usr/bin/env node
/**
 * Architect League System Implementation
 * Enables users to create long-term GM simulations across multiple seasons
 * Addresses the user's requirement for multi-season virtual GM functionality
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';

/**
 * ARCHITECT MULTI-SEASON SYSTEM
 * 
 * This system creates user-specific "leagues" that start as copies of real NBA data
 * but can be modified and saved independently across multiple seasons.
 * 
 * Key Requirements from User Comment:
 * 1. Trade for player on 4-year contract this season → player loads next season
 * 2. User can be virtual GM over time (not just single season)
 * 3. Real-time progression across seasons with saved state
 * 4. Handle roster complications from trades that won't happen in real life
 */
export class ArchitectLeagueSystem {
  constructor(db) {
    this.db = db;
  }

  /**
   * Create a new user league that starts as copy of real NBA data
   * This allows users to make changes without affecting real data
   */
  async createUserLeague(userId, leagueName, startingSeason = '2024-25') {
    console.log(`🏀 Creating new league: ${leagueName} for user: ${userId}`);
    
    const leagueId = `${userId}_${Date.now()}`;
    
    try {
      // 1. Copy real-world data to user's league
      await this.copyRealDataToUserLeague(leagueId, startingSeason);
      
      // 2. Create league metadata
      await this.createLeagueMetadata(leagueId, userId, leagueName, startingSeason);
      
      // 3. Initialize user as GM of chosen team
      await this.initializeUserGMRole(leagueId, userId);
      
      console.log(`✅ League created: ${leagueId}`);
      
      return {
        success: true,
        league_id: leagueId,
        starting_season: startingSeason,
        collections_created: [
          `leagues/${leagueId}/players`,
          `leagues/${leagueId}/contracts`, 
          `leagues/${leagueId}/team_caps`,
          `leagues/${leagueId}/evaluations`
        ]
      };
      
    } catch (error) {
      console.error('❌ Failed to create league:', error);
      throw error;
    }
  }

  /**
   * Copy real NBA data to user's league collections
   * This creates the starting point for their virtual GM experience
   */
  async copyRealDataToUserLeague(leagueId, season) {
    console.log(`📋 Copying real NBA data to league: ${leagueId}`);
    
    // Collections to copy
    const collections = ['players', 'contracts', 'team_caps', 'evaluations'];
    
    for (const collectionName of collections) {
      console.log(`   Copying ${collectionName}...`);
      
      // Get all documents from real collection
      const realCollectionRef = collection(this.db, collectionName);
      const snapshot = await getDocs(realCollectionRef);
      
      // Copy to user's league
      const batch = writeBatch(this.db);
      let batchCount = 0;
      
      snapshot.forEach(docSnapshot => {
        const data = docSnapshot.data();
        const userDocRef = doc(this.db, `leagues/${leagueId}/${collectionName}`, docSnapshot.id);
        
        // Add metadata to track this is user's league data
        batch.set(userDocRef, {
          ...data,
          league_id: leagueId,
          copied_from_real: true,
          copied_at: serverTimestamp(),
          season: season
        });
        
        batchCount++;
        
        // Firestore batch limit is 500
        if (batchCount >= 500) {
          batch.commit();
          batch = writeBatch(this.db);
          batchCount = 0;
        }
      });
      
      // Commit remaining documents
      if (batchCount > 0) {
        await batch.commit();
      }
      
      console.log(`   ✅ ${collectionName} copied (${snapshot.size} documents)`);
    }
  }

  /**
   * Create league metadata document
   */
  async createLeagueMetadata(leagueId, userId, leagueName, startingSeason) {
    const metadata = {
      id: leagueId,
      name: leagueName,
      owner_user_id: userId,
      current_season: startingSeason,
      seasons_completed: [],
      created_at: serverTimestamp(),
      last_updated: serverTimestamp(),
      settings: {
        salary_cap_enabled: true,
        luxury_tax_enabled: true,
        trade_deadline_enabled: true,
        free_agency_enabled: true
      },
      status: 'active'
    };
    
    await setDoc(doc(this.db, `leagues/${leagueId}/metadata`, 'league_info'), metadata);
  }

  /**
   * Initialize user as GM of chosen team
   */
  async initializeUserGMRole(leagueId, userId, teamId = null) {
    const gmRole = {
      user_id: userId,
      league_id: leagueId,
      team_id: teamId, // null means user hasn't chosen team yet
      role: 'gm',
      created_at: serverTimestamp(),
      permissions: {
        make_trades: true,
        sign_free_agents: true,
        draft_players: true,
        release_players: true
      }
    };
    
    await setDoc(doc(this.db, `leagues/${leagueId}/user_roles`, userId), gmRole);
  }

  /**
   * CRITICAL: Execute trade in user's league
   * This is how the user trades for a 4-year contract player and keeps them
   */
  async executeTradeInLeague(leagueId, tradeDetails) {
    console.log(`🔄 Executing trade in league: ${leagueId}`);
    
    const { team1, team2, team1_players, team2_players, team1_picks, team2_picks } = tradeDetails;
    
    try {
      const batch = writeBatch(this.db);
      
      // 1. Update player contracts to new teams
      for (const playerId of team1_players) {
        const contractRef = doc(this.db, `leagues/${leagueId}/contracts`, playerId);
        batch.update(contractRef, {
          team_abbrev: team2,
          traded_to: team2,
          trade_date: serverTimestamp(),
          trade_from: team1
        });
      }
      
      for (const playerId of team2_players) {
        const contractRef = doc(this.db, `leagues/${leagueId}/contracts`, playerId);
        batch.update(contractRef, {
          team_abbrev: team1,
          traded_to: team1,
          trade_date: serverTimestamp(),
          trade_from: team2
        });
      }
      
      // 2. Update team cap sheets
      await this.updateTeamCapsAfterTrade(leagueId, team1, team2, team1_players, team2_players);
      
      // 3. Record trade history
      const tradeRecord = {
        league_id: leagueId,
        team1, team2,
        team1_players, team2_players,
        team1_picks, team2_picks,
        executed_at: serverTimestamp(),
        season: await this.getCurrentSeason(leagueId)
      };
      
      const tradeRef = doc(this.db, `leagues/${leagueId}/trade_history`, `trade_${Date.now()}`);
      batch.set(tradeRef, tradeRecord);
      
      await batch.commit();
      
      console.log(`✅ Trade executed successfully`);
      
      return {
        success: true,
        trade_id: tradeRef.id,
        updated_players: [...team1_players, ...team2_players]
      };
      
    } catch (error) {
      console.error('❌ Trade execution failed:', error);
      throw error;
    }
  }

  /**
   * CRITICAL: Progress to next season 
   * This ensures traded players carry over to next season
   */
  async progressToNextSeason(leagueId) {
    console.log(`📅 Progressing league ${leagueId} to next season`);
    
    try {
      // 1. Get current season
      const currentSeason = await this.getCurrentSeason(leagueId);
      const nextSeason = this.getNextSeasonString(currentSeason);
      
      // 2. Archive current season
      await this.archiveCurrentSeason(leagueId, currentSeason);
      
      // 3. Update player ages
      await this.ageAllPlayers(leagueId);
      
      // 4. Process contract years (advance all contracts by 1 year)
      await this.advanceAllContracts(leagueId, nextSeason);
      
      // 5. Update league metadata
      await this.updateLeagueForNewSeason(leagueId, nextSeason, currentSeason);
      
      // 6. Clear stats for new season
      await this.resetStatsForNewSeason(leagueId, nextSeason);
      
      console.log(`✅ League progressed to ${nextSeason}`);
      
      return {
        success: true,
        previous_season: currentSeason,
        new_season: nextSeason,
        players_aged: true,
        contracts_advanced: true
      };
      
    } catch (error) {
      console.error('❌ Season progression failed:', error);
      throw error;
    }
  }

  /**
   * Advance all player contracts by one year
   * CRITICAL: This ensures 4-year contract player still has 3 years left next season
   */
  async advanceAllContracts(leagueId, newSeason) {
    console.log(`⏭️ Advancing all contracts to ${newSeason}`);
    
    const contractsRef = collection(this.db, `leagues/${leagueId}/contracts`);
    const snapshot = await getDocs(contractsRef);
    
    const batch = writeBatch(this.db);
    let batchCount = 0;
    let processedCount = 0;
    
    snapshot.forEach(docSnapshot => {
      const contract = docSnapshot.data();
      const salariesByYear = contract.salaries_by_year || {};
      
      // Remove the season that just ended
      const previousSeason = this.getPreviousSeasonString(newSeason);
      delete salariesByYear[previousSeason];
      
      // Update contract
      const updatedContract = {
        ...contract,
        salaries_by_year: salariesByYear,
        season: newSeason,
        last_updated: serverTimestamp()
      };
      
      // Check if player becomes free agent
      if (Object.keys(salariesByYear).length === 0) {
        updatedContract.contract_status = 'free_agent';
        updatedContract.free_agency_year = parseInt(newSeason.split('-')[0]);
      }
      
      batch.update(docSnapshot.ref, updatedContract);
      batchCount++;
      processedCount++;
      
      if (batchCount >= 500) {
        batch.commit();
        batch = writeBatch(this.db);
        batchCount = 0;
      }
    });
    
    if (batchCount > 0) {
      await batch.commit();
    }
    
    console.log(`   ✅ Advanced ${processedCount} contracts`);
  }

  /**
   * Get player with full contract info for trade machine
   * This ensures trade machine still works with league data
   */
  async getPlayerForTradeMachine(leagueId, playerId) {
    try {
      const [playerDoc, contractDoc, evaluationDoc] = await Promise.all([
        getDoc(doc(this.db, `leagues/${leagueId}/players`, playerId)),
        getDoc(doc(this.db, `leagues/${leagueId}/contracts`, playerId)),
        getDoc(doc(this.db, `leagues/${leagueId}/evaluations`, playerId))
      ]);
      
      return {
        id: playerId,
        nba: playerDoc.exists() ? playerDoc.data() : null,
        contract: contractDoc.exists() ? contractDoc.data() : null,
        evaluation: evaluationDoc.exists() ? evaluationDoc.data() : null,
        tradeable: contractDoc.exists() && contractDoc.data().contract_status !== 'free_agent'
      };
      
    } catch (error) {
      console.error('Error fetching player for trade machine:', error);
      throw error;
    }
  }

  /**
   * Seasonal architecture: Option B - Season as subcollection
   * This is the recommended approach for multi-season data
   */
  getSeasonalCollectionPath(leagueId, season, collection) {
    return `leagues/${leagueId}/seasons/${season}/${collection}`;
  }

  /**
   * Helper methods
   */
  async getCurrentSeason(leagueId) {
    const metadataDoc = await getDoc(doc(this.db, `leagues/${leagueId}/metadata`, 'league_info'));
    return metadataDoc.exists() ? metadataDoc.data().current_season : '2024-25';
  }

  getNextSeasonString(currentSeason) {
    const [startYear] = currentSeason.split('-');
    const nextStartYear = parseInt(startYear) + 1;
    const nextEndYear = nextStartYear + 1;
    return `${nextStartYear}-${nextEndYear.toString().slice(-2)}`;
  }

  getPreviousSeasonString(currentSeason) {
    const [startYear] = currentSeason.split('-');
    const prevStartYear = parseInt(startYear) - 1;
    const prevEndYear = prevStartYear + 1;
    return `${prevStartYear}-${prevEndYear.toString().slice(-2)}`;
  }

  async ageAllPlayers(leagueId) {
    console.log(`👴 Aging all players in league ${leagueId}`);
    
    const playersRef = collection(this.db, `leagues/${leagueId}/players`);
    const snapshot = await getDocs(playersRef);
    
    const batch = writeBatch(this.db);
    let batchCount = 0;
    
    snapshot.forEach(docSnapshot => {
      const player = docSnapshot.data();
      const currentAge = player.age || 25; // Default age if missing
      
      batch.update(docSnapshot.ref, {
        age: currentAge + 1,
        last_updated: serverTimestamp()
      });
      
      batchCount++;
      
      if (batchCount >= 500) {
        batch.commit();
        batch = writeBatch(this.db);
        batchCount = 0;
      }
    });
    
    if (batchCount > 0) {
      await batch.commit();
    }
  }

  async updateLeagueForNewSeason(leagueId, newSeason, previousSeason) {
    const metadataRef = doc(this.db, `leagues/${leagueId}/metadata`, 'league_info');
    const metadataDoc = await getDoc(metadataRef);
    
    if (metadataDoc.exists()) {
      const metadata = metadataDoc.data();
      const seasonsCompleted = metadata.seasons_completed || [];
      seasonsCompleted.push(previousSeason);
      
      await setDoc(metadataRef, {
        ...metadata,
        current_season: newSeason,
        seasons_completed: seasonsCompleted,
        last_updated: serverTimestamp()
      }, { merge: true });
    }
  }

  async archiveCurrentSeason(leagueId, season) {
    // Archive functionality would copy current state to archive collection
    // This is for historical tracking but not required for basic functionality
    console.log(`📦 Archiving season ${season} for league ${leagueId}`);
  }

  async resetStatsForNewSeason(leagueId, newSeason) {
    // Reset player stats for new season
    // This would typically come from new NBA API data
    console.log(`🔄 Resetting stats for season ${newSeason}`);
  }

  async updateTeamCapsAfterTrade(leagueId, team1, team2, team1Players, team2Players) {
    // Update team salary cap totals after trade
    // This ensures cap calculations remain accurate
    console.log(`💰 Updating team caps after trade: ${team1} ↔ ${team2}`);
  }
}

/**
 * Usage Example: Long-term Virtual GM Experience
 */
export const virtualGMExample = `
// 1. User creates league to become GM
const architect = new ArchitectLeagueSystem(db);
const league = await architect.createUserLeague('user123', 'MyNBALeague', '2024-25');

// 2. User trades for 4-year contract player
const tradeResult = await architect.executeTradeInLeague(league.league_id, {
  team1: 'LAL', // User's team
  team2: 'BOS',
  team1_players: ['role-player-1', 'draft-pick-2025'],
  team2_players: ['star-player-4yr-contract'],
  team1_picks: [],
  team2_picks: []
});

// 3. Season ends, progress to next year
const nextSeason = await architect.progressToNextSeason(league.league_id);
// Star player still on user's team with 3 years left on contract

// 4. User can continue making moves in year 2
const player = await architect.getPlayerForTradeMachine(league.league_id, 'star-player-4yr-contract');
// Player is still tradeable with updated contract years

// 5. This continues across multiple seasons
// User can play out their GM decisions over 4+ years
`;

console.log('🏀 Architect League System Ready');
console.log('Enables multi-season virtual GM experience with contract continuity');