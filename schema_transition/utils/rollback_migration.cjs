#!/usr/bin/env node
/**
 * Schema Transition Rollback Script
 * Provides rollback capability for schema migrations using reverse mapping
 */

const fs = require('fs');
const path = require('path');
const { initFirestore } = require('./firestoreHelpers.cjs');
const { mapNewSeasonToLegacy } = require('./schemaAdapters.cjs');

const SEASON = process.env.SEASON || '2025-26';
const DRY_RUN = process.env.DRY_RUN !== '0';
const BACKUP_DIR = process.env.BACKUP_DIR || './outputs/rollback_backup';
const BATCH_SIZE = 250;
const MAX_RETRIES = 3;

function eventLog(event, payload = {}) {
  const line = {
    timestamp: new Date().toISOString(),
    event,
    season: SEASON,
    dryRun: DRY_RUN,
    ...payload,
  };
  console.log(JSON.stringify(line));
}

async function createBackup(db) {
  console.log('📦 Creating pre-rollback backup...');
  
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  
  const backupData = {
    timestamp: new Date().toISOString(),
    season: SEASON,
    players: {},
    playersByNbaId: {},
  };
  
  // Backup current players collection
  const playersSnap = await db.collection('players').get();
  for (const doc of playersSnap.docs) {
    backupData.players[doc.id] = doc.data();
  }
  
  // Backup playersByNbaId collection
  const nbaIdSnap = await db.collection('playersByNbaId').get();  
  for (const doc of nbaIdSnap.docs) {
    backupData.playersByNbaId[doc.id] = doc.data();
  }
  
  const backupFile = path.join(BACKUP_DIR, `pre_rollback_${Date.now()}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
  
  eventLog('backup-created', {
    file: backupFile,
    playerCount: Object.keys(backupData.players).length,
    nbaIdCount: Object.keys(backupData.playersByNbaId).length
  });
  
  console.log(`✅ Backup created: ${backupFile}`);
  return backupFile;
}

async function validateRollbackData(db) {
  console.log('🔍 Validating rollback data availability...');
  
  let hasNewSchema = false;
  let playersWithSeasons = 0;
  
  const playersSnap = await db.collection('players').limit(10).get();
  
  for (const doc of playersSnap.docs) {
    const data = doc.data();
    
    // Check if player has new schema structure
    if (data.bio?.displayName || data.seasons) {
      hasNewSchema = true;
    }
    
    // Count players with season data
    if (data.seasons && data.seasons[SEASON]) {
      playersWithSeasons++;
    }
  }
  
  if (!hasNewSchema) {
    throw new Error('No new schema data found. Rollback not needed.');
  }
  
  eventLog('rollback-validation', {
    hasNewSchema,
    playersWithSeasons,
    sampledPlayers: playersSnap.docs.length
  });
  
  console.log(`✅ Validation complete. Found ${playersWithSeasons} players with ${SEASON} data.`);
  return { hasNewSchema, playersWithSeasons };
}

async function rollbackPlayerDoc(db, playerId, playerData) {
  const issues = [];
  const warnings = [];
  
  try {
    // Extract season data for current season
    const seasonData = playerData.seasons?.[SEASON];
    if (!seasonData) {
      warnings.push('no-season-data');
      return { playerId, issues, warnings, legacyDoc: null };
    }
    
    // Use reverse mapping to convert back to legacy format
    const legacyDoc = mapNewSeasonToLegacy(seasonData, playerData);
    
    if (!legacyDoc) {
      issues.push('reverse-mapping-failed');
      return { playerId, issues, warnings, legacyDoc: null };
    }
    
    // Validate essential fields are preserved
    if (!legacyDoc.bio?.display_name && !legacyDoc.Name) {
      issues.push('missing-display-name');
    }
    
    if (!legacyDoc.Team && !legacyDoc.bio?.Team) {
      warnings.push('missing-team');
    }
    
    return { playerId, issues, warnings, legacyDoc };
    
  } catch (err) {
    issues.push(`rollback-error:${err.message}`);
    return { playerId, issues, warnings, legacyDoc: null };
  }
}

async function executeRollback(db) {
  console.log(`🔄 ${DRY_RUN ? 'DRY RUN:' : 'EXECUTING:'} Rolling back schema migration...`);
  
  const results = [];
  let processedCount = 0;
  let errorCount = 0;
  
  // Get all players with new schema
  const playersSnap = await db.collection('players').get();
  const totalPlayers = playersSnap.docs.length;
  
  console.log(`📊 Processing ${totalPlayers} players...`);
  
  for (let i = 0; i < playersSnap.docs.length; i += BATCH_SIZE) {
    const batch = playersSnap.docs.slice(i, i + BATCH_SIZE);
    const batchResults = [];
    
    // Process batch
    for (const doc of batch) {
      const result = await rollbackPlayerDoc(db, doc.id, doc.data());
      batchResults.push(result);
      
      if (result.issues.length > 0) {
        errorCount++;
      }
      
      processedCount++;
      
      if (processedCount % 50 === 0) {
        console.log(`📈 Progress: ${processedCount}/${totalPlayers} (${Math.round(processedCount/totalPlayers*100)}%)`);
      }
    }
    
    // Write batch to Firestore (if not dry run)
    if (!DRY_RUN) {
      const writes = [];
      
      for (const result of batchResults) {
        if (result.legacyDoc && result.issues.length === 0) {
          const playerRef = db.collection('players').doc(result.playerId);
          writes.push({
            ref: playerRef,
            data: result.legacyDoc,
            options: { merge: false } // Full replacement for rollback
          });
        }
      }
      
      if (writes.length > 0) {
        await commitBatchWithRetries(db, writes);
        eventLog('rollback-batch-committed', {
          batchNumber: Math.floor(i / BATCH_SIZE) + 1,
          writeCount: writes.length
        });
      }
    }
    
    results.push(...batchResults);
  }
  
  return { results, processedCount, errorCount };
}

async function commitBatchWithRetries(db, writes) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const batch = db.batch();
    
    for (const write of writes) {
      const { ref, data, options } = write;
      if (options?.merge) {
        batch.set(ref, data, { merge: true });
      } else {
        batch.set(ref, data);
      }
    }
    
    try {
      await batch.commit();
      return;
    } catch (err) {
      if (attempt === MAX_RETRIES - 1) throw err;
      
      const delay = 1000 * 2 ** attempt;
      eventLog('rollback-batch-retry', { attempt, delay, error: err.message });
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

function generateRollbackSummary(results) {
  const summary = {
    timestamp: new Date().toISOString(),
    season: SEASON,
    dryRun: DRY_RUN,
    totalProcessed: results.length,
    successful: results.filter(r => r.issues.length === 0).length,
    withWarnings: results.filter(r => r.warnings.length > 0 && r.issues.length === 0).length,
    failed: results.filter(r => r.issues.length > 0).length,
    details: results
  };
  
  const summaryFile = path.join(BACKUP_DIR, `rollback_summary_${Date.now()}.json`);
  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
  
  // CSV summary
  const csvHeader = 'playerId,status,issues,warnings\n';
  const csvRows = results.map(r => {
    const status = r.issues.length > 0 ? 'FAILED' : r.warnings.length > 0 ? 'WARNING' : 'SUCCESS';
    return `"${r.playerId}","${status}","${r.issues.join('|')}","${r.warnings.join('|')}"`;
  }).join('\n');
  
  const csvFile = path.join(BACKUP_DIR, `rollback_summary_${Date.now()}.csv`);
  fs.writeFileSync(csvFile, csvHeader + csvRows);
  
  console.log(`📊 Rollback summary: ${summaryFile}`);
  console.log(`📈 CSV report: ${csvFile}`);
  
  return summary;
}

async function main() {
  console.log('🔄 Schema Transition Rollback Tool');
  console.log('=================================');
  console.log(`Season: ${SEASON}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE ROLLBACK'}`);
  console.log('');
  
  if (!DRY_RUN) {
    console.log('⚠️  WARNING: This will modify production data!');
    console.log('   Cancel now (Ctrl+C) if not intended.');
    console.log('   Waiting 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  try {
    const db = await initFirestore();
    
    // Create backup
    await createBackup(db);
    
    // Validate rollback data
    await validateRollbackData(db);
    
    // Execute rollback
    const { results, processedCount, errorCount } = await executeRollback(db);
    
    // Generate summary
    const summary = generateRollbackSummary(results);
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 Rollback Summary');
    console.log('='.repeat(50));
    console.log(`Total processed: ${processedCount}`);
    console.log(`Successful: ${summary.successful}`);
    console.log(`With warnings: ${summary.withWarnings}`);
    console.log(`Failed: ${summary.failed}`);
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE ROLLBACK'}`);
    
    if (summary.failed > 0) {
      console.log('\n⚠️  Some rollbacks failed. Review summary for details.');
      process.exit(1);
    } else {
      console.log('\n✅ Rollback completed successfully!');
      if (DRY_RUN) {
        console.log('   Run with DRY_RUN=0 to execute live rollback.');
      }
      process.exit(0);
    }
    
  } catch (err) {
    console.error('\n💥 Rollback failed:', err.message);
    eventLog('rollback-failed', { error: err.message });
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { rollbackPlayerDoc, createBackup, validateRollbackData };