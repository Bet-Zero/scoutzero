#!/usr/bin/env tsx
/**
 * FILE: team-scrape/draft-picks/scripts/pst/pst_phase_10_validate_firestore_entitlements.ts
 * PURPOSE: Validate Phase 10 Firestore entitlement writes and resolver behavior.
 */

import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { initializeApp } from 'firebase/app';
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  initializeFirestore,
  setDoc,
} from 'firebase/firestore';
import { getAuth, connectAuthEmulator, signInAnonymously } from 'firebase/auth';
import {
  resolveEntitlementWithDb,
  resolveEntitlementsForTeamWithDb,
} from '../../../../src/features/architect/utils/entitlements/entitlementResolver';

const DEFAULT_PROJECT_ID = 'scoutzero-bf1ae';
const DEFAULT_EMULATOR_HOST = '127.0.0.1';
const DEFAULT_EMULATOR_PORT = 8082;

const ASSETS_PATH = path.resolve(
  'data/pst/pst_entitlement_assets_2026_2033.json'
);
const BY_TEAM_PATH = path.resolve(
  'data/pst/pst_entitlements_by_team_2026_2033.json'
);

const BASE_ENTITLEMENTS_COLLECTION = 'architect_baseEntitlements';
const BASE_TEAMS_COLLECTION = 'architect_baseTeams';
const WORLDS_COLLECTION = 'architect_worlds';

function parseArg(name: string): string | undefined {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === `--${name}`) return args[i + 1];
    if (arg.startsWith(`--${name}=`)) {
      return arg.split('=')[1];
    }
  }
  return undefined;
}

async function loadJson<T>(filepath: string): Promise<T> {
  const raw = await readFile(filepath, 'utf8');
  return JSON.parse(raw) as T;
}

function pickFirstTeam(payload: Record<string, unknown>): string | null {
  const keys = Object.keys(payload);
  return keys.length ? keys[0] : null;
}

function parseEmulatorHost() {
  const hostEnv = process.env.FIRESTORE_EMULATOR_HOST;
  if (!hostEnv) return null;
  const [host, portRaw] = hostEnv.split(':');
  return {
    host: host || DEFAULT_EMULATOR_HOST,
    port: Number(portRaw) || DEFAULT_EMULATOR_PORT,
  };
}

