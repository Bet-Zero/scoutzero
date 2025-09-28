#!/usr/bin/env node
/**
 * Team season doc: rosterIds + capTable.totalSalary + placeholders (exceptions, TPEs, picks, deadMoney)
 * 
 * UPDATED: Now follows safety patterns with dry-run/shadow/live modes and proper batching
 */
const fs = require('fs');
const path = require('path');
const { initFirestore } = require('../utils/firestoreHelpers.cjs');

const MODE = process.env.MODE || (process.env.DRY_RUN === '0' ? 'live' : 'dry-run');
const SEASON = process.env.SEASON || '2025-26';
const SAMPLE = (process.env.SAMPLE_TEAMS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const SAMPLE_SET = new Set(SAMPLE);
const BATCH_SIZE = Math.min(Number(process.env.BATCH_SIZE || 250), 500);
const MAX_RETRIES = Number(process.env.MAX_RETRIES || 5);

const DRY_RUN = MODE === 'dry-run';
const SHADOW_MODE = MODE === 'shadow';
const LIVE_MODE = MODE === 'live';
const seasonFirstYear = Number(SEASON.split('-')[0]);

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
  console.log('🔄 Team Seasons Migration');
  console.log('=========================');
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

  const tSnap = await db.collection('teams').get();
  const results = [];
  const writes = [];
  let processed = 0;

  for (const doc of tSnap.docs) {
    const teamId = doc.id;
    const show = SAMPLE_SET.size === 0 || SAMPLE_SET.has(teamId);
    
    // Skip if sampling and not in sample set
    if (SAMPLE_SET.size > 0 && !show) {
      continue;
    }
    
    processed++;
    
    try {
      const t = doc.data();
      const cap = t?.capSheet || t;

      const rosterIds = Array.isArray(cap?.players)
        ? cap.players.map((p) => p.player_id).filter(Boolean)
        : [];
        
      let totalSalary = null;
      if (
        cap?.totalSalaryByYear &&
        cap.totalSalaryByYear[seasonFirstYear] != null
      )
        totalSalary = Number(cap.totalSalaryByYear[seasonFirstYear]);
      else if (
        t?.totalSalaryByYear &&
        t.totalSalaryByYear[seasonFirstYear] != null
      )
        totalSalary = Number(t.totalSalaryByYear[seasonFirstYear]);

      const seasonDoc = {
        ...(rosterIds.length ? { rosterIds } : {}),
        ...(totalSalary != null ? { capTable: { totalSalary } } : {}),
      };
      
      // Add placeholder fields for dry-run visibility
      const dryRunDoc = {
        ...seasonDoc,
        exceptions: [],
        TPEs: [],
        picks: [],
        deadMoney: [], // placeholders shown only in DRY mode
      };

      if (DRY_RUN) {
        console.log(`\n[DRY] Team: ${teamId}`);
        console.log(`  seasons/${SEASON} ->`, JSON.stringify(dryRunDoc, null, 2));
      } else {
        // Prepare for shadow or live write
        const baseCollection = SHADOW_MODE ? 'teams_shadow' : 'teams';
        const ref = db
          .collection(baseCollection)
          .doc(teamId)
          .collection('seasons')
          .doc(SEASON);
        writes.push({ ref, data: seasonDoc, options: { merge: true } });
      }

      results.push({
        teamId,
        rosterCount: rosterIds.length,
        totalSalary: totalSalary || 0,
        hasCapData: totalSalary != null,
        mode: MODE
      });
      
    } catch (err) {
      eventLog('team-error', { teamId, error: err.message });
      results.push({
        teamId,
        rosterCount: 0,
        totalSalary: 0,
        hasCapData: false,
        error: err.message,
        mode: MODE
      });
    }
  }

  // Commit all writes in batches
  if (!DRY_RUN && writes.length > 0) {
    const chunks = [];
    for (let i = 0; i < writes.length; i += BATCH_SIZE) {
      chunks.push(writes.slice(i, i + BATCH_SIZE));
    }
    
    for (let i = 0; i < chunks.length; i++) {
      eventLog('batch-commit-start', { chunk: i + 1, writeCount: chunks[i].length });
      await commitWithRetries(db, chunks[i]);
    }
  }

  // Write summary
  const summaryPath = path.join(process.cwd(), 'outputs', `build_team_seasons_${MODE}.json`);
  if (!fs.existsSync(path.dirname(summaryPath))) {
    fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
  }
  fs.writeFileSync(summaryPath, JSON.stringify(results, null, 2));

  eventLog('complete', { 
    processed: results.length, 
    totalWrites: writes.length,
    summaryJson: summaryPath 
  });

  console.log(`\n✅ Team seasons migration complete`);
  console.log(`   Processed: ${results.length} teams`);
  console.log(`   Writes: ${writes.length}`);
  console.log(`   Mode: ${MODE}`);
  console.log(`   Summary: ${summaryPath}`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
