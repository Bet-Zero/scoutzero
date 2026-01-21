#!/usr/bin/env tsx
/**
 * FILE: team-scrape/draft-picks/scripts/pst/pst_phase_10_push_base_entitlements.ts
 * PURPOSE: Push base entitlement definitions to Firestore from Phase 8.1 assets output.
 */

import admin from 'firebase-admin';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const SERVICE_ACCOUNT_PATH = path.resolve('serviceAccountKey.json');
const INPUT_PATH = path.resolve('data/pst/pst_entitlement_assets_2026_2033.json');
const BASE_ENTITLEMENTS_COLLECTION = 'architect_baseEntitlements';

const BATCH_SIZE = 450;

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

async function main() {
  if (!path.isAbsolute(SERVICE_ACCOUNT_PATH)) {
    throw new Error('Service account path must resolve to an absolute path.');
  }

  const serviceAccount = await readFile(SERVICE_ACCOUNT_PATH, 'utf8').then(
    JSON.parse
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  const db = admin.firestore();

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
