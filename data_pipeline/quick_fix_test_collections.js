#!/usr/bin/env node
/**
 * Quick Fix Test Collections Script  
 * This creates test collections with proper undefined value handling
 * Run this after adding Firebase credentials
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db;

// Try to initialize Firebase, fallback to simulation if not available
try {
  const { db: firebaseDb } = await import('../scripts/firebaseConfig.node.js');
  db = firebaseDb;
  console.log('✅ Firebase connection established');
} catch (error) {
  console.log('⚠️ Firebase not available - running in simulation mode');
  console.log('Error:', error.message);
  db = null;
}

async function loadPlayerData() {
  console.log('📂 Loading existing player data...');
  
  const playerDataPath = path.join(__dirname, '../public/players.json');
  
  if (!fs.existsSync(playerDataPath)) {
    throw new Error('Player data not found at ../public/players.json');
  }
  
  const data = JSON.parse(fs.readFileSync(playerDataPath, 'utf8'));
  console.log(`✅ Loaded ${Object.keys(data).length} players from players.json`);
  
  return data;
}

function createCleanPlayerDoc(player) {
  // Start with required fields that should always have values
  const playerDoc = {
    Name: player.Name || 'Unknown',
    Team: player.Team || 'Free Agent',
    Position: player.Position || 'Unknown',
    HT: player.HT || 'Unknown',
    WT: player.WT || 'Unknown',
    AGE: player.AGE || 0,
    'Years Pro': player['Years Pro'] || 0,
    'Games Played': player['Games Played'] || 0,
    is_active_nba: player.Team !== 'Free Agent' && player.Team !== undefined && player.Team !== '',
    last_updated: new Date().toISOString(),
    source: 'test_data_creation'
  };

  // Only add statistical fields if they exist and are not undefined/null
  const statFields = ['MIN', 'PPG', 'RPG', 'APG', 'FG%', '3PT%', 'FT%', 'EFG%'];
  
  for (const field of statFields) {
    if (player[field] !== undefined && player[field] !== null) {
      playerDoc[field] = player[field];
    }
  }

  return playerDoc;
}

async function createTestCollections() {
  console.log('🏀 Creating Test Firebase Collections (Fixed Version)');
  console.log('==================================================');
  console.log('🔒 Using test_ prefixes - safe for production');
  console.log('✅ Fixed undefined value handling');
  console.log();

  try {
    // Load player data
    const playerData = await loadPlayerData();
    
    // Analyze data first
    let playersWithStats = 0;
    let playersWithoutStats = 0;
    
    for (const player of Object.values(playerData)) {
      if (player.MIN !== undefined || player.PPG !== undefined) {
        playersWithStats++;
      } else {
        playersWithoutStats++;
      }
    }
    
    console.log(`📊 Data analysis: ${playersWithStats} players with stats, ${playersWithoutStats} without stats`);
    console.log();
    
    if (!db) {
      console.log('🎭 SIMULATION MODE: Showing what would be created');
      console.log('(Add Firebase credentials to create real collections)');
      console.log();
    }
    
    // Create test_players collection
    console.log('👥 Creating test_players collection...');
    
    let count = 0;
    let successfulDocs = 0;
    let errors = [];
    
    for (const [playerId, player] of Object.entries(playerData)) {
      try {
        const playerDoc = createCleanPlayerDoc(player);
        
        if (db) {
          // Real Firebase operation
          const docRef = db.collection('test_players').doc(playerId);
          await docRef.set(playerDoc);
        }
        
        successfulDocs++;
        count++;
        
        // Show progress
        if (count % 100 === 0) {
          console.log(`   📊 Processed ${count} players...`);
        }
        
        // Show first few examples
        if (count <= 3) {
          console.log(`   ✅ Example ${count}: ${playerDoc.Name} (${Object.keys(playerDoc).length} fields)`);
          if (playerDoc.MIN) {
            console.log(`      Has stats: MIN=${playerDoc.MIN}, PPG=${playerDoc.PPG}`);
          } else {
            console.log(`      Bio only: ${playerDoc.Position} from ${playerDoc.Team}`);
          }
        }
        
      } catch (error) {
        errors.push(`${playerId}: ${error.message}`);
        console.log(`   ❌ Error with ${playerId}: ${error.message}`);
      }
    }
    
    console.log();
    console.log('📊 RESULTS SUMMARY');
    console.log('==================');
    console.log(`✅ Total players processed: ${count}`);
    console.log(`✅ Successful documents: ${successfulDocs}`);
    console.log(`❌ Errors: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log('\nFirst few errors:');
      errors.slice(0, 5).forEach(error => console.log(`   - ${error}`));
    }
    
    if (db) {
      console.log('\n🎉 test_players collection created successfully!');
      console.log('📍 Check Firebase Console to see new test_players collection');
    } else {
      console.log('\n🎯 Ready for real Firebase creation!');
      console.log('1. Install firebase-admin: npm install firebase-admin');
      console.log('2. Add your serviceAccountKey.json to project root');
      console.log('3. Re-run this script');
    }
    
    // Save results
    const report = {
      timestamp: new Date().toISOString(),
      mode: db ? 'production' : 'simulation',
      total_players: count,
      successful_documents: successfulDocs,
      errors: errors.length,
      players_with_stats: playersWithStats,
      players_without_stats: playersWithoutStats,
      error_details: errors.slice(0, 10) // First 10 errors
    };
    
    const reportDir = './test_results';
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    const reportPath = `${reportDir}/fixed_test_collections_report.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📋 Report saved: ${reportPath}`);
    
  } catch (error) {
    console.error('💥 Failed to create test collections:', error.message);
    console.error('Stack trace:', error.stack);
    throw error;
  }
}

// Run the script
createTestCollections().catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});