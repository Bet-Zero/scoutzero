/** Shared pure bookkeeping for both ordinary and atomic world mutations. */
import type { WorldMetadata, WorldStats } from './worldManager.readUtils';

export function buildWorldStatsUpdate(
  metadata: WorldMetadata,
  actionType: string,
  teamCodes: string[] = []
) {
  const currentStats = metadata.stats || {
    totalTrades: 0,
    totalSignings: 0,
    totalWaives: 0,
    teamsInvolved: 0,
  };
  const stats: WorldStats = { ...currentStats };
  if (actionType === 'trade')
    stats.totalTrades = (currentStats.totalTrades || 0) + 1;
  if (actionType === 'signing')
    stats.totalSignings = (currentStats.totalSignings || 0) + 1;
  if (actionType === 'waive')
    stats.totalWaives = (currentStats.totalWaives || 0) + 1;
  if (actionType === 'renounce')
    stats.totalRenounces = (currentStats.totalRenounces || 0) + 1;
  const modifiedTeams = [
    ...new Set([...(metadata.modifiedTeams || []), ...teamCodes]),
  ];
  if (teamCodes.length) stats.teamsInvolved = modifiedTeams.length;
  return {
    actionCount: (metadata.actionCount || 0) + 1,
    stats,
    ...(teamCodes.length ? { modifiedTeams } : {}),
  };
}
