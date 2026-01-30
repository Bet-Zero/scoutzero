#!/usr/bin/env tsx
/**
 * FILE: team-scrape/draft-picks/scripts/pst/pst_phase_10_patch_base_teams_entitlements.ts
 * PURPOSE: Patch architect_baseTeams with entitlementIds from Phase 8.1 outputs.
 * SUPPORTS: Both emulator mode (via FIRESTORE_EMULATOR_HOST) and production (via serviceAccountKey.json)
 */

import admin from 'firebase-admin';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { constants } from 'node:fs';

const SERVICE_ACCOUNT_PATH = path.resolve('serviceAccountKey.json');
const INPUT_PATH = path.resolve(
  'data/pst/pst_entitlements_by_team_2026_2033.json'
);
const BASE_TEAMS_COLLECTION = 'architect_baseTeams';

const BATCH_SIZE = 450;

/**
 * Canonical projectId for emulator mode.
 * MUST match the projectId in scripts/emu/adminEmu.ts
 */
const EMULATOR_FALLBACK_PROJECT_ID = 'scoutzero-bf1ae';

type EntitlementAsset = {
  id: string;
  [key: string]: unknown;
};

type EntitlementsByTeam = Record<string, EntitlementAsset[]>;

async function loadJson<T>(filepath: string): Promise<T> {
  const raw = await readFile(filepath, 'utf8');
  return JSON.parse(raw) as T;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function buildEntitlementIds(assets: EntitlementAsset[]): string[] {
  const ids = assets.map((asset) => asset.id).filter(Boolean);
  return Array.from(new Set(ids));
}

async function fileExists(filepath: string): Promise<boolean> {
  try {
    await access(filepath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function isEmulatorMode(): boolean {
  return !!process.env.FIRESTORE_EMULATOR_HOST;
}

function resolveEmulatorProjectId(): string {
  return (
    process.env.GCLOUD_PROJECT ??
    process.env.FIREBASE_PROJECT ??
    process.env.PROJECT_ID ??
    EMULATOR_FALLBACK_PROJECT_ID
  );
}

async function initializeAdmin(): Promise<FirebaseFirestore.Firestore> {
  if (isEmulatorMode()) {
    const projectId = resolveEmulatorProjectId();
    console.log(`[patch] Emulator mode: projectId=${projectId}`);
    admin.initializeApp({ projectId });
  } else {
    // Production mode: use service account
    if (!(await fileExists(SERVICE_ACCOUNT_PATH))) {
      throw new Error(
        `Service account not found at ${SERVICE_ACCOUNT_PATH} and not in emulator mode. ` +
          'Either run the emulator or provide a service account.'
      );
    }
    const serviceAccount = JSON.parse(
      await readFile(SERVICE_ACCOUNT_PATH, 'utf8')
    );
    console.log('[patch] Production mode: using service account');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
  return admin.firestore();
}

async function main() {
  const db = await initializeAdmin();

  const payload = await loadJson<EntitlementsByTeam>(INPUT_PATH);
  const teamCodes = Object.keys(payload).sort();

  if (!teamCodes.length) {
    console.warn('No team entitlement payloads found in input file.');
    return;
  }

  console.log(
    `\n=== Patch Base Teams Entitlements ===\n` +
      `Input: ${INPUT_PATH}\n` +
      `Teams: ${teamCodes.length}\n`
  );

  const chunks = chunkArray(teamCodes, BATCH_SIZE);

  for (const [index, chunk] of chunks.entries()) {
    const batch = db.batch();

    chunk.forEach((teamCode) => {
      const assets = payload[teamCode] || [];
      const entitlementIds = buildEntitlementIds(assets);

      const docRef = db.collection(BASE_TEAMS_COLLECTION).doc(teamCode);
      batch.set(docRef, { entitlementIds }, { merge: true });
    });

    await batch.commit();
    console.log(
      `✅ Batch ${index + 1}/${chunks.length} committed (${chunk.length} teams)`
    );
  }

  console.log('\n🎉 Base teams patch complete.');
}

main().catch((err) => {
  console.error('Patch failed:', err);
  process.exit(1);
});
