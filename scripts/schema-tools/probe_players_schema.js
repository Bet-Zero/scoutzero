// scripts/probe_players_schema.js
// Run:
//   PROJECT_ID=scoutzero-bf1ae PLAYERS_ROOT=players_v2 SAMPLE_COUNT=3 \
//   node scripts/probe_players_schema.js

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ID = process.env.PROJECT_ID || 'scoutzero-bf1ae';
const PLAYERS_ROOT = process.env.PLAYERS_ROOT || 'players_v2';
const SAMPLE_COUNT = Number(process.env.SAMPLE_COUNT || 3);

// ---- init with your ./serviceAccountKey.json
const keyPath = path.resolve('./serviceAccountKey.json');
if (!fs.existsSync(keyPath)) {
  console.error('Missing ./serviceAccountKey.json in project root');
  process.exit(1);
}
if ((getApps()?.length || 0) === 0) {
  initializeApp({ credential: cert(keyPath), projectId: PROJECT_ID });
}
const db = getFirestore();

// ---- helpers
const typeOf = (v) =>
  v === null
    ? 'null'
    : Array.isArray(v)
      ? 'array'
      : typeof v === 'object'
        ? 'object'
        : typeof v;

async function sampleDoc(ref) {
  const out = { path: ref.path, fields: {}, subcollections: [] };
  try {
    const snap = await ref.get();
    if (snap?.exists) {
      const data = snap.data() || {};
      for (const [k, v] of Object.entries(data))
        out.fields[k] = { type: typeOf(v) };
    }
  } catch (e) {
    out.error = `get() failed: ${e?.message || e}`;
  }
  try {
    const subs = await ref.listCollections();
    out.subcollections = Array.isArray(subs) ? subs.map((c) => c.id) : [];
  } catch {
    out.subcollections = [];
  }
  return out;
}

function mdFromLock(lock) {
  let md = `# Players_v2 Schema Lock\n\nGenerated: ${lock.generatedAt}\nRoot: \`${lock.root}\`\n\n`;
  for (const doc of lock.docs || []) {
    md += `## ${doc.path}\n\n`;
    const fieldKeys = Object.keys(doc.fields || {});
    md += fieldKeys.length ? `**Fields**\n\n` : `_No fields_\n\n`;
    for (const k of fieldKeys)
      md += `- \`${k}\` — **${doc.fields[k]?.type || 'unknown'}**\n`;
    const subs = doc.subcollections || [];
    md += `\n**Subcollections**: ${subs.length ? subs.map((s) => `\`${s}\``).join(', ') : '_none_'}\n\n`;
  }
  return md;
}

async function run() {
  const lock = {
    generatedAt: new Date().toISOString(),
    root: PLAYERS_ROOT,
    docs: [],
  };
  const contractsDump = []; // <- full raw contract docs go here

  const snap = await db.collection(PLAYERS_ROOT).limit(SAMPLE_COUNT).get();
  const players = snap?.docs ?? [];
  for (const p of players) {
    // player root doc
    lock.docs.push(await sampleDoc(p.ref));

    // subcollections
    const subs = (await p.ref.listCollections()).map((c) => c.id);
    for (const sub of subs) {
      const subSnap = await p.ref.collection(sub).limit(SAMPLE_COUNT).get();
      const subDocs = subSnap?.docs ?? [];
      for (const sd of subDocs) {
        lock.docs.push(await sampleDoc(sd.ref));

        // if this is a contracts doc, also dump the FULL raw data so we can see nested keys like freeAgency.*
        if (sub.toLowerCase() === 'contracts') {
          const s = await sd.ref.get();
          if (s?.exists) {
            contractsDump.push({
              path: sd.ref.path,
              data: s.data(), // <- includes freeAgency object with all inner fields
            });
          }
        }
      }
    }
  }

  // write outputs
  if (!fs.existsSync('schema-lock-players_v2'))
    fs.mkdirSync('schema-lock-players_v2', { recursive: true });
  fs.writeFileSync(
    'schema-lock-players_v2/players_schema.lock.json',
    JSON.stringify(lock, null, 2),
    'utf8'
  );
  fs.writeFileSync(
    'schema-lock-players_v2/players_schema.lock.md',
    mdFromLock(lock),
    'utf8'
  );
  fs.writeFileSync(
    'schema-lock-players_v2/contracts_sample.json',
    JSON.stringify(contractsDump, null, 2),
    'utf8'
  );

  console.log('✅ wrote schema-lock-players_v2/players_schema.lock.json');
  console.log('✅ wrote schema-lock-players_v2/players_schema.lock.md');
  console.log(
    '✅ wrote schema-lock-players_v2/contracts_sample.json (FULL contract docs incl. freeAgency)'
  );
}

run().catch((e) => {
  console.error('Fatal:', e?.message || e);
  process.exit(1);
});
