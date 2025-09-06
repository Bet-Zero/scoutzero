/**
 * MIGRATE AND STRUCTURE - SEPARATED SCHEMA IMPLEMENTATION
 * ======================================================
 * 
 * This script takes fresh scraped data and your Firebase evaluations
 * and creates the new separated schema architecture.
 * 
 * Input: fresh_data.json from local_fresh_data_scraper.js + your Firebase evaluations
 * Output: Four collections in separated schema format
 * 
 * NO FALLBACKS - Uses only fresh scraped data and your evaluations.
 * If fresh data is empty, collections will be empty so you can see what works.
 * 
 * Usage:
 * 1. Run local_fresh_data_scraper.js on your local machine first
 * 2. Run this script: node migrate_and_structure.js
 * 3. Use load_to_firebase.js to upload to Firebase
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Firebase setup (dynamic import)
let admin = null;
let firebaseAvailable = false;

async function initializeFirebase() {
    try {
        const { default: firebaseAdmin } = await import('firebase-admin');
        admin = firebaseAdmin;
        const { default: serviceAccount } = await import('../serviceAccountKey.json', { assert: { type: 'json' } });
        
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        }
        firebaseAvailable = true;
        console.log('✅ Firebase initialized successfully');
    } catch (error) {
        console.log('⚠️  Firebase not available - will create JSON files only');
        firebaseAvailable = false;
    }
}

const OUTPUT_DIR = path.join(__dirname, 'output', 'separated_schema');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Progress logging
function logProgress(message) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${message}`);
}

/**
 * Load fresh scrape data - NO FALLBACKS
 * Returns empty data if scraping failed so you can see what works
 */
function loadFreshScrapeData() {
    const dataPath = path.join(__dirname, 'output', 'fresh_data.json');
    
    if (!fs.existsSync(dataPath)) {
        logProgress('❌ No fresh_data.json found');
        logProgress('   Run local_fresh_data_scraper.js on your LOCAL machine first');
        return null;
    }
    
    try {
        const freshData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        
        logProgress('✅ Loaded fresh scrape data:');
        logProgress(`   NBA players: ${freshData.nba_players?.length || 0}`);
        logProgress(`   Spotrac contracts: ${freshData.spotrac_contracts?.contracts?.length || 0}`);
        
        return freshData;
        
    } catch (error) {
        logProgress(`❌ Error loading fresh data: ${error.message}`);
        return null;
    }
}

/**
 * Migrate ONLY your user evaluations from Firebase
 * This is the ONLY data we preserve from your old system
 */
async function migrateUserEvaluations() {
    if (!admin) {
        logProgress('⚠️  Firebase not available - will create empty evaluations');
        logProgress('   Add serviceAccountKey.json and run locally to migrate your evaluations');
        return {};
    }
    
    if (!firebaseAvailable || !admin) {
        console.log('⚠️  Firebase not available - no evaluation migration');
        console.log('   Evaluations will be empty in new schema');
        return {};
    }
    
    try {
        logProgress('👤 Migrating ONLY your user evaluations from Firebase...');
        logProgress('   (grades, roles, notes, tiers - NOT NBA stats/bio data)');
        
        const db = admin.firestore();
        const playersSnapshot = await db.collection('players').get();
        
        const evaluations = {};
        let evaluationCount = 0;
        
        playersSnapshot.forEach(doc => {
            const data = doc.data();
            const playerId = doc.id;
            
            // Extract ONLY evaluation fields - no NBA data
            const hasEvaluationData = data.grade || data.role || data.notes || data.tier || data.blurb;
            
            if (hasEvaluationData) {
                evaluations[playerId] = {
                    player_id: playerId,
                    player_name: data.Name || data.name || playerId,
                    grade: data.grade || null,
                    role: data.role || null,
                    notes: data.notes || null,
                    tier: data.tier || null,
                    blurb: data.blurb || null,
                    evaluator: 'user',
                    last_updated: data.last_updated || new Date().toISOString(),
                    evaluation_season: '2024-25'
                };
                evaluationCount++;
            }
        });
        
        logProgress(`  ✅ Migrated ${evaluationCount} user evaluations (no NBA data)`);
        return evaluations;
        
    } catch (error) {
        logProgress(`  ❌ Error migrating evaluations: ${error.message}`);
        logProgress('     Will create empty evaluations collection');
        return {};
    }
}

/**
 * Create NBA Players collection from FRESH scraped data only
 * NO FALLBACKS - empty if scraping failed
 */
