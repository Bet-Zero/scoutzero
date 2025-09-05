#!/usr/bin/env node
/**
 * Evaluation-Only Migration Script
 * ONLY migrates user evaluations (grades, roles, notes) to new schema
 * NBA data comes from fresh scraping system - NOT migrated from old data
 */

import fs from 'fs';
import path from 'path';

// Try to initialize Firebase with graceful error handling
let db, getDocs, writeBatch, doc, collection;
let hasFirebase = false;

try {
  const firebaseModule = await import('./firebaseConfig.node.js');
  db = firebaseModule.db;
  getDocs = firebaseModule.getDocs;
  writeBatch = (firebaseInstance) => firebaseInstance.batch();
  doc = firebaseModule.doc;
  collection = firebaseModule.collection;
  hasFirebase = true;
  console.log('✅ Firebase connection available for evaluation migration');
} catch (error) {
  console.log('⚠️  Firebase credentials not available, will create sample evaluations structure');
  hasFirebase = false;
}

class EvaluationOnlyMigrator {
  constructor() {
    this.results = {
      playersChecked: 0,
      evaluationsPreserved: 0,
      playersWithEvaluations: [],
      errors: []
    };
  }

  async migrateEvaluationsOnly() {
    console.log('📝 EVALUATIONS-ONLY MIGRATION');
    console.log('=============================');
    console.log('🎯 Preserving ONLY your personal evaluations');
    console.log('📊 NBA data will come from fresh scraping system');
    console.log('⚠️  This does NOT migrate NBA stats/bio data');
    console.log();

    try {
      // Load existing data from your current players collection
      const existingData = await this.loadExistingPlayerData();
      console.log(`✅ Loaded ${existingData.length} players from your database`);

      // Extract and preserve ONLY user evaluations
      await this.preserveUserEvaluations(existingData);
      
      console.log('\n✅ Evaluation Migration Complete!');
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
    
    if (!hasFirebase) {
      throw new Error('Firebase credentials not available. Cannot access existing player data.');
    }
    
    const playersRef = collection(db, 'players');
    const playersSnapshot = await getDocs(playersRef);
    const players = [];
    
    playersSnapshot.docs.forEach(docSnapshot => {
      players.push({
        id: docSnapshot.id,
        ...docSnapshot.data()
      });
    });

    return players;
  }

  async preserveUserEvaluations(players) {
    console.log('\n📝 Extracting user evaluations only...');
    
    if (!hasFirebase) {
      console.log('⚠️  No Firebase connection - creating sample evaluation structure');
      this.results.evaluationsPreserved = 0;
      return;
    }
    
    const evaluationsBatch = writeBatch(db);
    let evaluationsCount = 0;

    for (const player of players) {
      this.results.playersChecked++;

      // Extract ONLY user evaluation data 
      const evaluationData = this.extractEvaluationData(player);
      
      if (evaluationData) {
        const evaluationsRef = doc(db, 'player_evaluations', player.id);
        evaluationsBatch.set(evaluationsRef, evaluationData);
        evaluationsCount++;
        
        this.results.playersWithEvaluations.push({
          name: player.Name || player.name || 'Unknown',
          id: player.id,
          evaluations: Object.keys(evaluationData).filter(key => 
            !['evaluator', 'last_updated', 'source'].includes(key)
          )
        });
      }

      // Commit in batches to avoid Firestore limits
      if (evaluationsCount % 400 === 0 && evaluationsCount > 0) {
        console.log(`💾 Committing batch at ${evaluationsCount} evaluations...`);
        await evaluationsBatch.commit();
        // Reset batch
        const newBatch = writeBatch(db);
        Object.setPrototypeOf(evaluationsBatch, newBatch);
      }
    }

    // Commit final batch
    if (evaluationsCount > 0) {
      console.log('💾 Committing final evaluations batch...');
      await evaluationsBatch.commit();
    }

    this.results.evaluationsPreserved = evaluationsCount;
    
    console.log(`✅ Preserved ${evaluationsCount} user evaluations`);
    console.log(`📋 Players with evaluations: ${this.results.playersWithEvaluations.length}`);
  }

  extractEvaluationData(player) {
    // ONLY user evaluations - grades, roles, notes, etc.
    const evaluationFields = [
      'Grade', 'grade', 'Role', 'role', 'Notes', 'notes',
      'tier', 'ranking', 'evaluation', 'user_notes', 'user_grade',
      'personal_notes', 'scouting_notes', 'evaluation_notes'
    ];
    
    const evaluationData = {};
    let hasEvaluationData = false;

    evaluationFields.forEach(field => {
      if (player[field] !== undefined && 
          player[field] !== null && 
          player[field] !== '' &&
          player[field] !== 'N/A') {
        evaluationData[field] = player[field];
        hasEvaluationData = true;
      }
    });

    if (hasEvaluationData) {
      evaluationData.evaluator = 'user'; // Mark as user evaluation
      evaluationData.last_updated = new Date().toISOString();
      evaluationData.source = 'evaluation_migration';
      evaluationData.player_name = player.Name || player.name || 'Unknown';
      return evaluationData;
    }

    return null;
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const migrator = new EvaluationOnlyMigrator();
  migrator.migrateEvaluationsOnly()
    .then(results => {
      console.log('\n🎉 Evaluation migration successful!');
      console.log('\n📋 Summary:');
      console.log(`   Players checked: ${results.playersChecked}`);
      console.log(`   Evaluations preserved: ${results.evaluationsPreserved}`);
      console.log('\n📊 Players with evaluations:');
      results.playersWithEvaluations.forEach(player => {
        console.log(`   ${player.name}: ${player.evaluations.join(', ')}`);
      });
      console.log('\n💡 Next steps:');
      console.log('   1. Populate NBA data using scraping system');
      console.log('   2. Update frontend to use new schema exclusively');
      console.log('   3. Test Trade Machine with separated data');
    })
    .catch(error => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

export default EvaluationOnlyMigrator;