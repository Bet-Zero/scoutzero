#!/usr/bin/env node
/* Firestore Migration Rollback Script */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase
if (!admin.apps.length) { admin.initializeApp(); }
const db = admin.firestore();

const BATCH_SIZE = 450;

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    if (key === '--dry-run' || key === '--confirm') {
      args[key.slice(2)] = true;
      continue;
    }
    if (key.startsWith('--')) {
      args[key.slice(2)] = argv[i + 1];
      i++;
    }
  }
  return args;
}

async function rollbackFromBackup(backupPath, targetCollection, isDryRun) {
  console.log(`📂 Loading backup from: ${backupPath}`);
  
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupPath}`);
  }
  
  const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  const playerIds = Object.keys(backupData);
  
  console.log(`   Found ${playerIds.length} players in backup\n`);
  
  if (isDryRun) {
    console.log('🔍 DRY RUN - No changes will be made\n');
  }
  
  let restored = 0;
  const collection = db.collection(targetCollection);
  
  for (let i = 0; i < playerIds.length; i += BATCH_SIZE) {
    const batchIds = playerIds.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(playerIds.length / BATCH_SIZE);
    
    console.log(`📦 Batch ${batchNum}/${totalBatches} (${batchIds.length} documents)`);
    
    if (!isDryRun) {
      const batch = db.batch();
      
      for (const playerId of batchIds) {
        const ref = collection.doc(playerId);
        batch.set(ref, backupData[playerId]);
      }
      
      await batch.commit();
      console.log(`   ✅ Restored ${batchIds.length} documents`);
    } else {
      console.log(`   ✓ Would restore ${batchIds.length} documents`);
    }
    
    restored += batchIds.length;
  }
  
  return restored;
}

async function deleteCollection(collectionName, isDryRun) {
  console.log(`🗑️  Deleting collection: ${collectionName}`);
  
  const collection = db.collection(collectionName);
  const snapshot = await collection.get();
  
  console.log(`   Found ${snapshot.size} documents\n`);
  
  if (snapshot.size === 0) {
    console.log('   Collection is empty - nothing to delete\n');
    return 0;
  }
  
  if (isDryRun) {
    console.log('🔍 DRY RUN - No documents will be deleted\n');
    return 0;
  }
  
  let deleted = 0;
  const docs = snapshot.docs;
  
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batchDocs = docs.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(docs.length / BATCH_SIZE);
    
    console.log(`📦 Batch ${batchNum}/${totalBatches} (${batchDocs.length} documents)`);
    
    const batch = db.batch();
    
    for (const doc of batchDocs) {
      batch.delete(doc.ref);
    }
    
    await batch.commit();
    console.log(`   ✅ Deleted ${batchDocs.length} documents`);
    
    deleted += batchDocs.length;
  }
  
  return deleted;
}

async function main() {
  console.log('🔄 Firestore Migration Rollback');
  console.log('================================\n');
  
  const args = parseArgs(process.argv);
  const isDryRun = !args.confirm;
  
  if (isDryRun) {
    console.log('⚠️  DRY RUN MODE - Use --confirm to execute rollback\n');
  } else {
    console.log('⚠️  LIVE MODE - Changes will be permanent!\n');
  }
  
  // Check for backup file
  const backupPath = args.backup || path.resolve('./backup_players_latest.json');
  
  if (!fs.existsSync(backupPath)) {
    console.log('❌ No backup file found!');
    console.log(`   Looking for: ${backupPath}`);
    console.log('\nAvailable backup files:');
    
    const backupFiles = fs.readdirSync('.')
      .filter(f => f.startsWith('backup_players_') && f.endsWith('.json'))
      .sort()
      .reverse();
    
    if (backupFiles.length === 0) {
      console.log('   No backup files found');
      console.log('\nCannot rollback without a backup file');
      process.exit(1);
    }
    
    backupFiles.slice(0, 5).forEach(f => console.log(`   - ${f}`));
    console.log('\nSpecify backup file with --backup <path>');
    process.exit(1);
  }
  
  // Rollback options
  console.log('📋 Rollback Options:\n');
  console.log('1. Delete players_v2 and restore from backup to players');
  console.log('2. Restore backup to players (keep players_v2)');
  console.log('3. Delete players_v2 only\n');
  
  const option = args.option || '1';
  console.log(`Selected: Option ${option}\n`);
  
  try {
    if (option === '1') {
      // Delete players_v2 and restore backup to players
      console.log('Step 1: Delete players_v2 collection\n');
      await deleteCollection('players_v2', isDryRun);
      
      console.log('\nStep 2: Restore backup to players collection\n');
      const restored = await rollbackFromBackup(backupPath, 'players', isDryRun);
      
      console.log('\n================================');
      console.log('✅ Rollback completed');
      console.log(`   Deleted: players_v2`);
      console.log(`   Restored: ${restored} players to players collection`);
      
    } else if (option === '2') {
      // Restore backup to players (keep players_v2)
      console.log('Restoring backup to players collection\n');
      const restored = await rollbackFromBackup(backupPath, 'players', isDryRun);
      
      console.log('\n================================');
      console.log('✅ Rollback completed');
      console.log(`   Restored: ${restored} players to players collection`);
      console.log(`   Kept: players_v2 collection unchanged`);
      
    } else if (option === '3') {
      // Delete players_v2 only
      console.log('Deleting players_v2 collection\n');
      const deleted = await deleteCollection('players_v2', isDryRun);
      
      console.log('\n================================');
      console.log('✅ Rollback completed');
      console.log(`   Deleted: ${deleted} documents from players_v2`);
      console.log(`   Kept: players collection unchanged`);
    }
    
    if (isDryRun) {
      console.log('\n⚠️  This was a DRY RUN - no changes were made');
      console.log('   Use --confirm to execute rollback');
    } else {
      console.log('\n🎉 Rollback executed successfully!');
    }
    
  } catch (error) {
    console.error('\n💥 Rollback failed:', error.message);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('💥 Rollback script error:', error);
  process.exit(1);
});