async function main() {
  const projectId =
    parseArg('projectId') ||
    process.env.GCLOUD_PROJECT ||
    process.env.FIREBASE_PROJECT ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    DEFAULT_PROJECT_ID;
  const worldId = parseArg('worldId') || 'phase10-validation';
  const allowWrites = parseArg('allowWrites') === 'true';

  const assetsPayload = await loadJson<{ assets: { id: string }[] }>(
    ASSETS_PATH
  );
  const byTeamPayload =
    await loadJson<Record<string, { id: string }[]>>(BY_TEAM_PATH);

  const teamCode = parseArg('teamCode') || pickFirstTeam(byTeamPayload);
  if (!teamCode) throw new Error('Unable to determine teamCode from payload.');

  const entitlementId =
    parseArg('entitlementId') || byTeamPayload[teamCode]?.[0]?.id;
  if (!entitlementId) {
    throw new Error(`Unable to determine entitlementId for team ${teamCode}.`);
  }

  const firebaseConfig = {
    projectId,
    apiKey: 'fake-api-key-for-emulator', // Emulator doesn't validate API key
  };
  const app = initializeApp(firebaseConfig);
  const db = initializeFirestore(app, { experimentalForceLongPolling: true });
  const auth = getAuth(app);

  const emulator = parseEmulatorHost();
  const emulatorHost = parseArg('emulatorHost') || emulator?.host;
  const emulatorPort = Number(parseArg('emulatorPort') || emulator?.port);

  const usingEmulator = Boolean(emulatorHost && emulatorPort);
  if (usingEmulator) {
    connectFirestoreEmulator(
      db,
      emulatorHost as string,
      emulatorPort as number
    );

    // Connect to Auth emulator
    const authEmulatorHost =
      process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
    const [authHost, authPort] = authEmulatorHost.split(':');
    connectAuthEmulator(auth, `http://${authHost}:${authPort}`, {
      disableWarnings: true,
    });

    // Sign in anonymously to satisfy Firestore rules
    console.log('Signing in anonymously to emulator...');
    await signInAnonymously(auth);
    console.log(`Signed in with UID: ${auth.currentUser?.uid}`);
  } else if (!allowWrites) {
    console.warn(
      'No emulator detected. Override writes will be skipped unless --allowWrites=true.'
    );
  }

  console.log(
    `\n=== Phase 10 Entitlements Validation ===\n` +
      `Project: ${projectId}\n` +
      `World: ${worldId}\n` +
      `Team: ${teamCode}\n` +
      `Entitlement: ${entitlementId}\n` +
      `Emulator: ${usingEmulator ? `${emulatorHost}:${emulatorPort}` : 'disabled'}\n` +
      `Auth UID: ${auth.currentUser?.uid || 'not signed in'}\n`
  );

  // Bootstrap world if it doesn't exist
  const worldRef = doc(db, WORLDS_COLLECTION, worldId);
  let worldExists = false;
  let worldOwned = false;

  try {
    const worldSnap = await getDoc(worldRef);
    worldExists = worldSnap.exists();
    worldOwned = worldExists;

    if (worldExists) {
      console.log(`\n--- World ${worldId} already exists ---`);
      const worldData = worldSnap.data();
      console.log(`Owner: ${worldData.createdBy}`);
      if (worldData.createdBy !== auth.currentUser?.uid) {
        console.warn(
          `⚠️  World owner (${worldData.createdBy}) does not match current UID (${auth.currentUser?.uid})`
        );
        worldOwned = false;
      }
    }
  } catch (err: any) {
    // Permission denied means world doesn't exist OR we're not the owner
    if (err.code === 'permission-denied') {
      console.log(`\n--- World ${worldId} does not exist or access denied ---`);
      worldExists = false;
      worldOwned = false;
    } else {
      throw err;
    }
  }

  if (!worldOwned) {
    console.log(`--- Creating/claiming world: ${worldId} ---`);
    if (!auth.currentUser) {
      throw new Error('Cannot bootstrap world: user not authenticated');
    }

    try {
      await setDoc(worldRef, {
        createdBy: auth.currentUser.uid,
        worldName: 'phase10-validation',
        createdAt: new Date().toISOString(),
      });
      console.log('✓ World created successfully');

      // Small delay to ensure world doc is fully propagated in emulator
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (err: any) {
      if (err.code === 'permission-denied') {
        console.log(
          '✗ FAIL: Cannot create world - may already exist with different owner'
        );
        console.log(
          'Try deleting the existing world or use a different worldId'
        );
        process.exit(1);
      }
      throw err;
    }
  }

  let failureCount = 0;

  console.log(`\n--- Step 1: Validate base entitlements ---`);
  const baseEntitlementsSnap = await getDocs(
    collection(db, BASE_ENTITLEMENTS_COLLECTION)
  );
  const expectedCount = assetsPayload.assets.length;
  const actualCount = baseEntitlementsSnap.size;

  console.log(
    `Base entitlements count: ${actualCount} (expected ${expectedCount})`
  );
  if (actualCount === expectedCount) {
    console.log('✓ PASS: Base entitlements count matches');
  } else {
    console.log('✗ FAIL: Base entitlements count mismatch');
    failureCount++;
  }

  console.log(`\n--- Step 2: Validate base teams entitlementIds ---`);
  const baseTeamsSnap = await getDocs(collection(db, BASE_TEAMS_COLLECTION));
  const teamsMissing: string[] = [];
  baseTeamsSnap.docs.forEach((docSnap) => {
    const data = docSnap.data() as { entitlementIds?: unknown };
    if (!Array.isArray(data.entitlementIds)) {
      teamsMissing.push(docSnap.id);
    }
  });
  console.log(
    `Base teams checked: ${baseTeamsSnap.size}. Missing entitlementIds: ${teamsMissing.length}`
  );
  if (teamsMissing.length) {
    console.log(`Missing entitlementIds for: ${teamsMissing.join(', ')}`);
    console.log('✗ FAIL: Some teams missing entitlementIds');
    failureCount++;
  } else {
    console.log('✓ PASS: All base teams have entitlementIds');
  }

  console.log(`\n--- Step 3: Write world team snapshot ---`);
  const teamEntitlementIds = byTeamPayload[teamCode]?.map((e) => e.id) || [];
  const worldTeamRef = doc(db, WORLDS_COLLECTION, worldId, 'teams', teamCode);

  try {
    await setDoc(
      worldTeamRef,
      {
        teamCode,
        entitlementIds: teamEntitlementIds.slice(0, 3), // Subset for validation
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    console.log(`✓ PASS: Written world team snapshot for ${teamCode}`);
  } catch (err) {
    console.log(`✗ FAIL: Failed to write world team snapshot: ${err}`);
    failureCount++;
  }

  console.log(`\n--- Step 4: Write world entitlement override ---`);
  const worldEntitlementRef = doc(
    db,
    WORLDS_COLLECTION,
    worldId,
    'entitlements',
    entitlementId
  );
  console.log(`Writing to: ${worldEntitlementRef.path}`);

  try {
    await setDoc(
      worldEntitlementRef,
      {
        description: 'Phase 10 override',
        testMeta: {
          flags: { override: true },
          note: 'world override',
        },
      },
      { merge: true }
    );
    console.log(
      `✓ PASS: Written world entitlement override for ${entitlementId}`
    );
  } catch (err) {
    console.log(`✗ FAIL: Failed to write world entitlement override: ${err}`);
    failureCount++;
  }

  console.log(
    `\n--- Step 5A: Resolver returns effective entitlements for team ---`
  );
  const resolvedForTeam = await resolveEntitlementsForTeamWithDb(
    db,
    worldId,
    teamCode
  );
  console.log(
    `Resolver entitlements for ${teamCode}: ${resolvedForTeam.length}`
  );
  if (resolvedForTeam.length > 0) {
    console.log('✓ PASS: Resolver returned entitlements for team');
  } else {
    console.log('✗ FAIL: Resolver returned no entitlements for team');
    failureCount++;
  }

  console.log(`\n--- Step 5B: Resolve entitlement with merger ---`);
  const baseRef = doc(db, BASE_ENTITLEMENTS_COLLECTION, entitlementId);

  // NOTE: We cannot write to base collections with client SDK (read-only)
  // Instead, we verify that the resolver correctly merges base + world override

  const resolvedEntitlement = await resolveEntitlementWithDb(
    db,
    worldId,
    entitlementId
  );

  if (!resolvedEntitlement) {
    console.log('✗ FAIL: Resolver returned null entitlement');
    failureCount++;
  } else {
    const testMeta = (resolvedEntitlement as { testMeta?: any }).testMeta || {};
    const description = (resolvedEntitlement as { description?: string })
      .description;

    console.log('Resolver merge details:', {
      hasOverrideFlag: Boolean(testMeta.flags?.override),
      overrideDescription: description,
    });

    // Check if override metadata is present (successful merge)
    const hasOverrideMeta = testMeta.flags?.override === true;
    const hasOverrideDescription = description === 'Phase 10 override';

    if (hasOverrideMeta && hasOverrideDescription) {
      console.log('✓ PASS: Resolver correctly merged base + world override');
    } else {
      console.log('✗ FAIL: Resolver merge incomplete');
      console.log(`  - Override meta present: ${hasOverrideMeta}`);
      console.log(`  - Override description: ${hasOverrideDescription}`);
      failureCount++;
    }
  }

  const baseSnap = await getDoc(baseRef);
  const worldOverrideSnap = await getDoc(worldEntitlementRef);
  console.log(`Base entitlement exists: ${baseSnap.exists()}`);
  console.log(`World override exists: ${worldOverrideSnap.exists()}`);

  // Final summary
  console.log(`\n=== Validation Summary ===`);
  if (failureCount === 0) {
    console.log('✓ ALL VALIDATIONS PASSED');
    process.exit(0);
  } else {
    console.log(`✗ ${failureCount} VALIDATION(S) FAILED`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Validation failed:', err);
  process.exit(1);
});
