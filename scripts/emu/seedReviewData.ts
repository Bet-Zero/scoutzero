/**
 * FILE: scripts/emu/seedReviewData.ts
 * PURPOSE: Seed minimal data into emulators for Architect review mode.
 *          Uses fixtures from tools/architect_review_seed/ to populate
 *          architect_baseTeams, architect_basePlayers, and architect_baseEntitlements.
 * OWNERSHIP: Tooling: architect review mode workflow
 *
 * USAGE:
 *   npm run architect:review:seed
 *
 * PREREQUISITES:
 *   - Firebase emulators must be running (port 8082 for Firestore)
 *   - FIRESTORE_EMULATOR_HOST must be set
 *
 * NOTE: This script uses a demo project ID when not specified.
 */

import fs from 'node:fs';
import path from 'node:path';
import admin from 'firebase-admin';

const SEED_DIR = path.resolve('tools/architect_review_seed');
const BASE_TEAMS_DIR = path.join(SEED_DIR, 'baseTeams');
const BASE_PLAYERS_DIR = path.join(SEED_DIR, 'basePlayers');
const ENTITLEMENTS_FILE = path.join(SEED_DIR, 'baseEntitlements.json');
const REVIEW_SEASON = '2026-27';
const ALL_TEAM_CODES = [
  'ATL',
  'BOS',
  'BKN',
  'CHA',
  'CHI',
  'CLE',
  'DAL',
  'DEN',
  'DET',
  'GSW',
  'HOU',
  'IND',
  'LAC',
  'LAL',
  'MEM',
  'MIA',
  'MIL',
  'MIN',
  'NOP',
  'NYK',
  'OKC',
  'ORL',
  'PHI',
  'PHX',
  'POR',
  'SAC',
  'SAS',
  'TOR',
  'UTA',
  'WAS',
];

/**
 * Demo project ID for review mode.
 * Matches the REVIEW_MODE_CONFIG in src/firebaseConfig.js
 */
const REVIEW_PROJECT_ID = 'demo-architect-review';

const log = (message: string) => {
  process.stdout.write(`${message}\n`);
};

/**
 * Initialize Admin SDK for emulator use.
 */
const initAdminForReview = () => {
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  if (!emulatorHost) {
    throw new Error(
      '[seed-review] FIRESTORE_EMULATOR_HOST not set. Ensure emulators are running.'
    );
  }

  const projectId =
    process.env.GCLOUD_PROJECT ??
    process.env.FIREBASE_PROJECT_ID ??
    REVIEW_PROJECT_ID;

  if (admin.apps.length === 0) {
    admin.initializeApp({ projectId });
  }

  log(`[seed-review] Using projectId=${projectId} emulator=${emulatorHost}`);
  return admin.firestore();
};

const readJson = <T>(filePath: string): T => {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as T;
};

const listJsonFiles = (dir: string): string[] => {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort();
};

const buildPlaceholderTeam = (teamCode: string) => ({
  teamCode,
  teamName: `${teamCode} Placeholder`,
  season: REVIEW_SEASON,
  abbreviation: teamCode,
  roster: [],
  deadCap: [],
  capHolds: [],
  entitlementIds: [],
  capSheet: {
    totalSalary: 0,
    capSpace: 0,
    taxLine: 188000000,
    firstApron: 178000000,
    secondApron: 189000000,
    hardCap: null,
  },
  totals: {},
  exceptions: {},
  draftPicks: [],
});

const seedBaseTeams = async (db: FirebaseFirestore.Firestore) => {
  log('[seed-review] Seeding architect_baseTeams...');
  const files = listJsonFiles(BASE_TEAMS_DIR);

  const batch = db.batch();
  let count = 0;
  const seededCodes = new Set<string>();

  for (const file of files) {
    const teamCode = file.replace('.json', '');
    const data = readJson<Record<string, unknown>>(
      path.join(BASE_TEAMS_DIR, file)
    );
    batch.set(db.collection('architect_baseTeams').doc(teamCode), data);
    seededCodes.add(teamCode);
    count++;
  }

  const placeholderCodes = ALL_TEAM_CODES.filter(
    (teamCode) => !seededCodes.has(teamCode)
  );

  placeholderCodes.forEach((teamCode) => {
    batch.set(
      db.collection('architect_baseTeams').doc(teamCode),
      buildPlaceholderTeam(teamCode)
    );
    count++;
  });

  await batch.commit();
  log(
    `[seed-review] ✓ Seeded ${count} teams (${placeholderCodes.length} placeholders)`
  );
  return count;
};

const seedBasePlayers = async (db: FirebaseFirestore.Firestore) => {
  log('[seed-review] Seeding architect_basePlayers...');
  const files = listJsonFiles(BASE_PLAYERS_DIR);
  if (files.length === 0) {
    log('[seed-review] ⚠️  No basePlayers fixtures found');
    return 0;
  }

  const batch = db.batch();
  let count = 0;

  for (const file of files) {
    const playerId = file.replace('.json', '');
    const data = readJson<Record<string, unknown>>(
      path.join(BASE_PLAYERS_DIR, file)
    );
    batch.set(db.collection('architect_basePlayers').doc(playerId), data);
    count++;
  }

  await batch.commit();
  log(`[seed-review] ✓ Seeded ${count} players`);
  return count;
};

const seedBaseEntitlements = async (db: FirebaseFirestore.Firestore) => {
  log('[seed-review] Seeding architect_baseEntitlements...');

  if (!fs.existsSync(ENTITLEMENTS_FILE)) {
    log('[seed-review] ⚠️  No entitlements fixture found');
    return 0;
  }

  const entitlements =
    readJson<Array<{ id: string } & Record<string, unknown>>>(
      ENTITLEMENTS_FILE
    );

  if (entitlements.length === 0) {
    log('[seed-review] ⚠️  Entitlements file is empty');
    return 0;
  }

  const batch = db.batch();
  let count = 0;

  for (const ent of entitlements) {
    if (!ent.id) {
      log(
        `[seed-review] ⚠️  Skipping entitlement without id: ${JSON.stringify(ent)}`
      );
      continue;
    }
    batch.set(db.collection('architect_baseEntitlements').doc(ent.id), ent);
    count++;
  }

  await batch.commit();
  log(`[seed-review] ✓ Seeded ${count} entitlements`);
  return count;
};

const main = async () => {
  log('');
  log('═══════════════════════════════════════════════════════════════════');
  log('  🌱 Architect Review Mode — Seeding Minimal Data');
  log('═══════════════════════════════════════════════════════════════════');
  log('');

  const db = initAdminForReview();

  const results = {
    teams: await seedBaseTeams(db),
    players: await seedBasePlayers(db),
    entitlements: await seedBaseEntitlements(db),
  };

  log('');
  log('───────────────────────────────────────────────────────────────────');
  log('  📊 Seed Summary');
  log(`     Teams:        ${results.teams}`);
  log(`     Players:      ${results.players}`);
  log(`     Entitlements: ${results.entitlements}`);
  log('───────────────────────────────────────────────────────────────────');

  const total = results.teams + results.players + results.entitlements;
  if (total === 0) {
    log('');
    log(
      '  ⚠️  No data seeded — check fixtures in tools/architect_review_seed/'
    );
    process.exit(1);
  }

  log('');
  log('  ✅ Review data seeded successfully');
  log('');
};

main().catch((error) => {
  process.stderr.write(`[seed-review] Fatal error: ${String(error)}\n`);
  process.exit(1);
});
