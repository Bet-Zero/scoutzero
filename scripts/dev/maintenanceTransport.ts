/**
 * FILE: scripts/dev/maintenanceTransport.ts
 * PURPOSE: Shared NBA maintenance mechanics with governed source and publication decisions.
 * OWNERSHIP: Operations tooling.
 * HISTORY: 2026-10-18 — BZE-324 Gate A implementation.
 * LINKS: docs/operations/NBA_MAINTENANCE.md; docs/operations/DRAFT_UPDATE_PROCESS.md
 */
import { applicationDefault } from 'firebase-admin/app';
import { DEMO_PROJECT, SOURCE_PROJECT } from './cloudData.js';
import type { PublicationStore } from './maintenancePublish.js';

/** Fixed endpoints; never accepts a supplied URL or forwards credentials on redirects. */
export async function maintenanceStore(production: boolean): Promise<PublicationStore> {
  const project = production ? SOURCE_PROJECT : DEMO_PROJECT;
  const origin = production ? 'https://firestore.googleapis.com' : 'http://127.0.0.1:8082';
  if (production && process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Production and emulator modes cannot be combined');
  const credential = production ? applicationDefault() : undefined;
  async function request(suffix: string, method = 'GET', body?: unknown) {
    const token = credential ? (await credential.getAccessToken()).access_token : 'owner';
    const result = await fetch(`${origin}/v1/projects/${project}/databases/(default)/documents${suffix}`, {
      method, headers: { Authorization: 'Bearer ' + token, 'content-type': 'application/json' },
      redirect: 'error', signal: AbortSignal.timeout(30000), ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (result.status === 404 && method === 'GET') return null;
    if (!result.ok) throw new Error('Conditional publication request failed: HTTP ' + result.status + '; retain plan and rerun for completion-record recovery');
    return result.json();
  }
  return { project, database: '(default)',
    read: documentPath => {
      if (!/^(players_v2|architect_basePlayers|architect_baseTeams|maintenance_publications)\//.test(documentPath) || documentPath.split('/').some(p => !p || p === '.' || p === '..')) throw new Error('Publication read path rejected');
      return request('/' + documentPath.split('/').map(encodeURIComponent).join('/'));
    },
    commit: async writes => { const result = await request(':commit', 'POST', { writes });
      if (result?.writeResults?.length !== writes.length) throw new Error('Incomplete conditional commit response'); },
  };
}
