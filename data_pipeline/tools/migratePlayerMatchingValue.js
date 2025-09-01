#!/usr/bin/env node
/* ========================================================================
   MIGRATION:  add matchingValue / isBYC / ppaMultiplier to every player
   ------------------------------------------------------------------------
   USAGE:
     node data_pipeline/tools/migratePlayerMatchingValue.js --project scoutzero-bf1ae
     node data_pipeline/tools/migratePlayerMatchingValue.js --project scoutzero-bf1ae --write
     node data_pipeline/tools/migratePlayerMatchingValue.js --project scoutzero-bf1ae --write --targetCollection players_staging
   ===================================================================== */

import minimist from 'minimist';
import admin from 'firebase-admin';
import { fileURLToPath } from 'url';
import path from 'path';

const args = minimist(process.argv.slice(2));
const projectId = args.project;
const shouldWrite = !!args.write;
const target = args.targetCollection || 'players';
const strict = !!args.strict;

if (!projectId) {
  console.error('❌  --project <firebase-project-id> is required');
  process.exit(1);
}

/* ----------  Firebase Init  ---------------------------------------- */
const serviceKeyPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  `../../serviceAccountKey.json`
);

admin.initializeApp({
  credential: admin.credential.cert(serviceKeyPath),
  projectId,
});
const db = admin.firestore();

/* ----------  Runner  ------------------------------------------------ */
(async () => {
  console.log(
    `🏃  Scanning collection “${target}”  (${shouldWrite ? 'WRITE' : 'DRY-RUN'})`
  );

  const snap = await db.collection(target).get();
  let updated = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const yearKey = '2025';
    const salary = data.salaries?.[yearKey];

    const patch = {};
    if (data.matchingValue == null && salary != null)
      patch.matchingValue = salary;
    if (data.isBYC == null) patch.isBYC = false;
    if (data.ppaMultiplier == null) patch.ppaMultiplier = null;

    if (Object.keys(patch).length === 0) continue; // nothing to add

    if (shouldWrite) {
      await doc.ref.update(patch);
    }
    updated += 1;

    console.log(
      `${shouldWrite ? '📝 UPDATED' : '🔍 WOULD-UPDATE'} ${doc.id}:`,
      patch
    );
  }

  console.log(
    `\n✅  ${shouldWrite ? 'Migration complete' : 'Dry-run summary'} – ${updated} docs ${
      shouldWrite ? 'modified' : 'would be modified'
    }`
  );
})().catch((err) => {
  console.error('💥  Migration failed\n', err);
  if (strict) process.exit(1);
});
