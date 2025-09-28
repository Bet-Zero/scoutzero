#!/usr/bin/env node
/**
 * Contract & Views migration (selector-driven, safety-first)
 *
 * Writes:
 *   - /{base}/players/{playerId}/contracts/{contractId}
 *   - /{base}/players/{playerId}/seasons/{SEASON}.contractView   (summary view)
 *   - /{baseXref}/playersByNbaId/{nbaId} -> { playerId }         (xref)
 *
 * Safety:
 *   - MODE: dry-run | shadow | live   (explicit required for non-dry)
 *   - Live guard: requires --i-understand-the-risks
 *   - Batching (<=500 ops) with retry/backoff
 *   - Optional parity checks for existing shadow/live docs
 *
 * Notes:
 *   - Uses schemaAdapters as the mapping source of truth.
 *   - Imports selectors to allow adapter composition if needed.
 *   - Keeps summary artifact under ./outputs/migrate_contracts_${MODE}.json
 */

const fs = require('fs');
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const { initFirestore } = require('../utils/firestoreHelpers.cjs');
const { mapLegacyPlayerToNew } = require('../utils/schemaAdapters.cjs');
const selectors = require('../../src/utils/selectors/newSchemeSelectors.js');

// —————————————————————————————————————————————————————————————————————————————
// CLI + ENV flags
// —————————————————————————————————————————————————————————————————————————————
const argv = yargs(hideBin(process.argv))
  .option('mode', { type: 'string', choices: ['dry-run', 'shadow', 'live'] })
  .option('season', { type: 'string' })
  .option('sample', { type: 'string', desc: 'Comma-separated playerIds to include' })
  .option('batch-size', { type: 'number' })
  .option('max-retries', { type: 'number' })
  .option('parity', { type: 'boolean', default: false })
  .option('limit', { type: 'number', desc: 'Max players to process' })
  .option('i-understand-the-risks', { type: 'boolean', default: false })
  .help(false)
  .parse();

const ENV_MODE = process.env.MODE || (process.env.DRY_RUN === '0' ? 'live' : 'dry-run');
const MODE = argv.mode || ENV_MODE; // 'dry-run' | 'shadow' | 'live'
const SEASON = argv.season || process.env.SEASON || '2025-26';
const SAMPLE = (argv.sample || process.env.SAMPLE_PLAYERS || '')
  .split(',')
  .map(s => s.trim())
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

