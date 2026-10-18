/**
 * FILE: scripts/dev/maintenanceApprovals.ts
 * PURPOSE: Shared NBA maintenance mechanics with governed source and publication decisions.
 * OWNERSHIP: Operations tooling.
 * HISTORY: 2026-10-18 — BZE-324 Gate A implementation.
 * LINKS: docs/operations/NBA_MAINTENANCE.md; docs/operations/DRAFT_UPDATE_PROCESS.md
 */
/** Production decisions are reviewed code pins, not caller-authored approval JSON. */
import { execFileSync } from 'node:child_process';
import { readFile, readlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCE_PROJECT } from './cloudData.js';
import type { Publication, PublicationApproval } from './maintenancePublish.js';

export type AcceptedPublication = {
  inputSha256: string; qualificationReceipt: string; reviewReceipt: string; ownerReceipt: string; expiresAt: string;
};
// Intentionally empty: Gate A authorizes no production refresh. Add an exact
// independently qualified/reviewed/owner-approved operation through normal PR review.
export const acceptedPublications: Readonly<Record<string, AcceptedPublication>> = Object.freeze({});

export function requireRegisteredPublication(planSha256: string, plan: Publication, approval: PublicationApproval, registry: Readonly<Record<string, AcceptedPublication>> = acceptedPublications) {
  const accepted = Object.hasOwn(registry, planSha256) ? registry[planSha256] : undefined;
  if (!accepted || plan.project !== SOURCE_PROJECT || accepted.inputSha256 !== plan.inputSha256 ||
      accepted.qualificationReceipt !== approval.qualification.receipt || accepted.reviewReceipt !== approval.review.receipt ||
      accepted.ownerReceipt !== approval.owner.receipt || accepted.expiresAt !== approval.expiresAt) throw new Error('Production plan is not registered by independently reviewed, owner-approved release code');
}

/** Inspect actual bytes, including files hidden by skip-worktree/assume-unchanged. */
export async function verifyTrackedExecutor(root: string) {
  const tree = execFileSync('git', ['ls-tree', '-rz', 'HEAD'], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  for (const entry of tree.split('\0').filter(Boolean)) {
    const split = entry.indexOf('\t');
    const [mode, type, expected] = entry.slice(0, split).split(' ');
    const name = entry.slice(split + 1);
    if (type !== 'blob') throw new Error('Unsupported executor repository entry');
    const bytes = mode === '120000' ? Buffer.from(await readlink(path.join(root, name))) : await readFile(path.join(root, name));
    const actual = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    if (actual !== expected) throw new Error('Executor tracked bytes differ from landed code');
  }
}

/** Production executes only the unmodified landed repository, never an author branch. */
export async function requireLandedExecutor() {
  const git = (args: string[]) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  if (git(['status', '--porcelain'])) throw new Error('Production executor must be clean');
  const head = git(['rev-parse', 'HEAD']);
  const response = await fetch('https://api.github.com/repos/Bet-Zero/scoutzero/commits/main', {
    redirect: 'error', headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(15000),
  });
  if (!response.ok || (await response.json()).sha !== head) throw new Error('Production executor is not exact live main');
  await verifyTrackedExecutor(git(['rev-parse', '--show-toplevel']));
  // Check the actually loaded approval module as well as git status. No local
  // skip-worktree/assume-unchanged flag may hide a replacement approval registry.
  const actual = await readFile(fileURLToPath(import.meta.url), 'utf8');
  if (actual.trim() !== git(['show', head + ':scripts/dev/maintenanceApprovals.ts'])) throw new Error('Loaded approval registry differs from landed code');
}
