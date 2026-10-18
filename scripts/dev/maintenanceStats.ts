/** Statistics-only staging preserves contract, roster and world fields. */
import { SeasonDocZ } from '../../src/schemas/players_v2.js';
import { planPlayerWrites } from './cloudPipeline.js';
import type { Snapshot } from './cloudData.js';

export function planStatistics(snapshot: Snapshot, playerId: string, output: any | null, season: string) {
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
