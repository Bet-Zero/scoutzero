#!/usr/bin/env node
/**
 * Data Migration Status Checker
 * Helps diagnose the current data architecture issues
 */

import { db } from '../src/firebaseConfig.js';
import { collection, getDocs, query, limit } from 'firebase/firestore';

class DataStatusChecker {
  async checkCurrentStatus() {
    console.log('🔍 DATA ARCHITECTURE STATUS CHECKER');
    console.log('===================================');
    console.log();

    try {
      // Check original players collection
      const originalPlayers = await this.checkCollection('players', 'Original unified collection');
      
      // Check test collections (the problematic ones)
      const testPlayers = await this.checkCollection('test_players', 'Test collection (fake data)');
      const testContracts = await this.checkCollection('test_contracts', 'Test contracts (fake data)');  
      const testEvaluations = await this.checkCollection('test_evaluations', 'Test evaluations (fake data)');
      
      // Check new separated collections
      const nbaPlayers = await this.checkCollection('nba_players', 'New NBA data collection');
      const playerContracts = await this.checkCollection('player_contracts', 'New contracts collection');
      const playerEvaluations = await this.checkCollection('player_evaluations', 'New evaluations collection');

      console.log('\n📊 DIAGNOSIS:');
      console.log('=============');
      
      if (originalPlayers > 0 && nbaPlayers === 0) {
        console.log('❌ ISSUE IDENTIFIED: Using old unified schema');
        console.log('   - Frontend reads from "players" collection');
        console.log('   - Test collections contain fake placeholder data');
        console.log('   - New separated schema not implemented yet');
        console.log();
        console.log('✅ SOLUTION: Run real data migration');
        console.log('   ./migrate_real_data.sh');
      } else if (nbaPlayers > 0) {
        console.log('✅ New separated schema is active');
        console.log('   - Frontend will use separated collections');
        console.log('   - Real data has been migrated');
        console.log('   - Test collections can be deleted');
      } else {
        console.log('⚠️  No player data found in any collection');
        console.log('   - Check Firebase connection');
        console.log('   - Verify .env configuration');
      }

      return {
        originalPlayers,
        testPlayers,
        nbaPlayers,
        playerContracts,
        playerEvaluations
      };

    } catch (error) {
      console.error('❌ Error checking data status:', error);
      throw error;
    }
  }

  async checkCollection(collectionName, description) {
    try {
      const snapshot = await getDocs(query(collection(db, collectionName), limit(1)));
      const fullSnapshot = await getDocs(collection(db, collectionName));
      const count = fullSnapshot.size;
      
      if (count > 0) {
        console.log(`✅ ${description}: ${count} documents`);
        
        // Show sample data for test collections to prove they're fake
        if (collectionName.startsWith('test_')) {
          const sampleDoc = snapshot.docs[0];
          const data = sampleDoc.data();
          if (data.evaluator === 'fixed_test_system') {
            console.log(`   🎭 Contains FAKE data: evaluator="${data.evaluator}"`);
          }
          if (data.source === 'test_data_creation') {
            console.log(`   🎭 Contains FAKE data: source="${data.source}"`);
          }
        }
      } else {
        console.log(`❌ ${description}: No data found`);
      }
      
      return count;
    } catch (error) {
      console.log(`❌ ${description}: Error accessing (${error.message})`);
      return 0;
    }
  }
}

// Run checker if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const checker = new DataStatusChecker();
  checker.checkCurrentStatus()
    .then(() => {
      console.log('\n💡 Next Steps:');
      console.log('   1. Run: ./migrate_real_data.sh');
      console.log('   2. Test: npm run dev'); 
      console.log('   3. Verify all players show (not just 15)');
      console.log('   4. Confirm your evaluations are preserved');
    })
    .catch(error => {
      console.error('💥 Status check failed:', error);
      process.exit(1);
    });
}

export default DataStatusChecker;