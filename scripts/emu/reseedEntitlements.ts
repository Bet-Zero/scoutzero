/**
 * FILE: scripts/emu/reseedEntitlements.ts
 * PURPOSE: Force-refresh entitlement data in the Firestore emulator by deleting and re-seeding.
 * OWNERSHIP: Tooling: local emulator workflow
 *
 * HISTORY:
 *  - 2026-01-29: Created for force-reseed workflow after generator changes
 *
 * LINKS:
 *  - Related: scripts/emu/seedIfMissing.ts
 */

import admin from 'firebase-admin';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const REQUIRED_TEAMS = 30;
const BATCH_DELETE_LIMIT = 450;
const ENTITLEMENTS_JSON_PATH = path.resolve(
  'data/pst/pst_entitlement_assets_2026_2033.json'
);

const getExpectedEntitlementCount = (): number => {
  if (!fs.existsSync(ENTITLEMENTS_JSON_PATH)) {
    throw new Error(
      `[reseed] entitlements JSON not found at ${ENTITLEMENTS_JSON_PATH}`
    );
  }
  const raw = fs.readFileSync(ENTITLEMENTS_JSON_PATH, 'utf8');
  const data = JSON.parse(raw) as unknown;
  if (Array.isArray(data)) {
    return data.length;
  }
  if (typeof data === 'object' && data !== null && 'assets' in data) {
    const assets = (data as { assets: unknown[] }).assets;
    if (Array.isArray(assets)) {
      return assets.length;
    }
  }
  throw new Error(
    `[reseed] invalid shape in ${ENTITLEMENTS_JSON_PATH}: expected { assets: [...] } or [...]`
  );
};

const requireEmulatorEnv = () => {
  const missing: string[] = [];
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    missing.push('FIRESTORE_EMULATOR_HOST');
  }
  if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    missing.push('FIREBASE_AUTH_EMULATOR_HOST');
  }
  if (missing.length > 0) {
    throw new Error(
      `Refusing to reseed without emulator env vars: ${missing.join(', ')}. ` +
        'Ensure emulators are running and env vars are set.'
    );
  }
};

const log = (message: string) => {
  process.stdout.write(`${message}\n`);
};

const ensureAdmin = () => {
  if (admin.apps.length === 0) {
    const projectId =
      process.env.FIREBASE_PROJECT_ID ??
      process.env.GCLOUD_PROJECT ??
      'demo-scoutzero';
    admin.initializeApp({ projectId });
  }
  return admin.firestore();
};

const deleteCollection = async (
  db: FirebaseFirestore.Firestore,
  collectionName: string
): Promise<number> => {
  let totalDeleted = 0;
  let batchCount = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snapshot = await db
      .collection(collectionName)
      .limit(BATCH_DELETE_LIMIT)
      .get();
    if (snapshot.empty) {
      break;
    }
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    totalDeleted += snapshot.size;
    batchCount += 1;
    log(
      `[reseed] deleted batch ${batchCount} (${snapshot.size} docs) from ${collectionName}`
    );
  }

  return totalDeleted;
};

const clearEntitlementIdsFromTeams = async (
  db: FirebaseFirestore.Firestore
): Promise<number> => {
  const teamsSnap = await db.collection('architect_baseTeams').get();
  if (teamsSnap.empty) {
    return 0;
  }
  const batch = db.batch();
  let count = 0;
  teamsSnap.forEach((doc) => {
    const data = doc.data();
    if (Array.isArray(data.entitlementIds) && data.entitlementIds.length > 0) {
      batch.update(doc.ref, {
        entitlementIds: admin.firestore.FieldValue.delete(),
      });
      count += 1;
    }
  });
  if (count > 0) {
    await batch.commit();
  }
  return count;
};

const runScript = async (script: string) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn('npm', ['run', script], {
      stdio: 'inherit',
      env: process.env,
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${script} exited with code ${code ?? 'unknown'}`));
      }
    });
  });

const checkFinalState = async (db: FirebaseFirestore.Firestore) => {
  const [entitlementsSnap, teamsSnap] = await Promise.all([
    db.collection('architect_baseEntitlements').get(),
    db.collection('architect_baseTeams').get(),
  ]);

  let teamsWithEntitlements = 0;
  teamsSnap.forEach((doc) => {
    const data = doc.data();
    if (Array.isArray(data.entitlementIds) && data.entitlementIds.length > 0) {
      teamsWithEntitlements += 1;
    }
  });

  return {
    entitlementsCount: entitlementsSnap.size,
    teamsCount: teamsSnap.size,
    teamsWithEntitlements,
  };
};

const main = async () => {
  requireEmulatorEnv();

  const expectedEntitlements = getExpectedEntitlementCount();
  log(
    `[reseed] expected entitlement count: ${expectedEntitlements} (from ${ENTITLEMENTS_JSON_PATH})`
  );

  const db = ensureAdmin();

  // Step 1: Delete all architect_baseEntitlements
  log('[reseed] deleting all architect_baseEntitlements...');
  const deletedEntitlements = await deleteCollection(
    db,
    'architect_baseEntitlements'
  );
  log(`[reseed] deleted ${deletedEntitlements} entitlement docs`);

  // Step 2: Clear entitlementIds from architect_baseTeams
  log('[reseed] clearing entitlementIds from architect_baseTeams...');
  const clearedTeams = await clearEntitlementIdsFromTeams(db);
  log(`[reseed] cleared entitlementIds from ${clearedTeams} teams`);

  // Step 3: Re-seed entitlements
  log('[reseed] running pst:push:base-entitlements...');
  await runScript('pst:push:base-entitlements');

  // Step 4: Re-patch team entitlementIds
  log('[reseed] running pst:patch:base-teams-entitlements...');
  await runScript('pst:patch:base-teams-entitlements');

  // Step 5: Verify final state
  const finalState = await checkFinalState(db);

  log('');
  log('=== RESEED COMPLETE ===');
  log(
    `architect_baseEntitlements: ${finalState.entitlementsCount} (expected: ${expectedEntitlements})`
  );
  log(
    `architect_baseTeams with entitlementIds: ${finalState.teamsWithEntitlements}/${finalState.teamsCount}`
  );

  if (finalState.entitlementsCount !== expectedEntitlements) {
    throw new Error(
      `[reseed] entitlements count mismatch: expected ${expectedEntitlements}, got ${finalState.entitlementsCount}`
    );
  }

  if (
    finalState.teamsCount !== REQUIRED_TEAMS ||
    finalState.teamsWithEntitlements !== REQUIRED_TEAMS
  ) {
    throw new Error(
      `[reseed] teams entitlementIds mismatch: expected ${REQUIRED_TEAMS}/${REQUIRED_TEAMS}, got ${finalState.teamsWithEntitlements}/${finalState.teamsCount}`
    );
  }

  log('[reseed] ✅ all checks passed');
};

main().catch((error) => {
  process.stderr.write(`[reseed] ${String(error)}\n`);
  process.exit(1);
});
