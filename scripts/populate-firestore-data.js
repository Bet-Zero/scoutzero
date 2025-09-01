#!/usr/bin/env node
/**
 * Populate Firestore Data - Node.js Firebase Data Population Tool
 * Supports main player data upload and season-specific data management
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get command line arguments first
const args = process.argv.slice(2);
const isMainOnly = args.includes('--main-only');
const isSeason = args.includes('--season');

// Show usage if no args or help requested
if (args.includes('--help') || args.includes('-h')) {
  console.log('🏀 Firestore Data Population Tool');
  console.log('=====================================');
  console.log('Usage: node populate-firestore-data.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --main-only    Upload only to main players collection');
  console.log('  --season       Upload only season-specific data');
  console.log('  (no options)   Upload all data (main + season + teams)');
  console.log('');
  console.log('Examples:');
  console.log('  npm run data:populate           # Full upload');
  console.log('  npm run data:populate-main      # Main collection only');
  console.log('  npm run data:populate-season    # Season data only');
  process.exit(0);
}

// Import Firebase configuration with error handling
let db;
try {
  const { db: firebaseDb } = await import('./firebaseConfig.node.js');
  db = firebaseDb;
  console.log('✅ Firebase connection established');
} catch (error) {
  console.log('❌ Firebase initialization failed:', error.message);
  console.log('💡 Ensure serviceAccountKey.json is in project root or GOOGLE_APPLICATION_CREDENTIALS is set');
  process.exit(1);
}

async function loadPlayerData() {
  /**
   * Load player data from available sources
   */
  const dataFiles = [
    '../data/players_merged_with_discoveries.json', // From pipeline output
    '../data/players_merged.json',                  // From merge script
    '../public/players.json',                       // Base player data
    './public/players.json'                         // Alternative path
  ];

  for (const filePath of dataFiles) {
    const fullPath = path.resolve(__dirname, filePath);
    if (fs.existsSync(fullPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        console.log(`✅ Loaded player data from: ${filePath}`);
        console.log(`📊 Players found: ${Object.keys(data).length}`);
        return data;
      } catch (error) {
        console.log(`❌ Error reading ${filePath}: ${error.message}`);
      }
    }
  }

  throw new Error('No player data file found. Run pipeline first or check data paths.');
}

async function uploadMainPlayerData(playerData) {
  /**
   * Upload main player collection to Firestore
   */
  console.log('📤 Uploading main player data to Firestore...');
  
  const playersRef = db.collection('players');
  const batch = db.batch();
  
  let uploadCount = 0;
  const playerKeys = Object.keys(playerData);
  
  for (const playerId of playerKeys) {
    const player = playerData[playerId];
    
    // Create document reference
    const docRef = playersRef.doc(playerId);
    
    // Transform contract data to the expected format
    const transformContractData = (player) => {
      if (!player.contract?.annual_salaries) {
        return player;
      }

      // Convert annual_salaries array to salaries_by_year object
      const salaries_by_year = {};
      player.contract.annual_salaries.forEach(salary => {
        salaries_by_year[salary.year] = {
          salary: salary.salary,
          guaranteed: salary.guaranteed,
          likely_bonus: 0, // Default to 0, can be enhanced later
          option: salary.option || undefined
        };
      });

      // Create contract_clean structure
      const contract_clean = {
        salaries_by_year,
        contractType: player.contract_summary?.type || 'Standard',
        extension: player.contract.extension,
        fa_year: player.contract.free_agency_year,
        total_value: player.contract.total_value,
        guaranteed_value: player.contract.total_value, // Assuming fully guaranteed for now
      };

      return {
        ...player,
        contract_clean
      };
    };

    // Prepare player document with metadata and transformed contract
    const transformedPlayer = transformContractData(player);
    const playerDoc = {
      ...transformedPlayer,
      system: {
        id: playerId,
        lastUpdated: new Date().toISOString(),
        source: 'automated_pipeline',
        version: '2025'
      }
    };
    
    batch.set(docRef, playerDoc, { merge: true });
    uploadCount++;
    
    // Commit batch every 400 documents (Firestore limit is 500)
    if (uploadCount % 400 === 0) {
      await batch.commit();
      console.log(`   📊 Uploaded ${uploadCount}/${playerKeys.length} players...`);
    }
  }
  
  // Commit remaining documents
  if (uploadCount % 400 !== 0) {
    await batch.commit();
  }
  
  console.log(`✅ Successfully uploaded ${uploadCount} players to main collection`);
  return uploadCount;
}

