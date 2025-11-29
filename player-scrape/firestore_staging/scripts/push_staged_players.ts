import admin from 'firebase-admin';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import {
  PlayerMainDocZ,
  ContractDocZ,
  SeasonDocZ,
  ContractsViewDocZ,
} from '@/schemas/players_v2';
import { BasePlayerDocZ } from '@/schemas/architect';

const SERVICE_ACCOUNT_PATH = path.resolve('serviceAccountKey.json');
// Stage script writes to scripts/_artifacts/output, not _artifacts/output
const STAGE_DIR = path.resolve('player-scrape/firestore_staging/scripts/_artifacts/output');

const PLAYERS_V2_COLLECTION = process.env.PLAYERS_V2_COLLECTION ?? 'players_v2';
const BASE_PLAYERS_COLLECTION =
  process.env.BASE_PLAYERS_COLLECTION ?? 'architect_basePlayers';

const serviceAccount = await readFile(SERVICE_ACCOUNT_PATH, 'utf8').then(
  JSON.parse
);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function loadJson(filepath: string) {
  const raw = await readFile(filepath, 'utf8');
  return JSON.parse(raw);
}

async function validatePlayer(
  playerId: string
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  try {
    const playersV2Path = path.join(
      STAGE_DIR,
      'players_v2',
      `${playerId}.json`
    );
    const basePlayerPath = path.join(
      STAGE_DIR,
      'basePlayers',
      `${playerId}.json`
    );

    const playersV2 = await loadJson(playersV2Path);
    const basePlayer = await loadJson(basePlayerPath);

    // Validate main doc
    const mainDocResult = PlayerMainDocZ.safeParse(playersV2.doc);
    if (!mainDocResult.success) {
      errors.push(
        `Main doc: ${mainDocResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`
      );
    }

    // Validate contracts
    if (playersV2.contracts) {
      for (const [contractId, contract] of Object.entries(
        playersV2.contracts
      )) {
        const contractResult = ContractDocZ.safeParse(contract);
        if (!contractResult.success) {
          errors.push(
            `Contract ${contractId}: ${contractResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`
          );
        }
      }
    }

    // Validate seasons
    if (playersV2.seasons) {
      for (const [seasonId, season] of Object.entries(playersV2.seasons)) {
        const seasonResult = SeasonDocZ.safeParse(season);
        if (!seasonResult.success) {
          errors.push(
            `Season ${seasonId}: ${seasonResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`
          );
        }
      }
    }

    // Validate contracts view
    if (playersV2.views?.contracts) {
      const viewResult = ContractsViewDocZ.safeParse(playersV2.views.contracts);
      if (!viewResult.success) {
        errors.push(
          `Contracts view: ${viewResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`
        );
      }
    }

    // Validate basePlayer
    const basePlayerResult = BasePlayerDocZ.safeParse(basePlayer);
    if (!basePlayerResult.success) {
      errors.push(
        `BasePlayer: ${basePlayerResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`
      );
    }

    return { valid: errors.length === 0, errors };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { valid: false, errors: [`Failed to load or validate: ${message}`] };
  }
}

async function pushPlayer(playerId: string) {
  // Validate before pushing
  console.log(`🔍 Validating ${playerId}...`);
  const validation = await validatePlayer(playerId);
  if (!validation.valid) {
    console.error(`❌ Validation failed for ${playerId}:`);
    validation.errors.forEach((err) => console.error(`   ${err}`));
    throw new Error(
      `Validation failed for ${playerId}. Cannot push invalid data.`
    );
  }
  console.log(`✅ Validation passed for ${playerId}`);

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

async function getAllStagedPlayers(): Promise<string[]> {
  const playersV2Dir = path.join(STAGE_DIR, 'players_v2');
  try {
    const files = await readdir(playersV2Dir);
    return files
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace('.json', ''));
  } catch (error) {
    throw new Error(
      `Failed to read staged players directory: ${playersV2Dir}. Make sure you've run the staging script first.`
    );
  }
}

async function main() {
  const args = process.argv.slice(2);
  const players: string[] = [];
  let pushAll = false;

  // Check for --all flag
  if (args.includes('--all')) {
    pushAll = true;
  }

  // Parse arguments - support both --player=id and positional args
  for (const arg of args) {
    if (arg === '--all') {
      continue; // Already handled
    } else if (arg.startsWith('--player=')) {
      players.push(arg.replace('--player=', ''));
    } else if (arg.startsWith('--player')) {
      // Skip --player flag, next arg is the value
      continue;
    } else if (args[args.indexOf(arg) - 1] === '--player') {
      // This is the value after --player flag
      players.push(arg);
    } else if (!arg.startsWith('--')) {
      // Positional argument (player ID)
      players.push(arg);
    }
  }

  // If --all flag, get all staged players
  if (pushAll) {
    const allStaged = await getAllStagedPlayers();
    players.push(...allStaged);
    console.log(`📦 Found ${allStaged.length} staged players to push`);
  }

  if (!players.length) {
    console.error(
      'Usage: npx tsx push_staged_players.ts [--all] [--player=]player_id [player_id...]'
    );
    console.error('Examples:');
    console.error('  npx tsx push_staged_players.ts --all');
    console.error('  npx tsx push_staged_players.ts paolo_banchero');
    console.error('  npx tsx push_staged_players.ts --player=paolo_banchero');
    process.exit(1);
  }

  console.log(`🚀 Pushing ${players.length} player(s)...\n`);

  for (const playerId of players) {
    await pushPlayer(playerId);
  }
  console.log('\n🎉 All players pushed.');
}

main().catch((err) => {
  console.error('Push failed:', err);
  process.exit(1);
});
