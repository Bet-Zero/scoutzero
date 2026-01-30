/**
 * FILE: scripts/emu/seedPlayersIfMissing.ts
 * PURPOSE: Populate architect_basePlayers and players_v2 in the Firestore emulator using staged JSON exports when data is missing.
 * OWNERSHIP: Tooling: local emulator workflow
 *
 * HISTORY:
 *  - 2026-01-29: Created by plan `plans/pst-emulator-seeding/plan.md`
 *
 * LINKS:
 *  - Plan: plans/pst-emulator-seeding/plan.md
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initAdminEmu } from './adminEmu.js';

const BATCH_WRITE_LIMIT = 450; // stay under Firestore 500-write batch cap per requirement
const OUTPUT_ROOT = path.resolve('firestore_staging/_artifacts/output');
const BASE_PLAYERS_DIR = path.join(OUTPUT_ROOT, 'basePlayers');
const PLAYERS_V2_DIR = path.join(OUTPUT_ROOT, 'players_v2');

type SeedLogger = (message: string) => void;

type SeedTarget = 'architect_basePlayers' | 'players_v2' | 'all';

interface SeedOptions {
  force?: boolean;
  logger?: SeedLogger;
}

interface SeedSummary {
  collection: 'architect_basePlayers' | 'players_v2';
  players: number;
  writes: number;
  batches: number;
  skipped: boolean;
}

interface PlayersV2File {
  doc: FirebaseFirestore.DocumentData;
  contracts?: Record<string, FirebaseFirestore.DocumentData>;
  seasons?: Record<string, FirebaseFirestore.DocumentData>;
  views?: Record<string, FirebaseFirestore.DocumentData>;
  evaluations?: Record<string, FirebaseFirestore.DocumentData>;
}

const defaultLog: SeedLogger = (message) => {
  process.stdout.write(`${message}\n`);
};

let cachedDb: FirebaseFirestore.Firestore | null = null;

const getDb = () => {
  if (!cachedDb) {
    const { db } = initAdminEmu();
    cachedDb = db;
  }
  return cachedDb;
};

const assertDirExists = async (dir: string) => {
  try {
    const stats = await fs.stat(dir);
    if (!stats.isDirectory()) {
      throw new Error(`[seed] Expected directory at ${dir} but found a file`);
    }
  } catch (error) {
    throw new Error(`[seed] Required data directory missing: ${dir}`);
  }
};

const listJsonFiles = async (dir: string) => {
  const entries = await fs.readdir(dir);
  return entries
    .filter((file) => file.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b));
};

const readJson = async <T>(filePath: string): Promise<T> => {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw) as T;
};

const createBatcher = (db: FirebaseFirestore.Firestore, logger: SeedLogger) => {
  let batch = db.batch();
  let writesInBatch = 0;
  let totalWrites = 0;
  let batches = 0;

  const flush = async () => {
    if (writesInBatch === 0) {
      return;
    }
    await batch.commit();
    batches += 1;
    logger(`[seed] committed batch ${batches} (${writesInBatch} writes)`);
    batch = db.batch();
    writesInBatch = 0;
  };

  const enqueue = async (
    ref: FirebaseFirestore.DocumentReference,
    payload: FirebaseFirestore.DocumentData
  ) => {
    batch.set(ref, payload);
    writesInBatch += 1;
    totalWrites += 1;
    if (writesInBatch >= BATCH_WRITE_LIMIT) {
      await flush();
    }
  };

  const finalize = async () => {
    await flush();
    return { totalWrites, batches };
  };

  return { enqueue, finalize };
};

const shouldSkipSeed = async (
  db: FirebaseFirestore.Firestore,
  collection: 'architect_basePlayers' | 'players_v2',
  force: boolean,
  logger: SeedLogger
) => {
  if (force) {
    return false;
  }
  const snapshot = await db.collection(collection).limit(1).get();
  if (!snapshot.empty) {
    logger(
      `[seed] ${collection} already populated — skipping (use --force to rewrite).`
    );
    return true;
  }
  return false;
};

export const seedArchitectBasePlayers = async ({
  force = false,
  logger = defaultLog,
}: SeedOptions = {}): Promise<SeedSummary> => {
  await assertDirExists(BASE_PLAYERS_DIR);
  const files = await listJsonFiles(BASE_PLAYERS_DIR);
  if (files.length === 0) {
    throw new Error(
      `[seed] No base player JSON files found in ${BASE_PLAYERS_DIR}`
    );
  }
  const db = getDb();
  if (await shouldSkipSeed(db, 'architect_basePlayers', force, logger)) {
    return {
      collection: 'architect_basePlayers',
      players: 0,
      writes: 0,
      batches: 0,
      skipped: true,
    };
  }
  logger(
    `[seed] writing ${files.length} architect_basePlayers docs from ${BASE_PLAYERS_DIR}`
  );
  const batcher = createBatcher(db, logger);
  for (const file of files) {
    const playerId = file.replace(/\.json$/, '');
    const payload = await readJson<FirebaseFirestore.DocumentData>(
      path.join(BASE_PLAYERS_DIR, file)
    );
    const ref = db.collection('architect_basePlayers').doc(playerId);
    await batcher.enqueue(ref, payload);
  }
  const { totalWrites, batches } = await batcher.finalize();
  return {
    collection: 'architect_basePlayers',
    players: files.length,
    writes: totalWrites,
    batches,
    skipped: false,
  };
};

const writeRecord = async (
  record: Record<string, FirebaseFirestore.DocumentData> | undefined,
  buildRef: (id: string) => FirebaseFirestore.DocumentReference,
  batcher: ReturnType<typeof createBatcher>
) => {
  if (!record) {
    return;
  }
  for (const [docId, docPayload] of Object.entries(record)) {
    await batcher.enqueue(buildRef(docId), docPayload);
  }
};

export const seedPlayersV2 = async ({
  force = false,
  logger = defaultLog,
}: SeedOptions = {}): Promise<SeedSummary> => {
  await assertDirExists(PLAYERS_V2_DIR);
  const files = await listJsonFiles(PLAYERS_V2_DIR);
  if (files.length === 0) {
    throw new Error(
      `[seed] No players_v2 JSON files found in ${PLAYERS_V2_DIR}`
    );
  }
  const db = getDb();
  if (await shouldSkipSeed(db, 'players_v2', force, logger)) {
    return {
      collection: 'players_v2',
      players: 0,
      writes: 0,
      batches: 0,
      skipped: true,
    };
  }
  logger(
    `[seed] writing ${files.length} players_v2 docs (main + subcollections) from ${PLAYERS_V2_DIR}`
  );
  const batcher = createBatcher(db, logger);
  const playersCollection = db.collection('players_v2');
  for (const file of files) {
    const playerId = file.replace(/\.json$/, '');
    const payload = await readJson<PlayersV2File>(
      path.join(PLAYERS_V2_DIR, file)
    );
    if (!payload.doc) {
      throw new Error(`[seed] Missing doc payload for players_v2/${playerId}`);
    }
    const playerDocRef = playersCollection.doc(playerId);
    await batcher.enqueue(playerDocRef, payload.doc);
    await writeRecord(
      payload.contracts,
      (docId) => playerDocRef.collection('contracts').doc(docId),
      batcher
    );
    await writeRecord(
      payload.seasons,
      (docId) => playerDocRef.collection('seasons').doc(docId),
      batcher
    );
    await writeRecord(
      payload.evaluations,
      (docId) => playerDocRef.collection('evaluations').doc(docId),
      batcher
    );
    if (payload.views) {
      for (const [viewDocId, viewPayload] of Object.entries(payload.views)) {
        await batcher.enqueue(
          playerDocRef.collection('views').doc(viewDocId),
          viewPayload
        );
      }
    }
  }
  const { totalWrites, batches } = await batcher.finalize();
  return {
    collection: 'players_v2',
    players: files.length,
    writes: totalWrites,
    batches,
    skipped: false,
  };
};

const normalizeTarget = (value: string): SeedTarget => {
  const normalized = value.trim().toLowerCase();
  if (['architect_baseplayers', 'base', 'baseplayers'].includes(normalized)) {
    return 'architect_basePlayers';
  }
  if (['players_v2', 'players', 'players-v2'].includes(normalized)) {
    return 'players_v2';
  }
  if (normalized === 'all') {
    return 'all';
  }
  throw new Error(`[seed] Unsupported collection target: ${value}`);
};

const parseArgs = (): { target: SeedTarget; force: boolean } => {
  let target: SeedTarget = 'all';
  let force = false;

  for (const arg of process.argv.slice(2)) {
    if (arg === '--force') {
      force = true;
    } else if (arg === '--base') {
      target = 'architect_basePlayers';
    } else if (arg === '--players') {
      target = 'players_v2';
    } else if (arg === '--all') {
      target = 'all';
    } else if (arg.startsWith('--collection=')) {
      target = normalizeTarget(arg.split('=')[1]);
    } else if (arg.startsWith('--target=')) {
      target = normalizeTarget(arg.split('=')[1]);
    } else {
      throw new Error(`[seed] Unknown argument: ${arg}`);
    }
  }

  return { target, force };
};

const runCli = async () => {
  // Initialize and validate (also logs projectId)
  const { projectId } = initAdminEmu();
  defaultLog(`[seed:players] projectId: ${projectId}`);

  const { target, force } = parseArgs();
  const summaries: SeedSummary[] = [];

  if (target === 'all' || target === 'architect_basePlayers') {
    summaries.push(await seedArchitectBasePlayers({ force }));
  }
  if (target === 'all' || target === 'players_v2') {
    summaries.push(await seedPlayersV2({ force }));
  }

  const seeded = summaries.filter((summary) => !summary.skipped);
  if (seeded.length === 0) {
    defaultLog('[seed] All requested player collections already populated.');
    return;
  }

  for (const summary of seeded) {
    defaultLog(
      `[seed] ${summary.collection}: ${summary.players} players (${summary.writes} writes across ${summary.batches} batches).`
    );
  }
};

const resolvedArgvPath = process.argv[1]
  ? path.resolve(process.argv[1])
  : undefined;
const resolvedModulePath = fileURLToPath(import.meta.url);

if (resolvedArgvPath === resolvedModulePath) {
  runCli().catch((error) => {
    process.stderr.write(`[seed] ${String(error)}\n`);
    process.exit(1);
  });
}
