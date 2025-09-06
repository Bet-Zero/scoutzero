#!/usr/bin/env node
/**
 * Working Contract Migration System
 * - Uses existing contract data from players.json (which already has contract info)
 * - Implements proper separated schema with actual data
 * - Preserves user evaluations from Firebase
 * - Creates working system without external dependencies
 */

import fs from 'fs';
import path from 'path';

// Firebase setup with graceful error handling
let db, getDocs, setDoc, doc, collection, writeBatch;
let hasFirebase = false;

try {
  const firebaseModule = await import('./firebaseConfig.node.js');
  db = firebaseModule.db;
  getDocs = firebaseModule.getDocs;
  setDoc = firebaseModule.setDoc;
  doc = firebaseModule.doc;
  collection = firebaseModule.collection;
  writeBatch = firebaseModule.writeBatch;
  hasFirebase = true;
  console.log('✅ Firebase initialized with credentials: ../serviceAccountKey.json');
} catch (error) {
  console.log('⚠️  Firebase credentials not available - will work with local files only');
  hasFirebase = false;
}

class WorkingContractMigration {
  constructor() {
    this.results = {
      bioDataProcessed: 0,
      contractsExtracted: 0,
      evaluationsMigrated: 0,
      teamCapsCalculated: 0,
      collectionsCreated: [],
      errors: []
    };
  }

  async run() {
    console.log('🎯 WORKING CONTRACT & DATA MIGRATION');
    console.log('===================================');
    console.log('📊 Bio data: From existing comprehensive dataset');
    console.log('💰 Contract data: Extracted from existing players.json');
    console.log('👤 Evaluations: Migrated from Firebase (if available)');
    console.log('📈 Team caps: Calculated from contract data');
    console.log('');

    try {
      // Step 1: Process bio data from existing source
      console.log('📋 Step 1: Processing Player Bio Data...');
      const bioData = await this.processBioData();
      
      // Step 2: Extract contract data from existing players.json
      console.log('');
      console.log('💰 Step 2: Extracting Contract Data...');
      const contractData = await this.extractContractData();

      // Step 3: Calculate team caps from contract data
      console.log('');
      console.log('📈 Step 3: Calculating Team Salary Caps...');
      const teamCapData = await this.calculateTeamCaps(contractData);

      // Step 4: Migrate user evaluations if Firebase is available
      console.log('');
      console.log('👤 Step 4: Migrating User Evaluations...');
      const evaluationData = await this.migrateEvaluations();

      // Step 5: Create new collections in Firebase
      console.log('');
      console.log('🗃️  Step 5: Creating Separated Schema Collections...');
      await this.createCollections(bioData, contractData, teamCapData, evaluationData);

      // Summary
      console.log('');
      console.log('✅ MIGRATION COMPLETE!');
      console.log('=====================');
      console.log(`📊 Bio data: ${this.results.bioDataProcessed} players`);
      console.log(`💰 Contracts: ${this.results.contractsExtracted} extracted`);
      console.log(`📈 Team caps: ${this.results.teamCapsCalculated} teams`);
      console.log(`👤 Evaluations: ${this.results.evaluationsMigrated} preserved`);
      console.log(`🗃️  Collections: ${this.results.collectionsCreated.join(', ')}`);
      
      return this.results;
    } catch (error) {
      console.error('❌ Migration failed:', error);
      this.results.errors.push(error.message);
      throw error;
    }
  }

