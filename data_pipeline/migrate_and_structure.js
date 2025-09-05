/**
 * MIGRATE AND STRUCTURE - SEPARATED SCHEMA IMPLEMENTATION
 * ======================================================
 * 
 * This script takes fresh scraped data and your Firebase evaluations
 * and creates the new separated schema architecture.
 * 
 * Usage:
 * 1. Run local_fresh_data_scraper.js on your local machine first
 * 2. Run this script to process the data and create new schema
 * 3. Use load_to_firebase.js to upload to Firebase
 */

const fs = require('fs');
const path = require('path');

// Check for Firebase (optional in this environment)
let admin;
try {
    admin = require('firebase-admin');
    const serviceAccount = require('../serviceAccountKey.json');
    
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    }
} catch (error) {
    console.log('⚠️  Firebase not available - will create JSON files only');
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
 * Load the most recent fresh scrape data
 */
function loadFreshScrapeData() {
    const scrapeDir = path.join(__dirname, 'output', 'fresh_scrape');
    
    if (!fs.existsSync(scrapeDir)) {
        throw new Error('No fresh scrape data found. Run local_fresh_data_scraper.js first.');
    }
    
    const files = fs.readdirSync(scrapeDir)
        .filter(f => f.startsWith('fresh_scrape_') && f.endsWith('.json'))
        .sort()
        .reverse(); // Most recent first
    
    if (files.length === 0) {
        throw new Error('No fresh scrape files found. Run local_fresh_data_scraper.js first.');
    }
    
    const latestFile = path.join(scrapeDir, files[0]);
    logProgress(`📂 Loading fresh data from: ${files[0]}`);
    
    return JSON.parse(fs.readFileSync(latestFile, 'utf8'));
}

/**
 * Migrate user evaluations from Firebase
 */
async function migrateUserEvaluations() {
    if (!admin) {
        logProgress('⚠️  No Firebase connection - using sample evaluation structure');
        return {};
    }
    
    try {
        logProgress('👤 Migrating user evaluations from Firebase...');
        
        const db = admin.firestore();
        const playersSnapshot = await db.collection('players').get();
        
        const evaluations = {};
        let evaluationCount = 0;
        
        playersSnapshot.forEach(doc => {
            const data = doc.data();
            const playerId = doc.id;
            
            // Check for user evaluation fields
            const hasEvaluations = data.grade || data.role || data.notes || data.tier || data.blurb;
            
            if (hasEvaluations) {
                evaluations[playerId] = {
                    player_id: playerId,
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
        
        logProgress(`  ✅ Found ${evaluationCount} player evaluations`);
        return evaluations;
        
    } catch (error) {
        logProgress(`  ❌ Error migrating evaluations: ${error.message}`);
        return {};
    }
}

/**
 * Create NBA Players collection data
 */
function createNBAPlayersData(freshData) {
    logProgress('🏀 Creating NBA Players collection...');
    
    const nbaPlayers = {};
    let playerCount = 0;
    
    // Process NBA stats data
    freshData.nbaStats.forEach(player => {
        const playerId = player.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
        
        nbaPlayers[playerId] = {
            player_id: playerId,
            name: player.name,
            nba_id: player.nba_id,
            team: player.team_abbrev,
            team_name: player.team_name,
            roster_status: player.roster_status,
            years_pro: player.to_year - player.from_year,
            is_active: player.is_active,
            season: '2024-25',
            last_updated: new Date().toISOString(),
            data_source: 'nba_api'
        };
        
        playerCount++;
    });
    
    logProgress(`  ✅ Created ${playerCount} NBA player records`);
    return nbaPlayers;
}

/**
 * Create Player Contracts collection data
 */
function createPlayerContractsData(freshData) {
    logProgress('💰 Creating Player Contracts collection...');
    
    const contracts = {};
    let contractCount = 0;
    
    // Process contract data from team scrapes
    freshData.teamContracts.forEach(teamData => {
        if (teamData.players && teamData.players.length > 0) {
            teamData.players.forEach(player => {
                const playerId = player.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
                
                contracts[playerId] = {
                    player_id: playerId,
                    player_name: player.name,
                    team: player.team,
                    salary: player.salary,
                    salary_display: player.salaryDisplay,
                    contract_years: player.contractYears,
                    season: '2024-25',
                    scraped_from: player.scrapedFrom,
                    last_updated: new Date().toISOString(),
                    data_source: 'spotrac'
                };
                
                contractCount++;
            });
        }
    });
    
    logProgress(`  ✅ Created ${contractCount} contract records`);
    return contracts;
}

/**
 * Create Team Caps collection data
 */
function createTeamCapsData(freshData) {
    logProgress('📊 Creating Team Caps collection...');
    
    const teamCaps = {};
    
    // Process team salary data
    freshData.teamContracts.forEach(teamData => {
        if (teamData.players && teamData.players.length > 0) {
            const totalSalary = teamData.players.reduce((sum, player) => sum + player.salary, 0);
            const playerCount = teamData.players.length;
            
            // NBA salary cap constants (2024-25 season estimates)
            const SALARY_CAP = 140588000; // $140.588M
            const LUXURY_TAX = 170814000; // $170.814M
            const APRON = 178655000; // $178.655M
            
            teamCaps[teamData.team.toLowerCase()] = {
                team: teamData.team,
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
                data_source: 'spotrac_calculated'
            };
        }
    });
    
    logProgress(`  ✅ Created ${Object.keys(teamCaps).length} team cap records`);
    return teamCaps;
}

/**
 * Save data to JSON files
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
    logProgress('🔄 MIGRATE AND STRUCTURE - SEPARATED SCHEMA');
    logProgress('===========================================');
    logProgress('📊 Processing fresh data into new architecture');
    logProgress('');
    
    try {
        // Step 1: Load fresh scrape data
        logProgress('📂 Step 1: Loading Fresh Scrape Data...');
        const freshData = loadFreshScrapeData();
        
        // Step 2: Migrate user evaluations
        logProgress('');
        logProgress('👤 Step 2: Migrating User Evaluations...');
        const evaluations = await migrateUserEvaluations();
        
        // Step 3: Create separated collections
        logProgress('');
        logProgress('🏗️  Step 3: Creating Separated Schema Collections...');
        
        const nbaPlayers = createNBAPlayersData(freshData);
        const contracts = createPlayerContractsData(freshData);
        const teamCaps = createTeamCapsData(freshData);
        
        // Step 4: Save to files
        logProgress('');
        logProgress('💾 Step 4: Saving Data...');
        const summary = saveToFiles(nbaPlayers, contracts, evaluations, teamCaps);
        
        // Results
        logProgress('');
        logProgress('✅ MIGRATION AND STRUCTURING COMPLETE!');
        logProgress('=====================================');
        logProgress(`🏀 NBA Players: ${summary.collections.nba_players}`);
        logProgress(`💰 Contracts: ${summary.collections.player_contracts}`);
        logProgress(`👤 Evaluations: ${summary.collections.player_evaluations}`);
        logProgress(`📊 Team Caps: ${summary.collections.team_caps}`);
        logProgress(`📁 Files saved to: ${OUTPUT_DIR}`);
        logProgress('');
        logProgress('Next Step: Run load_to_firebase.js to upload to Firebase');
        
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

module.exports = { migrateAndStructure };