function createNBAPlayersData(freshData) {
    logProgress('🏀 Creating NBA Players collection from fresh scraped data...');
    
    if (!freshData || !freshData.nba_players || freshData.nba_players.length === 0) {
        logProgress('   ❌ No fresh NBA player data available');
        logProgress('   Run local_fresh_data_scraper.js on your LOCAL machine first');
        return {};
    }
    
    const nbaPlayers = {};
    let playerCount = 0;
    
    // Use ONLY fresh NBA data - no fallbacks
    freshData.nba_players.forEach((player, index) => {
        // Progress logging every 100 players
        if (index % 100 === 0) {
            logProgress(`   Processing ${index}/${freshData.nba_players.length} NBA players...`);
        }
        
        const playerId = player.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
        
        nbaPlayers[playerId] = {
            player_id: playerId,
            Name: player.name, // Capitalized for compatibility
            name: player.name, // Lowercase for compatibility
            nba_id: player.nba_id,
            Team: player.team_abbrev, // Capitalized for compatibility
            team: player.team_abbrev, // Lowercase for compatibility
            team_name: player.team_name,
            roster_status: player.roster_status,
            years_pro: player.years_pro,
            is_active: player.is_active,
            season: '2024-25',
            last_updated: player.scraped_at,
            data_source: 'nba_api_fresh_scrape'
        };
        
        playerCount++;
    });
    
    logProgress(`  ✅ Created ${playerCount} NBA player records from fresh data`);
    return nbaPlayers;
}

/**
 * Create Player Contracts collection from FRESH scraped data only
 * NO FALLBACKS - empty if scraping failed
 */
function createPlayerContractsData(freshData) {
    logProgress('💰 Creating Player Contracts collection from fresh scraped data...');
    
    if (!freshData || !freshData.spotrac_contracts || !freshData.spotrac_contracts.contracts) {
        logProgress('   ❌ No fresh contract data available');
        logProgress('   Run local_fresh_data_scraper.js on your LOCAL machine first');
        return {};
    }
    
    const contracts = {};
    let contractCount = 0;
    const freshContracts = freshData.spotrac_contracts.contracts;
    
    // Use ONLY fresh contract data - no fallbacks
    freshContracts.forEach((player, index) => {
        // Progress logging every 50 contracts
        if (index % 50 === 0) {
            logProgress(`   Processing ${index}/${freshContracts.length} contracts...`);
        }
        
        const playerId = player.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
        
        contracts[playerId] = {
            player_id: playerId,
            player_name: player.name,
            Team: player.team, // Capitalized for compatibility
            team: player.team, // Lowercase for compatibility
            salary: player.salary,
            Contract: player.salary_display, // Capitalized for compatibility
            contract_display: player.salary_display,
            contract_years: player.contract_years,
            season: '2024-25',
            scraped_from: player.scraped_from,
            last_updated: player.scraped_at,
            data_source: 'spotrac_fresh_scrape'
        };
        
        contractCount++;
    });
    
    logProgress(`  ✅ Created ${contractCount} contract records from fresh data`);
    return contracts;
}

/**
 * Create Team Caps collection from FRESH contract data only
 * NO FALLBACKS - empty if contract scraping failed
 */
function createTeamCapsData(freshData) {
    logProgress('📊 Creating Team Caps collection from fresh contract data...');
    
    if (!freshData || !freshData.spotrac_contracts || !freshData.spotrac_contracts.contracts) {
        logProgress('   ❌ No fresh contract data available for team cap calculations');
        logProgress('   Run local_fresh_data_scraper.js on your LOCAL machine first');
        return {};
    }
    
    const teamCaps = {};
    const teamSalaries = {};
    
    // Group contracts by team
    freshData.spotrac_contracts.contracts.forEach(player => {
        const team = player.team;
        if (!teamSalaries[team]) {
            teamSalaries[team] = [];
        }
        teamSalaries[team].push(player);
    });
    
    // Calculate team caps from fresh contract data
    Object.entries(teamSalaries).forEach(([team, players]) => {
        const totalSalary = players.reduce((sum, player) => sum + (player.salary || 0), 0);
        const playerCount = players.length;
        
        // NBA salary cap constants (2024-25 season)
        const SALARY_CAP = 140588000; // $140.588M
        const LUXURY_TAX = 170814000; // $170.814M
        const APRON = 178655000; // $178.655M
        
        teamCaps[team.toLowerCase()] = {
            team: team,
            season: '2024-25',
            total_salary: totalSalary,
            salary_display: `$${(totalSalary / 1000000).toFixed(1)}M`,
            player_count: playerCount,
            cap_space: Math.max(0, SALARY_CAP - totalSalary),
            over_cap: totalSalary > SALARY_CAP,
            in_luxury_tax: totalSalary > LUXURY_TAX,
            over_apron: totalSalary > APRON,
            luxury_tax_bill: Math.max(0, totalSalary - LUXURY_TAX),
            last_updated: new Date().toISOString(),
            data_source: 'calculated_from_fresh_contracts'
        };
    });
    
    logProgress(`  ✅ Created ${Object.keys(teamCaps).length} team salary cap records from fresh data`);
    return teamCaps;
}

/**
 * Save separated schema data to JSON files
 */
