/**
 * Automated Data Pipeline Orchestrator
 * Replaces manual Python pipeline with self-executing Node.js automation
 */

import { nbaApi } from './nbaApi.js';
import { db } from '@/firebaseConfig';
import { collection, doc, setDoc, updateDoc, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';

/**
 * Data Pipeline Orchestrator
 * Manages automated data collection, processing, and synchronization
 */
export class DataOrchestrator {
  constructor() {
    this.isRunning = false;
    this.lastRun = null;
    this.stats = {
      totalRuns: 0,
      successfulRuns: 0,
      errors: [],
      lastUpdate: null
    };
  }

  /**
   * Main orchestration method - replaces manual Python script execution
   */
  async runFullPipeline(options = {}) {
    if (this.isRunning) {
      console.log('⏳ Pipeline already running, skipping...');
      return { status: 'skipped', reason: 'already_running' };
    }

    console.log('🚀 Starting automated data pipeline...');
    this.isRunning = true;
    this.stats.totalRuns++;
    
    const pipeline = {
      startTime: new Date(),
      steps: [],
      errors: [],
      results: {}
    };

    try {
      // Step 1: Discover and merge players (replaces 01_discover_and_merge_players.py)
      pipeline.steps.push(await this.executeStep('discoverPlayers', async () => {
        console.log('📋 Step 1: Player Discovery...');
        const players = await nbaApi.discoverAllPlayers();
        await this.syncPlayersToFirestore(players);
        return { playersDiscovered: players.length };
      }));

      // Step 2: Update team rosters (enhances team data)
      pipeline.steps.push(await this.executeStep('updateRosters', async () => {
        console.log('👥 Step 2: Team Roster Updates...');
        const rosters = await nbaApi.getTeamRosters();
        await this.syncRostersToFirestore(rosters);
        return { teamsUpdated: Object.keys(rosters).length };
      }));

      // Step 3: Update player contracts (replaces 03_update_contracts.py)
      pipeline.steps.push(await this.executeStep('updateContracts', async () => {
        console.log('💰 Step 3: Contract Updates...');
        const contracts = await nbaApi.getPlayerContracts();
        await this.syncContractsToFirestore(contracts);
        return { contractsUpdated: 0 }; // Will implement real logic
      }));

      // Step 4: Update player stats (replaces 04_update_stats.py)
      pipeline.steps.push(await this.executeStep('updateStats', async () => {
        console.log('📊 Step 4: Player Stats Updates...');
        return await this.updatePlayerStatsInBatches();
      }));

      // Step 5: Validate and cache data
      pipeline.steps.push(await this.executeStep('validateData', async () => {
        console.log('✅ Step 5: Data Validation...');
        return await this.validateDataIntegrity();
      }));

      // Record successful pipeline run
      pipeline.endTime = new Date();
      pipeline.duration = pipeline.endTime - pipeline.startTime;
      pipeline.status = 'success';
      
      this.stats.successfulRuns++;
      this.stats.lastUpdate = new Date().toISOString();
      this.lastRun = pipeline;

      console.log('✅ Automated pipeline completed successfully');
      console.log(`⏱️ Duration: ${Math.round(pipeline.duration / 1000)}s`);
      
      // Store pipeline results in Firestore
      await this.storePipelineResults(pipeline);
      
      return pipeline;

    } catch (error) {
      console.error('❌ Pipeline failed:', error);
      pipeline.errors.push(error.message);
      pipeline.status = 'failed';
      pipeline.endTime = new Date();
      
      this.stats.errors.push({
        timestamp: new Date().toISOString(),
        error: error.message,
        step: pipeline.steps.length
      });

      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Execute a pipeline step with error handling
   */
  async executeStep(stepName, stepFunction) {
    const step = {
      name: stepName,
      startTime: new Date(),
      status: 'running'
    };

    try {
      console.log(`🔄 Executing step: ${stepName}`);
      step.result = await stepFunction();
      step.status = 'success';
      step.endTime = new Date();
      step.duration = step.endTime - step.startTime;
      
      console.log(`✅ Step completed: ${stepName} (${Math.round(step.duration / 1000)}s)`);
      return step;

    } catch (error) {
      step.status = 'failed';
      step.error = error.message;
      step.endTime = new Date();
      
      console.error(`❌ Step failed: ${stepName} - ${error.message}`);
      
      // Continue pipeline with warning for non-critical steps
      if (this.isNonCriticalStep(stepName)) {
        console.log(`⚠️ Non-critical step failed, continuing pipeline...`);
        return step;
      } else {
        throw error;
      }
    }
  }

  /**
   * Sync discovered players to Firestore
   */
  async syncPlayersToFirestore(players) {
    console.log(`💾 Syncing ${players.length} players to Firestore...`);
    
    const batch = writeBatch(db);
    let updateCount = 0;

    for (const player of players) {
      try {
        const playerRef = doc(db, 'players', player.id);
        
        // Merge with existing player data to preserve user evaluations
        const playerData = {
          ...player,
          automated_update: true,
          last_discovered: serverTimestamp(),
          source: 'nba_api_automated'
        };

        batch.set(playerRef, playerData, { merge: true });
        updateCount++;

        // Commit in batches of 500 (Firestore limit)
        if (updateCount % 500 === 0) {
          await batch.commit();
          console.log(`💾 Committed batch: ${updateCount} players`);
        }

      } catch (error) {
        console.warn(`⚠️ Failed to sync player ${player.id}:`, error.message);
      }
    }

    // Commit remaining players
    if (updateCount % 500 !== 0) {
      await batch.commit();
    }

    console.log(`✅ Synced ${updateCount} players to Firestore`);
    return updateCount;
  }

  /**
   * Sync team rosters to Firestore
   */
  async syncRostersToFirestore(rosters) {
    console.log(`👥 Syncing ${Object.keys(rosters).length} team rosters...`);
    
    const batch = writeBatch(db);
    let updateCount = 0;

    for (const [teamId, roster] of Object.entries(rosters)) {
      try {
        const teamRef = doc(db, 'teams', teamId);
        
        const teamData = {
          ...roster,
          automated_update: true,
          last_updated: serverTimestamp(),
          source: 'nba_api_automated'
        };

        batch.set(teamRef, teamData, { merge: true });
        updateCount++;

      } catch (error) {
        console.warn(`⚠️ Failed to sync team ${teamId}:`, error.message);
      }
    }

    await batch.commit();
    console.log(`✅ Synced ${updateCount} team rosters`);
    return updateCount;
  }

  /**
   * Sync contract data to Firestore
   */
  async syncContractsToFirestore(contracts) {
    console.log(`💰 Syncing contract data...`);
    
    if (!contracts || !contracts.contracts) {
      console.log('ℹ️ No contract data to sync');
      return 0;
    }

    // Implementation for contract syncing
    // This would process and store contract information
    
    return 0;
  }

  /**
   * Update player stats in efficient batches
   */
  async updatePlayerStatsInBatches() {
    console.log('📊 Updating player stats in batches...');
    
    // Get all players from Firestore
    const playersSnapshot = await getDocs(collection(db, 'players'));
    const players = playersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    console.log(`📋 Found ${players.length} players to update stats for`);
    
    let updated = 0;
    let errors = 0;
    const batchSize = 10; // Process 10 players at a time
    
    for (let i = 0; i < players.length; i += batchSize) {
      const batch = players.slice(i, i + batchSize);
      
      console.log(`📊 Processing stats batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(players.length / batchSize)}`);
      
      const batchPromises = batch.map(async (player) => {
        try {
          const stats = await nbaApi.getPlayerStats(player.id);
          if (stats) {
            const playerRef = doc(db, 'players', player.id);
            await updateDoc(playerRef, {
              stats: stats.stats,
              last_stats_update: serverTimestamp(),
              stats_source: 'nba_api_automated'
            });
            return { success: true, playerId: player.id };
          }
        } catch (error) {
          console.warn(`⚠️ Failed to update stats for ${player.id}:`, error.message);
          return { success: false, playerId: player.id, error: error.message };
        }
      });

      const results = await Promise.allSettled(batchPromises);
      
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value?.success) {
          updated++;
        } else {
          errors++;
        }
      });

      // Rate limiting between batches
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`✅ Stats update completed: ${updated} updated, ${errors} errors`);
    return { updated, errors, total: players.length };
  }

  /**
   * Validate data integrity after updates
   */
  async validateDataIntegrity() {
    console.log('🔍 Validating data integrity...');
    
    const validation = {
      players: { count: 0, issues: [] },
      teams: { count: 0, issues: [] },
      stats: { updated: 0, missing: 0 }
    };

    try {
      // Count players
      const playersSnapshot = await getDocs(collection(db, 'players'));
      validation.players.count = playersSnapshot.size;

      // Count teams  
      const teamsSnapshot = await getDocs(collection(db, 'teams'));
      validation.teams.count = teamsSnapshot.size;

      // Check for players with recent stats updates
      let recentStatsCount = 0;
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      playersSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.last_stats_update && data.last_stats_update.toDate() > oneDayAgo) {
          recentStatsCount++;
        }
      });

      validation.stats.updated = recentStatsCount;
      validation.stats.missing = validation.players.count - recentStatsCount;

      console.log('✅ Data validation completed');
      console.log(`📊 Players: ${validation.players.count}, Teams: ${validation.teams.count}`);
      console.log(`📈 Recent stats updates: ${validation.stats.updated}/${validation.players.count}`);

      return validation;

    } catch (error) {
      console.error('❌ Data validation failed:', error);
      validation.error = error.message;
      return validation;
    }
  }

  /**
   * Store pipeline execution results for monitoring
   */
  async storePipelineResults(pipeline) {
    try {
      const pipelineRef = doc(db, 'pipeline_runs', pipeline.startTime.getTime().toString());
      await setDoc(pipelineRef, {
        ...pipeline,
        timestamp: serverTimestamp()
      });
      
      console.log('📝 Pipeline results stored for monitoring');
    } catch (error) {
      console.warn('⚠️ Failed to store pipeline results:', error.message);
    }
  }

  /**
   * Check if a step is non-critical (pipeline can continue if it fails)
   */
  isNonCriticalStep(stepName) {
    const nonCriticalSteps = ['updateContracts', 'validateData'];
    return nonCriticalSteps.includes(stepName);
  }

  /**
   * Get pipeline status and statistics
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastRun: this.lastRun,
      stats: this.stats,
      nextScheduledRun: this.getNextScheduledRun()
    };
  }

  /**
   * Calculate next scheduled run time
   */
  getNextScheduledRun() {
    if (!this.lastRun) return 'Never run';
    
    const lastRunTime = new Date(this.lastRun.startTime);
    const nextRun = new Date(lastRunTime.getTime() + (6 * 60 * 60 * 1000)); // 6 hours later
    
    return nextRun.toISOString();
  }

  /**
   * Manual trigger for immediate pipeline execution
   */
  async triggerManualRun(reason = 'manual_trigger') {
    console.log(`🔄 Manual pipeline trigger: ${reason}`);
    return await this.runFullPipeline({ trigger: 'manual', reason });
  }
}

// Export singleton instance
export const dataOrchestrator = new DataOrchestrator();
export default dataOrchestrator;