// —————————————————————————————————————————————————————————————————————————————
// Logging & helpers
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
  return new Promise(resolve => setTimeout(resolve, ms));
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
  const base = LIVE_MODE ? 'players' : 'players_shadow';
  const baseXref = LIVE_MODE ? 'playersByNbaId' : 'playersByNbaId_shadow';
  return {
    contractDoc: (playerId, contractId) =>
      db.collection(base).doc(playerId).collection('contracts').doc(contractId),
    seasonDoc: (playerId, season) =>
      db.collection(base).doc(playerId).collection('seasons').doc(season),
    xrefDoc: (nbaId) => db.collection(baseXref).doc(String(nbaId)),
  };
}

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
async function main() {
  console.log('🔄 Contract & Views Migration');
  console.log('=============================');
  console.log(`Mode: ${MODE}`);
  console.log(`Season: ${SEASON}`);
  if (SAMPLE_SET.size > 0) console.log(`Sample: ${Array.from(SAMPLE_SET).join(', ')}`);
  if (argv.limit) console.log(`Limit: ${argv.limit}`);
  console.log('');

  eventLog('start', { sampleCount: SAMPLE_SET.size });

  const db = initFirestore();
  if (!db) {
    console.error('❌ Failed to initialize Firestore');
    process.exit(1);
  }

  // Read legacy players (source of truth)
  const snap = await db.collection('players').get();
  const { contractDoc, seasonDoc, xrefDoc } = targets(db);

  const results = [];
  let processed = 0;
  for (const doc of snap.docs) {
    if (argv.limit && processed >= argv.limit) break;

    const playerId = doc.id;
    if (SAMPLE_SET.size > 0 && !SAMPLE_SET.has(playerId)) continue;

    processed++;
    try {
      const legacy = doc.data();

      // Use adapters (optionally provide selectors if your adapter supports it)
      // mapLegacyPlayerToNew(playerId, legacy, SEASON[, selectors])
      let mapping;
      try {
        mapping = mapLegacyPlayerToNew.length >= 4
          ? mapLegacyPlayerToNew(playerId, legacy, SEASON, selectors)
          : mapLegacyPlayerToNew(playerId, legacy, SEASON);
      } catch (e) {
        // Fallback to original signature
        mapping = mapLegacyPlayerToNew(playerId, legacy, SEASON);
      }

      const writes = [];
      let parityDiffs = 0;

      // Contracts
      for (const contract of mapping.contracts || []) {
        const ref = contractDoc(playerId, contract.id);
        if (DRY_RUN) continue;

        if (PARITY) {
          const existing = await ref.get().then(s => (s.exists ? s.data() : null));
          const diff = shallowDiff(existing || {}, contract.data);
          parityDiffs += diff.length;
          if (diff.length) {
            eventLog('parity-contract', { playerId, contractId: contract.id, diffCount: diff.length, diffs: diff.slice(0, 10) });
          }
        }
        writes.push({ ref, data: contract.data, options: { merge: true } });
      }

      // Season contractView (summary)
      const view = buildContractView(mapping.contracts || [], SEASON);
      if (view) {
        const ref = seasonDoc(playerId, SEASON);
        const wrapped = { contractView: view };
        if (!DRY_RUN) {
          if (PARITY) {
            const existing = await ref.get().then(s => (s.exists ? s.data() : null));
            const diff = shallowDiff(existing?.contractView || {}, view);
            parityDiffs += diff.length;
            if (diff.length) {
              eventLog('parity-contractView', { playerId, season: SEASON, diffCount: diff.length, diffs: diff.slice(0, 10) });
            }
          }
          writes.push({ ref, data: wrapped, options: { merge: true } });
        }
      }

      // Xref (playersByNbaId)
      if (mapping.xref && mapping.xref.id) {
        const ref = xrefDoc(mapping.xref.id);
        if (!DRY_RUN) {
          if (PARITY) {
            const existing = await ref.get().then(s => (s.exists ? s.data() : null));
            const diff = shallowDiff(existing || {}, mapping.xref.data);
            parityDiffs += diff.length;
            if (diff.length) {
              eventLog('parity-xref', { playerId, nbaId: mapping.xref.id, diffCount: diff.length, diffs: diff.slice(0, 10) });
            }
          }
          writes.push({ ref, data: mapping.xref.data, options: { merge: true } });
        }
      }

      // Commit in chunks
      if (!DRY_RUN && writes.length > 0) {
        for (let i = 0; i < writes.length; i += BATCH_SIZE) {
          const chunk = writes.slice(i, i + BATCH_SIZE);
          eventLog('batch-commit-start', { playerId, chunkSize: chunk.length });
          await commitWithRetries(db, chunk);
        }
      }

      results.push({
        playerId,
        contractsWritten: mapping.contracts ? mapping.contracts.length : 0,
        xrefWritten: mapping.xref ? 1 : 0,
        parityDiffs,
        warnings: (mapping.warnings || []).join('|') || '',
        mode: MODE,
      });

      if (DRY_RUN && processed <= 3) {
        console.log(`\n[DRY] Player: ${playerId}`);
        console.log(`  Contracts: ${mapping.contracts?.length || 0}`);
        console.log(`  XRef: ${mapping.xref ? mapping.xref.id : 'none'}`);
        console.log(`  Warnings: ${(mapping.warnings || []).join(', ') || 'none'}`);
        console.log(`  contractView: ${JSON.stringify(view || {}, null, 2)}`);
      }
    } catch (err) {
      eventLog('player-error', { playerId, error: String(err && err.message || err) });
      results.push({
        playerId,
        contractsWritten: 0,
        xrefWritten: 0,
        parityDiffs: 0,
        warnings: `error:${String(err && err.message || err)}`,
        mode: MODE,
      });
    }
  }

  // Summary artifact
  const summaryPath = path.join(process.cwd(), 'outputs', `migrate_contracts_${MODE}.json`);
  if (!fs.existsSync(path.dirname(summaryPath))) {
    fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
  }
  fs.writeFileSync(summaryPath, JSON.stringify(results, null, 2));

  const totals = results.reduce((acc, r) => {
    acc.contracts += r.contractsWritten || 0;
    acc.xrefs += r.xrefWritten || 0;
    acc.parityDiffs += r.parityDiffs || 0;
    return acc;
  }, { contracts: 0, xrefs: 0, parityDiffs: 0 });

  eventLog('complete', {
    processed: results.length,
    totalContracts: totals.contracts,
    totalXrefs: totals.xrefs,
    totalParityDiffs: totals.parityDiffs,
    summaryJson: summaryPath,
  });

  console.log(`\n✅ Contract & Views migration complete`);
  console.log(`   Processed players: ${results.length}`);
  console.log(`   Total contracts:   ${totals.contracts}`);
  console.log(`   Total xrefs:       ${totals.xrefs}`);
  console.log(`   Parity diffs:      ${totals.parityDiffs}`);
  console.log(`   Mode:              ${MODE}`);
  console.log(`   Summary:           ${summaryPath}`);
}

function buildContractView(contracts, seasonKey) {
  if (!Array.isArray(contracts) || contracts.length === 0) return null;

  // Find current/nearest contract for the season; fall back to first
  const seasonStart = Number((seasonKey || '').split('-')[0]) || null;

  // Expect adapter-produced contract.data like:
  // { id, data: { salaryByYear: { "2025": number }, years, faYear, ... } }
  let best = contracts[0];
  if (seasonStart) {
    for (const c of contracts) {
      const sal = c?.data?.salaryByYear ? c.data.salaryByYear[String(seasonStart)] : undefined;
      if (sal != null) { best = c; break; }
    }
  }
  const d = best?.data || {};
  const totalSalary = (d.salaryByYear && seasonStart && d.salaryByYear[String(seasonStart)] != null)
    ? Number(d.salaryByYear[String(seasonStart)])
    : Number(d.totalSalary || 0);

  const years = Number(d.years || d.yearsRemaining || 0);
  const faYear = d.faYear || d.freeAgencyYear || null;

  return {
    activeContractId: best?.id || null,
    totalSalary: isFinite(totalSalary) ? totalSalary : 0,
    yearsLeft: years,
    faYear,
  };
}

main().catch((err) => {
  console.error('💥 migrate_contracts_and_views failed');
  console.error(err);
  process.exit(1);
});
