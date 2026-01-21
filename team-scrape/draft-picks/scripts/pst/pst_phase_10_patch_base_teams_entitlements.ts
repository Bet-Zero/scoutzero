#!/usr/bin/env tsx
/**
 * FILE: team-scrape/draft-picks/scripts/pst/pst_phase_10_patch_base_teams_entitlements.ts
 * PURPOSE: Patch architect_baseTeams with entitlementIds from Phase 8.1 outputs.
 */

import admin from 'firebase-admin';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const SERVICE_ACCOUNT_PATH = path.resolve('serviceAccountKey.json');
const INPUT_PATH = path.resolve('data/pst/pst_entitlements_by_team_2026_2033.json');
const BASE_TEAMS_COLLECTION = 'architect_baseTeams';

const BATCH_SIZE = 450;

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

async function main() {
  const serviceAccount = await readFile(SERVICE_ACCOUNT_PATH, 'utf8').then(
    JSON.parse
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  const db = admin.firestore();

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
