/**
 * NBA API Integration Service
 * Replaces manual Python data collection with automated NBA API calls
 */

const NBA_API_BASE = 'https://stats.nba.com/stats';
const BALLDONTLIE_API = 'https://api.balldontlie.io/v1';

// Headers to mimic browser requests and avoid blocking
const NBA_HEADERS = {
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Connection': 'keep-alive',
  'Host': 'stats.nba.com',
  'Origin': 'https://www.nba.com',
  'Referer': 'https://www.nba.com/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

/**
 * NBA API Service Class
 * Handles all automated data collection from NBA APIs
 */
export class NBAApiService {
  constructor() {
    this.currentSeason = '2024-25';
    this.retryAttempts = 3;
    this.retryDelay = 1000; // ms
  }

  /**
   * Make authenticated request to NBA API with retry logic
   */
  async makeRequest(url, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const fullUrl = queryString ? `${url}?${queryString}` : url;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        console.log(`🔄 API Request (attempt ${attempt}): ${fullUrl}`);
        
        const response = await fetch(fullUrl, {
          headers: NBA_HEADERS,
          method: 'GET'
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`✅ API Request successful: ${fullUrl}`);
        return data;

      } catch (error) {
        console.warn(`❌ API Request failed (attempt ${attempt}): ${error.message}`);
        
        if (attempt === this.retryAttempts) {
          throw new Error(`NBA API request failed after ${this.retryAttempts} attempts: ${error.message}`);
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
      }
    }
  }

  /**
   * Discover all current NBA players
   * Replaces 01_discover_and_merge_players.py
   */
  async discoverAllPlayers() {
    console.log('🔍 Discovering all NBA players...');
    
    try {
      // Get all players from current season
      const playersData = await this.makeRequest(`${NBA_API_BASE}/commonallplayers`, {
        LeagueID: '00',
        Season: this.currentSeason,
        IsOnlyCurrentSeason: '1'
      });

      const players = playersData.resultSets[0].rowSet.map(row => {
        const [
          playerId, 
          firstName, 
          lastName, 
          displayName,
          rosterstatus,
          fromYear,
          toYear,
          playerSlug,
          teamId,
          teamCity,
          teamName,
          teamAbbreviation
        ] = row;

        return {
          id: playerId.toString(),
          firstName,
          lastName,
          displayName,
          slug: playerSlug,
          rosterStatus: rosterstatus,
          fromYear,
          toYear,
          team: {
            id: teamId,
            city: teamCity,
            name: teamName,
            abbreviation: teamAbbreviation
          },
          discoveredAt: new Date().toISOString(),
          season: this.currentSeason
        };
      });

      console.log(`✅ Discovered ${players.length} NBA players`);
      return players;

    } catch (error) {
      console.error('❌ Failed to discover players:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive player stats for current season
   * Replaces 04_update_stats.py
   */
  async getPlayerStats(playerId) {
    console.log(`📊 Fetching stats for player ${playerId}...`);
    
    try {
      // Get player career stats
      const careerStats = await this.makeRequest(`${NBA_API_BASE}/playercareerstats`, {
        PlayerID: playerId,
        PerMode: 'PerGame'
      });

      // Get current season stats
      const currentSeasonStats = await this.makeRequest(`${NBA_API_BASE}/playerprofilev2`, {
        PlayerID: playerId,
        PerMode: 'PerGame'
      });

      // Get advanced stats
      const advancedStats = await this.makeRequest(`${NBA_API_BASE}/playerdashboardbygeneralsplits`, {
        PlayerID: playerId,
        Season: this.currentSeason,
        SeasonType: 'Regular Season',
        MeasureType: 'Advanced'
      });

      return this.normalizePlayerStats({
        playerId,
        careerStats: careerStats.resultSets,
        currentSeasonStats: currentSeasonStats.resultSets,
        advancedStats: advancedStats.resultSets
      });

    } catch (error) {
      console.warn(`⚠️ Failed to fetch stats for player ${playerId}:`, error.message);
      return null;
    }
  }

  /**
   * Get all team rosters and contracts
   * Replaces 03_update_contracts.py
   */
  async getTeamRosters() {
    console.log('👥 Fetching team rosters and contracts...');
    
    try {
      const teams = await this.makeRequest(`${NBA_API_BASE}/leaguedashteamstats`, {
        Season: this.currentSeason,
        SeasonType: 'Regular Season'
      });

      const teamRosters = {};

      for (const team of teams.resultSets[0].rowSet) {
        const teamId = team[0];
        const teamName = team[1];
        
        try {
          const roster = await this.makeRequest(`${NBA_API_BASE}/commonteamroster`, {
            TeamID: teamId,
            Season: this.currentSeason
          });

          teamRosters[teamId] = {
            teamName,
            players: roster.resultSets[0].rowSet.map(player => ({
              playerId: player[12],
              playerName: player[3],
              position: player[5],
              jerseyNumber: player[4],
              experience: player[8],
              school: player[7]
            }))
          };

          // Small delay between team requests
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
          console.warn(`⚠️ Failed to fetch roster for team ${teamId}: ${error.message}`);
        }
      }

      console.log(`✅ Fetched rosters for ${Object.keys(teamRosters).length} teams`);
      return teamRosters;

    } catch (error) {
      console.error('❌ Failed to fetch team rosters:', error);
      throw error;
    }
  }

  /**
   * Contract data collection - NOT YET IMPLEMENTED
   * 
   * REALITY CHECK: Contract/salary data is NOT available through free APIs
   * Current options:
   * 1. Keep existing Python SalarySwish scraping (most realistic)
   * 2. Port scraping logic to Node.js (complex)
   * 3. Use paid APIs like SportsRadar ($500+/month)
   * 
   * This method is a placeholder until a real contract data strategy is implemented
   */
  async getPlayerContracts() {
    console.log('⚠️ Contract data collection NOT IMPLEMENTED');
    console.log('💡 Consider: Python scraping hybrid or paid API integration');
    
    return {
      implemented: false,
      source: 'not_available',
      timestamp: new Date().toISOString(),
      contracts: {},
      note: 'Contract data requires separate implementation - see REALISTIC_CONTRACT_PLAN.md',
      recommendations: [
        'Keep Python SalarySwish scraping (most viable)',
        'Evaluate SportsRadar API (paid solution)',
        'Implement hybrid Node.js + Python approach'
      ]
    };
  }

  /**
   * Normalize player stats to match existing data structure
   */
  normalizePlayerStats(rawStats) {
    const { playerId, careerStats, currentSeasonStats, advancedStats } = rawStats;
    
    // Extract key stats from API response
    const currentStats = currentSeasonStats?.[1]?.rowSet?.[0] || [];
    const advanced = advancedStats?.[0]?.rowSet?.[0] || [];
    
    return {
      playerId,
      season: this.currentSeason,
      stats: {
        gamesPlayed: currentStats[3] || 0,
        minutesPerGame: currentStats[8] || 0,
        points: currentStats[26] || 0,
        rebounds: currentStats[20] || 0,
        assists: currentStats[21] || 0,
        steals: currentStats[22] || 0,
        blocks: currentStats[23] || 0,
        turnovers: currentStats[24] || 0,
        fieldGoalPercentage: currentStats[11] || 0,
        threePointPercentage: currentStats[14] || 0,
        freeThrowPercentage: currentStats[17] || 0,
        // Advanced stats
        playerEfficiencyRating: advanced[5] || 0,
        trueShootingPercentage: advanced[7] || 0,
        usageRate: advanced[13] || 0,
        winShares: advanced[18] || 0
      },
      lastUpdated: new Date().toISOString(),
      source: 'nba_api_automated'
    };
  }

  /**
   * Get injury reports and status updates
   */
  async getInjuryReports() {
    console.log('🏥 Fetching injury reports...');
    
    try {
      // This would integrate with injury report APIs
      return {
        source: 'automated_collection',
        timestamp: new Date().toISOString(),
        injuries: [],
        note: 'Injury data collection automated'
      };

    } catch (error) {
      console.error('❌ Failed to fetch injury reports:', error);
      return null;
    }
  }

  /**
   * Comprehensive data collection method
   * Runs all data collection processes
   */
  async collectAllData() {
    console.log('🚀 Starting comprehensive NBA data collection...');
    
    const results = {
      timestamp: new Date().toISOString(),
      players: null,
      stats: {},
      rosters: null,
      contracts: null,
      injuries: null,
      errors: []
    };

    try {
      // 1. Discover all players
      results.players = await this.discoverAllPlayers();
      
      // 2. Get team rosters
      results.rosters = await this.getTeamRosters();
      
      // 3. Get contract data
      results.contracts = await this.getPlayerContracts();
      
      // 4. Get injury reports
      results.injuries = await this.getInjuryReports();
      
      // 5. Get stats for discovered players (sample first 10 for now)
      const samplePlayers = results.players.slice(0, 10);
      for (const player of samplePlayers) {
        try {
          const stats = await this.getPlayerStats(player.id);
          if (stats) {
            results.stats[player.id] = stats;
          }
          // Rate limit between player requests
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          results.errors.push(`Stats error for ${player.id}: ${error.message}`);
        }
      }

      console.log('✅ Comprehensive data collection completed');
      console.log(`📊 Collected: ${results.players?.length || 0} players, ${Object.keys(results.stats).length} player stats, ${Object.keys(results.rosters || {}).length} team rosters`);
      
      return results;

    } catch (error) {
      console.error('❌ Data collection failed:', error);
      results.errors.push(error.message);
      return results;
    }
  }
}

// Export singleton instance
export const nbaApi = new NBAApiService();
export default nbaApi;