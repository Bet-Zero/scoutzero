/**
 * FILE: scripts/emu/seedIfMissing.ts
 * PURPOSE: Seed emulator data only when required base collections are missing.
 * OWNERSHIP: Tooling: local emulator workflow
 *
 * HISTORY:
 *  - 2026-01-28: Created by plan `plans/_archive/emulator-workflow-hardening/plan.md`, chunk_01
 *
 * LINKS:
 *  - Plan: plans/_archive/emulator-workflow-hardening/plan.md
 *  - Latest Chunk: plans/_archive/emulator-workflow-hardening/chunks/chunk_01.md
 */

import admin from 'firebase-admin';
import { spawn } from 'node:child_process';

const REQUIRED_ENTITLEMENTS = 525;
const REQUIRED_TEAMS = 30;

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
      `Refusing to seed without emulator env vars: ${missing.join(', ')}. ` +
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

const checkSeedState = async () => {
  const db = ensureAdmin();
  const entitlementsSnap = await db
    .collection('architect_baseEntitlements')
    .get();
  const entitlementsCount = entitlementsSnap.size;

  const teamsSnap = await db.collection('architect_baseTeams').get();
  let teamsWithEntitlements = 0;
  teamsSnap.forEach((doc) => {
    const data = doc.data();
    if (Array.isArray(data.entitlementIds) && data.entitlementIds.length > 0) {
      teamsWithEntitlements += 1;
    }
  });

  return {
    entitlementsCount,
    teamsCount: teamsSnap.size,
    teamsWithEntitlements,
  };
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

const main = async () => {
  requireEmulatorEnv();

  const initial = await checkSeedState();
  const entitlementsReady = initial.entitlementsCount === REQUIRED_ENTITLEMENTS;
  const teamsReady =
    initial.teamsCount === REQUIRED_TEAMS &&
    initial.teamsWithEntitlements === REQUIRED_TEAMS;

  if (entitlementsReady) {
    log(
      `[seed] base entitlements present (${REQUIRED_ENTITLEMENTS}) — skipping`
    );
  }

  if (teamsReady) {
    log(
      `[seed] base teams entitlementIds present (${REQUIRED_TEAMS}/${REQUIRED_TEAMS}) — skipping`
    );
  }

  if (entitlementsReady && teamsReady) {
    return;
  }

  log('[seed] base data missing — running PST seeding scripts...');
  await runScript('pst:push:base-entitlements');
  await runScript('pst:patch:base-teams-entitlements');

  const finalState = await checkSeedState();
  if (finalState.entitlementsCount !== REQUIRED_ENTITLEMENTS) {
    throw new Error(
      `[seed] base entitlements count mismatch: expected ${REQUIRED_ENTITLEMENTS}, got ${finalState.entitlementsCount}`
    );
  }

  if (
    finalState.teamsCount !== REQUIRED_TEAMS ||
    finalState.teamsWithEntitlements !== REQUIRED_TEAMS
  ) {
    throw new Error(
      `[seed] base team entitlementIds mismatch: expected ${REQUIRED_TEAMS}/${REQUIRED_TEAMS}, got ${finalState.teamsWithEntitlements}/${finalState.teamsCount}`
    );
  }

  log('[seed] base data verified after seeding.');
};

main().catch((error) => {
  process.stderr.write(`[seed] ${String(error)}\n`);
  process.exit(1);
});
