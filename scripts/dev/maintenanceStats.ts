/**
 * FILE: scripts/dev/maintenanceStats.ts
 * PURPOSE: Shared NBA maintenance mechanics with governed source and publication decisions.
 * OWNERSHIP: Operations tooling.
 * HISTORY: 2026-10-18 — BZE-324 Gate A implementation.
 * LINKS: docs/operations/NBA_MAINTENANCE.md; docs/operations/DRAFT_UPDATE_PROCESS.md
 */
/** Statistics-only staging preserves contract, roster and world fields. */
import { SeasonDocZ } from '../../src/schemas/players_v2.js';
import { planPlayerWrites } from './cloudPipeline.js';
import type { Snapshot } from './cloudData.js';

export function planStatistics(snapshot: Snapshot, playerId: string, output: any | null, season: string) {
  if (!snapshot.documents.some(d => d.name.endsWith('/documents/players_v2/' + playerId))) throw new Error('Statistics-only planning requires an existing player; prepare identity through the player workflow first');
  const seasons: Record<string, unknown> = {};
  for (const [id, value] of Object.entries(output?.seasons || {}) as [string, any][]) {
    seasons[id] = SeasonDocZ.parse({ team: value.team, age: typeof value.age === 'number' ? value.age : undefined, stats: value.stats, meta: output.meta });
  }
  const current = output?.seasons?.[season];
  const currentSeasonStats = current && !output.meta?.statsCarryOver ? Object.fromEntries(Object.entries(current.stats).filter(([key]) => ['PTS', 'REB', 'AST', 'FG%', '3PT%', 'FT%', 'eFG%', 'MIN', 'GP'].includes(key))) : undefined;
  const result = planPlayerWrites(snapshot, playerId, { doc: currentSeasonStats ? { currentSeasonStats } : {},
    contracts: {}, views: {}, seasons, statsProvided: true }, undefined);
  if (result.some(entry => entry.path.startsWith('architect_basePlayers/') || entry.path.includes('/contracts/'))) throw new Error('Statistics-only scope escaped');
  return result;
}
