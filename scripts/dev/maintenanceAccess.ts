/**
 * FILE: scripts/dev/maintenanceAccess.ts
 * PURPOSE: Non-mutating ordinary-publisher permission preflight; no ADC/key loading.
 * OWNERSHIP: Operations tooling.
 * HISTORY: 2026-10-18 — BZE-324 protected keyless publisher.
 * LINKS: docs/operations/NBA_MAINTENANCE.md
 */
import { execFileSync } from 'node:child_process';
import { SOURCE_PROJECT } from './cloudData.js';
import { maintenanceErrorMessage } from './maintenanceErrors.js';

export const REQUIRED_MAINTENANCE_PERMISSIONS = ['datastore.entities.get', 'datastore.entities.create', 'datastore.entities.update'];
export const FORBIDDEN_MAINTENANCE_PERMISSIONS = ['datastore.entities.delete', 'datastore.entities.list', 'datastore.databases.create', 'datastore.databases.delete', 'firebaserules.releases.update', 'resourcemanager.projects.setIamPolicy', 'iam.serviceAccounts.setIamPolicy', 'iam.serviceAccounts.getAccessToken', 'storage.objects.create'];

/** Only testIamPermissions and one fixed ordinary document GET; never commits. */
export async function probeMaintenancePermissions(token: string, send: typeof fetch = fetch) {
  if (!token) throw new Error('Protected worker token missing');
  const response = await send(`https://cloudresourcemanager.googleapis.com/v1/projects/${SOURCE_PROJECT}:testIamPermissions`, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { Authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    body: JSON.stringify({ permissions: [...REQUIRED_MAINTENANCE_PERMISSIONS, ...FORBIDDEN_MAINTENANCE_PERMISSIONS] }),
  });
  if (!response.ok) throw new Error('Maintenance permission probe failed: HTTP ' + response.status);
  const permissions: string[] = (await response.json()).permissions || [];
  if (REQUIRED_MAINTENANCE_PERMISSIONS.some(p => !permissions.includes(p))) throw new Error('Maintenance identity lacks required get/create/update permissions');
  if (FORBIDDEN_MAINTENANCE_PERMISSIONS.some(p => permissions.includes(p))) throw new Error('Maintenance identity has excessive tested permissions; do not use an owner/admin or draft-publisher identity');
  const name = `projects/${SOURCE_PROJECT}/databases/(default)/documents/architect_basePlayers/luka_doncic`;
  const read = await send('https://firestore.googleapis.com/v1/' + name, {
    method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15000), headers: { Authorization: 'Bearer ' + token },
  });
  if (!read.ok || (await read.json()).name !== name) throw new Error('Maintenance identity failed fixed-project ordinary-document read');
  const bulk = await send(`https://firestore.googleapis.com/v1/projects/${SOURCE_PROJECT}/databases/(default)/documents:batchGet`, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { Authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    body: JSON.stringify({ documents: [name] }),
  });
  if (!bulk.ok) throw new Error('Maintenance identity failed non-mutating batchGet');
  const rows = await bulk.json();
  if (!Array.isArray(rows) || rows.length !== 1 || rows[0].found?.name !== name || !rows[0].readTime) throw new Error('Maintenance batchGet proof missing');
  const pinned = await send(`https://firestore.googleapis.com/v1/projects/${SOURCE_PROJECT}/databases/(default)/documents:batchGet`, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { Authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    body: JSON.stringify({ documents: [name], readTime: rows[0].readTime }),
  });
  if (!pinned.ok) throw new Error('Maintenance identity failed pinned readTime batchGet');
  const snapshot = await pinned.json();
  if (!Array.isArray(snapshot) || snapshot.length !== 1 || snapshot[0].found?.name !== name ||
      snapshot[0].readTime !== rows[0].readTime || snapshot[0].found.updateTime !== rows[0].found.updateTime) throw new Error('Maintenance pinned snapshot mismatch');
  return { project: SOURCE_PROJECT, nonMutating: true, requiredPermissionsPresent: true, testedExcessPermissionsAbsent: true, ordinaryReadVerified: true, ordinaryBatchReadVerified: true,
    configurationReviewStillRequired: true, productionWriteAuthorized: false };
}

if (decodeURIComponent(import.meta.url) === `file://${process.argv[1]}`) {
  try {
    execFileSync('gh', ['workflow', 'run', 'nba-maintenance.yml', '--repo', 'Bet-Zero/scoutzero', '--ref', 'main', '-f', 'operation=access'], { stdio: 'inherit' });
    console.log('Read-only access verification requested. Protected environment approval is required; inspect the resulting GitHub run.');
  } catch (error) { console.error(maintenanceErrorMessage(error)); process.exitCode = 1; }
}
