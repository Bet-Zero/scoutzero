/** Exercise an ordinary plan atomically in the demo emulator, then restore exact fields. No production target. */
import { firestoreFieldHash } from './firestoreValue.js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { assertEmulatorOrigin, DEMO_PROJECT, digest } from './cloudData.js';
import { canonical, decodeFields, verifyPipelineRun } from './cloudPipeline.js';
import { privateJson } from './cloudStorage.js';

const origin = 'http://127.0.0.1:8082';
const prefix = `projects/${DEMO_PROJECT}/databases/(default)/documents/`;
const headers = { Authorization: 'Bearer owner', 'content-type': 'application/json' };
export function assertOrdinaryDocumentPath(value: string) {
  if (!/^(players_v2|architect_basePlayers)\/[\p{L}\p{M}\p{N}_]+(?:\/(contracts|seasons|views)\/[a-zA-Z0-9_-]+)?$/u.test(value) ||
      (value.startsWith('architect_basePlayers/') && value.split('/').length !== 2)) throw new Error('Emulator plan contains a non-ordinary source path');
}
type LocalDocument = { name: string; fields?: Record<string, unknown>; updateTime: string };
async function readDocument(documentPath: string): Promise<LocalDocument | null> {
  const response = await fetch(origin + '/v1/' + prefix + documentPath.split('/').map(encodeURIComponent).join('/'), {
    method: 'GET', headers, redirect: 'error', signal: AbortSignal.timeout(10000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Local plan read failed: HTTP ' + response.status);
  return response.json();
}
async function commit(writes: unknown[]) {
  const response = await fetch(origin + `/v1/projects/${DEMO_PROJECT}/databases/(default)/documents:commit`, {
    method: 'POST', headers, redirect: 'error', body: JSON.stringify({ writes }), signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('Local conditional commit failed: HTTP ' + response.status);
  const result = await response.json();
  if (result.writeResults?.length !== writes.length) throw new Error('Local commit result is incomplete');
}
const fieldHash = (fields: Record<string, unknown> | null) => firestoreFieldHash(fields);

export async function checkPlanInEmulator(runDir: string) {
  assertEmulatorOrigin(origin);
  await verifyPipelineRun(runDir);
  const plan = JSON.parse(await readFile(path.join(runDir, 'plan.json'), 'utf8'));
  if (!Array.isArray(plan.entries) || plan.entries.length < 1 || plan.entries.length > 450) throw new Error('A bounded ordinary update plan is required');
  const seen = new Set<string>();
  for (const entry of plan.entries) {
    assertOrdinaryDocumentPath(entry.path);
    if (seen.has(entry.path) || !entry.afterFields) throw new Error('Invalid or duplicate update entry');
    seen.add(entry.path);
    if (fieldHash(entry.beforeFields) !== entry.beforeSha256 || fieldHash(entry.afterFields) !== entry.afterSha256) throw new Error('Plan field hash mismatch');
  }
  const before = await Promise.all(plan.entries.map((entry: { path: string }) => readDocument(entry.path)));
  for (let i = 0; i < plan.entries.length; i++) {
    if (fieldHash(before[i] ? before[i]!.fields || {} : null) !== plan.entries[i].beforeSha256) throw new Error('Emulator before-image changed; no writes performed');
  }
  // Source updateTime values remain in the review plan. Emulator timestamps are
  // different after seeding, so its own before-images bind this local-only proof.
  await commit(plan.entries.map((entry: any, i: number) => ({
    update: { name: prefix + entry.path, fields: entry.afterFields },
    currentDocument: before[i] ? { updateTime: before[i]!.updateTime } : { exists: false },
  })));
  const after = await Promise.all(plan.entries.map((entry: { path: string }) => readDocument(entry.path)));
  for (let i = 0; i < plan.entries.length; i++) {
    if (!after[i] || fieldHash(after[i]!.fields || {}) !== plan.entries[i].afterSha256) throw new Error('Local update verification failed; inspect retained emulator state before retrying');
  }
  // Restore only after verifying every successful local result, with new exact
  // preconditions. Never replay/overwrite a concurrent change or target production.
  await commit(plan.entries.map((entry: any, i: number) => before[i] ? {
    update: { name: prefix + entry.path, fields: before[i]!.fields || {} }, currentDocument: { updateTime: after[i]!.updateTime },
  } : { delete: prefix + entry.path, currentDocument: { updateTime: after[i]!.updateTime } }));
  const restored = await Promise.all(plan.entries.map((entry: { path: string }) => readDocument(entry.path)));
  for (let i = 0; i < plan.entries.length; i++) {
    if (fieldHash(restored[i] ? restored[i]!.fields || {} : null) !== plan.entries[i].beforeSha256) throw new Error('Local restoration did not match the exact original fields');
  }
  const result = { checkedAt: new Date().toISOString(), isolatedProject: DEMO_PROJECT, records: plan.entries.length,
    sourceBaselineSha256: plan.baselineSha256, sourceReadTime: plan.baselineReadTime, planSha256: digest(plan),
    atomicLocalApplyVerified: true, originalFieldsRestored: true, productionWriteAuthorized: false };
  await privateJson(path.join(runDir, 'emulator-proof.json'), result);
  return result;
}
