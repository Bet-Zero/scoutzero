#!/usr/bin/env node
/**
 * Team season migration (MVP, selector-driven, safety-first)
 *
 * Writes team season docs with:
 *  - MODE support: dry-run | shadow | live
 *  - Shadow by default (safest)
 *  - Batching (<=500 ops), retries with backoff
 *  - Optional parity checks (logs diffs)
 *  - Live-mode guard requiring explicit confirmation
 *  - Selector/adapter mapping as the single source of truth
 *
 * Target doc path (shadow unless MODE=live):
 *   {base}/teams/{teamId}/seasons/{SEASON}
 *
 * Notes:
 * - Keeps subcollection name "seasons" to match existing usage.
 * - Falls back to legacy-derived rosterIds/totalSalary if adapter doesn't provide them.
 */

const fs = require('fs');
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const { initFirestore } = require('../utils/firestoreHelpers.cjs');

// Adapters/selectors (adjust function names if your adapters expose different APIs)
const {
  mapLegacyTeamToNew,            // optional (not used directly here, kept for future base writes)
  mapLegacyTeamSeasonToNew,      // primary mapper for season docs
} = require('../utils/schemaAdapters.cjs');

const selectors = require('../../src/utils/selectors/newSchemeSelectors.js');

// —————————————————————————————————————————————————————————————————————————————
// CLI + ENV flags
// —————————————————————————————————————————————————————————————————————————————
const argv = yargs(hideBin(process.argv))
  .option('mode', { type: 'string', choices: ['dry-run', 'shadow', 'live'] })
  .option('season', { type: 'string' })
  .option('sample', { type: 'string', desc: 'Comma-separated teamIds to include' })
  .option('batch-size', { type: 'number' })
  .option('max-retries', { type: 'number' })
  .option('parity', { type: 'boolean', default: false })
  .option('i-understand-the-risks', { type: 'boolean', default: false })
  .help(false)
  .parse();

const ENV_MODE = process.env.MODE || (process.env.DRY_RUN === '0' ? 'live' : 'dry-run');
const MODE = argv.mode || ENV_MODE;                   // 'dry-run' | 'shadow' | 'live'
const SEASON = argv.season || process.env.SEASON || '2025-26';
const SAMPLE = (argv.sample || process.env.SAMPLE_TEAMS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const SAMPLE_SET = new Set(SAMPLE);

const BATCH_SIZE = Math.min(Number(argv['batch-size'] || process.env.BATCH_SIZE || 250), 500);
const MAX_RETRIES = Number(argv['max-retries'] || process.env.MAX_RETRIES || 5);
const PARITY = Boolean(argv.parity);

const DRY_RUN = MODE === 'dry-run';
const SHADOW_MODE = MODE === 'shadow';
const LIVE_MODE = MODE === 'live';

if (!['dry-run', 'shadow', 'live'].includes(MODE)) {
  console.error(`❌ Unknown MODE="${MODE}". Use dry-run | shadow | live.`);
  process.exit(1);
}

if (LIVE_MODE && !argv['i-understand-the-risks']) {
  console.error('❌ Refusing LIVE without --i-understand-the-risks');
  process.exit(2);
}

if (!process.env.MODE && !argv.mode && !DRY_RUN) {
  console.error('❌ Refusing non-dry run without explicit MODE (set MODE=shadow or MODE=live)');
  process.exit(2);
}

const seasonFirstYear = Number(SEASON.split('-')[0]);

// —————————————————————————————————————————————————————————————————————————————
// Logging & utils
// —————————————————————————————————————————————————————————————————————————————
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
    for (const { ref, data, options } of writes) {
      if (options?.merge) batch.set(ref, data, { merge: true });
      else batch.set(ref, data);
    }
    try {
      await batch.commit();
      eventLog('batch-commit-success', { writeCount: writes.length, attempt: attempt + 1 });
      return;
    } catch (err) {
      const isRateLimit = err.code === 'resource-exhausted' || /rate|quota|exhaust/i.test(String(err.message));
      const delay = Math.min(2000 * 2 ** attempt, 30000);
      eventLog('batch-retry', {
        attempt: attempt + 1,
        delay,
        error: String(err && err.message || err),
        errorCode: err && err.code,
        isRateLimit,
      });
      if (attempt === MAX_RETRIES - 1) throw err;
      await wait(delay);
    }
  }
}

function targets(db) {
  const base = LIVE_MODE ? 'teams' : 'teams_shadow';
  return {
    teamDoc: (teamId) => db.collection(base).doc(teamId),
    teamSeasonDoc: (teamId, season) => db.collection(base).doc(teamId).collection('seasons').doc(season),
  };
}

// Simple shallow diff for parity logs (expand to deep compare if needed)
function shallowDiff(a, b) {
  const diffs = [];
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const k of keys) {
    const av = JSON.stringify(a?.[k]);
    const bv = JSON.stringify(b?.[k]);
    if (av !== bv) diffs.push({ field: k, from: a?.[k], to: b?.[k] });
  }
  return diffs;
}

