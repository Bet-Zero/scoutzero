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
import {
  resolveEntitlementWithDb,
  resolveEntitlementsForTeamWithDb,
} from '../../../../src/features/architect/utils/entitlements/entitlementResolver';

const DEFAULT_PROJECT_ID = 'scoutzero-bf1ae';
const DEFAULT_EMULATOR_HOST = '127.0.0.1';
const DEFAULT_EMULATOR_PORT = 8082;

const ASSETS_PATH = path.resolve('data/pst/pst_entitlement_assets_2026_2033.json');
const BY_TEAM_PATH = path.resolve('data/pst/pst_entitlements_by_team_2026_2033.json');

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
  const byTeamPayload = await loadJson<Record<string, { id: string }[]>>(
    BY_TEAM_PATH
  );

  const teamCode = parseArg('teamCode') || pickFirstTeam(byTeamPayload);
  if (!teamCode) throw new Error('Unable to determine teamCode from payload.');

  const entitlementId =
    parseArg('entitlementId') || byTeamPayload[teamCode]?.[0]?.id;
  if (!entitlementId) {
    throw new Error(`Unable to determine entitlementId for team ${teamCode}.`);
  }

  const firebaseConfig = { projectId };
  const app = initializeApp(firebaseConfig);
  const db = initializeFirestore(app, { experimentalForceLongPolling: true });

  const emulator = parseEmulatorHost();
  const emulatorHost = parseArg('emulatorHost') || emulator?.host;
  const emulatorPort = Number(parseArg('emulatorPort') || emulator?.port);

  const usingEmulator = Boolean(emulatorHost && emulatorPort);
  if (usingEmulator) {
    connectFirestoreEmulator(db, emulatorHost as string, emulatorPort as number);
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
      `Emulator: ${usingEmulator ? `${emulatorHost}:${emulatorPort}` : 'disabled'}\n`
  );

  // 1) Base entitlements count
  const baseEntitlementsSnap = await getDocs(
    collection(db, BASE_ENTITLEMENTS_COLLECTION)
  );
  console.log(
    `Base entitlements count: ${baseEntitlementsSnap.size} (expected ${assetsPayload.assets.length})`
  );

  // 2) Base teams entitlementIds
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
  }

  // 3) Resolver returns effective entitlements for world+team
  const resolvedForTeam = await resolveEntitlementsForTeamWithDb(
    db,
    worldId,
    teamCode
  );
  console.log(
    `Resolver entitlements for ${teamCode}: ${resolvedForTeam.length}`
  );

  // 4) World override merge check
  const baseRef = doc(db, BASE_ENTITLEMENTS_COLLECTION, entitlementId);
  const worldRef = doc(
    db,
    WORLDS_COLLECTION,
    worldId,
    'entitlements',
    entitlementId
  );

  if (usingEmulator || allowWrites) {
    await setDoc(
      baseRef,
      {
        testMeta: {
          source: 'base',
          flags: { baseOnly: true },
        },
      },
      { merge: true }
    );

    await setDoc(
      worldRef,
      {
        description: 'Phase 10 override',
        testMeta: {
          flags: { override: true },
          note: 'world override',
        },
      },
      { merge: true }
    );
  }

  const resolvedEntitlement = await resolveEntitlementWithDb(
    db,
    worldId,
    entitlementId
  );

  if (!resolvedEntitlement) {
    console.log('Resolver returned null entitlement.');
    return;
  }

  const testMeta = (resolvedEntitlement as { testMeta?: any }).testMeta || {};

  console.log('Resolver merge checks:', {
    hasBaseSource: testMeta.source === 'base',
    hasOverrideFlag: Boolean(testMeta.flags?.override),
    hasBaseFlag: Boolean(testMeta.flags?.baseOnly),
    overrideDescription: (resolvedEntitlement as { description?: string })
      .description,
  });

  const baseSnap = await getDoc(baseRef);
  const worldSnap = await getDoc(worldRef);
  console.log('Base entitlement exists:', baseSnap.exists());
  console.log('World override exists:', worldSnap.exists());
}

main().catch((err) => {
  console.error('Validation failed:', err);
  process.exit(1);
});
