#!/usr/bin/env node
/**
 * Create Test Collections Script
 * Creates actual Firebase test collections with the new separated schema
 * Uses test_ prefixes to avoid affecting production data
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

class TestCollectionCreator {
  constructor() {
    this.results = {
      playersCreated: 0,
      contractsCreated: 0,
      evaluationsCreated: 0,
      teamCapsCreated: 0,
      errors: []
    };
  }

  async createAllTestCollections() {
    console.log('🏀 Creating Test Firebase Collections');
    console.log('====================================');
    console.log('🔒 Using test_ prefixes - safe for production');
    console.log();

    try {
      // Load existing player data
      const playerData = await this.loadPlayerData();
      
      // Create separated collections
      await this.createTestPlayersCollection(playerData);
      await this.createTestContractsCollection(playerData);
      await this.createTestEvaluationsCollection(playerData);
      await this.createTestTeamCapsCollection(playerData);
      
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
    
    const batch = db.batch();
    let count = 0;
    
    for (const [playerId, player] of Object.entries(playerData)) {
      // Extract only NBA data (no contracts, no user evaluations)
      const playerDoc = {
        Name: player.Name,
        Team: player.Team,
        Position: player.Position,
        HT: player.HT,
        WT: player.WT,
        AGE: player.AGE,
        'Years Pro': player['Years Pro'],
        MIN: player.MIN,
        PPG: player.PPG,
        RPG: player.RPG,
        APG: player.APG,
        'FG%': player['FG%'],
        '3PT%': player['3PT%'],
        'FT%': player['FT%'],
        'EFG%': player['EFG%'],
        'Games Played': player['Games Played'],
        is_active_nba: player.Team !== 'Free Agent', // Mark free agents
        last_updated: new Date().toISOString(),
        source: 'test_data_creation'
      };
      
      const docRef = db.collection('test_players').doc(playerId);
      batch.set(docRef, playerDoc);
      count++;
      
      // Commit batch every 400 documents
      if (count % 400 === 0) {
        await batch.commit();
        console.log(`   📊 Created ${count} player records...`);
      }
    }
    
    // Commit remaining documents
    if (count % 400 !== 0) {
      await batch.commit();
    }
    
    this.results.playersCreated = count;
    console.log(`✅ Created ${count} records in test_players collection`);
  }

  async createTestContractsCollection(playerData) {
    console.log('💰 Creating test_contracts collection (individual contracts)...');
    
    const batch = db.batch();
    let count = 0;
    
    for (const [playerId, player] of Object.entries(playerData)) {
      if (player.Team === 'Free Agent') continue; // Skip free agents
      
      // Parse contract information
      const contractDoc = {
        player_id: playerId,
        player_name: player.Name,
        current_team: player.Team,
        contract_details: player.Contract || 'Unknown',
        free_agent_year: this.parseFreeAgentYear(player['Free Agent']),
        
        // Mock salary data based on contract string
        estimated_salary: this.parseContractSalary(player.Contract),
        
        // Trading information
        tradeable: true,
        trade_eligible_date: new Date().toISOString(),
        
        // Metadata
        last_updated: new Date().toISOString(),
        source: 'test_contract_creation'
      };
      
      const docRef = db.collection('test_contracts').doc(playerId);
      batch.set(docRef, contractDoc);
      count++;
      
      if (count % 400 === 0) {
        await batch.commit();
        console.log(`   📊 Created ${count} contract records...`);
      }
    }
    
    if (count % 400 !== 0) {
      await batch.commit();
    }
    
    this.results.contractsCreated = count;
    console.log(`✅ Created ${count} records in test_contracts collection`);
  }

  async createTestEvaluationsCollection(playerData) {
    console.log('🎯 Creating test_evaluations collection (user grades)...');
    
    const batch = db.batch();
    let count = 0;
    
    // Create sample evaluations for some players
    const gradeOptions = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'F'];
    const roleOptions = ['Superstar', 'Star', 'Starter', 'Role Player', 'Bench Player', 'Deep Bench'];
    
    // Add evaluations for top players (those with high PPG)
    for (const [playerId, player] of Object.entries(playerData)) {
      // Only create evaluations for players with significant stats
      if (!player.PPG || player.PPG < 8) continue;
      
      const evaluationDoc = {
        player_id: playerId,
        player_name: player.Name,
        grade: this.assignGrade(player.PPG, gradeOptions),
        role: this.assignRole(player.PPG, player.MIN, roleOptions),
        notes: `Evaluation for ${player.Name} - ${player.PPG} PPG, ${player.RPG} RPG, ${player.APG} APG`,
        evaluator: 'test_system',
        last_updated: new Date().toISOString(),
        locked: false // Can be modified by user
      };
      
      const docRef = db.collection('test_evaluations').doc(playerId);
      batch.set(docRef, evaluationDoc);
      count++;
      
      if (count % 400 === 0) {
        await batch.commit();
        console.log(`   📊 Created ${count} evaluation records...`);
      }
    }
    
    if (count % 400 !== 0) {
      await batch.commit();
    }
    
    this.results.evaluationsCreated = count;
    console.log(`✅ Created ${count} records in test_evaluations collection`);
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
    
    // Create team cap documents
    const batch = db.batch();
    let count = 0;
    
    for (const [teamName, teamData] of Object.entries(teams)) {
      const salaryCap = 140000000; // 2024-25 salary cap
      const luxuryTax = 170000000;
      
      const teamCapDoc = {
        team_name: teamName,
        team_abbrev: this.getTeamAbbrev(teamName),
        total_salary: teamData.totalSalary,
        roster_count: teamData.rosterCount,
        
        // Cap calculations
        salary_cap: salaryCap,
        cap_space: Math.max(0, salaryCap - teamData.totalSalary),
        luxury_tax_threshold: luxuryTax,
        luxury_tax_amount: Math.max(0, teamData.totalSalary - luxuryTax),
        
        // Mock apron data
        first_apron_space: Math.max(0, 178000000 - teamData.totalSalary),
        second_apron_space: Math.max(0, 188000000 - teamData.totalSalary),
        
        // Metadata
        last_updated: new Date().toISOString(),
        season: '2024-25',
        source: 'test_team_caps_creation'
      };
      
      const teamId = teamName.toLowerCase().replace(/\s+/g, '_');
      const docRef = db.collection('test_team_caps').doc(teamId);
      batch.set(docRef, teamCapDoc);
      count++;
    }
    
    await batch.commit();
    
    this.results.teamCapsCreated = count;
    console.log(`✅ Created ${count} records in test_team_caps collection`);
  }

  // Helper methods
  parseContractSalary(contractString) {
    if (!contractString || contractString === 'Unknown') return 1000000; // Default 1M
    
    // Extract salary from strings like "$6.0M / 1 yr" or "$47.6M / 2 yrs"
    const match = contractString.match(/\$(\d+\.?\d*)M/);
    if (match) {
      return parseFloat(match[1]) * 1000000;
    }
    return 1000000; // Default
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
    console.log('📊 TEST COLLECTIONS SUMMARY');
    console.log('===========================');
    console.log(`✅ test_players created: ${this.results.playersCreated} records`);
    console.log(`✅ test_contracts created: ${this.results.contractsCreated} records`);
    console.log(`✅ test_evaluations created: ${this.results.evaluationsCreated} records`);
    console.log(`✅ test_team_caps created: ${this.results.teamCapsCreated} records`);
    
    if (this.results.errors.length > 0) {
      console.log(`❌ Errors: ${this.results.errors.length}`);
      this.results.errors.forEach(error => console.log(`   - ${error}`));
    }
    
    console.log();
    console.log('🎯 NEXT STEPS FOR TESTING:');
    console.log('==========================');
    console.log('1. 🔥 Check Firebase Console - you should see 4 new test_ collections');
    console.log('2. 🚀 Start dev server: npm run dev');
    console.log('3. 🔧 Update frontend to use test_ collections temporarily');
    console.log('4. 🎮 Test Trade Machine with individual contracts from test_contracts');
    console.log('5. 🏗️ Test Architect tool with separated data structure');
    console.log('6. ✅ When satisfied, switch to production collections');
    
    // Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      collections_created: [
        { name: 'test_players', count: this.results.playersCreated, purpose: 'NBA stats and bio data' },
        { name: 'test_contracts', count: this.results.contractsCreated, purpose: 'Individual player contracts' },
        { name: 'test_evaluations', count: this.results.evaluationsCreated, purpose: 'User grades and roles' },
        { name: 'test_team_caps', count: this.results.teamCapsCreated, purpose: 'Team salary information' }
      ],
      data_separation: {
        nba_data: 'test_players (safe for automation)',
        contracts: 'test_contracts (from team scraping)',
        user_data: 'test_evaluations (never automated)',
        team_info: 'test_team_caps (salary cap management)'
      },
      testing_ready: true,
      errors: this.results.errors
    };
    
    const reportPath = './test_results/test_collections_created.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📋 Detailed report saved: ${reportPath}`);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const creator = new TestCollectionCreator();
  creator.createAllTestCollections().catch(error => {
    console.error('💥 Failed to create test collections:', error);
    process.exit(1);
  });
}

export { TestCollectionCreator };