async function uploadSeasonData(playerData) {
  /**
   * Upload season-specific player data
   */
  const currentYear = new Date().getFullYear();
  const seasonId = `${currentYear}-${(currentYear + 1).toString().slice(2)}`;
  
  console.log(`📤 Uploading season data for ${seasonId}...`);
  
  const seasonRef = db.collection('seasons').doc(seasonId).collection('players');
  const batch = db.batch();
  
  let uploadCount = 0;
  const playerKeys = Object.keys(playerData);
  
  for (const playerId of playerKeys) {
    const player = playerData[playerId];
    
    // Create season-specific document
    const docRef = seasonRef.doc(playerId);
    
    const seasonDoc = {
      // Core identity
      name: player.Name,
      team: player.Team,
      position: player.Position,
      
      // Season-specific stats
      stats: {
        ppg: player.PPG || 0,
        rpg: player.RPG || 0,
        apg: player.APG || 0,
        fgPercent: player['FG%'] || '0%',
        threePercent: player['3PT%'] || '0%',
        ftPercent: player['FT%'] || '0%',
        gamesPlayed: player['Games Played'] || 0
      },
      
      // Contract info
      contract: {
        details: player.Contract || 'Unknown',
        freeAgent: player['Free Agent'] || 'Unknown'
      },
      
      // System metadata
      system: {
        id: playerId,
        seasonId: seasonId,
        lastUpdated: new Date().toISOString(),
        source: 'season_pipeline'
      }
    };
    
    batch.set(docRef, seasonDoc);
    uploadCount++;
    
    if (uploadCount % 400 === 0) {
      await batch.commit();
      console.log(`   📊 Uploaded ${uploadCount}/${playerKeys.length} season records...`);
    }
  }
  
  if (uploadCount % 400 !== 0) {
    await batch.commit();
  }
  
  // Update season metadata
  const seasonMetaRef = db.collection('seasons').doc(seasonId);
  await seasonMetaRef.set({
    year: currentYear + 1,
    seasonId: seasonId,
    playerCount: uploadCount,
    lastUpdated: new Date().toISOString(),
    status: 'active'
  }, { merge: true });
  
  console.log(`✅ Successfully uploaded ${uploadCount} players to season ${seasonId}`);
  return { seasonId, uploadCount };
}

async function createTeamSummaries(playerData) {
  /**
   * Create team summary documents
   */
  console.log('📊 Creating team summaries...');
  
  const teams = {};
  
  // Group players by team
  Object.values(playerData).forEach(player => {
    const team = player.Team;
    if (!team || team === 'Free Agent') return;
    
    if (!teams[team]) {
      teams[team] = {
        name: team,
        players: [],
        totalSalary: 0,
        rosterCount: 0
      };
    }
    
    teams[team].players.push({
      id: player.Name?.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
      name: player.Name,
      position: player.Position,
      contract: player.Contract
    });
    
    teams[team].rosterCount++;
  });
  
  // Upload team summaries
  const teamsRef = db.collection('teams');
  const batch = db.batch();
  
  let teamCount = 0;
  for (const [teamName, teamData] of Object.entries(teams)) {
    const teamId = teamName.toLowerCase().replace(/\s+/g, '_');
    const docRef = teamsRef.doc(teamId);
    
    batch.set(docRef, {
      ...teamData,
      id: teamId,
      lastUpdated: new Date().toISOString()
    });
    
    teamCount++;
  }
  
  await batch.commit();
  console.log(`✅ Created summaries for ${teamCount} teams`);
  
  return teamCount;
}

async function main() {
  console.log('🏀 Firestore Data Population Tool');
  console.log('=====================================');
  
  try {
    // Load player data
    const playerData = await loadPlayerData();
    
    let results = {
      playersUploaded: 0,
      seasonData: null,
      teamsCreated: 0
    };
    
    if (isSeason) {
      // Season-only mode
      console.log('🗓️ Season-only mode: Uploading season-specific data');
      results.seasonData = await uploadSeasonData(playerData);
      
    } else if (isMainOnly) {
      // Main collection only
      console.log('📁 Main-only mode: Uploading to main player collection');
      results.playersUploaded = await uploadMainPlayerData(playerData);
      
    } else {
      // Full upload (default)
      console.log('🚀 Full mode: Uploading all data collections');
      
      results.playersUploaded = await uploadMainPlayerData(playerData);
      results.seasonData = await uploadSeasonData(playerData);
      results.teamsCreated = await createTeamSummaries(playerData);
    }
    
    // Summary report
    console.log('');
    console.log('📊 UPLOAD SUMMARY');
    console.log('=====================================');
    console.log(`✅ Main players uploaded: ${results.playersUploaded}`);
    
    if (results.seasonData) {
      console.log(`✅ Season ${results.seasonData.seasonId}: ${results.seasonData.uploadCount} players`);
    }
    
    if (results.teamsCreated > 0) {
      console.log(`✅ Team summaries created: ${results.teamsCreated}`);
    }
    
    console.log('');
    console.log('🎉 Data population completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during data population:', error.message);
    process.exit(1);
  }
}

// Run the main function
main();