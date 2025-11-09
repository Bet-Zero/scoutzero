import admin from 'firebase-admin';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const SERVICE_ACCOUNT_PATH = path.resolve('serviceAccountKey.json');
const STAGE_DIR = path.resolve('player-scrape/firestore_staging/output');

// Write directly to the live collections so this mirrors the production path.
const PLAYERS_V2_COLLECTION = 'players_v2';
const BASE_PLAYERS_COLLECTION = 'architect_basePlayers';

const serviceAccount = await readFile(SERVICE_ACCOUNT_PATH, 'utf8').then(
  JSON.parse
);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function loadJson(filepath: string) {
  const raw = await readFile(filepath, 'utf8');
  return JSON.parse(raw);
}

async function pushPlayer(playerId: string) {
  const playersV2Path = path.join(STAGE_DIR, 'players_v2', `${playerId}.json`);
  const basePlayerPath = path.join(
    STAGE_DIR,
    'basePlayers',
    `${playerId}.json`
  );

  const playersV2 = await loadJson(playersV2Path);
  const basePlayer = await loadJson(basePlayerPath);

  // Main document
  await db.doc(`${PLAYERS_V2_COLLECTION}/${playerId}`).set(playersV2.doc);

  // Contracts subcollection
  if (playersV2.contracts) {
    for (const [contractId, payload] of Object.entries(playersV2.contracts)) {
      await db
        .doc(`${PLAYERS_V2_COLLECTION}/${playerId}/contracts/${contractId}`)
        .set(payload);
    }
  }

  // Seasons subcollection
  if (playersV2.seasons) {
    for (const [seasonId, payload] of Object.entries(playersV2.seasons)) {
      await db
        .doc(`${PLAYERS_V2_COLLECTION}/${playerId}/seasons/${seasonId}`)
        .set(payload);
    }
  }

  // Views/contracts doc
  if (playersV2.views?.contracts) {
    await db
      .doc(`${PLAYERS_V2_COLLECTION}/${playerId}/views/contracts`)
      .set(playersV2.views.contracts);
  }

  // BasePlayers document
  await db.doc(`${BASE_PLAYERS_COLLECTION}/${playerId}`).set(basePlayer);

  console.log(`✅ Pushed ${playerId}`);
}

async function main() {
  const players = process.argv.slice(2);
  if (!players.length) {
    console.error(
      'Usage: npx tsx push_staged_players.ts player_id [player_id...]'
    );
    process.exit(1);
  }

  for (const playerId of players) {
    await pushPlayer(playerId);
  }
  console.log('🎉 All players pushed.');
}

main().catch((err) => {
  console.error('Push failed:', err);
  process.exit(1);
});