// —————————————————————————————————————————————————————————————————————————————
// Main
// —————————————————————————————————————————————————————————————————————————————
async function main() {
  console.log('🔄 Team Seasons Migration');
  console.log('=========================');
  console.log(`Mode: ${MODE}`);
  console.log(`Season: ${SEASON}`);
  if (SAMPLE_SET.size > 0) console.log(`Sample: ${Array.from(SAMPLE_SET).join(', ')}`);
  console.log('');

  eventLog('start', { sampleCount: SAMPLE_SET.size });

  const db = initFirestore();
  if (!db) {
    console.error('❌ Failed to initialize Firestore');
    process.exit(1);
  }

  // Source of truth for legacy teams
  const srcSnap = await db.collection('teams').get();

  const { teamSeasonDoc } = targets(db);
  const results = [];
  const writes = [];
  let processed = 0;

  for (const doc of srcSnap.docs) {
    const teamId = doc.id;
    if (SAMPLE_SET.size > 0 && !SAMPLE_SET.has(teamId)) continue;
    processed++;

    try {
      const legacyTeam = doc.data();

      // Use adapter+selectors as the canonical mapping layer
      let seasonNew = mapLegacyTeamSeasonToNew(
        {
          teamId,
          legacy: legacyTeam,
          season: SEASON,
          seasonFirstYear,
        },
        selectors
      );

      // ——— Fallbacks: preserve your previous derivations if adapter didn't include them
      // rosterIds
      if (!seasonNew.rosterIds) {
        const cap = legacyTeam?.capSheet || legacyTeam;
        seasonNew.rosterIds = Array.isArray(cap?.players)
          ? cap.players.map((p) => p.player_id).filter(Boolean)
          : [];
      }
      // capTable.totalSalary
      if (!(seasonNew.capTable && typeof seasonNew.capTable === 'object' && 'totalSalary' in seasonNew.capTable)) {
        const cap = legacyTeam?.capSheet || legacyTeam;
        const byYear = cap?.totalSalaryByYear || legacyTeam?.totalSalaryByYear || {};
        const total = byYear[seasonFirstYear];
        if (total != null) {
          seasonNew.capTable = { ...(seasonNew.capTable || {}), totalSalary: Number(total) };
        }
      }
      // ——— End fallbacks

      if (DRY_RUN) {
        // Show full dry-run payload with placeholders so you can "see" intent safely
        const dryView = {
          ...seasonNew,
          exceptions: [],
          TPEs: [],
          picks: [],
          deadMoney: [],
        };
        console.log(`\n[DRY] Team: ${teamId}`);
        console.log(`  seasons/${SEASON} ->`, JSON.stringify(dryView, null, 2));
      } else {
        const ref = teamSeasonDoc(teamId, SEASON);

        if (PARITY) {
          const existing = await ref.get().then((s) => (s.exists ? s.data() : null));
          const diff = shallowDiff(existing || {}, seasonNew);
          eventLog('parity-check', {
            teamId,
            season: SEASON,
            diffCount: diff.length,
            diffs: diff.slice(0, 10), // log first few to keep output reasonable
          });
        }

        writes.push({ ref, data: seasonNew, options: { merge: true } });
      }

      results.push({
        teamId,
        rosterCount: Array.isArray(seasonNew.rosterIds) ? seasonNew.rosterIds.length : 0,
        totalSalary: Number(seasonNew?.capTable?.totalSalary || 0),
        hasCapData: seasonNew?.capTable?.totalSalary != null,
        mode: MODE,
      });
    } catch (err) {
      eventLog('team-error', { teamId, error: String(err && err.message || err) });
      results.push({
        teamId,
        rosterCount: 0,
        totalSalary: 0,
        hasCapData: false,
        error: String(err && err.message || err),
        mode: MODE,
      });
    }
  }

  // Commit in chunks
  if (!DRY_RUN && writes.length > 0) {
    const chunks = [];
    for (let i = 0; i < writes.length; i += BATCH_SIZE) chunks.push(writes.slice(i, i + BATCH_SIZE));
    for (let i = 0; i < chunks.length; i++) {
      eventLog('batch-commit-start', { chunk: i + 1, writeCount: chunks[i].length });
      await commitWithRetries(db, chunks[i]);
    }
  }

  // Summary artifact
  const summaryPath = path.join(process.cwd(), 'outputs', `build_team_seasons_${MODE}.json`);
  if (!fs.existsSync(path.dirname(summaryPath))) {
    fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
  }
  fs.writeFileSync(summaryPath, JSON.stringify(results, null, 2));

  eventLog('complete', {
    processed: results.length,
    totalWrites: writes.length,
    summaryJson: summaryPath,
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
