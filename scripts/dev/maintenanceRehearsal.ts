/** Real retained plan, actual demo Firestore commits, interrupted recovery and exact restoration. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { digest, DEMO_PROJECT } from './cloudData.js';
import { canonical, verifyPipelineRun } from './cloudPipeline.js';
import { publishMaintenance, restoreMaintenanceRehearsal, type Publication, type PublicationApproval } from './maintenancePublish.js';
import { maintenanceStore } from './maintenanceTransport.js';
import { privateJson } from './cloudStorage.js';

try {
  const dir = process.argv.find(v => v.startsWith('--run='))?.slice(6);
  if (!dir) throw new Error('Verified private player run required');
  await verifyPipelineRun(dir);
  const input = JSON.parse(await readFile(path.join(dir, 'plan.json'), 'utf8'));
  const store = await maintenanceStore(false);
  const entries = [];
  for (const entry of input.entries) {
    const live = await store.read(entry.path);
    assert.deepEqual(canonical(live ? live.fields || {} : null), canonical(entry.beforeFields), 'Real source before-image must match the demo copy');
    entries.push({ path: entry.path, beforeFields: entry.beforeFields, afterFields: entry.afterFields,
      precondition: live ? { updateTime: live.updateTime } : { exists: false as const } });
  }
  const plan: Publication = { version: 1, project: DEMO_PROJECT, database: '(default)', inputSha256: input.inputManifestSha256,
    season: input.context.season, asOf: input.context.asOf,
    groups: [{ id: 'player', entries }] };
  const retainedPath = path.join(dir, 'rehearsal-plan.json');
  await privateJson(retainedPath, plan);
  const sha = digest(canonical(plan));
  // These are synthetic test approvals, confined to DEMO_PROJECT. No factual acceptance.
  const approval: PublicationApproval = { planSha256: sha, project: DEMO_PROJECT, database: '(default)', expiresAt: new Date(Date.now() + 3600000).toISOString(),
    qualification: { verdict: 'ACCEPT', reviewer: 'SYNTHETIC EMULATOR ONLY', receipt: 'https://linear.app/bzero/issue/BZE-324', inputSha256: input.inputManifestSha256 },
    review: { verdict: 'ACCEPT', reviewer: 'SYNTHETIC EMULATOR ONLY', receipt: 'https://linear.app/bzero/issue/BZE-324', planSha256: sha },
    owner: { decision: 'APPROVE', actor: 'SYNTHETIC EMULATOR ONLY', receipt: 'https://linear.app/bzero/issue/BZE-324', planSha256: sha } };
  const commit = store.commit;
  let lost = false;
  store.commit = async writes => { await commit(writes); if (!lost) { lost = true; throw new Error('Synthetic lost acknowledgement after actual commit'); } };
  await assert.rejects(() => publishMaintenance(plan, approval, store), /lost acknowledgement/);
  store.commit = commit;
  const result = await publishMaintenance(plan, approval, store);
  assert.equal(result.complete, true); assert.equal(result.resumedGroups, 1);
  await assert.rejects(() => publishMaintenance(plan, { ...approval, planSha256: '0'.repeat(64) }, store), /approval/);
  await restoreMaintenanceRehearsal(plan, store);
  const receipt = { ...result, checkedAt: new Date().toISOString(), records: entries.length, actualEmulatorCommits: true,
    interruptedRecovery: true, exactOriginalFieldsRestored: true, qualified: false, productionWriteAuthorized: false };
  await privateJson(path.join(dir, 'controlled-publication-proof.json'), receipt);
  console.log(JSON.stringify(receipt));
} catch (error) { console.error(error instanceof Error ? error.message : 'Rehearsal failed'); process.exitCode = 1; }
