/**
 * FILE: scripts/dev/maintenancePublish.cli.ts
 * PURPOSE: Shared NBA maintenance mechanics with governed source and publication decisions.
 * OWNERSHIP: Operations tooling.
 * HISTORY: 2026-10-18 — BZE-324 Gate A implementation.
 * LINKS: docs/operations/NBA_MAINTENANCE.md; docs/operations/DRAFT_UPDATE_PROCESS.md
 */
import { maintenanceErrorMessage } from './maintenanceErrors.js';
/** Production is an explicit operator operation after external factual review and owner approval. */
import { readFile } from 'node:fs/promises';
import { digest } from './cloudData.js';
import { canonical } from './cloudPipeline.js';
import { publishMaintenance } from './maintenancePublish.js';
import { maintenanceStore } from './maintenanceTransport.js';
import { requireLandedExecutor, requireRegisteredPublication } from './maintenanceApprovals.js';

try {
  const option = (key: string) => process.argv.find(v => v.startsWith('--' + key + '='))?.slice(key.length + 3);
  const plan = JSON.parse(await readFile(option('plan') || '', 'utf8'));
  const approval = JSON.parse(await readFile(option('approval') || '', 'utf8'));
  const production = process.argv.includes('--production');
  if (production && option('approved-plan-sha256') !== digest(canonical(plan))) throw new Error('Production requires the exact owner-approved plan digest');
  if (production) {
    requireRegisteredPublication(digest(canonical(plan)), plan, approval);
    await requireLandedExecutor();
  }
  console.log(JSON.stringify(await publishMaintenance(plan, approval, await maintenanceStore(production))));
} catch (error) {
  console.error(maintenanceErrorMessage(error));
  console.error('Publication stopped; no complete-publication claim is made.');
  process.exitCode = 1;
}
