/**
 * Architect Core Module Index
 *
 * Centralized exports for all Architect core functionality.
 * This provides a single import point for world management, team loading,
 * read-only roster helpers, and season advancement.
 *
 * @file src/utils/architect/architectCore.ts
 * @module architectCore
 */

// World Management
export {
  createWorld,
  getWorldMetadata,
  listUserWorlds,
  updateWorldMetadata,
  deleteWorld,
  branchWorld,
  updateWorldStats,
} from './worldManager';

// Team Data Loading
export {
  getTeam,
  getLeague,
  getPlayer,
  mergePlayerOverride,
} from './teamLoader';

// Trade Management
// Note: updateTeamCapTotals was removed in Phase 78; use computeTeamCapTotals from capTotals instead
export {
  signFreeAgent,
  waivePlayer,
  extendPlayer,
} from './tradeManager';

// Season Advancement
export { advanceSeason, processSeasonTransition } from './seasonManager';

// Trade Input Builder
export {
  buildTradeTeamInput,
  buildTradeInput,
  // Deprecated aliases for backward compatibility
  adaptTeamForValidator,
  adaptPlayerForValidator,
  adaptContractForValidator,
  adaptTradeInputForValidator,
} from './schemaAdapter';
