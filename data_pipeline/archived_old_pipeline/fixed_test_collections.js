#!/usr/bin/env node
/**
 * Fixed Test Collections Script
 * Addresses the WriteBatch commit error by properly managing batch lifecycle
 * Creates actual Firebase test collections with the new separated schema
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import Firebase configuration
let db;
try {
  const { db: firebaseDb } = await import('../scripts/firebaseConfig.node.js');
  db = firebaseDb;
  console.log('✅ Firebase connection established');
} catch (error) {
  console.log('❌ Firebase initialization failed:', error.message);
  console.log('💡 Ensure serviceAccountKey.json is in project root');
  process.exit(1);
}

class FixedTestCollectionCreator {
  constructor() {
    this.BATCH_SIZE = 400; // Firebase batch limit is 500, use 400 for safety
    this.results = {
      playersCreated: 0,
      contractsCreated: 0,
      evaluationsCreated: 0,
      teamCapsCreated: 0,
      errors: []
    };
  }

  /**
   * Helper function to manage batch operations properly
   * Creates new batch when needed and handles commits
   */
  async writeBatchDocuments(collectionName, documents, logMessage) {
    let batch = db.batch();
    let count = 0;
    let totalCount = 0;

    console.log(`📝 Writing ${documents.length} documents to ${collectionName}...`);

    for (const { docId, docData } of documents) {
      const docRef = db.collection(collectionName).doc(docId);
      batch.set(docRef, docData);
      count++;
      totalCount++;

      // Commit batch every BATCH_SIZE documents
      if (count >= this.BATCH_SIZE) {
        await batch.commit();
        console.log(`   📊 ${logMessage} ${totalCount} records...`);
        
        // Create new batch for remaining documents
        batch = db.batch();
        count = 0;
      }
    }

    // Commit any remaining documents
    if (count > 0) {
      await batch.commit();
    }

    console.log(`✅ Created ${totalCount} records in ${collectionName} collection`);
    return totalCount;
  }

  async createAllTestCollections() {
    console.log('🏀 FIXED Test Firebase Collections Creator');
    console.log('==========================================');
    console.log('🔒 Using test_ prefixes - safe for production');
    console.log('🔧 Fixed WriteBatch commit error');
    console.log();

    try {
      // Load existing player data
      const playerData = await this.loadPlayerData();
      
      // Create separated collections with fixed batch handling
      this.results.playersCreated = await this.createTestPlayersCollection(playerData);
      this.results.contractsCreated = await this.createTestContractsCollection(playerData);
      this.results.evaluationsCreated = await this.createTestEvaluationsCollection(playerData);
      this.results.teamCapsCreated = await this.createTestTeamCapsCollection(playerData);
      
      // Generate summary report
      await this.generateSummaryReport();
      
      console.log('🎉 Test collections created successfully!');
      console.log('📍 Check Firebase Console to see new test_ collections');
      
    } catch (error) {
      console.error('❌ Error creating test collections:', error.message);
      throw error;
    }
  }

  async loadPlayerData() {
    console.log('📂 Loading existing player data...');
    
    const playerDataPath = path.join(__dirname, '../public/players.json');
    
    if (!fs.existsSync(playerDataPath)) {
      throw new Error('Player data not found at ../public/players.json');
    }
    
    const data = JSON.parse(fs.readFileSync(playerDataPath, 'utf8'));
    console.log(`✅ Loaded ${Object.keys(data).length} players from players.json`);
    
    return data;
  }

  async createTestPlayersCollection(playerData) {
    console.log('👥 Creating test_players collection (NBA data only)...');
    
    const documents = [];
    
    for (const [playerId, player] of Object.entries(playerData)) {
      // Extract only NBA data (no contracts, no user evaluations)
      const playerDoc = {
        Name: player.Name || 'Unknown',
        Team: player.Team || 'Free Agent',
        Position: player.Position || 'Unknown',
        HT: player.HT || 'Unknown',
        WT: player.WT || 'Unknown',
        AGE: player.AGE || 0,
        'Years Pro': player['Years Pro'] || 0,
        is_active_nba: player.Team !== 'Free Agent' && player.Team !== undefined,
        last_updated: new Date().toISOString(),
        source: 'fixed_test_data_creation'
      };

      // Only add statistical fields if they exist and are not undefined
      if (player.MIN !== undefined && player.MIN !== null) playerDoc.MIN = player.MIN;
      if (player.PPG !== undefined && player.PPG !== null) playerDoc.PPG = player.PPG;
      if (player.RPG !== undefined && player.RPG !== null) playerDoc.RPG = player.RPG;
      if (player.APG !== undefined && player.APG !== null) playerDoc.APG = player.APG;
      if (player['FG%'] !== undefined && player['FG%'] !== null) playerDoc['FG%'] = player['FG%'];
      if (player['3PT%'] !== undefined && player['3PT%'] !== null) playerDoc['3PT%'] = player['3PT%'];
      if (player['FT%'] !== undefined && player['FT%'] !== null) playerDoc['FT%'] = player['FT%'];
      if (player['EFG%'] !== undefined && player['EFG%'] !== null) playerDoc['EFG%'] = player['EFG%'];
      if (player['Games Played'] !== undefined && player['Games Played'] !== null) playerDoc['Games Played'] = player['Games Played'];
      
      documents.push({ docId: playerId, docData: playerDoc });
    }
    
    return await this.writeBatchDocuments('test_players', documents, 'Created');
  }

  async createTestContractsCollection(playerData) {
    console.log('💰 Creating test_contracts collection (individual contracts)...');
    
    const documents = [];
    
    for (const [playerId, player] of Object.entries(playerData)) {
      if (player.Team === 'Free Agent') continue; // Skip free agents
      
      const contractDoc = {
        player_id: playerId,
        player_name: player.Name,
        current_team: player.Team,
        contract_details: player.Contract || 'Unknown',
        free_agent_year: this.parseFreeAgentYear(player['Free Agent']),
        estimated_salary: this.parseContractSalary(player.Contract),
        tradeable: true,
        trade_eligible_date: new Date().toISOString(),
        last_updated: new Date().toISOString(),
        source: 'fixed_test_contract_creation'
      };
      
      documents.push({ docId: playerId, docData: contractDoc });
    }
    
    return await this.writeBatchDocuments('test_contracts', documents, 'Created');
  }

  async createTestEvaluationsCollection(playerData) {
    console.log('🎯 Creating test_evaluations collection (user grades)...');
    
    const documents = [];
    const gradeOptions = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'F'];
    const roleOptions = ['Superstar', 'Star', 'Starter', 'Role Player', 'Bench Player', 'Deep Bench'];
    
    for (const [playerId, player] of Object.entries(playerData)) {
      // Only create evaluations for players with statistical data
      if (!player.PPG || player.PPG === undefined || player.PPG < 5) continue;
      
      const evaluationDoc = {
        player_id: playerId,
        player_name: player.Name || 'Unknown',
        grade: this.assignGrade(player.PPG, gradeOptions),
        role: this.assignRole(player.PPG, player.MIN || 0, roleOptions),
        notes: `Evaluation for ${player.Name || 'Unknown'} - ${player.PPG || 0} PPG, ${player.RPG || 0} RPG, ${player.APG || 0} APG`,
        evaluator: 'fixed_test_system',
        last_updated: new Date().toISOString(),
        locked: false
      };
      
      documents.push({ docId: playerId, docData: evaluationDoc });
    }
    
    return await this.writeBatchDocuments('test_evaluations', documents, 'Created');
  }

  async createTestTeamCapsCollection(playerData) {
    console.log('🏀 Creating test_team_caps collection (team salary info)...');
    
    // Group players by team and calculate totals
    const teams = {};
    
    for (const player of Object.values(playerData)) {
      if (player.Team === 'Free Agent' || !player.Team) continue;
      
      if (!teams[player.Team]) {
        teams[player.Team] = {
          players: [],
          totalSalary: 0,
          rosterCount: 0
        };
      }
      
      teams[player.Team].players.push(player);
      teams[player.Team].totalSalary += this.parseContractSalary(player.Contract);
      teams[player.Team].rosterCount++;
    }
    
    const documents = [];
    const salaryCap = 140000000; // 2024-25 salary cap
    const luxuryTax = 170000000;
    
    for (const [teamName, teamData] of Object.entries(teams)) {
      const teamCapDoc = {
        team_name: teamName,
        team_abbrev: this.getTeamAbbrev(teamName),
        total_salary: teamData.totalSalary,
        roster_count: teamData.rosterCount,
        salary_cap: salaryCap,
        cap_space: Math.max(0, salaryCap - teamData.totalSalary),
        luxury_tax_threshold: luxuryTax,
        luxury_tax_amount: Math.max(0, teamData.totalSalary - luxuryTax),
        first_apron_space: Math.max(0, 178000000 - teamData.totalSalary),
        second_apron_space: Math.max(0, 188000000 - teamData.totalSalary),
        last_updated: new Date().toISOString(),
        season: '2024-25',
        source: 'fixed_test_team_caps_creation'
      };
      
      const teamId = teamName.toLowerCase().replace(/\s+/g, '_');
      documents.push({ docId: teamId, docData: teamCapDoc });
    }
    
    return await this.writeBatchDocuments('test_team_caps', documents, 'Created');
  }

  // Helper methods
  parseContractSalary(contractString) {
    if (!contractString || contractString === 'Unknown') return 1000000;
    const match = contractString.match(/\$(\d+\.?\d*)M/);
    if (match) {
      return parseFloat(match[1]) * 1000000;
    }
    return 1000000;
  }

  parseFreeAgentYear(freeAgentString) {
    if (!freeAgentString) return 2025;
    const match = freeAgentString.match(/(\d{4})/);
    return match ? parseInt(match[1]) : 2025;
  }

  assignGrade(ppg, gradeOptions) {
    if (ppg >= 25) return 'A+';
    if (ppg >= 20) return 'A';
    if (ppg >= 15) return 'B+';
    if (ppg >= 10) return 'B';
    if (ppg >= 8) return 'C+';
    return 'C';
  }

  assignRole(ppg, minutes, roleOptions) {
    if (ppg >= 25 && minutes >= 32) return 'Superstar';
    if (ppg >= 18 && minutes >= 28) return 'Star';
    if (minutes >= 20) return 'Starter';
    if (minutes >= 15) return 'Role Player';
    return 'Bench Player';
  }

  getTeamAbbrev(teamName) {
    const abbrevMap = {
      'Lakers': 'LAL', 'Celtics': 'BOS', 'Warriors': 'GSW', 'Heat': 'MIA',
      'Knicks': 'NYK', 'Bulls': 'CHI', 'Mavericks': 'DAL', 'Nuggets': 'DEN',
      'Suns': 'PHX', 'Hawks': 'ATL', 'Nets': 'BRK', 'Hornets': 'CHA',
      'Cavaliers': 'CLE', 'Pistons': 'DET', 'Rockets': 'HOU', 'Pacers': 'IND',
      'Clippers': 'LAC', 'Grizzlies': 'MEM', 'Bucks': 'MIL', 'Timberwolves': 'MIN',
      'Pelicans': 'NOP', 'Thunder': 'OKC', 'Magic': 'ORL', '76ers': 'PHI',
      'Trail Blazers': 'POR', 'Kings': 'SAC', 'Spurs': 'SAS', 'Raptors': 'TOR',
      'Jazz': 'UTA', 'Wizards': 'WAS'
    };
    
    for (const [fullName, abbrev] of Object.entries(abbrevMap)) {
      if (teamName.includes(fullName)) return abbrev;
    }
    return teamName.slice(0, 3).toUpperCase();
  }

  async generateSummaryReport() {
    console.log();
    console.log('📊 FIXED TEST COLLECTIONS SUMMARY');
    console.log('==================================');
    console.log(`✅ test_players created: ${this.results.playersCreated} records`);
    console.log(`✅ test_contracts created: ${this.results.contractsCreated} records`);
    console.log(`✅ test_evaluations created: ${this.results.evaluationsCreated} records`);
    console.log(`✅ test_team_caps created: ${this.results.teamCapsCreated} records`);
    
    if (this.results.errors.length > 0) {
      console.log(`❌ Errors: ${this.results.errors.length}`);
      this.results.errors.forEach(error => console.log(`   - ${error}`));
    } else {
      console.log('✅ No errors encountered!');
    }
    
    console.log();
    console.log('🎯 NEXT STEPS FOR TESTING:');
    console.log('==========================');
    console.log('1. 🔥 Check Firebase Console - you should see 4 new test_ collections');
    console.log('2. 🚀 Start dev server: npm run dev');
    console.log('3. 🎮 Test Trade Machine with individual contracts from test_contracts');
    console.log('4. 🏗️ Test Architect tool with separated data structure');
    console.log('5. ✅ WriteBatch error has been fixed!');
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🔧 FIXED VERSION - WriteBatch Error Resolved');
  console.log('==============================================');
  
  const creator = new FixedTestCollectionCreator();
  creator.createAllTestCollections().catch(error => {
    console.error('💥 Failed to create test collections:', error);
    process.exit(1);
  });
}

export { FixedTestCollectionCreator };