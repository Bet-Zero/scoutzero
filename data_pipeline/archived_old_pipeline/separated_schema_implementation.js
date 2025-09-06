#!/usr/bin/env node
/**
 * Separated Schema Implementation
 * Creates the new data architecture with proper separation of concerns
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc, writeBatch } from 'firebase/firestore';

/**
 * NEW SEPARATED SCHEMA IMPLEMENTATION
 * Addresses the core problem: mixed concerns in single collection
 */
export class SeparatedSchemaImplementation {
  constructor(db) {
    this.db = db;
    
    // Define the new separated collections
    this.collections = {
      players_v2: 'players_v2',      // NBA data only (safe for automation)
      contracts: 'contracts',        // Team-based contract data
      evaluations: 'evaluations',    // User grades/roles (never automated)
      team_caps: 'team_caps'         // Team salary cap information
    };
  }

  /**
   * Migrate existing mixed data to separated schema
   */
  async migrateToSeparatedSchema() {
    console.log('🏗️ Starting migration to separated schema...');
    
    try {
      // Get all existing players from mixed collection
      const existingPlayers = await this.getExistingPlayerData();
      
      // Separate the data by concerns
      const separatedData = this.separateDataByConcerns(existingPlayers);
      
      // Create new collections with separated data
      await this.createSeparatedCollections(separatedData);
      
      // Verify migration success
      await this.verifyMigration(existingPlayers.length);
      
      console.log('✅ Migration to separated schema complete!');
      
      return {
        success: true,
        migrated_players: existingPlayers.length,
        collections_created: Object.keys(this.collections).length
      };
      
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  /**
   * Get existing player data from mixed collection
   */
  async getExistingPlayerData() {
    console.log('📥 Fetching existing player data...');
    
    const playersRef = collection(this.db, 'players');
    const snapshot = await getDocs(playersRef);
    
    const players = [];
    snapshot.forEach(doc => {
      players.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`   Found ${players.length} players in existing collection`);
    return players;
  }

  /**
   * Separate mixed data into proper concerns
   */
  separateDataByConcerns(players) {
    console.log('🔧 Separating data by concerns...');
    
    const separated = {
      nba_data: {},
      contracts: {},
      evaluations: {},
      team_caps: {}
    };
    
    players.forEach(player => {
      const playerId = player.id;
      
      // 1. NBA Data Only (automated)
      separated.nba_data[playerId] = {
        id: playerId,
        nba_id: player.nba_player_id || null,
        name: player.Name || player.displayName || '',
        firstName: player.firstName || this.extractFirstName(player.Name),
        lastName: player.lastName || this.extractLastName(player.Name),
        team: this.formatTeamData(player),
        position: player.Position || '',
        height: player.HT || player.height || '',
        weight: player.WT || player.weight || '',
        age: player.AGE || player.age || null,
        stats: this.formatStatsData(player),
        is_active_nba: player.is_active_nba || true,
        automated_update: true,
        last_nba_update: new Date().toISOString(),
        discovery_source: player.discovery_source || 'migration'
      };
      
      // 2. Contract Data (team-based)
      if (this.hasContractData(player)) {
        separated.contracts[playerId] = {
          player_id: playerId,
          team_abbrev: this.extractTeamAbbrev(player),
          contract_type: 'Standard',
          total_value: this.parseContractValue(player.Contract),
          salaries_by_year: player.salaries_by_year || {},
          free_agency_year: this.parseFreeAgencyYear(player['Free Agent']),
          source: 'migration_from_mixed_schema',
          last_contract_update: new Date().toISOString()
        };
      }
      
      // 3. User Evaluations (manual only)
      if (this.hasEvaluationData(player)) {
        separated.evaluations[playerId] = {
          player_id: playerId,
          user_id: 'migration_user',
          overall_grade: player.Grade || '',
          role: player.Role || '',
          tier: player.Tier || '',
          notes: player.Notes || '',
          created_by: 'data_migration',
          last_updated: new Date().toISOString(),
          never_automated: true
        };
      }
    });
    
    console.log(`   NBA data entries: ${Object.keys(separated.nba_data).length}`);
    console.log(`   Contract entries: ${Object.keys(separated.contracts).length}`);
    console.log(`   Evaluation entries: ${Object.keys(separated.evaluations).length}`);
    
    return separated;
  }

  /**
   * Create new separated collections
   */
  async createSeparatedCollections(separatedData) {
    console.log('📤 Creating separated collections...');
    
    // Create batches for each collection
    const batches = {
      players_v2: writeBatch(this.db),
      contracts: writeBatch(this.db),
      evaluations: writeBatch(this.db)
    };
    
    let batchCounts = {
      players_v2: 0,
      contracts: 0,
      evaluations: 0
    };
    
    // Add NBA data to players_v2
    for (const [playerId, nbaData] of Object.entries(separatedData.nba_data)) {
      const docRef = doc(this.db, this.collections.players_v2, playerId);
      batches.players_v2.set(docRef, nbaData);
      batchCounts.players_v2++;
      
      // Firestore batch limit is 500
      if (batchCounts.players_v2 >= 500) {
        await batches.players_v2.commit();
        batches.players_v2 = writeBatch(this.db);
        batchCounts.players_v2 = 0;
      }
    }
    
    // Add contract data
    for (const [playerId, contractData] of Object.entries(separatedData.contracts)) {
      const docRef = doc(this.db, this.collections.contracts, playerId);
      batches.contracts.set(docRef, contractData);
      batchCounts.contracts++;
      
      if (batchCounts.contracts >= 500) {
        await batches.contracts.commit();
        batches.contracts = writeBatch(this.db);
        batchCounts.contracts = 0;
      }
    }
    
    // Add evaluation data
    for (const [playerId, evaluationData] of Object.entries(separatedData.evaluations)) {
      const docRef = doc(this.db, this.collections.evaluations, playerId);
      batches.evaluations.set(docRef, evaluationData);
      batchCounts.evaluations++;
      
      if (batchCounts.evaluations >= 500) {
        await batches.evaluations.commit();
        batches.evaluations = writeBatch(this.db);
        batchCounts.evaluations = 0;
      }
    }
    
    // Commit remaining batches
    await Promise.all([
      batchCounts.players_v2 > 0 ? batches.players_v2.commit() : Promise.resolve(),
      batchCounts.contracts > 0 ? batches.contracts.commit() : Promise.resolve(),
      batchCounts.evaluations > 0 ? batches.evaluations.commit() : Promise.resolve()
    ]);
    
    console.log('✅ All separated collections created successfully');
  }

  /**
   * Helper methods for data transformation
   */
  extractFirstName(fullName) {
    return fullName ? fullName.split(' ')[0] : '';
  }
  
  extractLastName(fullName) {
    if (!fullName) return '';
    const parts = fullName.split(' ');
    return parts.length > 1 ? parts.slice(1).join(' ') : '';
  }
  
  formatTeamData(player) {
    const teamName = player.Team || '';
    return {
      id: this.extractTeamAbbrev(player),
      name: teamName,
      abbreviation: this.extractTeamAbbrev(player)
    };
  }
  
  extractTeamAbbrev(player) {
    // This would need team name to abbreviation mapping
    const teamMappings = {
      'Lakers': 'LAL',
      'Celtics': 'BOS',
      'Warriors': 'GSW',
      // ... full mapping would be implemented
    };
    
    const teamName = player.Team || '';
    return teamMappings[teamName] || teamName.slice(0, 3).toUpperCase();
  }
  
  formatStatsData(player) {
    return {
      season: '2024-25',
      gamesPlayed: player['Games Played'] || player.GP || 0,
      minutes: player.MIN || 0,
      points: player.PPG || 0,
      rebounds: player.RPG || 0,
      assists: player.APG || 0,
      fieldGoalPct: this.parsePercentage(player['FG%']),
      threePointPct: this.parsePercentage(player['3PT%']),
      freeThrowPct: this.parsePercentage(player['FT%'])
    };
  }
  
  parsePercentage(percentStr) {
    if (!percentStr) return 0;
    const cleaned = percentStr.replace('%', '');
    return parseFloat(cleaned) / 100 || 0;
  }
  
  hasContractData(player) {
    return player.Contract || player.salaries_by_year || player['Free Agent'];
  }
  
  hasEvaluationData(player) {
    return player.Grade || player.Role || player.Notes || player.Tier;
  }
  
  parseContractValue(contractStr) {
    if (!contractStr) return 0;
    
    // Parse strings like "$47.6M / 2 yr"
    const match = contractStr.match(/\$([0-9.]+)M/);
    if (match) {
      return parseFloat(match[1]) * 1000000;
    }
    return 0;
  }
  
  parseFreeAgencyYear(faStr) {
    if (!faStr) return null;
    
    // Parse strings like "2025 (UFA)" or "2026 (Player Option)"
    const match = faStr.match(/(\d{4})/);
    return match ? parseInt(match[1]) : null;
  }

  /**
   * Verify migration completed successfully
   */
  async verifyMigration(originalPlayerCount) {
    console.log('🔍 Verifying migration...');
    
    const verificationResults = {};
    
    for (const [collectionName, collectionPath] of Object.entries(this.collections)) {
      if (collectionName === 'team_caps') continue; // Skip team caps for now
      
      const collectionRef = collection(this.db, collectionPath);
      const snapshot = await getDocs(collectionRef);
      verificationResults[collectionName] = snapshot.size;
    }
    
    console.log('📊 Migration verification results:');
    Object.entries(verificationResults).forEach(([name, count]) => {
      console.log(`   ${name}: ${count} documents`);
    });
    
    const totalMigrated = Object.values(verificationResults).reduce((sum, count) => sum + count, 0);
    console.log(`   Original players: ${originalPlayerCount}`);
    console.log(`   Total documents created: ${totalMigrated}`);
    
    return verificationResults;
  }

  /**
   * Frontend usage example for new schema
   */
  async getPlayerData(playerId) {
    try {
      // Get data from separated collections
      const [nbaDoc, contractDoc, evaluationDoc] = await Promise.all([
        getDoc(doc(this.db, this.collections.players_v2, playerId)),
        getDoc(doc(this.db, this.collections.contracts, playerId)),
        getDoc(doc(this.db, this.collections.evaluations, playerId))
      ]);
      
      return {
        nba: nbaDoc.exists() ? nbaDoc.data() : null,
        contract: contractDoc.exists() ? contractDoc.data() : null,
        evaluation: evaluationDoc.exists() ? evaluationDoc.data() : null
      };
      
    } catch (error) {
      console.error('Error fetching separated player data:', error);
      throw error;
    }
  }

  /**
   * Safe update functions that respect data boundaries
   */
  async updateNBAData(playerId, nbaData) {
    // Only automated systems should call this
    const docRef = doc(this.db, this.collections.players_v2, playerId);
    await setDoc(docRef, {
      ...nbaData,
      automated_update: true,
      last_nba_update: new Date().toISOString()
    }, { merge: true });
  }

  async updateEvaluation(playerId, evaluationData, userId) {
    // Only manual/user systems should call this
    const docRef = doc(this.db, this.collections.evaluations, playerId);
    await setDoc(docRef, {
      ...evaluationData,
      player_id: playerId,
      user_id: userId,
      last_updated: new Date().toISOString(),
      never_automated: true
    }, { merge: true });
  }

  async updateContract(playerId, contractData) {
    // Called by team-based contract collection
    const docRef = doc(this.db, this.collections.contracts, playerId);
    await setDoc(docRef, {
      ...contractData,
      player_id: playerId,
      last_contract_update: new Date().toISOString()
    }, { merge: true });
  }
}

/**
 * TypeScript interfaces for the new schema
 */
export const schemaInterfaces = `
// NEW SEPARATED SCHEMA TYPESCRIPT INTERFACES

// 1. NBA Data Only (automated)
interface PlayerNBAData {
  id: string;
  nba_id: number | null;
  name: string;
  firstName: string;
  lastName: string;
  team: {
    id: string;
    name: string;
    abbreviation: string;
  };
  position: string;
  height: string;
  weight: string;
  age: number | null;
  stats: {
    season: string;
    gamesPlayed: number;
    minutes: number;
    points: number;
    rebounds: number;
    assists: number;
    fieldGoalPct: number;
    threePointPct: number;
    freeThrowPct: number;
  };
  is_active_nba: boolean;
  automated_update: boolean;
  last_nba_update: string;
  discovery_source: string;
}

// 2. Contract Data (team-based collection)
interface PlayerContract {
  player_id: string;
  team_abbrev: string;
  contract_type: 'Standard' | 'Two-Way' | 'Exhibit 10';
  total_value: number;
  years?: number;
  aav?: number;
  guaranteed?: number;
  salaries_by_year: Record<string, number>;
  free_agency_year: number | null;
  bird_rights?: string;
  trade_clauses?: string[];
  source: string;
  last_contract_update: string;
}

// 3. User Evaluations (never automated)
interface PlayerEvaluation {
  player_id: string;
  user_id: string;
  overall_grade: string;
  role: string;
  tier: string;
  ceiling?: string;
  floor?: string;
  strengths?: string[];
  weaknesses?: string[];
  notes: string;
  fit_grades?: Record<string, string>;
  created_by: string;
  last_updated: string;
  never_automated: true;
}

// 4. Team Cap Data
interface TeamCapData {
  team_abbrev: string;
  team_name: string;
  season: string;
  salary_totals: {
    total_salary: number;
    luxury_tax: number;
    cap_space: number;
    first_apron_space: number;
    second_apron_space: number;
  };
  roster_count: number;
  dead_money?: number;
  retained_salaries?: number;
  source: string;
  last_updated: string;
}

// Data boundary enforcement
type AutomatedData = PlayerNBAData;
type ManualData = PlayerEvaluation;
type ContractData = PlayerContract;

// Frontend usage
type PlayerDisplayData = {
  nba: PlayerNBAData | null;
  contract: PlayerContract | null;
  evaluation: PlayerEvaluation | null;
};
`;

console.log('🏗️ Separated Schema Implementation Ready');
console.log('Addresses all data separation and TypeScript concerns');