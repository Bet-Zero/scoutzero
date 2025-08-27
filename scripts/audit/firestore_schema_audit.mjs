// SCSP: Live Firestore schema snapshot (counts + field samples)
// Usage: node scripts/audit/firestore_schema_audit.mjs
// Looks for GOOGLE_APPLICATION_CREDENTIALS; falls back to ./serviceAccountKey.json

import fs from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function resolveCredsPath() {
  const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (envPath && fs.existsSync(envPath)) return envPath;
  const fallback = './serviceAccountKey.json';
  if (fs.existsSync(fallback)) return fallback;
  console.error(
    '❌ No service account JSON found. Set GOOGLE_APPLICATION_CREDENTIALS or place ./serviceAccountKey.json'
  );
  process.exit(1);
}

const credsPath = resolveCredsPath();
const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
initializeApp({ credential: cert(creds) });
const db = getFirestore();

const OUT = {
  when: new Date().toISOString(),
  projectId: creds.project_id || null,
  collections: [],
  collectionGroups: [],
};

async function listTopCollections() {
  const cols = await db.listCollections();
  return cols.map((c) => c.id).sort();
}

async function sampleTopCollection(id, sampleSize = 10) {
  const snap = await db.collection(id).limit(sampleSize).get();
  const fields = {};
  snap.forEach((doc) => {
    const data = doc.data() || {};
    for (const [k, v] of Object.entries(data)) {
      const t = Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v;
      fields[k] = fields[k] || new Set();
      fields[k].add(t);
    }
  });
  return Object.fromEntries(
    Object.entries(fields).map(([k, set]) => [k, [...set].sort()])
  );
}

async function sampleCollectionGroup(id, sampleSize = 10) {
  const snap = await db.collectionGroup(id).limit(sampleSize).get();
  const fields = {};
  let count = 0;
  snap.forEach((doc) => {
    count++;
    const data = doc.data() || {};
    for (const [k, v] of Object.entries(data)) {
      const t = Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v;
      fields[k] = fields[k] || new Set();
      fields[k].add(t);
    }
  });
  return {
    sampleCount: count,
    fields: Object.fromEntries(
      Object.entries(fields).map(([k, set]) => [k, [...set].sort()])
    ),
  };
}

async function run() {
  console.log('📦 Listing top-level collections…');
  const top = await listTopCollections();

  for (const colId of top) {
    const fields = await sampleTopCollection(colId);
    OUT.collections.push({ colId, sampleFields: fields });
  }

  const cgCandidates = [
    'players',
    'teams',
    'capSheets',
    'planMeta',
    'roster',
    'trades',
    'exceptions',
    'picks',
    'seasons',
  ];
  for (const cg of cgCandidates) {
    try {
      const res = await sampleCollectionGroup(cg);
      if (res.sampleCount > 0)
        OUT.collectionGroups.push({ groupId: cg, ...res });
    } catch {
      /* ignore */
    }
  }

  const outPath = 'scripts/audit/_firestore_schema_snapshot.json';
  fs.writeFileSync(outPath, JSON.stringify(OUT, null, 2));
  console.log(`✅ Snapshot → ${outPath}`);
}
run();
