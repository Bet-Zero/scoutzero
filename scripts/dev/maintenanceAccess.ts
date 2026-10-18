/**
 * FILE: scripts/dev/maintenanceAccess.ts
 * PURPOSE: Non-mutating ordinary-publisher credential and permission preflight.
 * OWNERSHIP: Operations tooling.
 * HISTORY: 2026-10-18 — BZE-324 access closeout.
 * LINKS: docs/operations/NBA_MAINTENANCE.md
 */
import { applicationDefault } from 'firebase-admin/app';
import { readFile } from 'node:fs/promises';
import { SOURCE_PROJECT } from './cloudData.js';
import { maintenanceErrorMessage } from './maintenanceErrors.js';

export const REQUIRED_MAINTENANCE_PERMISSIONS = ['datastore.entities.get', 'datastore.entities.create', 'datastore.entities.update'];
export const FORBIDDEN_MAINTENANCE_PERMISSIONS = ['datastore.entities.delete', 'datastore.entities.list', 'datastore.databases.create', 'datastore.databases.delete', 'firebaserules.releases.update', 'resourcemanager.projects.setIamPolicy', 'iam.serviceAccounts.setIamPolicy', 'iam.serviceAccounts.getAccessToken', 'storage.objects.create'];
const IAM_HOST = 'cloudresourcemanager.googleapis.com';

/** Only testIamPermissions and one fixed ordinary document GET; never commits. */
export async function probeMaintenancePermissions(token: string, send: typeof fetch = fetch) {
  const response = await send(`https://${IAM_HOST}/v1/projects/${SOURCE_PROJECT}:testIamPermissions`, {
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
  return { project: SOURCE_PROJECT, nonMutating: true, requiredPermissionsPresent: true, testedExcessPermissionsAbsent: true, ordinaryReadVerified: true,
    configurationReviewStillRequired: true, productionWriteAuthorized: false };
}

export async function checkMaintenanceAccess() {
  // Select only an explicitly configured ADC file or the one configured GCP
  // connection. Do not probe metadata endpoints or borrow another provider.
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && process.env.OIC_MANIFEST_PATH) {
    const manifest = JSON.parse(await readFile(process.env.OIC_MANIFEST_PATH, 'utf8'));
    if (manifest.version !== 1) throw new Error('Unsupported outbound identity manifest');
    const connections = manifest.connections.filter((c: { provider_kind: string }) => c.provider_kind === 'gcp');
    if (connections.length === 1) {
      const connection = connections[0];
      if (!connection.credentials_file || !connection.config_dir || !connection.configuration_name) throw new Error('Configured Google identity selectors are incomplete');
      process.env.GOOGLE_APPLICATION_CREDENTIALS = connection.credentials_file;
      process.env.CLOUDSDK_CONFIG = connection.config_dir;
      process.env.CLOUDSDK_ACTIVE_CONFIG_NAME = connection.configuration_name;
    }
  }
  const missing: string[] = [];
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) missing.push('approved Google maintenance identity');
  try {
    const policy = JSON.parse(await readFile('/etc/codex/network-policy.json', 'utf8'));
    if (policy.http_network_policy?.type === 'restricted' && !policy.http_network_policy.egress_rules?.some((r: { host: string }) => r.host === IAM_HOST)) missing.push('network allowlist: ' + IAM_HOST);
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('Managed network policy could not be verified'); }
  // The file describes startup policy, which may precede a live policy update.
  // Report all setup hints together when identity is missing; with credentials,
  // the actual proxy-enforced permission request decides network reachability.
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error('Access configuration missing: ' + missing.join('; '));
  let token;
  try { token = await applicationDefault().getAccessToken(); }
  catch { throw new Error('Configured Google maintenance identity cannot authenticate'); }
  if (!token.access_token || !(token.expires_in > 0 && token.expires_in <= 3600)) throw new Error('Short-lived maintenance credential required (maximum one hour)');
  return probeMaintenancePermissions(token.access_token);
}

if (decodeURIComponent(import.meta.url) === `file://${process.argv[1]}`) {
  try { console.log(JSON.stringify(await checkMaintenanceAccess())); }
  catch (error) { console.error(maintenanceErrorMessage(error)); process.exitCode = 1; }
}
