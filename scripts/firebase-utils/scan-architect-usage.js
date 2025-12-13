/**
 * FILE: scripts/firebase-utils/scan-architect-usage.js
 * PURPOSE: Identify likely-active Architect-related Firestore collections based on (a) recent activity timestamps
 *          and (b) codebase references to collection IDs/paths.
 *
 * Usage:
 *   node scripts/firebase-utils/scan-architect-usage.js \
 *     --candidates=teamPlans,architect_teamPlans,architect_baseTeams,architect_basePlayers,teams,architect_* \
 *     --maxDocs=10 \
 *     --activityFieldCandidates=updatedAt,lastUpdated,modifiedAt,editedAt,createdAt \
 *     --out=scripts/firebase-utils/architect-usage-report.json \
 *     --summaryOut=scripts/firebase-utils/architect-usage-report.txt
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { db } from '../firebaseConfig.node.js';

const DEFAULTS = {
  candidates: [
    'teamPlans',
    'architect_teamPlans',
    'architect_baseTeams',
    'architect_basePlayers',
    'teams',
    'architect_*',
  ],
  maxDocs: 10,
  activityFieldCandidates: [
    'updatedAt',
    'lastUpdated',
    'modifiedAt',
    'editedAt',
    'createdAt',
  ],
  out: 'scripts/firebase-utils/architect-usage-report.json',
  summaryOut: 'scripts/firebase-utils/architect-usage-report.txt',
  activityWindowDays: 180,
  maxCodeHitsPerCollection: 25,
  maxFileBytes: 512 * 1024,
};

function parseCliArgs(argv) {
  const args = {};
  for (const raw of argv) {
    if (!raw.startsWith('--')) continue;
    const eqIndex = raw.indexOf('=');
    if (eqIndex === -1) {
      args[raw.slice(2)] = true;
      continue;
    }
    const key = raw.slice(2, eqIndex);
    const value = raw.slice(eqIndex + 1);
    args[key] = value;
  }
  return args;
}

function splitCsv(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function uniqStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function isTimestampLike(value) {
  // firebase-admin Timestamp has toDate(); Date instance is also acceptable.
  if (!value) return false;
  if (value instanceof Date) return true;
  return typeof value?.toDate === 'function';
}

function toMillis(value) {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toDate === 'function') {
    const date = value.toDate();
    if (date instanceof Date) return date.getTime();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Heuristic: treat as epoch (ms if big, otherwise seconds)
    if (value > 10_000_000_000) return value;
    if (value > 100_000_000) return value * 1000;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return null;
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function listTopLevelCollectionIds() {
  const collections = await db.listCollections();
  return collections.map((c) => c.id);
}

function expandWildcardCandidates(candidates, topLevelCollectionIds) {
  const expanded = [];
  for (const candidate of candidates) {
    if (candidate.includes('*')) {
      // Only support simple trailing-wildcard patterns (e.g., architect_*)
      if (candidate.endsWith('*')) {
        const prefix = candidate.slice(0, -1);
        for (const id of topLevelCollectionIds) {
          if (id.startsWith(prefix)) expanded.push(id);
        }
      }
      continue;
    }
    expanded.push(candidate);
  }
  return uniqStrings(expanded);
}

function shouldSkipDirEntry(entryName) {
  return (
    entryName === 'node_modules' ||
    entryName === 'dist' ||
    entryName === 'build' ||
    entryName === '.git' ||
    entryName === '.next' ||
    entryName === 'coverage'
  );
}

function isScannableFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return (
    ext === '.js' ||
    ext === '.jsx' ||
    ext === '.ts' ||
    ext === '.tsx' ||
    ext === '.cjs' ||
    ext === '.mjs'
  );
}

async function* walkFiles(rootDir) {
  const stack = [rootDir];
  while (stack.length) {
    const current = stack.pop();
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (shouldSkipDirEntry(entry.name)) continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        yield fullPath;
      }
    }
  }
}

function makeRepoRelative(absolutePath) {
  const repoRoot = process.cwd();
  const rel = path.relative(repoRoot, absolutePath);
  return rel.startsWith('..') ? absolutePath : rel;
}

async function scanCodeForCollectionIds(collectionIds, opts) {
  const roots = opts.roots;
  const maxFileBytes = opts.maxFileBytes;
  const maxHitsPerCollection = opts.maxHitsPerCollection;

  const hitsByCollection = Object.fromEntries(
    collectionIds.map((id) => [id, []])
  );

  const needlesByCollection = new Map();
  for (const id of collectionIds) {
    // Keep it simple: raw id + a couple of common path-ish variants.
    const needles = new Set([id, `/${id}/`, `\"${id}\"`, `'${id}'`]);
    needlesByCollection.set(id, [...needles]);
  }

  for (const root of roots) {
    const absRoot = path.resolve(process.cwd(), root);
    if (!(await pathExists(absRoot))) continue;

    for await (const filePath of walkFiles(absRoot)) {
      if (!isScannableFile(filePath)) continue;

      let stat;
      try {
        stat = await fs.stat(filePath);
      } catch {
        continue;
      }
      if (!stat.isFile() || stat.size > maxFileBytes) continue;

      let content;
      try {
        content = await fs.readFile(filePath, 'utf8');
      } catch {
        continue;
      }

      const lines = content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;

        for (const id of collectionIds) {
          const existing = hitsByCollection[id];
          if (existing.length >= maxHitsPerCollection) continue;

          const needles = needlesByCollection.get(id);
          if (!needles) continue;

          let matched = false;
          for (const needle of needles) {
            if (line.includes(needle)) {
              matched = true;
              break;
            }
          }
          if (!matched) continue;

          existing.push({
            file: makeRepoRelative(filePath),
            line: i + 1,
            lineSnippet: line.trim().slice(0, 240),
          });
        }
      }
    }
  }

  return hitsByCollection;
}

async function analyzeCollection({
  collectionId,
  maxDocs,
  activityFieldCandidates,
  codeHits,
  activityWindowDays,
}) {
  const result = {
    collectionId,
    docCountSampled: 0,
    fieldUnion: [],
    subcollectionsUnion: [],
    newestTimestamp: null,
    newestTimestampField: null,
    intendedUsedByCode: Array.isArray(codeHits) && codeHits.length > 0,
    codeHits: codeHits ?? [],
    likelyActive: false,
    error: null,
  };

  try {
    const snapshot = await db.collection(collectionId).limit(maxDocs).get();

    result.docCountSampled = snapshot.size;

    const fieldSet = new Set();
    const subcolSet = new Set();

    let newestMillis = null;
    let newestField = null;

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data() ?? {};
      for (const key of Object.keys(data)) fieldSet.add(key);

      for (const field of activityFieldCandidates) {
        if (!(field in data)) continue;
        const value = data[field];
        const millis = toMillis(value);
        if (millis == null) continue;
        if (newestMillis == null || millis > newestMillis) {
          newestMillis = millis;
          newestField = field;
        }
      }

      // Union subcollections from sampled docs.
      try {
        const subcols = await docSnap.ref.listCollections();
        for (const subcol of subcols) subcolSet.add(subcol.id);
      } catch {
        // Ignore per-doc listCollections failures.
      }
    }

    result.fieldUnion = [...fieldSet].sort();
    result.subcollectionsUnion = [...subcolSet].sort();

    if (newestMillis != null) {
      result.newestTimestamp = new Date(newestMillis).toISOString();
      result.newestTimestampField = newestField;
    }

    const activityThresholdMillis =
      Date.now() - activityWindowDays * 24 * 60 * 60 * 1000;

    const activeByData =
      newestMillis != null && newestMillis >= activityThresholdMillis;

    result.likelyActive = Boolean(activeByData || result.intendedUsedByCode);
  } catch (error) {
    result.error = error?.message ?? String(error);
    // If Firestore query fails, still surface code-based intent.
    result.likelyActive = Boolean(result.intendedUsedByCode);
  }

  return result;
}

function formatSummaryTxt(report) {
  const lines = [];
  lines.push('Architect Firestore Usage Report');
  lines.push('='.repeat(34));
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Activity window days: ${report.activityWindowDays}`);
  lines.push(`Candidates (expanded): ${report.candidatesExpanded.join(', ')}`);
  lines.push('');

  const likely = report.results.filter((r) => r.likelyActive);
  lines.push(
    `Likely-active collections: ${likely.length}/${report.results.length}`
  );
  lines.push('');

  for (const r of report.results) {
    const newest = r.newestTimestamp
      ? `${r.newestTimestamp} (${r.newestTimestampField})`
      : 'null';
    const subcols = r.subcollectionsUnion.length
      ? r.subcollectionsUnion.join(',')
      : '-';

    lines.push(
      `- ${r.collectionId}: likelyActive=${r.likelyActive}; sampled=${r.docCountSampled}; newest=${newest}; codeHits=${r.codeHits.length}; subcollections=${subcols}`
    );
    if (r.error) lines.push(`  error: ${r.error}`);
  }

  lines.push('');
  lines.push('Likely-active collection IDs:');
  for (const r of likely) lines.push(`- ${r.collectionId}`);

  return lines.join('\n');
}

async function main() {
  const cli = parseCliArgs(process.argv.slice(2));

  const candidates =
    splitCsv(cli.candidates).length > 0
      ? splitCsv(cli.candidates)
      : DEFAULTS.candidates;

  const maxDocs = cli.maxDocs ? Number(cli.maxDocs) : DEFAULTS.maxDocs;
  const activityFieldCandidates =
    splitCsv(cli.activityFieldCandidates).length > 0
      ? splitCsv(cli.activityFieldCandidates)
      : DEFAULTS.activityFieldCandidates;

  const out = cli.out ?? DEFAULTS.out;
  const summaryOut = cli.summaryOut ?? DEFAULTS.summaryOut;

  const topLevelCollectionIds = await listTopLevelCollectionIds();
  const candidatesExpanded = expandWildcardCandidates(
    candidates,
    topLevelCollectionIds
  );

  // Code hits are computed against the expanded list.
  const codeHitsByCollection = await scanCodeForCollectionIds(
    candidatesExpanded,
    {
      roots: ['src', 'scripts'],
      maxFileBytes: DEFAULTS.maxFileBytes,
      maxHitsPerCollection: DEFAULTS.maxCodeHitsPerCollection,
    }
  );

  const results = [];
  for (const collectionId of candidatesExpanded) {
    const codeHits = codeHitsByCollection[collectionId] ?? [];

    // eslint-disable-next-line no-console
    console.log(`🔎 Scanning collection: ${collectionId}`);

    const analysis = await analyzeCollection({
      collectionId,
      maxDocs,
      activityFieldCandidates,
      codeHits,
      activityWindowDays: DEFAULTS.activityWindowDays,
    });
    results.push(analysis);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    activityWindowDays: DEFAULTS.activityWindowDays,
    inputs: {
      candidates,
      maxDocs,
      activityFieldCandidates,
      out,
      summaryOut,
    },
    candidatesExpanded,
    results,
  };

  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, JSON.stringify(report, null, 2), 'utf8');

  const summaryTxt = formatSummaryTxt(report);
  await fs.mkdir(path.dirname(summaryOut), { recursive: true });
  await fs.writeFile(summaryOut, summaryTxt, 'utf8');

  // eslint-disable-next-line no-console
  console.log(`\n✅ Wrote JSON report: ${out}`);
  // eslint-disable-next-line no-console
  console.log(`✅ Wrote summary: ${summaryOut}`);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('❌ scan-architect-usage failed:', error);
  process.exitCode = 1;
});
