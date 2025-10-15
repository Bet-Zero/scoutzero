#!/usr/bin/env node
/**
 * Upload Players v2 Contract Data to Firestore /architect/basePlayers
 * 
 * This script uploads individual player contract details to the architect collection
 * including Bird rights, trade eligibility, and free agency information.
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '../../../serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ serviceAccountKey.json not found!');
  console.error('   Place your Firebase service account key in the project root');
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/**
 * Upload base players to /architect/basePlayers collection
 */
async function uploadBasePlayers(playersData) {
  console.log('📤 Uploading base players to /architect/basePlayers...\n');
  
  const batch = db.batch();
  let uploadCount = 0;
  
  const playerIds = Object.keys(playersData);
  
  for (const playerId of playerIds) {
    const playerData = playersData[playerId];
    
    // Create document reference
    const docRef = db.collection('architect').doc('basePlayers').collection('players').doc(playerId);
    
    // Set the document
    batch.set(docRef, playerData, { merge: true });
    uploadCount++;
    
    // Commit in batches of 400
    if (uploadCount % 400 === 0) {
      await batch.commit();
      console.log(`   ✅ Uploaded ${uploadCount}/${playerIds.length} players...`);
    }
  }
  
  // Commit remaining
  if (uploadCount % 400 !== 0) {
    await batch.commit();
  }
  
  console.log(`\n✅ Successfully uploaded ${uploadCount} players to /architect/basePlayers`);
}

/**
 * Create metadata document
 */
async function createMetadata(playerCount) {
  const metadataRef = db.collection('architect').doc('metadata');
  
  const metadata = {
    basePlayers: {
      count: playerCount,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      source: 'SalarySwish',
      version: '1.0',
      dataFields: [
        'playerId',
        'displayName', 
        'teamCode',
        'teamName',
        'bio',
        'contract.birdRights',
        'contract.freeAgency',
        'contract.tradeEligibility',
        'contract.salariesByYear'
      ]
    }
  };
  
  await metadataRef.set(metadata, { merge: true });
  console.log('✅ Created metadata document');
}

/**
 * Main execution
 */
async function main() {
  console.log('🏀 Upload Players v2 to /architect/basePlayers');
  console.log('=' .repeat(70) + '\n');
  
  // Load parsed player data
  const dataPath = path.join(__dirname, '../../resources/data/architect_base_players.json');
  
  if (!fs.existsSync(dataPath)) {
    console.error(`❌ Data file not found: ${dataPath}`);
    console.error('   Run scrape_players_v2.py and parse_players_v2.py first');
    process.exit(1);
  }
  
  const playersData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  console.log(`✅ Loaded ${Object.keys(playersData).length} players from: ${dataPath}\n`);
  
  try {
    // Upload players
    await uploadBasePlayers(playersData);
    
    // Create metadata
    await createMetadata(Object.keys(playersData).length);
    
    console.log('\n🎉 Upload complete!');
    console.log('=' .repeat(70));
    console.log('📁 Collection: /architect/basePlayers/players/{playerId}');
    console.log('📊 Document count:', Object.keys(playersData).length);
    console.log('✅ Ready for use in Architect GM Tools');
    
  } catch (error) {
    console.error('❌ Upload failed:', error.message);
    process.exit(1);
  }
  
  process.exit(0);
}

main();
