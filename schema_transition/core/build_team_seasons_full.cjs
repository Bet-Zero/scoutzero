// Team season doc: rosterIds + capTable.totalSalary + placeholders (exceptions, TPEs, picks, deadMoney)
// DRY mode prints only teams in SAMPLE_TEAMS (comma-separated). Real write is sparse.
const fs = require('fs');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const SA_PATH = '../serviceAccountKey.json';
const SEASON = process.env.SEASON || '2025-26';
const DRY = process.env.DRY_RUN === '1';
const SAMPLE = (process.env.SAMPLE_TEAMS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const SAMPLE_SET = new Set(SAMPLE);
const seasonFirstYear = Number(SEASON.split('-')[0]);

function initDB() {
  const sa = JSON.parse(fs.readFileSync(SA_PATH, 'utf8'));
  initializeApp({ credential: cert(sa) });
  return getFirestore();
}

async function main() {
  const db = initDB();
  const tSnap = await db.collection('teams').get();
  let writes = 0,
    processed = 0;

  for (const doc of tSnap.docs) {
    const show = SAMPLE_SET.size === 0 || SAMPLE_SET.has(doc.id);
    const t = doc.data();
    const cap = t?.capSheet || t;

    const rosterIds = Array.isArray(cap?.players)
      ? cap.players.map((p) => p.player_id).filter(Boolean)
      : [];
    let totalSalary = null;
    if (
      cap?.totalSalaryByYear &&
      cap.totalSalaryByYear[seasonFirstYear] != null
    )
      totalSalary = Number(cap.totalSalaryByYear[seasonFirstYear]);
    else if (
      t?.totalSalaryByYear &&
      t.totalSalaryByYear[seasonFirstYear] != null
    )
      totalSalary = Number(t.totalSalaryByYear[seasonFirstYear]);

    const seasonDoc = {
      ...(rosterIds.length ? { rosterIds } : {}),
      ...(totalSalary != null ? { capTable: { totalSalary } } : {}),
      exceptions: [],
      TPEs: [],
      picks: [],
      deadMoney: [], // placeholders (only printed in DRY)
    };

    if (DRY) {
      if (show) {
        console.log('======================================');
        console.log('[DRY FULL] Team:', doc.id);
        console.log(`  seasons/${SEASON} ->`, seasonDoc);
      }
      continue;
    }

    const writeDoc = {
      ...(rosterIds.length ? { rosterIds } : {}),
      ...(totalSalary != null ? { capTable: { totalSalary } } : {}),
    };
    await db
      .doc(`teams/${doc.id}/seasons/${SEASON}`)
      .set(writeDoc, { merge: true });
    writes++;
    processed++;
  }

  console.log(
    `Done teams. Docs processed: ${tSnap.size}, writes: ${writes}${DRY ? ' (DRY)' : ''}.`
  );
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
