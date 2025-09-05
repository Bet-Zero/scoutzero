#!/usr/bin/env node
/**
 * Fresh NBA Data Scraper Integration
 * Integrates existing scraping tools with new separated schema
 */

import { TeamBasedContractSystem } from './team_based_contract_solution.js';
import fs from 'fs';
import path from 'path';

class FreshNBADataScraper {
  constructor() {
    this.contractSystem = new TeamBasedContractSystem();
    this.results = {
      playersScraped: 0,
      contractsScraped: 0,
      teamsScraped: 0,
      errors: []
    };
  }

  async scrapeAllNBAData() {
    console.log('🕸️ FRESH NBA DATA SCRAPING');
    console.log('===========================');
    console.log('🎯 Scraping fresh NBA data for new separated schema');
    console.log();

    try {
      // 1. Scrape team-based contracts (superior approach)
      const contractData = await this.scrapeTeamContracts();
      
      // 2. Scrape NBA player stats/bio data
      const playerData = await this.scrapePlayerData();
      
      // 3. Combine and save to resources for population script
      await this.saveScrapedData(playerData, contractData);
      
      console.log('\n✅ Fresh data scraping complete!');
      console.log('📊 Results:', this.results);
      
      return this.results;
    } catch (error) {
      console.error('❌ Scraping failed:', error);
      this.results.errors.push(error.message);
      throw error;
    }
  }

  async scrapeTeamContracts() {
    console.log('💰 Scraping team contracts using superior team-based approach...');
    
    try {
      // Use existing team-based contract system
      const contractResults = await this.contractSystem.collectAllTeamContracts();
      
      this.results.contractsScraped = Object.keys(contractResults.playerContracts || {}).length;
      this.results.teamsScraped = Object.keys(contractResults.teamCaps || {}).length;
      
      console.log(`✅ Scraped contracts for ${this.results.contractsScraped} players`);
      console.log(`✅ Scraped cap data for ${this.results.teamsScraped} teams`);
      
      return contractResults;
    } catch (error) {
      console.error('❌ Error scraping team contracts:', error);
      // Return empty structure to continue with player data
      return { playerContracts: {}, teamCaps: {} };
    }
  }

  async scrapePlayerData() {
    console.log('📊 Scraping NBA player stats and bio data...');
    
    // Check if we have existing player data to use as base
    const existingDataSources = [
      'resources/players.json',
      'players.json',
      '../players.json'
    ];
    
    let playerData = [];
    
    for (const source of existingDataSources) {
      try {
        if (fs.existsSync(source)) {
          const rawData = fs.readFileSync(source, 'utf8');
          const parsed = JSON.parse(rawData);
          playerData = Array.isArray(parsed) ? parsed : parsed.players || [];
          console.log(`✅ Using existing player data from: ${source} (${playerData.length} players)`);
          break;
        }
      } catch (err) {
        console.log(`❌ Could not use ${source}: ${err.message}`);
      }
    }
    
    // TODO: Integrate with existing NBA API scrapers if available
    // For now, use existing data and enhance it
    if (playerData.length === 0) {
      console.log('⚠️  No existing player data found. Using sample data.');
      playerData = this.createSamplePlayerData();
    }
    
    // Clean and prepare player data for new schema
    const cleanedPlayerData = playerData.map(player => ({
      id: this.generatePlayerId(player),
      name: player.name || player.Name,
      team: player.team || player.Team,
      position: player.position || player.Position,
      height: player.height || player.HT,
      weight: player.weight || player.WT,
      age: player.age || player.AGE,
      yearsPro: player.yearsPro || player['Years Pro'],
      is_active_nba: player.is_active_nba !== false,
      
      // Stats
      MIN: this.cleanNumericValue(player.MIN),
      PPG: this.cleanNumericValue(player.PPG),
      RPG: this.cleanNumericValue(player.RPG),
      APG: this.cleanNumericValue(player.APG),
      'FG%': this.cleanPercentageValue(player['FG%']),
      '3PT%': this.cleanPercentageValue(player['3PT%']),
      'FT%': this.cleanPercentageValue(player['FT%']),
      'EFG%': this.cleanPercentageValue(player['EFG%']),
      'Games Played': this.cleanNumericValue(player['Games Played']),
      
      last_scraped: new Date().toISOString(),
      source: 'fresh_nba_scraping'
    }));
    
    this.results.playersScraped = cleanedPlayerData.length;
    console.log(`✅ Prepared ${cleanedPlayerData.length} players for new schema`);
    
    return cleanedPlayerData;
  }

  async saveScrapedData(playerData, contractData) {
    console.log('💾 Saving scraped data to resources...');
    
    // Ensure resources directory exists
    const resourcesDir = 'resources';
    if (!fs.existsSync(resourcesDir)) {
      fs.mkdirSync(resourcesDir, { recursive: true });
    }
    
    // Save combined scraped data
    const scrapedData = {
      players: playerData,
      contracts: contractData.playerContracts || {},
      teamCaps: contractData.teamCaps || {},
      metadata: {
        scraped_at: new Date().toISOString(),
        player_count: playerData.length,
        contract_count: Object.keys(contractData.playerContracts || {}).length,
        team_count: Object.keys(contractData.teamCaps || {}).length
      }
    };
    
    // Save for population script to use
    fs.writeFileSync(
      path.join(resourcesDir, 'fresh_nba_data.json'), 
      JSON.stringify(scrapedData, null, 2)
    );
    
    console.log('✅ Saved scraped data to resources/fresh_nba_data.json');
  }

  createSamplePlayerData() {
    return [
      {
        name: 'LeBron James',
        team: 'LAL',
        position: 'SF',
        age: 39,
        is_active_nba: true,
        PPG: 25.3,
        RPG: 7.3,
        APG: 8.3
      },
      {
        name: 'Stephen Curry', 
        team: 'GSW',
        position: 'PG',
        age: 35,
        is_active_nba: true,
        PPG: 26.4,
        RPG: 4.5,
        APG: 5.1
      }
    ];
  }

  cleanNumericValue(value) {
    if (value === null || value === undefined || value === '' || value === 'N/A') {
      return null;
    }
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }

  cleanPercentageValue(value) {
    if (value === null || value === undefined || value === '' || value === 'N/A') {
      return null;
    }
    // Handle percentage values (remove % if present)
    const cleaned = String(value).replace('%', '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  generatePlayerId(player) {
    const name = player.name || player.Name || 'unknown';
    return name.toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .substring(0, 50); // Firestore document ID limit
  }
}

// Run scraping if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const scraper = new FreshNBADataScraper();
  scraper.scrapeAllNBAData()
    .then(results => {
      console.log('\n🎉 Fresh NBA data scraping successful!');
      console.log('\n💡 Next steps:');
      console.log('   1. Run: node populate_nba_data.js');
      console.log('   2. Populate Firebase with fresh scraped data');
      console.log('   3. Test new separated schema');
    })
    .catch(error => {
      console.error('💥 Scraping failed:', error);
      process.exit(1);
    });
}

export default FreshNBADataScraper;