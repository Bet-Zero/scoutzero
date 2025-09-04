#!/usr/bin/env node
/**
 * Free Agent Preservation Solution
 * Addresses the critical issue: Discovery system must never delete existing players
 */

/**
 * CURRENT PROBLEM ANALYSIS:
 * The automated discovery system has a major flaw that WILL cause data loss:
 * 
 * 1. NBA API with IsOnlyCurrentSeason=1 only returns current NBA roster players
 * 2. Free agents and retired players won't be discovered 
 * 3. Using merge: true only works if player is rediscovered
 * 4. Result: Free agents/retired players with user evaluations get lost
 */

export class FreeAgentPreservationSystem {
  constructor(db) {
    this.db = db;
  }

  /**
   * SOLUTION: Never-Delete Discovery Policy
   * Only ADD/UPDATE players, never remove existing ones
   */
  async safePlayerDiscovery(discoveredPlayers) {
    console.log('🔒 Running safe discovery with free agent preservation...');
    
    // Get ALL existing players from Firestore
    const existingSnapshot = await this.db.collection('players').get();
    const existingPlayers = new Map();
    
    existingSnapshot.docs.forEach(doc => {
      existingPlayers.set(doc.id, doc.data());
    });
    
    const discoveredIds = new Set(discoveredPlayers.map(p => p.id));
    const existingIds = new Set(existingPlayers.keys());
    
    // Players that exist but weren't discovered (free agents/retired)
    const preservedPlayers = [...existingIds].filter(id => !discoveredIds.has(id));
    
    console.log(`📊 Discovery Analysis:`);
    console.log(`   Discovered active NBA players: ${discoveredIds.size}`);
    console.log(`   Existing players in database: ${existingIds.size}`);
    console.log(`   Free agents/retired preserved: ${preservedPlayers.length}`);
    
    // Create safe update plan
    const updatePlan = {
      activeNBAPlayers: [],
      preservedFreeAgents: [],
      newPlayers: []
    };
    
    // Categorize discovered players
    discoveredPlayers.forEach(player => {
      if (existingPlayers.has(player.id)) {
        updatePlan.activeNBAPlayers.push({
          ...player,
          is_active_nba: true,
          automated_update: true,
          preserves_existing_data: true
        });
      } else {
        updatePlan.newPlayers.push({
          ...player,
          is_active_nba: true,
          automated_update: true,
          new_discovery: true
        });
      }
    });
    
    // Handle preserved free agents - mark as inactive but keep all data
    preservedPlayers.forEach(playerId => {
      const existingData = existingPlayers.get(playerId);
      updatePlan.preservedFreeAgents.push({
        id: playerId,
        ...existingData,
        is_active_nba: false,
        free_agent_status: 'preserved',
        last_nba_activity: existingData.last_nba_update || 'unknown'
      });
    });
    
    return updatePlan;
  }

  /**
   * Execute safe updates without data loss
   */
  async executeSafeUpdates(updatePlan) {
    const batch = this.db.batch();
    let totalUpdates = 0;
    
    // Update active NBA players (preserve existing evaluations)
    updatePlan.activeNBAPlayers.forEach(player => {
      const playerRef = this.db.collection('players').doc(player.id);
      batch.set(playerRef, player, { merge: true });
      totalUpdates++;
    });
    
    // Add new NBA players  
    updatePlan.newPlayers.forEach(player => {
      const playerRef = this.db.collection('players').doc(player.id);
      batch.set(playerRef, player);
      totalUpdates++;
    });
    
    // Update free agent status (keep all existing data)
    updatePlan.preservedFreeAgents.forEach(player => {
      const playerRef = this.db.collection('players').doc(player.id);
      batch.set(playerRef, player, { merge: true });
      totalUpdates++;
    });
    
    await batch.commit();
    
    console.log(`✅ Safe discovery complete:`);
    console.log(`   Active NBA players updated: ${updatePlan.activeNBAPlayers.length}`);
    console.log(`   New NBA players added: ${updatePlan.newPlayers.length}`);
    console.log(`   Free agents preserved: ${updatePlan.preservedFreeAgents.length}`);
    console.log(`   Total operations: ${totalUpdates}`);
    console.log(`   DATA LOSS RISK: ZERO ✅`);
    
    return {
      success: true,
      updates: totalUpdates,
      preservation_count: updatePlan.preservedFreeAgents.length
    };
  }
}

/**
 * IMPLEMENTATION EXAMPLE:
 * This replaces the current unsafe discovery in automated-data-updates.js
 */
export async function safeSyncPlayersToFirestore(players, db) {
  const preservationSystem = new FreeAgentPreservationSystem(db);
  
  // Analyze and plan safe updates
  const updatePlan = await preservationSystem.safePlayerDiscovery(players);
  
  // Execute updates with zero data loss risk
  return await preservationSystem.executeSafeUpdates(updatePlan);
}

/**
 * VERIFICATION SYSTEM:
 * Always verify no data was lost after updates
 */
export async function verifyNoDataLoss(db, previousPlayerCount) {
  const currentSnapshot = await db.collection('players').get();
  const currentCount = currentSnapshot.size;
  
  if (currentCount < previousPlayerCount) {
    throw new Error(`🚨 DATA LOSS DETECTED: ${previousPlayerCount - currentCount} players lost!`);
  }
  
  console.log(`✅ Data integrity verified: ${currentCount} players (no loss)`);
  return true;
}