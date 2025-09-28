// SCSP™ — Full file block
// Purpose: Export current Firestore to JSON (players, teams, seasons subcollections)

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

const SA_PATH = process.env.SA_PATH || '../serviceAccountKey.json';
const OUT_DIR = './outputs';
const OUT_FILE = path.join(OUT_DIR, 'current_export.json');

async function initDB() {
  const serviceAccount = JSON.parse(fs.readFileSync(SA_PATH, 'utf8'));
  initializeApp({ credential: cert(serviceAccount) });
  return getFirestore();
}

async function exportCollection(db, colName, subCollections = []) {
  const res = {};
  const snap = await db
    .collection(colName)
    .get()
    .catch(() => null);
  if (!snap) return res;

  for (const doc of snap.docs) {
    res[doc.id] = doc.data();

    for (const sub of subCollections) {
      const subSnap = await db
        .collection(colName)
        .doc(doc.id)
        .collection(sub)
        .get()
        .catch(() => null);
      if (subSnap) {
        if (!res[doc.id].__sub) res[doc.id].__sub = {};
        res[doc.id].__sub[sub] = {};
        for (const sdoc of subSnap.docs) {
          res[doc.id].__sub[sub][sdoc.id] = sdoc.data();
        }
      }
    }
  }
  return res;
}

async function main() {
  const db = await initDB();
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const players = await exportCollection(db, 'players', ['seasons']);
  const teams = await exportCollection(db, 'teams', ['seasons']);

  const out = { players, teams, exportedAt: new Date().toISOString() };
  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2));
  console.log('Export complete ->', OUT_FILE);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
