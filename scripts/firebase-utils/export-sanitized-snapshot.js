/**
 * FILE: scripts/firebase-utils/export-sanitized-snapshot.js
 * PURPOSE: Export a shareable, sanitized (shape-only) snapshot of selected Firestore collections/subcollections.
 *          Values are replaced with type tags and document IDs are hashed.
 *
 * Usage:
 *   node scripts/firebase-utils/export-sanitized-snapshot.js \
 *     --collections=architect_teamPlans,architect_baseTeams \
 *     --maxDocs=3 \
 *     --maxDepth=2 \
 *     --out=scripts/firebase-utils/firestore-snapshot.sanitized.json \
 *     --summaryOut=scripts/firebase-utils/firestore-snapshot.summary.txt
 *
 * If --collections is omitted, reads likelyActive collections from:
 *   scripts/firebase-utils/architect-usage-report.json
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

import { db } from '../firebaseConfig.node.js';

const DEFAULTS = {
  maxDocs: 3,
  maxDepth: 2,
  out: 'scripts/firebase-utils/firestore-snapshot.sanitized.json',
  summaryOut: 'scripts/firebase-utils/firestore-snapshot.summary.txt',
  reportIn: 'scripts/firebase-utils/architect-usage-report.json',
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

function hashDocId(docId) {
  return crypto
    .createHash('sha256')
    .update(String(docId))
    .digest('hex')
    .slice(0, 10);
}

function isTimestampLike(value) {
  return Boolean(value && typeof value?.toDate === 'function');
}

function isGeoPointLike(value) {
  if (!value) return false;
  return (
    typeof value.latitude === 'number' &&
    typeof value.longitude === 'number' &&
    (value.constructor?.name === 'GeoPoint' || value._latitude != null)
  );
}

function isDocumentReferenceLike(value) {
  if (!value) return false;
  // Firestore DocumentReference commonly has .id and .path
  return (
    typeof value.id === 'string' &&
    typeof value.path === 'string' &&
    (value.constructor?.name === 'DocumentReference' ||
      typeof value.parent === 'object')
  );
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return false;
  if (value instanceof Date) return false;
  return value.constructor === Object;
}

function sanitizeValue(value, depth = 0) {
  if (value === null) return '<null>';

  const t = typeof value;
  if (t === 'string') return '<string>';
  if (t === 'number') return '<number>';
  if (t === 'boolean') return '<boolean>';
  if (t === 'undefined') return '<null>';

  if (value instanceof Date || isTimestampLike(value)) return '<timestamp>';
  if (isGeoPointLike(value)) return '<geopoint>';
  if (isDocumentReferenceLike(value)) return '<ref>';

  if (Array.isArray(value)) {
    const items = value.slice(0, 2).map((v) => sanitizeValue(v, depth + 1));
    return {
      __arrayLength: value.length,
      __items: items,
    };
  }

  if (isPlainObject(value)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = sanitizeValue(v, depth + 1);
    }
    return out;
  }

  // Fallback for exotic Firestore/admin types (Bytes, FieldValue sentinels, etc.)
  return '<unknown>';
}

async function readLikelyActiveCollectionsFromReport(reportPath) {
  const raw = await fs.readFile(reportPath, 'utf8');
  const report = JSON.parse(raw);
  const results = Array.isArray(report.results) ? report.results : [];
  return results.filter((r) => r?.likelyActive).map((r) => r.collectionId);
}

async function exportCollectionShape(
  collectionRef,
  { maxDocs, depthRemaining }
) {
  const snapshot = await collectionRef.limit(maxDocs).get();
  const docsOut = {};

  for (const docSnap of snapshot.docs) {
    const hashedId = hashDocId(docSnap.id);

    const fields = sanitizeValue(docSnap.data() ?? {});

    const subcollectionsOut = {};
    if (depthRemaining > 0) {
      const subcols = await docSnap.ref.listCollections();
      for (const subcol of subcols) {
        subcollectionsOut[subcol.id] = await exportCollectionShape(subcol, {
          maxDocs,
          depthRemaining: depthRemaining - 1,
        });
      }
    }

    docsOut[hashedId] = {
      fields,
      subcollections: subcollectionsOut,
    };
  }

  return {
    sampledDocCount: snapshot.size,
    docs: docsOut,
  };
}

function formatSummary(snapshot) {
  const lines = [];
  lines.push('Firestore Sanitized Snapshot Summary');
  lines.push('='.repeat(36));
  lines.push(`Generated: ${snapshot.generatedAt}`);
  lines.push(`Max docs per collection: ${snapshot.inputs.maxDocs}`);
  lines.push(`Max subcollection depth: ${snapshot.inputs.maxDepth}`);
  lines.push(`Collections exported: ${snapshot.inputs.collections.join(', ')}`);
  lines.push('');

  for (const [collectionId, exported] of Object.entries(snapshot.collections)) {
    const docCount = exported.sampledDocCount;
    const subcolNames = new Set();

    for (const doc of Object.values(exported.docs ?? {})) {
      for (const name of Object.keys(doc.subcollections ?? {}))
        subcolNames.add(name);
    }

    lines.push(
      `- ${collectionId}: sampledDocs=${docCount}; subcollectionsSeen=${
        subcolNames.size ? [...subcolNames].sort().join(',') : '-'
      }`
    );
  }

  return lines.join('\n');
}

async function main() {
  const cli = parseCliArgs(process.argv.slice(2));

  const maxDocs = cli.maxDocs ? Number(cli.maxDocs) : DEFAULTS.maxDocs;
  const maxDepth = cli.maxDepth ? Number(cli.maxDepth) : DEFAULTS.maxDepth;

  const out = cli.out ?? DEFAULTS.out;
  const summaryOut = cli.summaryOut ?? DEFAULTS.summaryOut;

  let collections = splitCsv(cli.collections);
  let collectionsSource = 'cli';

  if (collections.length === 0) {
    const reportPath = cli.reportIn ?? DEFAULTS.reportIn;
    collections = await readLikelyActiveCollectionsFromReport(reportPath);
    collectionsSource = reportPath;
  }

  collections = [...new Set(collections)];
  if (collections.length === 0) {
    throw new Error(
      'No collections provided and none found in report (likelyActive). Provide --collections=... or run scan first.'
    );
  }

  const collectionsOut = {};
  for (const collectionId of collections) {
    // eslint-disable-next-line no-console
    console.log(`📦 Exporting sanitized shape: ${collectionId}`);

    collectionsOut[collectionId] = await exportCollectionShape(
      db.collection(collectionId),
      {
        maxDocs,
        depthRemaining: maxDepth,
      }
    );
  }

  const snapshot = {
    generatedAt: new Date().toISOString(),
    inputs: {
      collections,
      collectionsSource,
      maxDocs,
      maxDepth,
      out,
      summaryOut,
    },
    collections: collectionsOut,
  };

  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, JSON.stringify(snapshot, null, 2), 'utf8');

  const summaryTxt = formatSummary(snapshot);
  await fs.mkdir(path.dirname(summaryOut), { recursive: true });
  await fs.writeFile(summaryOut, summaryTxt, 'utf8');

  // eslint-disable-next-line no-console
  console.log(`\n✅ Wrote snapshot JSON: ${out}`);
  // eslint-disable-next-line no-console
  console.log(`✅ Wrote summary TXT: ${summaryOut}`);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('❌ export-sanitized-snapshot failed:', error);
  process.exitCode = 1;
});
