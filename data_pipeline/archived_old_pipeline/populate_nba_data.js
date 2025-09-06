#!/usr/bin/env node
/**
 * NBA Data Population Script  
 * Populates fresh NBA data in the new separated schema
 * Uses scraped/API data - does NOT migrate old data
 */

import { db } from '../src/firebaseConfig.js';
import { collection, writeBatch, doc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

class NBADataPopulator {
  constructor() {
    this.results = {
      playersCreated: 0,
      contractsCreated: 0, 
      teamCapsCreated: 0,
      errors: []
    };
  }

  async populateNBAData() {
    console.log('🏀 NBA DATA POPULATION');
    console.log('======================');
    console.log('📊 Populating fresh NBA data in new separated schema');
    console.log('🔄 Uses scraping/API data - NOT old migrated data');
    console.log();

    try {
      // Load fresh NBA data from resources
      const nbaData = await this.loadFreshNBAData();
      console.log(`✅ Loaded ${nbaData.players?.length || 0} players from fresh data sources`);

      // Populate separated collections with fresh data
      await this.createNBACollections(nbaData);
      
      console.log('\n✅ NBA Data Population Complete!');
      console.log('📊 Results:', this.results);
      
      return this.results;
    } catch (error) {
      console.error('❌ Population failed:', error);
      this.results.errors.push(error.message);
      throw error;
    }
  }

  async loadFreshNBAData() {
    console.log('📂 Loading fresh NBA data from resources...');
    
    // Try to load scraped data first (preferred)
    const scrapedDataSources = [
      'resources/fresh_nba_data.json',
      'resources/players.json',
      'players.json', 
      '../players.json',
      'data/players.json'
    ];

    let nbaData = null;
    
    for (const source of scrapedDataSources) {
      try {
        const fullPath = path.resolve(source);
        if (fs.existsSync(fullPath)) {
          const rawData = fs.readFileSync(fullPath, 'utf8');
          nbaData = JSON.parse(rawData);
          console.log(`✅ Loaded data from: ${source}`);
          
          // Handle different data formats
          if (nbaData.players && nbaData.contracts && nbaData.teamCaps) {
            // Scraped data format
            console.log(`📊 Using fresh scraped data (${nbaData.players.length} players, ${Object.keys(nbaData.contracts).length} contracts)`);
            return nbaData;
          } else if (Array.isArray(nbaData)) {
            // Legacy format
            return {
              players: nbaData,
              contracts: {},
              teamCaps: this.generateTeamCapData()
            };
          } else if (nbaData.players) {
            // Mixed format
            return {
              players: nbaData.players,
              contracts: nbaData.contracts || {},
              teamCaps: nbaData.teamCaps || nbaData.teams || this.generateTeamCapData()
            };
          }
          break;
        }
      } catch (err) {
        console.log(`❌ Could not load from ${source}: ${err.message}`);
      }
    }

    if (!nbaData) {
      // Create sample data structure if no source found
      console.log('⚠️  No data source found, creating sample structure');
      return {
        players: this.createSampleData(),
        contracts: {},
        teamCaps: this.generateTeamCapData()
      };
    }

    // Fallback return
    return {
      players: Array.isArray(nbaData) ? nbaData : nbaData.players || [],
      contracts: nbaData.contracts || {},
      teamCaps: nbaData.teamCaps || nbaData.teams || this.generateTeamCapData()
    };
  }

  createSampleData() {
    // Sample structure to show the new schema
    return [
      {
        id: 'sample_player_1',
        name: 'Sample Player',
        team: 'LAL',
        position: 'PG',
        age: 25,
        is_active_nba: true
      }
    ];
  }

  async createNBACollections(nbaData) {
    console.log('\n🔄 Creating NBA collections with fresh data...');
    
    const playersBatch = writeBatch(db);
    const contractsBatch = writeBatch(db);
    const teamCapsBatch = writeBatch(db);
    
    let playersCount = 0;
    let contractsCount = 0;

    // 1. Create NBA players data (stats, bio, team info)
    for (const player of nbaData.players) {
      const nbaPlayerData = this.createNBAPlayerData(player);
      const playerId = player.id || this.generatePlayerId(player);
      const playersRef = doc(db, 'nba_players', playerId);
      playersBatch.set(playersRef, nbaPlayerData);
      playersCount++;

      // 2. Create contract data from scraped contracts OR player data
      let contractData = null;
      
      // First try from scraped contracts
      if (nbaData.contracts && nbaData.contracts[playerId]) {
        contractData = nbaData.contracts[playerId];
      } else {
        // Fall back to contract data embedded in player data
        contractData = this.extractContractData(player);
      }
      
      if (contractData) {
        const contractsRef = doc(db, 'player_contracts', playerId);
        contractsBatch.set(contractsRef, {
          ...contractData,
          last_updated: new Date().toISOString(),
          source: 'fresh_contract_data'
        });
        contractsCount++;
      }

      // Commit in batches to avoid limits
      if (playersCount % 400 === 0) {
        console.log(`💾 Committing batch at ${playersCount} players...`);
        await playersBatch.commit();
        await contractsBatch.commit();
        // Reset batches
        const newPlayersBatch = writeBatch(db);
        const newContractsBatch = writeBatch(db);
        Object.setPrototypeOf(playersBatch, newPlayersBatch);
        Object.setPrototypeOf(contractsBatch, newContractsBatch);
      }
    }

    // 3. Create team cap data from scraped data OR generated data
    const teamCapData = nbaData.teamCaps || this.generateTeamCapData();
    for (const [teamId, capInfo] of Object.entries(teamCapData)) {
      const teamCapsRef = doc(db, 'team_caps', teamId);
      teamCapsBatch.set(teamCapsRef, {
        ...capInfo,
        last_updated: new Date().toISOString(),
        source: 'fresh_team_cap_data'
      });
    }

    // Commit all final batches
    console.log('💾 Committing final batches...');
    await playersBatch.commit();
    await contractsBatch.commit();
    await teamCapsBatch.commit();

    this.results.playersCreated = playersCount;
    this.results.contractsCreated = contractsCount;
    this.results.teamCapsCreated = Object.keys(teamCapData).length;
    
    console.log(`✅ Created ${playersCount} NBA player records`);
    console.log(`✅ Created ${contractsCount} contract records`);
    console.log(`✅ Created ${this.results.teamCapsCreated} team cap records`);
  }

  createNBAPlayerData(player) {
    // Fresh NBA data only - no user content
    return {
      name: player.name || player.Name,
      team: player.team || player.Team,
      position: player.position || player.Position,
      height: player.height || player.HT,
      weight: player.weight || player.WT,
      age: player.age || player.AGE,
      yearsPro: player.yearsPro || player['Years Pro'],
      is_active_nba: player.is_active_nba !== false,
      
      // Stats (if available)
      MIN: player.MIN,
      PPG: player.PPG,
      RPG: player.RPG,
      APG: player.APG,
      'FG%': player['FG%'],
      '3PT%': player['3PT%'],
      'FT%': player['FT%'],
      'EFG%': player['EFG%'],
      'Games Played': player['Games Played'],
      
      last_updated: new Date().toISOString(),
      source: 'fresh_nba_data_population'
    };
  }

  extractContractData(player) {
    const contractFields = ['contract', 'salary', 'years_remaining', 'aav', 'cap_hit'];
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
      contractData.source = 'fresh_contract_data';
      return contractData;
    }

    return null;
  }

  generateTeamCapData() {
    const nbaTeams = [
      'ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GSW',
      'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NOP', 'NYK',
      'OKC', 'ORL', 'PHI', 'PHX', 'POR', 'SAC', 'SAS', 'TOR', 'UTA', 'WAS'
    ];

    const teamCapData = {};
    nbaTeams.forEach(team => {
      teamCapData[team] = {
        team_id: team,
        total_cap: 0,
        cap_space: 0,
        luxury_tax_space: 0,
        apron_space: 0,
        last_updated: new Date().toISOString(),
        source: 'team_cap_calculation'
      };
    });

    return teamCapData;
  }

  generatePlayerId(player) {
    const name = player.name || player.Name || 'unknown';
    return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  }
}

// Run population if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const populator = new NBADataPopulator();
  populator.populateNBAData()
    .then(results => {
      console.log('\n🎉 NBA data population successful!');
      console.log('\n💡 Next steps:');
      console.log('   1. Update frontend to use new schema exclusively');
      console.log('   2. Test player data loading');
      console.log('   3. Test Trade Machine functionality');
    })
    .catch(error => {
      console.error('💥 Population failed:', error);
      process.exit(1);
    });
}

export default NBADataPopulator;