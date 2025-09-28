#!/usr/bin/env node
/*
 * Full player migration with dry-run, shadow-write, and live modes.
 * - Maps legacy player docs to the new hierarchical schema using schemaAdapters.
 * - Uses selectors/newSchemeSelectors.js to validate shape parity.
 * - Supports verify-then-swap workflow by requiring a matching shadow document before live writes.
 * - Emits detailed JSON + CSV summaries for auditing and rollback.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL: nodePathToFileURL } = require('url');
const { initFirestore } = require('../utils/firestoreHelpers.cjs');
const {
  mapLegacyPlayerToNew,
  mapNewSeasonToLegacy,
} = require('../utils/schemaAdapters.cjs');

const MODE = process.env.MODE || (process.env.DRY_RUN === '0' ? 'live' : 'dry-run');
const SEASON = process.env.SEASON || '2025-26';
const SAMPLE = (process.env.SAMPLE_PLAYERS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const SAMPLE_SET = new Set(SAMPLE);
const BATCH_SIZE = Number(process.env.BATCH_SIZE || 250);
const MAX_RETRIES = Number(process.env.MAX_RETRIES || 5);
const SHADOW_PREFIX = process.env.SHADOW_PREFIX || 'players_shadow';
const REQUIRE_SHADOW_CONFIRM = process.env.CONFIRM_SHADOW === '1';
const SUMMARY_DIR = path.resolve(process.cwd(), 'outputs');
const SUMMARY_JSON = path.join(SUMMARY_DIR, `migrate_full_players_${MODE}.json`);
const SUMMARY_CSV = path.join(SUMMARY_DIR, `migrate_full_players_${MODE}.csv`);

const DRY_RUN = MODE === 'dry-run';
const SHADOW_MODE = MODE === 'shadow';
const LIVE_MODE = MODE === 'live';

if (!['dry-run', 'shadow', 'live'].includes(MODE)) {
  console.error(`❌ Unknown MODE="${MODE}". Use dry-run | shadow | live.`);
  process.exit(1);
}

if (LIVE_MODE && !REQUIRE_SHADOW_CONFIRM) {
  console.error(
    '❌ Live mode requires CONFIRM_SHADOW=1 to acknowledge shadow parity verification.',
  );
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

function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
  return out;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function diffObjects(expected, actual, pathPrefix = '') {
  const diffs = [];
  const keys = new Set([
    ...Object.keys(expected || {}),
    ...Object.keys(actual || {}),
  ]);
  for (const key of keys) {
    const pathKey = pathPrefix ? `${pathPrefix}.${key}` : key;
    const expectedValue = expected ? expected[key] : undefined;
    const actualValue = actual ? actual[key] : undefined;
    if (
      expectedValue &&
      actualValue &&
      typeof expectedValue === 'object' &&
      typeof actualValue === 'object' &&
      !Array.isArray(expectedValue) &&
      !Array.isArray(actualValue)
    ) {
      diffs.push(...diffObjects(expectedValue, actualValue, pathKey));
      continue;
    }
    const expectedJson = JSON.stringify(expectedValue);
    const actualJson = JSON.stringify(actualValue);
    if (expectedJson !== actualJson) {
      diffs.push({ path: pathKey, expected: expectedValue, actual: actualValue });
    }
  }
  return diffs;
}

function extractComparableLegacy(legacy) {
  const comparable = {};
  if (legacy?.bio && typeof legacy.bio === 'object') {
    comparable.bio = {
      display_name: legacy.bio.display_name ?? legacy.bio.displayName ?? legacy.bio.Name ?? null,
      Position: legacy.bio.Position ?? legacy.bio.position ?? null,
      HT: legacy.bio.HT ?? legacy.bio.height ?? null,
      WT: legacy.bio.WT ?? legacy.bio.weight ?? null,
      AGE: legacy.bio.AGE ?? legacy.bio.age ?? null,
    };
  }
  if (legacy?.Team) comparable.Team = legacy.Team;
  if (legacy?.system?.stats) comparable.system = { stats: legacy.system.stats };
  if (legacy?.traits) comparable.traits = legacy.traits;
  if (legacy?.roles) comparable.roles = legacy.roles;
  if (legacy?.subRoles) comparable.subRoles = legacy.subRoles;
  if (legacy?.blurbs) comparable.blurbs = legacy.blurbs;
  if (legacy?.shootingProfile != null) comparable.shootingProfile = legacy.shootingProfile;
  if (legacy?.twoWayMeter != null) comparable.twoWayMeter = legacy.twoWayMeter;
  const freeAgencyYear =
    legacy?.contract?.free_agency_year || legacy?.contract?.freeAgencyYear || null;
  const rights = legacy?.bird_rights || legacy?.contract?.rights || null;
  if (freeAgencyYear != null || rights != null) {
    comparable.contract = {
      free_agency_year: freeAgencyYear,
      rights,
    };
  }
  if (legacy?.stats_season) comparable.stats_season = legacy.stats_season;
  if (legacy?.stats_carry_over) comparable.stats_carry_over = legacy.stats_carry_over;
  if (legacy?.last_stats_update) comparable.last_stats_update = legacy.last_stats_update;

  const scrubbed = {};
  for (const [key, value] of Object.entries(comparable)) {
    if (value == null) continue;
    if (typeof value === 'object' && !Array.isArray(value)) {
      const nested = {};
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        if (nestedValue != null) nested[nestedKey] = nestedValue;
      }
      if (Object.keys(nested).length) scrubbed[key] = nested;
    } else {
      scrubbed[key] = value;
    }
  }

  return scrubbed;
}

async function commitWithRetries(db, writes) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const batch = db.batch();
    for (const write of writes) {
      const { ref, data, options } = write;
      if (options?.merge) {
        batch.set(ref, data, { merge: true });
      } else if (options?.delete) {
        batch.delete(ref);
      } else {
        batch.set(ref, data);
      }
    }
    try {
      await batch.commit();
      return;
    } catch (err) {
      const delay = Math.min(1000 * 2 ** attempt, 15000);
      eventLog('batch-retry', {
        attempt,
        delay,
        error: err.message,
      });
      await wait(delay);
    }
  }
  throw new Error('Exceeded max retries committing Firestore batch');
}

async function loadSelectors() {
  const modulePath = path.resolve(
    process.cwd(),
    'src/utils/selectors/newSchemeSelectors.js',
  );
  return import(nodePathToFileURL(modulePath).href);
}

async function validateSeasonDoc(selectors, seasonDoc) {
  const issues = [];
  try {
    if (typeof selectors.assertSeasonDocShape === 'function') {
      selectors.assertSeasonDocShape(seasonDoc);
    }
  } catch (err) {
    issues.push(`shape:${err.message}`);
  }
  const displayName = selectors.getDisplayName(seasonDoc, null);
  if (seasonDoc?.bio?.displayName && displayName !== seasonDoc.bio.displayName) {
    issues.push('selector-mismatch:bio.displayName');
  }
  const teamCode = selectors.getTeamCode(seasonDoc, null);
  if (seasonDoc?.team?.code && teamCode !== seasonDoc.team.code) {
    issues.push('selector-mismatch:team.code');
  }
  const salary = selectors.getSalary(seasonDoc, null);
  if (
    seasonDoc?.contractView?.salary != null &&
    salary !== seasonDoc.contractView.salary
  ) {
    issues.push('selector-mismatch:contractView.salary');
  }
  return issues;
}

function summarizeEntry(result) {
  const {
    playerId,
    seasonDoc,
    seasonDiff,
    warnings,
    selectorIssues,
    modeAction,
  } = result;
  return {
    playerId,
    seasonWritten: modeAction,
    warnings: warnings.join('|') || '',
    selectorIssues: selectorIssues.join('|') || '',
    diffCount: seasonDiff.length,
  };
}

function writeSummaries(summary) {
  if (!fs.existsSync(SUMMARY_DIR)) fs.mkdirSync(SUMMARY_DIR, { recursive: true });
  fs.writeFileSync(SUMMARY_JSON, JSON.stringify(summary, null, 2));
  const header = 'playerId,seasonWritten,warnings,selectorIssues,diffCount\n';
  const csvBody = summary
    .map((row) =>
      [
        row.playerId,
        row.seasonWritten,
        row.warnings,
        row.selectorIssues,
        row.diffCount,
      ]
        .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
        .join(','),
    )
    .join('\n');
  fs.writeFileSync(SUMMARY_CSV, header + csvBody);
}

async function main() {
  eventLog('start', { sampleCount: SAMPLE_SET.size, batchSize: BATCH_SIZE });
  const db = initFirestore();
  const selectors = await loadSelectors();

  const playersSnap = await db.collection('players').get();
  eventLog('players-read', { count: playersSnap.size });

  const results = [];
  const shadowFailures = [];

  const docs = playersSnap.docs.filter((doc) =>
    SAMPLE_SET.size ? SAMPLE_SET.has(doc.id) : true,
  );

  const targetPlayers = SAMPLE_SET.size ? docs : playersSnap.docs;
  const chunks = chunk(targetPlayers, BATCH_SIZE);

  for (const [chunkIndex, docsChunk] of chunks.entries()) {
    const writes = [];
    for (const doc of docsChunk) {
      const legacy = doc.data();
      const mapping = mapLegacyPlayerToNew(doc.id, legacy, SEASON);
      const selectorIssues = await validateSeasonDoc(selectors, mapping.seasonDoc || {});

      const legacyRoundTrip = mapNewSeasonToLegacy(
        doc.id,
        SEASON,
        mapping.seasonDoc || {},
      );
      const expectedLegacy = extractComparableLegacy(legacy);
      const parityDiff = diffObjects(expectedLegacy || {}, legacyRoundTrip || {});

      let modeAction = 'skipped';
      if (DRY_RUN) {
        modeAction = 'dry-run';
      } else {
        const baseCollection = SHADOW_MODE ? SHADOW_PREFIX : 'players';
        const xrefCollection = SHADOW_MODE
          ? 'playersByNbaId_shadow'
          : 'playersByNbaId';

        if (LIVE_MODE) {
          const shadowSeasonRef = db
            .collection(`${SHADOW_PREFIX}`)
            .doc(doc.id)
            .collection('seasons')
            .doc(SEASON);
          const shadowSnap = await shadowSeasonRef.get();
          if (!shadowSnap.exists) {
            shadowFailures.push({ playerId: doc.id, reason: 'missing-shadow-season' });
            modeAction = 'blocked-missing-shadow';
          } else {
            const shadowDiff = diffObjects(
              mapping.seasonDoc || {},
              shadowSnap.data() || {},
            );
            if (shadowDiff.length) {
              shadowFailures.push({
                playerId: doc.id,
                reason: 'shadow-mismatch',
                diff: shadowDiff,
              });
              modeAction = 'blocked-shadow-mismatch';
            }
          }
        }

        if (!(LIVE_MODE && modeAction.startsWith('blocked'))) {
          if (Object.keys(mapping.playerDoc).length) {
            const ref = db.collection(baseCollection).doc(mapping.playerId);
            writes.push({ ref, data: mapping.playerDoc, options: { merge: true } });
          }
          if (mapping.seasonDoc) {
            const ref = db
              .collection(baseCollection)
              .doc(mapping.playerId)
              .collection('seasons')
              .doc(SEASON);
            writes.push({ ref, data: mapping.seasonDoc, options: { merge: true } });
            modeAction = `${MODE}-season`;
          }
          for (const contract of mapping.contracts) {
            const ref = db
              .collection(baseCollection)
              .doc(mapping.playerId)
              .collection('contracts')
              .doc(contract.id);
            writes.push({ ref, data: contract.data, options: { merge: true } });
          }
          if (mapping.xref) {
            const ref = db.collection(xrefCollection).doc(mapping.xref.id);
            writes.push({ ref, data: mapping.xref.data, options: { merge: true } });
          }
        }
      }

      results.push(
        summarizeEntry({
          playerId: mapping.playerId,
          seasonDoc: mapping.seasonDoc,
          seasonDiff: parityDiff,
          warnings: mapping.warnings,
          selectorIssues,
          modeAction,
        }),
      );
    }

    if (!DRY_RUN && writes.length) {
      eventLog('batch-commit-start', {
        chunk: chunkIndex,
        writeCount: writes.length,
      });
      await commitWithRetries(db, writes);
      eventLog('batch-commit-success', { chunk: chunkIndex });
    }
  }

  if (shadowFailures.length) {
    eventLog('shadow-verify-failed', { failures: shadowFailures.length });
    fs.writeFileSync(
      SUMMARY_JSON.replace('.json', '_shadow_failures.json'),
      JSON.stringify(shadowFailures, null, 2),
    );
    if (LIVE_MODE) {
      console.error('❌ Live migration blocked due to shadow verification failures.');
      process.exit(2);
    }
  }

  writeSummaries(results);
  eventLog('complete', { processed: results.length, summaryJson: SUMMARY_JSON });
}

main().catch((err) => {
  console.error('💥 migrate_full_players failed');
  console.error(err);
  process.exit(1);
});
