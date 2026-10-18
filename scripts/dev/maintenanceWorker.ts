/**
 * FILE: scripts/dev/maintenanceWorker.ts
 * PURPOSE: Fixed protected GitHub executor; no caller code, ADC or draft identity.
 * OWNERSHIP: Operations tooling.
 * HISTORY: 2026-10-18 — BZE-324 keyless production access.
 * LINKS: docs/operations/NBA_MAINTENANCE.md
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { canonical } from './cloudPipeline.js';
import { digest, SOURCE_PROJECT } from './cloudData.js';
import { requireRegisteredPublication, verifyTrackedExecutor, type AcceptedPublication } from './maintenanceApprovals.js';
import { probeMaintenancePermissions } from './maintenanceAccess.js';
import { publishMaintenance, validatePublication, type Publication, type PublicationApproval } from './maintenancePublish.js';
import { maintenanceStore } from './maintenanceTransport.js';
import { maintenanceErrorMessage } from './maintenanceErrors.js';

export const MAINTENANCE_ENVIRONMENT = 'nba-maintenance-publication';
const REPO = 'Bet-Zero/scoutzero';
const API = 'https://api.github.com/repos/' + REPO;
type Release = AcceptedPublication & { ciphertextSha256: string };

export function verifyMaintenanceProtection(environment: any, branches: any) {
  const review = environment.protection_rules?.find((r: any) => r.type === 'required_reviewers');
  if (environment.name !== MAINTENANCE_ENVIRONMENT || environment.can_admins_bypass !== false ||
      review?.reviewers?.length !== 1 || !review?.reviewers?.some((r: any) => r.type === 'User' && r.reviewer?.id === 205859440) ||
      !environment.deployment_branch_policy?.custom_branch_policies || environment.deployment_branch_policy?.protected_branches ||
      branches.branch_policies?.length !== 1 || branches.branch_policies[0].name !== 'main' || branches.branch_policies[0].type !== 'branch') {
    throw new Error('Dedicated environment must require the owner, forbid admin bypass and allow only main');
  }
}

/** Registry is reviewed data from exact live main, never executable caller code. */
export function maintenanceRegistry(value: any): Record<string, Release> {
  if (value?.version !== 1 || !value.publications || Array.isArray(value.publications) || typeof value.publications !== 'object' ||
      Object.keys(value).some(k => !['version', 'publications'].includes(k))) throw new Error('Invalid maintenance approval registry');
  for (const [sha, entry] of Object.entries(value.publications) as [string, any][]) {
    if (!/^[a-f0-9]{64}$/.test(sha) || !entry || typeof entry !== 'object' ||
        Object.keys(entry).sort().join(',') !== 'ciphertextSha256,expiresAt,inputSha256,ownerReceipt,qualificationReceipt,reviewReceipt' ||
        !/^[a-f0-9]{64}$/.test(entry.inputSha256) || !/^[a-f0-9]{64}$/.test(entry.ciphertextSha256) ||
        !Number.isFinite(Date.parse(entry.expiresAt)) || Date.parse(entry.expiresAt) <= Date.now() ||
        ![entry.ownerReceipt, entry.qualificationReceipt, entry.reviewReceipt].every(v => typeof v === 'string' && /^https:\/\/(linear.app|github.com)\//.test(v))) throw new Error('Invalid or expired registered release');
  }
  return value.publications;
}

async function github(suffix: string, accept = 'application/vnd.github+json') {
  const response = await fetch(API + suffix, {
    headers: { Authorization: 'Bearer ' + process.env.GH_TOKEN, Accept: accept },
    redirect: 'error', signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('GitHub protection/release inspection failed: HTTP ' + response.status);
  return response.json();
}
async function fileAtMain(name: string, sha: string, limit: number) {
  const file = await github('/contents/' + name + '?ref=' + sha, 'application/vnd.github.object+json');
  if (file.type !== 'file' || !/^[a-f0-9]{40}$/.test(file.sha) || !Number.isSafeInteger(file.size) || file.size > limit) throw new Error('Unbounded maintenance input');
  const blob = file.encoding === 'base64' ? file : await github('/git/blobs/' + file.sha);
  if (blob.encoding !== 'base64' || blob.size !== file.size) throw new Error('Invalid maintenance blob');
  const bytes = Buffer.from(blob.content, 'base64');
  if (bytes.length !== file.size || bytes.length > limit) throw new Error('Incomplete maintenance input');
  return bytes;
}
export function decryptMaintenancePackage(ciphertext: Buffer, passphrase: string, filename: string, homedir: string) {
  if (!/^[a-f0-9]{96}$/.test(passphrase)) throw new Error('Dedicated maintenance input decryption secret missing');
  const result = spawnSync('gpg', ['--no-options', '--homedir', homedir, '--batch', '--no-symkey-cache', '--pinentry-mode', 'loopback', '--passphrase-fd', '0', '--decrypt', filename], {
    input: passphrase + '\n', env: { PATH: process.env.PATH }, maxBuffer: 40 * 1024 * 1024, timeout: 30000,
  });
  // Never forward GPG diagnostics, passphrases, decrypted data or source filenames.
  if (result.status !== 0 || !ciphertext.length) throw new Error('Private maintenance package decryption failed');
  const value = JSON.parse(result.stdout.toString('utf8'));
  if (Object.keys(value).sort().join(',') !== 'approval,plan') throw new Error('Maintenance package must contain only plan and approval');
  return value as { plan: Publication; approval: PublicationApproval };
}
async function acceptedPackage(sha: string, requested: string) {
  if (!/^[a-f0-9]{64}$/.test(requested)) throw new Error('Exact approved plan digest required');
  const registry = maintenanceRegistry(JSON.parse((await fileAtMain('.github/nba-maintenance-approvals.json', sha, 100_000)).toString('utf8')));
  if (!Object.hasOwn(registry, requested)) throw new Error('Production plan is not registered by reviewed main');
  const ciphertext = await fileAtMain('.github/nba-maintenance-publication.json.gpg', sha, 35 * 1024 * 1024);
  if (digest(ciphertext) !== registry[requested].ciphertextSha256) throw new Error('Ciphertext is not the exact registered package');
  const temp = await mkdtemp(path.join(os.tmpdir(), 'nba-maintenance-'));
  try {
    const filename = path.join(temp, 'package.gpg');
    await writeFile(filename, ciphertext, { mode: 0o600, flag: 'wx' });
    const { plan, approval } = decryptMaintenancePackage(ciphertext, process.env.BZE324_MAINTENANCE_PASSPHRASE || '', filename, temp);
    if (digest(canonical(plan)) !== requested) throw new Error('Decrypted plan digest mismatch');
    requireRegisteredPublication(requested, plan, approval, registry);
    validatePublication(plan, approval, { project: SOURCE_PROJECT, database: '(default)', read: async () => { throw new Error('Not a store'); }, commit: async () => { throw new Error('Not a store'); } });
    return { plan, approval };
  } finally {
    spawnSync('gpgconf', ['--homedir', temp, '--kill', 'gpg-agent'], { stdio: 'ignore', timeout: 5000 });
    await rm(temp, { recursive: true, force: true });
  }
}

export async function runMaintenanceWorker(stage: string) {
  if (!['prepare', 'execute'].includes(stage) || process.env.GITHUB_ACTIONS !== 'true' || process.env.GITHUB_REPOSITORY !== REPO ||
      process.env.GITHUB_REPOSITORY_ID !== '997820257' || process.env.GITHUB_REPOSITORY_OWNER_ID !== '205859440' ||
      process.env.GITHUB_EVENT_NAME !== 'workflow_dispatch' || process.env.GITHUB_REF !== 'refs/heads/main' ||
      process.env.GITHUB_WORKFLOW_REF !== REPO + '/.github/workflows/nba-maintenance.yml@refs/heads/main' ||
      !/^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA || '') || !/^[a-f0-9]{40}$/.test(process.env.MAINTENANCE_WORKER_SHA || '')) throw new Error('Protected main workflow context required');
  const operation = process.env.MAINTENANCE_OPERATION;
  if (!['access', 'publish'].includes(operation || '')) throw new Error('Unsupported maintenance operation');
  const workerSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (workerSha !== process.env.MAINTENANCE_WORKER_SHA) throw new Error('Executor is not the attested immutable worker');
  await verifyTrackedExecutor(process.cwd());
  const sha = process.env.GITHUB_SHA!;
  if ((await github('/commits/main')).sha !== sha) throw new Error('Caller is not exact live main');
  const base = '/environments/' + MAINTENANCE_ENVIRONMENT;
  verifyMaintenanceProtection(await github(base), await github(base + '/deployment-branch-policies'));
  const input = operation === 'publish' ? await acceptedPackage(sha, process.env.MAINTENANCE_PLAN_SHA256 || '') : undefined;
  if (stage === 'prepare') return { protected: true, operation, productionWriteAuthorized: false };
  const token = process.env.SCOUTZERO_MAINTENANCE_ACCESS_TOKEN || '';
  const access = await probeMaintenancePermissions(token);
  if (!input) return access;
  return publishMaintenance(input.plan, input.approval, await maintenanceStore(true, token));
}

if (decodeURIComponent(import.meta.url) === `file://${process.argv[1]}`) {
  try { console.log(JSON.stringify(await runMaintenanceWorker(process.argv[2]))); }
  catch (error) { console.error(maintenanceErrorMessage(error)); console.error('Protected maintenance operation stopped; no completion claim.'); process.exitCode = 1; }
}