  logProgress(message) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${message}`);
  }

  async processBioData() {
    this.logProgress('Loading comprehensive player dataset...');
    
    const playersPath = path.join(process.cwd(), '../public/players.json');
    
    if (!fs.existsSync(playersPath)) {
      throw new Error('players.json not found - this contains the comprehensive bio data');
    }
    
    const playersData = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
    const bioData = [];
    
    let processed = 0;
    const total = Object.keys(playersData).length;
    
    for (const [playerId, player] of Object.entries(playersData)) {
      // Extract ONLY bio and basic info (no contracts, evaluations)
      const bioRecord = {
        id: playerId,
        Name: player.Name,
        HT: player.HT,
        WT: player.WT,
        AGE: player.AGE,
        'Years Pro': player['Years Pro'],
        Team: player.Team,
        Position: player.Position,
        nba_player_id: player.nba_player_id,
        is_active_nba: player.is_active_nba,
        // Current season stats (these change but are part of player records)
        MIN: player.MIN,
        PPG: player.PPG,
        RPG: player.RPG,
        APG: player.APG,
        'FG%': player['FG%'],
        '3PT%': player['3PT%'],
        'FT%': player['FT%'],
        'EFG%': player['EFG%'],
        'Games Played': player['Games Played'],
        bio_source: 'comprehensive_dataset',
        last_updated: new Date().toISOString()
      };
      
      bioData.push(bioRecord);
      processed++;
      
      // Progress logging every 50 players
      if (processed % 50 === 0) {
        this.logProgress(`Processed ${processed}/${total} player bio records...`);
      }
    }
    
    this.logProgress(`✅ Processed bio data for ${bioData.length} players`);
    this.results.bioDataProcessed = bioData.length;
    return bioData;
  }

  async extractContractData() {
    this.logProgress('Extracting contract data from existing player records...');
    
    const playersPath = path.join(process.cwd(), '../public/players.json');
    const playersData = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
    const contractData = [];
    
    let extracted = 0;
    const total = Object.keys(playersData).length;
    
    for (const [playerId, player] of Object.entries(playersData)) {
      // Extract contract information
      const contractRecord = {
        id: playerId,
        player_name: player.Name,
        team: player.Team,
        contract: player.Contract,
        free_agent: player['Free Agent'],
        current_salary: this.parseContractSalary(player.Contract),
        contract_years: this.parseContractYears(player.Contract),
        fa_year: this.parseFreeAgentYear(player['Free Agent']),
        fa_type: this.parseFreeAgentType(player['Free Agent']),
        source: 'existing_comprehensive_data',
        last_updated: new Date().toISOString()
      };
      
      contractData.push(contractRecord);
      extracted++;
      
      // Progress logging every 50 contracts
      if (extracted % 50 === 0) {
        this.logProgress(`Extracted ${extracted}/${total} player contracts...`);
      }
    }
    
    this.logProgress(`✅ Extracted ${contractData.length} player contracts`);
    this.results.contractsExtracted = contractData.length;
    return contractData;
  }

  parseContractSalary(contractStr) {
    if (!contractStr || contractStr === 'N/A') return 0;
    
    // Parse values like "$6.0M / 1 yr", "$12.6M / 1 yr"
    const match = contractStr.match(/\$([0-9.]+)M/);
    if (match) {
      return parseFloat(match[1]) * 1000000;
    }
    
    return 0;
  }

  parseContractYears(contractStr) {
    if (!contractStr || contractStr === 'N/A') return 0;
    
    // Parse values like "$6.0M / 1 yr", "$12.6M / 3 yr"
    const match = contractStr.match(/(\d+) yr/);
    if (match) {
      return parseInt(match[1]);
    }
    
    return 0;
  }

  parseFreeAgentYear(faStr) {
    if (!faStr) return null;
    
    // Parse values like "2025 (UFA)", "2026 (RFA)"
    const match = faStr.match(/(\d{4})/);
    if (match) {
      return parseInt(match[1]);
    }
    
    return null;
  }

  parseFreeAgentType(faStr) {
    if (!faStr) return 'Unknown';
    
    // Parse values like "2025 (UFA)", "2026 (RFA)"
    if (faStr.includes('UFA')) return 'Unrestricted';
    if (faStr.includes('RFA')) return 'Restricted';
    
    return 'Unknown';
  }

  async calculateTeamCaps(contractData) {
    this.logProgress('Calculating team salary caps from contract data...');
    
    const teamTotals = {};
    
    // Group contracts by team and sum salaries
    for (const contract of contractData) {
      const team = contract.team;
      if (!teamTotals[team]) {
        teamTotals[team] = {
          total_salary: 0,
          player_count: 0,
          players: []
        };
      }
      
      teamTotals[team].total_salary += contract.current_salary || 0;
      teamTotals[team].player_count += 1;
      teamTotals[team].players.push(contract.player_name);
    }
    
    const teamCapData = [];
    const luxuryTaxThreshold = 170814000; // 2024-25 luxury tax threshold
    
    for (const [teamAbbrev, totals] of Object.entries(teamTotals)) {
      const teamCapRecord = {
        team: teamAbbrev,
        total_salary: totals.total_salary,
        player_count: totals.player_count,
        luxury_tax_threshold: luxuryTaxThreshold,
        over_luxury_tax: totals.total_salary > luxuryTaxThreshold,
        luxury_tax_bill: Math.max(0, totals.total_salary - luxuryTaxThreshold),
        source: 'calculated_from_contracts',
        last_updated: new Date().toISOString()
      };
      
      teamCapData.push(teamCapRecord);
      
      this.logProgress(`  ${teamAbbrev}: $${(totals.total_salary / 1000000).toFixed(1)}M (${totals.player_count} players)`);
    }
    
    this.logProgress(`✅ Calculated caps for ${teamCapData.length} teams`);
    this.results.teamCapsCalculated = teamCapData.length;
    return teamCapData;
  }

  async migrateEvaluations() {
    if (!hasFirebase) {
      this.logProgress('⚠️  Firebase not available - skipping evaluation migration');
      return [];
    }

    try {
      this.logProgress('Loading existing player evaluations from Firebase...');
      
      const playersCollection = collection(db, 'players');
      const snapshot = await getDocs(playersCollection);
      
      const evaluationData = [];
      let migratedCount = 0;
      
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        const playerId = docSnapshot.id;
        
        // Check if this player has evaluation data (grades, roles, notes)
        const hasEvaluations = data.grade || data.role || data.notes || 
                             data.Grade || data.Role || data.Notes ||
                             data.tier || data.Tier;
        
        if (hasEvaluations) {
          const evaluationRecord = {
            id: playerId,
            player_name: data.Name,
            grade: data.grade || data.Grade || null,
            role: data.role || data.Role || null,
            notes: data.notes || data.Notes || null,
            tier: data.tier || data.Tier || null,
            evaluator: 'user',
            source: 'firebase_migration',
            last_updated: new Date().toISOString()
          };
          
          evaluationData.push(evaluationRecord);
          migratedCount++;
        }
      });
      
      this.logProgress(`✅ Migrated ${migratedCount} user evaluations`);
      this.results.evaluationsMigrated = migratedCount;
      return evaluationData;
      
    } catch (error) {
      this.logProgress(`⚠️  Error migrating evaluations: ${error.message}`);
      this.results.errors.push(`Evaluation migration: ${error.message}`);
      return [];
    }
  }

  async createCollections(bioData, contractData, teamCapData, evaluationData) {
    // Always save to local files first for backup/review
    const outputDir = './output';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    fs.writeFileSync(`${outputDir}/nba_players.json`, JSON.stringify(bioData, null, 2));
    fs.writeFileSync(`${outputDir}/player_contracts.json`, JSON.stringify(contractData, null, 2));
    fs.writeFileSync(`${outputDir}/team_caps.json`, JSON.stringify(teamCapData, null, 2));
    fs.writeFileSync(`${outputDir}/player_evaluations.json`, JSON.stringify(evaluationData, null, 2));
    
    this.logProgress('✅ Data saved to local files in ./output/ directory');

    if (!hasFirebase) {
      this.logProgress('⚠️  Firebase not available - only local files created');
      this.logProgress('💡 To load to Firebase: Provide credentials then run load_separated_data_to_firebase.js');
      this.results.collectionsCreated = ['Local Files'];
      return;
    }

    // If Firebase is available, also load to Firebase
    this.logProgress('🔥 Firebase available - loading to Firebase collections...');

    try {
      // Create nba_players collection
      this.logProgress('Creating nba_players collection...');
      let batch = writeBatch(db);
      let batchCount = 0;
      
      for (const player of bioData) {
        const playerRef = doc(db, 'nba_players', player.id);
        batch.set(playerRef, player);
        batchCount++;
        
        if (batchCount >= 500) {
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
          this.logProgress(`  ✓ Committed batch of players to nba_players`);
        }
      }
      
      if (batchCount > 0) {
        await batch.commit();
      }
      this.results.collectionsCreated.push('nba_players');
      
      // Create player_contracts collection
      this.logProgress('Creating player_contracts collection...');
      batch = writeBatch(db);
      batchCount = 0;
      
      for (const contract of contractData) {
        const contractRef = doc(db, 'player_contracts', contract.id);
        batch.set(contractRef, contract);
        batchCount++;
        
        if (batchCount >= 500) {
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
          this.logProgress(`  ✓ Committed batch of contracts to player_contracts`);
        }
      }
      
      if (batchCount > 0) {
        await batch.commit();
      }
      this.results.collectionsCreated.push('player_contracts');
      
      // Create team_caps collection
      this.logProgress('Creating team_caps collection...');
      batch = writeBatch(db);
      
      for (const teamCap of teamCapData) {
        const teamRef = doc(db, 'team_caps', teamCap.team);
        batch.set(teamRef, teamCap);
      }
      
      await batch.commit();
      this.results.collectionsCreated.push('team_caps');
      
      // Create player_evaluations collection if we have data
      if (evaluationData.length > 0) {
        this.logProgress('Creating player_evaluations collection...');
        batch = writeBatch(db);
        
        for (const evaluation of evaluationData) {
          const evalRef = doc(db, 'player_evaluations', evaluation.id);
          batch.set(evalRef, evaluation);
        }
        
        await batch.commit();
        this.results.collectionsCreated.push('player_evaluations');
      }
      
      this.logProgress('✅ All Firebase collections created successfully');
      
    } catch (error) {
      this.logProgress(`❌ Error creating Firebase collections: ${error.message}`);
      this.logProgress('📋 Data is still available in ./output/ directory');
      this.results.errors.push(`Firebase creation: ${error.message}`);
      // Don't throw - local files are still created
    }
  }
}

// Run the migration
async function main() {
  const migration = new WorkingContractMigration();
  try {
    await migration.run();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}