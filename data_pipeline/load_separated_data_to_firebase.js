#!/usr/bin/env node
/**
 * Load Separated Data to Firebase
 * - Takes the generated JSON files and loads them into Firebase
 * - Run this AFTER running the working_contract_migration.js
 * - Requires Firebase credentials
 */

import fs from 'fs';
import path from 'path';

// Firebase setup with error handling
let db, setDoc, doc, writeBatch;
let hasFirebase = false;

try {
  const firebaseModule = await import('./firebaseConfig.node.js');
  db = firebaseModule.db;
  setDoc = firebaseModule.setDoc;
  doc = firebaseModule.doc;
  writeBatch = firebaseModule.writeBatch;
  hasFirebase = true;
  console.log('✅ Firebase connection established');
} catch (error) {
  console.error('❌ Firebase credentials required to load data');
  console.log('Please ensure serviceAccountKey.json is in the correct location');
  process.exit(1);
}

class FirebaseDataLoader {
  constructor() {
    this.results = {
      collectionsCreated: [],
      recordsLoaded: {},
      errors: []
    };
  }

  async run() {
    console.log('🔥 LOADING SEPARATED DATA TO FIREBASE');
    console.log('====================================');
    console.log('');

    const outputDir = './output';
    
    if (!fs.existsSync(outputDir)) {
      console.error('❌ No output directory found. Run working_contract_migration.js first.');
      process.exit(1);
    }

    try {
      // Load each collection
      await this.loadCollection('nba_players', `${outputDir}/nba_players.json`);
      await this.loadCollection('player_contracts', `${outputDir}/player_contracts.json`);
      await this.loadCollection('team_caps', `${outputDir}/team_caps.json`);
      await this.loadCollection('player_evaluations', `${outputDir}/player_evaluations.json`);

      console.log('');
      console.log('✅ FIREBASE LOADING COMPLETE!');
      console.log('=============================');
      console.log(`🗃️  Collections created: ${this.results.collectionsCreated.join(', ')}`);
      for (const [collection, count] of Object.entries(this.results.recordsLoaded)) {
        console.log(`   ${collection}: ${count} records`);
      }
      console.log('');
      console.log('🧪 Next Steps:');
      console.log('   1. cd .. && npm run dev');
      console.log('   2. Navigate to http://localhost:5173/');
      console.log('   3. Verify ALL players show (not just 15)');
      console.log('   4. Test Trade Machine functionality');

      return this.results;
    } catch (error) {
      console.error('❌ Loading failed:', error);
      throw error;
    }
  }

  async loadCollection(collectionName, filePath) {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  Skipping ${collectionName} - file not found: ${filePath}`);
      return;
    }

    console.log(`📋 Loading ${collectionName} collection...`);
    
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    if (data.length === 0) {
      console.log(`   ⚠️  No data found in ${filePath}`);
      return;
    }

    let batch = writeBatch(db);
    let batchCount = 0;
    let totalCount = 0;

    for (const record of data) {
      const recordId = record.id || record.team || `record_${totalCount}`;
      const docRef = doc(db, collectionName, recordId);
      batch.set(docRef, record);
      batchCount++;
      totalCount++;

      if (batchCount >= 500) {
        await batch.commit();
        batch = writeBatch(db);
        batchCount = 0;
        console.log(`   ✓ Committed batch of ${totalCount} records to ${collectionName}`);
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    console.log(`   ✅ Loaded ${totalCount} records to ${collectionName}`);
    this.results.collectionsCreated.push(collectionName);
    this.results.recordsLoaded[collectionName] = totalCount;
  }
}

// Run the loader
async function main() {
  const loader = new FirebaseDataLoader();
  try {
    await loader.run();
    process.exit(0);
  } catch (error) {
    console.error('Loading failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}