function saveToFiles(nbaPlayers, contracts, evaluations, teamCaps) {
    logProgress('💾 Saving separated schema data to files...');
    
    const files = [
        { name: 'nba_players.json', data: nbaPlayers },
        { name: 'player_contracts.json', data: contracts },
        { name: 'player_evaluations.json', data: evaluations },
        { name: 'team_caps.json', data: teamCaps }
    ];
    
    files.forEach(file => {
        const filePath = path.join(OUTPUT_DIR, file.name);
        fs.writeFileSync(filePath, JSON.stringify(file.data, null, 2));
        
        const count = Object.keys(file.data).length;
        logProgress(`  ✅ Saved ${file.name} with ${count} records`);
    });
    
    // Create summary file
    const summary = {
        created: new Date().toISOString(),
        collections: {
            nba_players: Object.keys(nbaPlayers).length,
            player_contracts: Object.keys(contracts).length,
            player_evaluations: Object.keys(evaluations).length,
            team_caps: Object.keys(teamCaps).length
        },
        total_records: Object.keys(nbaPlayers).length + Object.keys(contracts).length + 
                      Object.keys(evaluations).length + Object.keys(teamCaps).length
    };
    
    fs.writeFileSync(path.join(OUTPUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));
    logProgress(`  ✅ Created summary.json`);
    
    return summary;
}

/**
 * Main migration and structuring function
 */
async function migrateAndStructure() {
    // Initialize Firebase first
    await initializeFirebase();
    
    console.log('🔄 MIGRATE AND STRUCTURE - SEPARATED SCHEMA');
    console.log('===========================================');
    console.log('📊 NO FALLBACKS: Fresh data only + your evaluations only');
    console.log('🎯 Empty results show what works vs what doesn\'t');
    console.log('');
    
    try {
        // Step 1: Load fresh scrape data (NO FALLBACKS)
        logProgress('📂 Step 1: Loading Fresh Scrape Data...');
        const freshData = loadFreshScrapeData();
        
        if (!freshData) {
            logProgress('❌ Cannot proceed without fresh data');
            logProgress('   Run local_fresh_data_scraper.js on your LOCAL machine first');
            process.exit(1);
        }
        
        // Step 2: Migrate user evaluations only
        logProgress('');
        logProgress('👤 Step 2: Migrating ONLY Your User Evaluations...');
        const evaluations = await migrateUserEvaluations();
        
        // Step 3: Create separated collections (NO FALLBACKS)
        logProgress('');
        logProgress('🏗️  Step 3: Creating Separated Schema Collections...');
        logProgress('   Using ONLY fresh scraped data - no fallback to old data');
        
        const nbaPlayers = createNBAPlayersData(freshData);
        const contracts = createPlayerContractsData(freshData);
        const teamCaps = createTeamCapsData(freshData);
        
        // Step 4: Save to files
        logProgress('');
        logProgress('💾 Step 4: Saving Data...');
        const summary = saveToFiles(nbaPlayers, contracts, evaluations, teamCaps);
        
        // Results with clear success/failure indicators
        logProgress('');
        logProgress('✅ MIGRATION AND STRUCTURING COMPLETE!');
        logProgress('=====================================');
        logProgress(`🏀 NBA Players: ${summary.collections.nba_players} ${summary.collections.nba_players === 0 ? '(FAILED - no fresh NBA data)' : '(SUCCESS)'}`);
        logProgress(`💰 Contracts: ${summary.collections.player_contracts} ${summary.collections.player_contracts === 0 ? '(FAILED - no fresh contract data)' : '(SUCCESS)'}`);
        logProgress(`👤 Evaluations: ${summary.collections.player_evaluations} ${summary.collections.player_evaluations === 0 ? '(none found in Firebase)' : '(SUCCESS)'}`);
        logProgress(`📊 Team Caps: ${summary.collections.team_caps} ${summary.collections.team_caps === 0 ? '(FAILED - no contract data for calculations)' : '(SUCCESS)'}`);
        logProgress(`📁 Files saved to: ${OUTPUT_DIR}`);
        logProgress('');
        
        if (summary.collections.nba_players > 0 && summary.collections.player_contracts > 0) {
            logProgress('🎉 SUCCESS: Fresh data pipeline worked! Ready for Firebase upload.');
            logProgress('📝 Next Step: Run load_to_firebase.js to upload to Firebase');
        } else {
            logProgress('⚠️  PARTIAL/NO SUCCESS: Fresh data scraping failed in restricted environment');
            logProgress('💡 Run local_fresh_data_scraper.js on your LOCAL machine where APIs aren\'t blocked');
        }
        
        return summary;
        
    } catch (error) {
        logProgress(`❌ Error: ${error.message}`);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    migrateAndStructure().catch(error => {
        logProgress(`❌ Fatal error: ${error.message}`);
        process.exit(1);
    });
}

export { migrateAndStructure };