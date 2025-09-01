#!/usr/bin/env node

/**
 * Firestore Data Population Tool
 * 
 * This script helps populate missing player data in Firestore by:
 * 1. Reading from local players.json file
 * 2. Populating the main /players collection
 * 3. Optionally populating season-specific collections
 * 
 * Usage:
 *   node scripts/populate-firestore-data.js [options]
 * 
 * Options:
 *   --season <year>     Populate specific season collection
 *   --main-only         Only populate main /players collection  
 *   --dry-run           Show what would be done without making changes
 *   --force             Overwrite existing data
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

// Initialize Firebase Admin (similar to existing scripts)
function initFirebase() {
  if (getApps().length === 0) {
    try {
      const serviceAccountPath = join(PROJECT_ROOT, 'serviceAccountKey.json');
      if (!existsSync(serviceAccountPath)) {
        console.error('❌ Firebase credentials not found at:', serviceAccountPath);
        console.log('💡 Please place your serviceAccountKey.json in the project root');
        process.exit(1);
      }

      const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
      initializeApp({
        credential: cert(serviceAccount)
      });
      console.log('✅ Firebase Admin initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Firebase:', error.message);
      process.exit(1);
    }
  }
  return getFirestore();
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    season: null,
    mainOnly: false,
    dryRun: false,
    force: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--season':
        options.season = args[++i];
        break;
      case '--main-only':
        options.mainOnly = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--force':
        options.force = true;
        break;
      case '--help':
        console.log(`
🏀 Firestore Data Population Tool

Usage: node scripts/populate-firestore-data.js [options]

Options:
  --season <year>     Populate specific season collection (e.g., 2026)
  --main-only         Only populate main /players collection
  --dry-run           Show what would be done without making changes
  --force             Overwrite existing data
  --help              Show this help

Examples:
  node scripts/populate-firestore-data.js --main-only
  node scripts/populate-firestore-data.js --season 2026 --force
  node scripts/populate-firestore-data.js --dry-run
        `);
        process.exit(0);
      default:
        console.error(`❌ Unknown option: ${args[i]}`);
        process.exit(1);
    }
  }

  return options;
}

// Load player data from local file
function loadPlayerData() {
  const playersJsonPath = join(PROJECT_ROOT, 'public', 'players.json');
  
  if (!existsSync(playersJsonPath)) {
    console.error('❌ Player data file not found at:', playersJsonPath);
    console.log('💡 Please ensure public/players.json exists with current player data');
    process.exit(1);
  }

  try {
    const rawData = readFileSync(playersJsonPath, 'utf8');
    const playersData = JSON.parse(rawData);
    
    // Convert object format to array with proper IDs
    const players = Object.keys(playersData).map(id => ({
      id,
      ...playersData[id]
    }));
    
    console.log(`✅ Loaded ${players.length} players from local file`);
    return players;
  } catch (error) {
    console.error('❌ Failed to load player data:', error.message);
    process.exit(1);
  }
}

// Check existing data in Firestore
async function checkExistingData(db, options) {
  const checks = {};
  
  try {
    // Check main players collection
    const playersSnap = await db.collection('players').get();
    checks.mainPlayers = playersSnap.size;
    
    // Check seasons if specified
    if (options.season) {
      const seasonPlayersSnap = await db.collection('seasons').doc(options.season).collection('players').get();
      checks.seasonPlayers = seasonPlayersSnap.size;
    }
    
    return checks;
  } catch (error) {
    console.warn('⚠️ Could not check existing data:', error.message);
    return {};
  }
}

// Populate main players collection
async function populateMainPlayers(db, players, options) {
  console.log(`\n📦 Populating main /players collection...`);
  
  if (options.dryRun) {
    console.log(`[DRY RUN] Would add ${players.length} players to /players collection`);
    return;
  }
  
  const batch = db.batch();
  let count = 0;
  
  for (const player of players) {
    const playerRef = db.collection('players').doc(player.id);
    batch.set(playerRef, player, { merge: !options.force });
    count++;
    
    // Commit in batches of 450 (Firestore limit is 500)
    if (count % 450 === 0) {
      await batch.commit();
      console.log(`  ✅ Committed batch (${count} players so far)`);
    }
  }
  
  // Commit remaining
  if (count % 450 !== 0) {
    await batch.commit();
  }
  
  console.log(`✅ Successfully populated ${count} players in main collection`);
}

// Populate season-specific collection
async function populateSeasonPlayers(db, players, season, options) {
  console.log(`\n📅 Populating season ${season} players collection...`);
  
  if (options.dryRun) {
    console.log(`[DRY RUN] Would add ${players.length} players to /seasons/${season}/players collection`);
    return;
  }
  
  // Ensure season document exists
  const seasonRef = db.collection('seasons').doc(season);
  const seasonDoc = await seasonRef.get();
  
  if (!seasonDoc.exists) {
    console.log(`📋 Creating season ${season} document...`);
    await seasonRef.set({
      status: 'active',
      display_name: `${parseInt(season) - 1}-${season.slice(-2)}`,
      created_date: new Date(),
      version: '1.0'
    });
  }
  
  const batch = db.batch();
  let count = 0;
  
  for (const player of players) {
    const playerRef = seasonRef.collection('players').doc(player.id);
    batch.set(playerRef, player, { merge: !options.force });
    count++;
    
    // Commit in batches of 450
    if (count % 450 === 0) {
      await batch.commit();
      console.log(`  ✅ Committed batch (${count} players so far)`);
    }
  }
  
  // Commit remaining
  if (count % 450 !== 0) {
    await batch.commit();
  }
  
  console.log(`✅ Successfully populated ${count} players in season ${season} collection`);
}

// Main execution
async function main() {
  console.log('🏀 Firestore Data Population Tool');
  console.log('================================');
  
  const options = parseArgs();
  console.log('🔧 Options:', options);
  
  // Load local player data
  const players = loadPlayerData();
  
  // Initialize Firebase
  const db = initFirebase();
  
  // Check existing data
  const existing = await checkExistingData(db, options);
  console.log('\n📊 Existing data:', existing);
  
  // Warn about overwriting
  if (!options.force && (existing.mainPlayers > 0 || existing.seasonPlayers > 0)) {
    console.log('⚠️ Existing data found. Use --force to overwrite, or data will be merged.');
  }
  
  try {
    // Populate main collection (unless season-only specified)
    if (!options.season || !options.mainOnly) {
      await populateMainPlayers(db, players, options);
    }
    
    // Populate season collection if specified
    if (options.season) {
      await populateSeasonPlayers(db, players, options.season, options);
    }
    
    console.log('\n🎉 Data population completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('  • Refresh your application to see the new data');
    console.log('  • Run npm run season:validate to verify data integrity');
    console.log('  • Use the diagnostic tool in the app to confirm data structure');
    
  } catch (error) {
    console.error('\n❌ Population failed:', error.message);
    process.exit(1);
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main as populateFirestoreData };