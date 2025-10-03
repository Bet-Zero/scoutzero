#!/usr/bin/env node
/* Rename players_v2 to players collection */
const admin = require('firebase-admin');
const fs = require('fs');

// Initialize Firebase
if (!admin.apps.length) { admin.initializeApp(); }
const db = admin.firestore();

const BATCH_SIZE = 450;

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    if (key === '--confirm') {
      args.confirm = true;
    }
  }
  return args;
}

async function renameCollection() {
  console.log('🔄 Rename Collection: players_v2 → players');
  console.log('==========================================\n');
  
  const args = parseArgs(process.argv);
  
  if (!args.confirm) {
    console.log('⚠️  DRY RUN MODE');
    console.log('   This will show what would happen without making changes.');
    console.log('   Use --confirm to execute the rename.\n');
  } else {
    console.log('⚠️  LIVE MODE - Changes will be permanent!\n');
  }
  
  // Step 1: Check collections exist
  console.log('Step 1: Checking collections...');
  
  const oldPlayersSnap = await db.collection('players').get();
  const newPlayersSnap = await db.collection('players_v2').get();
  
  console.log(`   Found: ${oldPlayersSnap.size} documents in 'players'`);
  console.log(`   Found: ${newPlayersSnap.size} documents in 'players_v2'\n`);
  
  if (newPlayersSnap.size === 0) {
    console.log('❌ Error: players_v2 collection is empty or does not exist');
    console.log('   Run migration first: npm run migrate:live');
    process.exit(1);
  }
  
  // Step 2: Backup old players collection
  console.log('Step 2: Creating backup of old players collection...');
  
  const backupPath = `./backup_old_players_${Date.now()}.json`;
  const backup = {};
  
  oldPlayersSnap.docs.forEach(doc => {
    backup[doc.id] = doc.data();
  });
  
  if (!args.confirm) {
    console.log(`   Would create backup: ${backupPath}`);
    console.log(`   Would backup ${oldPlayersSnap.size} documents\n`);
  } else {
    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
    console.log(`✅ Backup created: ${backupPath}`);
    console.log(`   Backed up ${oldPlayersSnap.size} documents\n`);
  }
  
  // Step 3: Delete old players collection
  console.log('Step 3: Deleting old players collection...');
  
  if (!args.confirm) {
    console.log(`   Would delete ${oldPlayersSnap.size} documents from 'players'\n`);
  } else {
    const oldDocs = oldPlayersSnap.docs;
    for (let i = 0; i < oldDocs.length; i += BATCH_SIZE) {
      const batchDocs = oldDocs.slice(i, i + BATCH_SIZE);
      const batch = db.batch();
      
      batchDocs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      console.log(`   Deleted batch ${Math.floor(i / BATCH_SIZE) + 1} (${batchDocs.length} docs)`);
    }
    console.log('✅ Old players collection deleted\n');
  }
  
  // Step 4: Copy players_v2 to players
  console.log('Step 4: Copying players_v2 → players...');
  
  if (!args.confirm) {
    console.log(`   Would copy ${newPlayersSnap.size} documents to 'players'\n`);
  } else {
    const newDocs = newPlayersSnap.docs;
    for (let i = 0; i < newDocs.length; i += BATCH_SIZE) {
      const batchDocs = newDocs.slice(i, i + BATCH_SIZE);
      const batch = db.batch();
      
      batchDocs.forEach(doc => {
        const playerRef = db.collection('players').doc(doc.id);
        batch.set(playerRef, doc.data());
      });
      
      await batch.commit();
      console.log(`   Copied batch ${Math.floor(i / BATCH_SIZE) + 1} (${batchDocs.length} docs)`);
    }
    console.log(`✅ Copied ${newPlayersSnap.size} documents to players\n`);
  }
  
  // Step 5: Delete players_v2
  console.log('Step 5: Deleting players_v2 collection...');
  
  if (!args.confirm) {
    console.log(`   Would delete ${newPlayersSnap.size} documents from 'players_v2'\n`);
  } else {
    const newDocs = newPlayersSnap.docs;
    for (let i = 0; i < newDocs.length; i += BATCH_SIZE) {
      const batchDocs = newDocs.slice(i, i + BATCH_SIZE);
      const batch = db.batch();
      
      batchDocs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      console.log(`   Deleted batch ${Math.floor(i / BATCH_SIZE) + 1} (${batchDocs.length} docs)`);
    }
    console.log('✅ Deleted players_v2 collection\n');
  }
  
  // Summary
  console.log('==========================================');
  
  if (!args.confirm) {
    console.log('✅ Dry run completed');
    console.log('\nWhat would happen:');
    console.log(`   1. Backup old players → ${backupPath}`);
    console.log(`   2. Delete ${oldPlayersSnap.size} docs from 'players'`);
    console.log(`   3. Copy ${newPlayersSnap.size} docs from 'players_v2' → 'players'`);
    console.log(`   4. Delete ${newPlayersSnap.size} docs from 'players_v2'`);
    console.log('\nTo execute: node scripts/rename_collection.cjs --confirm');
  } else {
    console.log('🎉 Collection renamed successfully!');
    console.log('\nWhat was done:');
    console.log(`   1. ✅ Backed up old players → ${backupPath}`);
    console.log(`   2. ✅ Deleted old 'players' collection`);
    console.log(`   3. ✅ Copied 'players_v2' → 'players'`);
    console.log(`   4. ✅ Deleted 'players_v2' collection`);
    console.log('\n✅ Your app can now use the "players" collection with the new structure!');
  }
}

renameCollection().catch(error => {
  console.error('💥 Rename failed:', error);
  process.exit(1);
});
