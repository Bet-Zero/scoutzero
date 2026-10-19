/**
 * FILE: scripts/dev/maintenanceTransport.ts
 * PURPOSE: Shared NBA maintenance mechanics with governed source and publication decisions.
 * OWNERSHIP: Operations tooling.
 * HISTORY: 2026-10-18 — BZE-324 Gate A implementation.
 * LINKS: docs/operations/NBA_MAINTENANCE.md; docs/operations/DRAFT_UPDATE_PROCESS.md
 */
import { DEMO_PROJECT, SOURCE_PROJECT } from './cloudData.js';
import type { PublicationStore } from './maintenancePublish.js';

/** Fixed endpoints; never accepts a supplied URL or forwards credentials on redirects. */
export async function maintenanceStore(production: boolean, workerToken?: string, deadline?: number): Promise<PublicationStore> {
  const project = production ? SOURCE_PROJECT : DEMO_PROJECT;
  const origin = production ? 'https://firestore.googleapis.com' : 'http://127.0.0.1:8082';
  if (production && process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Production and emulator modes cannot be combined');
  if (production && !workerToken) throw new Error('Production requires the protected keyless GitHub worker; local ADC and service-account keys are unsupported');
  async function request(suffix: string, method = 'GET', body?: unknown) {
    if (deadline !== undefined && Date.now() >= deadline) throw new Error('Publication execution budget exhausted; retain plan and resume');
    const timeout = Math.max(1, Math.min(30000, deadline === undefined ? 30000 : deadline - Date.now()));
    const token = production ? workerToken : 'owner';
    const result = await fetch(`${origin}/v1/projects/${project}/databases/(default)/documents${suffix}`, {
      method, headers: { Authorization: 'Bearer ' + token, 'content-type': 'application/json' },
      redirect: 'error', signal: AbortSignal.timeout(timeout), ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (result.status === 404 && method === 'GET') return null;
    if (!result.ok) throw new Error('Conditional publication request failed: HTTP ' + result.status + '; retain plan and rerun for completion-record recovery');
    return result.json();
  }
  function checkedPath(documentPath: string) {
    if (!/^(players_v2|architect_basePlayers|architect_baseTeams|maintenance_publications)\//.test(documentPath) || documentPath.split('/').some(p => !p || p === '.' || p === '..')) throw new Error('Publication read path rejected');
    return `projects/${project}/databases/(default)/documents/${documentPath}`;
  }
  return { project, database: '(default)',
    read: documentPath => {
      checkedPath(documentPath);
      return request('/' + documentPath.split('/').map(encodeURIComponent).join('/'));
    },
    readMany: async paths => {
      const names = paths.map(checkedPath);
      if (new Set(names).size !== names.length) throw new Error('Duplicate bulk read path');
      const documents = new Map<string, Awaited<ReturnType<PublicationStore['read']>>>(); let readTime: string | undefined;
      for (let offset = 0; offset < paths.length; offset += 100) {
        const batch = names.slice(offset, offset + 100); const seen = new Set<string>();
        const snapshot = readTime;
        const response = await request(':batchGet', 'POST', { documents: batch, ...(snapshot ? { readTime: snapshot } : {}) });
        if (!Array.isArray(response)) throw new Error('Invalid publication bulk read response');
        for (const row of response) {
          const name = row.found?.name ?? row.missing;
          if (!batch.includes(name) || seen.has(name) || !!row.found === !!row.missing ||
              !Number.isFinite(Date.parse(row.readTime)) || snapshot && row.readTime !== snapshot ||
              row.found && (!row.found.updateTime || !Number.isFinite(Date.parse(row.found.updateTime)))) throw new Error('Inconsistent publication bulk snapshot');
          seen.add(name);
          documents.set(name.split('/documents/')[1], row.found ?? null);
        }
        if (seen.size !== batch.length) throw new Error('Incomplete publication bulk snapshot');
        // batchGet guarantees prior rows unchanged through its monotonically increasing readTime.
        // Pin later pages to the last time of the first page for one coherent whole-plan snapshot.
        readTime = response.at(-1).readTime;
      }
      return documents;
    },
    commit: async writes => { const result = await request(':commit', 'POST', { writes });
      if (result?.writeResults?.length !== writes.length) throw new Error('Incomplete conditional commit response'); },
  };
}
