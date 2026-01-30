#!/usr/bin/env tsx
/**
 * FILE: team-scrape/draft-picks/scripts/pst/pst_phase_10_push_base_entitlements.ts
 * PURPOSE: Push base entitlement definitions to Firestore from Phase 8.1 assets output.
 * SUPPORTS: Both emulator mode (via FIRESTORE_EMULATOR_HOST) and production (via serviceAccountKey.json)
 */

import admin from 'firebase-admin';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { constants } from 'node:fs';

const SERVICE_ACCOUNT_PATH = path.resolve('serviceAccountKey.json');
const INPUT_PATH = path.resolve(
  'data/pst/pst_entitlement_assets_2026_2033.json'
);
const BASE_ENTITLEMENTS_COLLECTION = 'architect_baseEntitlements';

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

type EntitlementAssetFile = {
  meta?: {
    generatedAt?: string;
    count?: number;
  };
  assets: EntitlementAsset[];
};

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
    console.log(`[push] Emulator mode: projectId=${projectId}`);
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
    console.log('[push] Production mode: using service account');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
  return admin.firestore();
}

async function main() {
  const db = await initializeAdmin();

  const payload = await loadJson<EntitlementAssetFile>(INPUT_PATH);
  const assets = payload.assets || [];

  if (!assets.length) {
    console.warn('No entitlement assets found in input file.');
    return;
  }

  console.log(
    `\n=== Push Base Entitlements ===\n` +
      `Input: ${INPUT_PATH}\n` +
      `Assets: ${assets.length}\n` +
      `Meta count: ${payload.meta?.count ?? 'n/a'}\n`
  );

  const chunks = chunkArray(assets, BATCH_SIZE);

  for (const [index, chunk] of chunks.entries()) {
    const batch = db.batch();
    chunk.forEach((asset) => {
      const docRef = db.collection(BASE_ENTITLEMENTS_COLLECTION).doc(asset.id);
      batch.set(docRef, asset);
    });

    await batch.commit();
    console.log(
      `✅ Batch ${index + 1}/${chunks.length} committed (${chunk.length} docs)`
    );
  }

  console.log('\n🎉 Base entitlement push complete.');
}

main().catch((err) => {
  console.error('Push failed:', err);
  process.exit(1);
});
