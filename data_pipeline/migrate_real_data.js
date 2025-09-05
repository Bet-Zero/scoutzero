#!/usr/bin/env node
/**
 * Real Data Migration Script
 * Migrates your actual Firebase data to the new separated schema
 * Preserves all evaluations, contracts, and player data
 */

import { db } from '../src/firebaseConfig.js';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';

class RealDataMigrator {
  constructor() {
    this.results = {
      playersProcessed: 0,
      contractsCreated: 0,
      evaluationsPreserved: 0,
      errors: []
    };
  }

  async migrateRealData() {
    console.log('🔄 REAL DATA MIGRATION');
    console.log('======================');
    console.log('🎯 Migrating your actual Firebase data to separated schema');
    console.log('⚠️  This preserves ALL your evaluations and data');
    console.log();

    try {
      // Load existing data from your current players collection
      const existingData = await this.loadExistingPlayerData();
      console.log(`✅ Loaded ${existingData.length} players from your database`);

      // Separate the data into new collections
      await this.createSeparatedCollections(existingData);
      
      console.log('\n✅ Migration Complete!');
      console.log('📊 Results:', this.results);
      
      return this.results;
    } catch (error) {
      console.error('❌ Migration failed:', error);
      this.results.errors.push(error.message);
      throw error;
    }
  }

  async loadExistingPlayerData() {
    console.log('📂 Loading your existing player data...');
    
    const playersSnapshot = await getDocs(collection(db, 'players'));
    const players = [];
    
    playersSnapshot.forEach(doc => {
      players.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return players;
  }

  async createSeparatedCollections(players) {
    console.log('\n🔄 Creating separated collections with your real data...');
    
    // Create batches for each collection
    const playersBatch = writeBatch(db);
    const contractsBatch = writeBatch(db);
    const evaluationsBatch = writeBatch(db);
    
    let playersCount = 0;
    let contractsCount = 0;
    let evaluationsCount = 0;

    for (const player of players) {
      // 1. NBA Data Only (stats, bio, team info)
      const nbaData = this.extractNBAData(player);
      const playersRef = doc(db, 'nba_players', player.id);
      playersBatch.set(playersRef, nbaData);
      playersCount++;

      // 2. Contract Data (if exists)
      const contractData = this.extractContractData(player);
      if (contractData) {
        const contractsRef = doc(db, 'player_contracts', player.id);
        contractsBatch.set(contractsRef, contractData);
        contractsCount++;
      }

      // 3. User Evaluations (your grades and roles)
      const evaluationData = this.extractEvaluationData(player);
      if (evaluationData) {
        const evaluationsRef = doc(db, 'player_evaluations', player.id);
        evaluationsBatch.set(evaluationsRef, evaluationData);
        evaluationsCount++;
      }
    }

    // Commit all batches
    console.log('💾 Committing NBA players data...');
    await playersBatch.commit();
    
    console.log('💾 Committing contracts data...');
    await contractsBatch.commit();
    
    console.log('💾 Committing evaluations data...');
    await evaluationsBatch.commit();

    this.results.playersProcessed = playersCount;
    this.results.contractsCreated = contractsCount;
    this.results.evaluationsPreserved = evaluationsCount;
    
    console.log(`✅ Created ${playersCount} NBA player records`);
    console.log(`✅ Created ${contractsCount} contract records`);
    console.log(`✅ Preserved ${evaluationsCount} user evaluations`);
  }

  extractNBAData(player) {
    // NBA stats and bio data only - no user content
    const nbaData = {
      name: player.Name || player.name,
      team: player.Team || player.team,
      position: player.Position || player.position,
      height: player.HT || player.height,
      weight: player.WT || player.weight,
      age: player.AGE || player.age,
      yearsPro: player['Years Pro'] || player.yearsPro,
      is_active_nba: player.is_active_nba !== false,
      last_updated: new Date().toISOString(),
      source: 'real_data_migration'
    };

    // Add stats if they exist
    const statsFields = ['MIN', 'PPG', 'RPG', 'APG', 'FG%', '3PT%', 'FT%', 'EFG%', 'Games Played'];
    statsFields.forEach(field => {
      if (player[field] !== undefined && player[field] !== null) {
        nbaData[field] = player[field];
      }
    });

    return nbaData;
  }

  extractContractData(player) {
    // Contract information - salary, years, etc.
    const contractFields = [
      'contract', 'salary', 'years_remaining', 'contract_value',
      'cap_hit', 'guaranteed', 'contract_years', 'aav'
    ];
    
    const contractData = {};
    let hasContractData = false;

    contractFields.forEach(field => {
      if (player[field] !== undefined && player[field] !== null) {
        contractData[field] = player[field];
        hasContractData = true;
      }
    });

    if (hasContractData) {
      contractData.last_updated = new Date().toISOString();
      contractData.source = 'real_data_migration';
      return contractData;
    }

    return null;
  }

  extractEvaluationData(player) {
    // Your personal evaluations - grades, roles, notes
    const evaluationFields = [
      'Grade', 'grade', 'Role', 'role', 'Notes', 'notes',
      'tier', 'ranking', 'evaluation', 'user_notes'
    ];
    
    const evaluationData = {};
    let hasEvaluationData = false;

    evaluationFields.forEach(field => {
      if (player[field] !== undefined && player[field] !== null && player[field] !== '') {
        evaluationData[field] = player[field];
        hasEvaluationData = true;
      }
    });

    if (hasEvaluationData) {
      evaluationData.evaluator = 'user'; // Mark as user evaluation
      evaluationData.last_updated = new Date().toISOString();
      evaluationData.source = 'real_data_migration';
      return evaluationData;
    }

    return null;
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const migrator = new RealDataMigrator();
  migrator.migrateRealData()
    .then(results => {
      console.log('\n🎉 Migration successful!');
      console.log('Next steps:');
      console.log('1. Update frontend to use new collections');
      console.log('2. Test Trade Machine with separated contract data');
      console.log('3. Verify all your evaluations are preserved');
    })
    .catch(error => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

export default RealDataMigrator;