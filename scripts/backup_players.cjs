#!/usr/bin/env node
const fs = require('fs');
const admin = require('firebase-admin');

// Point to your service account JSON:
process.env.GOOGLE_APPLICATION_CREDENTIALS =
  process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccount.json';

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

(async () => {
  const out = fs.createWriteStream('players_backup.jsonl', { flags: 'w' });
  let count = 0;
  const snap = await db.collection('players').get();
  for (const doc of snap.docs) {
    out.write(JSON.stringify({ id: doc.id, ...doc.data() }) + '\n');
    count++;
  }
  out.end();
  console.log(`Wrote ${count} docs to players_backup.jsonl`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
