/**
 * FILE: scripts/dev/maintenancePackage.ts
 * PURPOSE: Prepare private ordinary-publication ciphertext using the established GPG handoff.
 * OWNERSHIP: Operations tooling.
 * HISTORY: 2026-10-18 — BZE-324 repeatable publication packaging.
 * LINKS: docs/operations/NBA_MAINTENANCE.md
 */
import { parseArgs } from 'node:util';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { canonical } from './cloudPipeline.js';
import { digest, SOURCE_PROJECT } from './cloudData.js';
import { validatePublication, type Publication, type PublicationApproval } from './maintenancePublish.js';
import { decryptMaintenancePackage } from './maintenanceWorker.js';
import { maintenanceErrorMessage } from './maintenanceErrors.js';

export async function packageMaintenance(plan: Publication, approval: PublicationApproval, output: string, passphrasePath: string) {
  if (plan.project !== SOURCE_PROJECT) throw new Error('Package requires a production-target proposal; packaging is not acceptance or write authorization');
  validatePublication(plan, approval, { project: SOURCE_PROJECT, database: '(default)', read: async () => null, commit: async () => { throw new Error('Not a store'); } });
  let passphrase: string;
  try { passphrase = (await readFile(passphrasePath, 'utf8')).trim(); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    passphrase = randomBytes(48).toString('hex');
    await writeFile(passphrasePath, passphrase + '\n', { mode: 0o600, flag: 'wx' });
  }
  if (!/^[a-f0-9]{96}$/.test(passphrase)) throw new Error('Separate 384-bit maintenance passphrase required');
  const temp = await mkdtemp(path.join(os.tmpdir(), 'nba-package-'));
  try {
    const input = path.join(temp, 'input.json'); const cipher = path.join(temp, 'output.gpg');
    await writeFile(input, JSON.stringify({ plan, approval }), { mode: 0o600, flag: 'wx' });
    const result = spawnSync('gpg', ['--no-options', '--homedir', temp, '--batch', '--no-symkey-cache', '--pinentry-mode', 'loopback', '--passphrase-fd', '0', '--symmetric', '--cipher-algo', 'AES256', '--output', cipher, input], {
      input: passphrase + '\n', env: { PATH: process.env.PATH }, timeout: 30000,
    });
    if (result.status !== 0) throw new Error('Maintenance package encryption failed');
    const bytes = await readFile(cipher);
    if (bytes.length > 35 * 1024 * 1024) throw new Error('Package exceeds bounded worker limit; prepare separate reviewed plans');
    const recovered = decryptMaintenancePackage(bytes, passphrase, cipher, temp);
    if (digest(canonical(recovered)) !== digest(canonical({ plan, approval }))) throw new Error('Private package readback mismatch');
    await writeFile(output, bytes, { mode: 0o600, flag: 'wx' });
    return { planSha256: digest(canonical(plan)), ciphertextSha256: digest(bytes), inputSha256: plan.inputSha256,
      qualificationReceipt: approval.qualification.receipt, reviewReceipt: approval.review.receipt, ownerReceipt: approval.owner.receipt, expiresAt: approval.expiresAt,
      encryptedBytes: bytes.length, privateReadbackVerified: true, productionWriteAuthorized: false };
  } finally {
    spawnSync('gpgconf', ['--homedir', temp, '--kill', 'gpg-agent'], { stdio: 'ignore', timeout: 5000 });
    await rm(temp, { recursive: true, force: true });
  }
}
if (decodeURIComponent(import.meta.url) === `file://${process.argv[1]}`) {
  try {
    const { values } = parseArgs({ options: { plan: { type: 'string' }, approval: { type: 'string' }, out: { type: 'string' }, passphrase: { type: 'string' } } });
    if (![values.plan, values.approval, values.out, values.passphrase].every(Boolean)) throw new Error('Explicit private --plan, --approval, --out and --passphrase file paths required');
    console.log(JSON.stringify(await packageMaintenance(JSON.parse(await readFile(values.plan!, 'utf8')), JSON.parse(await readFile(values.approval!, 'utf8')), values.out!, values.passphrase!)));
  } catch (error) { console.error(maintenanceErrorMessage(error)); process.exitCode = 1; }
}
