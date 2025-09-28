#!/usr/bin/env node
/**
 * Creates /players/{id}/contracts/* and /players/{id}/seasons/{seasonKey}.contractView
 * Adds bio.nbaId (if present) and a lookup doc: /playersByNbaId/{nbaId} -> { playerId }
 * 
 * UPDATED: Now uses schemaAdapters and follows the same safety patterns as migrate_full_players.cjs
 */
const fs = require('fs');
const path = require('path');
const { initFirestore } = require('../utils/firestoreHelpers.cjs');
const { mapLegacyPlayerToNew } = require('../utils/schemaAdapters.cjs');

const MODE = process.env.MODE || (process.env.DRY_RUN === '0' ? 'live' : 'dry-run');
const SEASON = process.env.SEASON || '2025-26';
const SAMPLE = (process.env.SAMPLE_PLAYERS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const SAMPLE_SET = new Set(SAMPLE);
const BATCH_SIZE = Math.min(Number(process.env.BATCH_SIZE || 250), 500);
const MAX_RETRIES = Number(process.env.MAX_RETRIES || 5);

const DRY_RUN = MODE === 'dry-run';
const SHADOW_MODE = MODE === 'shadow';
const LIVE_MODE = MODE === 'live';

if (!['dry-run', 'shadow', 'live'].includes(MODE)) {
  console.error(`❌ Unknown MODE="${MODE}". Use dry-run | shadow | live.`);
  process.exit(1);
}

function eventLog(event, payload = {}) {
  const line = {
    timestamp: new Date().toISOString(),
    event,
    mode: MODE,
    season: SEASON,
    ...payload,
  };
  console.log(JSON.stringify(line));
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function commitWithRetries(db, writes) {
  if (writes.length > 500) {
    throw new Error(`Batch size ${writes.length} exceeds Firestore limit of 500 operations`);
  }
  
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
      eventLog('batch-commit-success', {
        writeCount: writes.length,
        attempt: attempt + 1
      });
      return;
    } catch (err) {
      const isRateLimit = err.code === 'resource-exhausted' || err.message.includes('rate');
      const delay = Math.min(2000 * 2 ** attempt, 30000);
      
      eventLog('batch-retry', {
        attempt: attempt + 1,
        delay,
        error: err.message,
        errorCode: err.code,
        isRateLimit
      });
      
      if (attempt === MAX_RETRIES - 1) {
        throw err;
      }
      
      await wait(delay);
    }
  }
}

async function main() {
  console.log('🔄 Contract & Views Migration');
  console.log('=============================');
  console.log(`Mode: ${MODE}`);
  console.log(`Season: ${SEASON}`);
  if (SAMPLE_SET.size > 0) {
    console.log(`Sample: ${Array.from(SAMPLE_SET).join(', ')}`);
  }
  console.log('');

  eventLog('start', { sampleCount: SAMPLE_SET.size });
  
  const db = initFirestore();
  if (!db) {
    console.error('❌ Failed to initialize Firestore');
    process.exit(1);
  }

  const playersSnap = await db.collection('players').get();
  const results = [];
  let processed = 0;
  
  for (const doc of playersSnap.docs) {
    const playerId = doc.id;
    const legacyData = doc.data();
    
    // Skip if sampling and not in sample set
    if (SAMPLE_SET.size > 0 && !SAMPLE_SET.has(playerId)) {
      continue;
    }
    
    processed++;
    
    try {
      // Use schema adapters for consistent mapping
      const mapping = mapLegacyPlayerToNew(playerId, legacyData, SEASON);
      
      const writes = [];
      const baseCollection = SHADOW_MODE ? 'players_shadow' : 'players';
      const xrefCollection = SHADOW_MODE ? 'playersByNbaId_shadow' : 'playersByNbaId';
      
      if (!DRY_RUN) {
        // Write contracts
        for (const contract of mapping.contracts) {
          const ref = db
            .collection(baseCollection)
            .doc(playerId)
            .collection('contracts')
            .doc(contract.id);
          writes.push({ ref, data: contract.data, options: { merge: true } });
        }
        
        // Write xref if exists
        if (mapping.xref) {
          const ref = db.collection(xrefCollection).doc(mapping.xref.id);
          writes.push({ ref, data: mapping.xref.data, options: { merge: true } });
        }
        
        // Commit batch
        if (writes.length > 0) {
          await commitWithRetries(db, writes);
        }
      }
      
      results.push({
        playerId,
        contractsWritten: mapping.contracts.length,
        xrefWritten: mapping.xref ? 1 : 0,
        warnings: mapping.warnings.join('|') || '',
        mode: MODE
      });
      
      if (DRY_RUN && processed <= 3) {
        console.log(`\n[DRY] Player: ${playerId}`);
        console.log(`  Contracts: ${mapping.contracts.length}`);
        console.log(`  XRef: ${mapping.xref ? mapping.xref.id : 'none'}`);
        console.log(`  Warnings: ${mapping.warnings.join(', ') || 'none'}`);
      }
      
    } catch (err) {
      eventLog('player-error', { playerId, error: err.message });
      results.push({
        playerId,
        contractsWritten: 0,
        xrefWritten: 0,
        warnings: `error:${err.message}`,
        mode: MODE
      });
    }
  }
  
  // Write summary
  const summaryPath = path.join(process.cwd(), 'outputs', `migrate_contracts_${MODE}.json`);
  if (!fs.existsSync(path.dirname(summaryPath))) {
    fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
  }
  fs.writeFileSync(summaryPath, JSON.stringify(results, null, 2));
  
  eventLog('complete', { 
    processed: results.length, 
    totalContracts: results.reduce((sum, r) => sum + r.contractsWritten, 0),
    totalXrefs: results.reduce((sum, r) => sum + r.xrefWritten, 0),
    summaryJson: summaryPath 
  });
  
  console.log(`\n✅ Contract migration complete`);
  console.log(`   Processed: ${results.length} players`);
  console.log(`   Mode: ${MODE}`);
  console.log(`   Summary: ${summaryPath}`);
}

main().catch((err) => {
  console.error('💥 migrate_contracts_and_views failed');
  console.error(err);
  process.exit(1);
});
