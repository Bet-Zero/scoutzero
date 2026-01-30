/**
 * FILE: src/features/architect/utils/tradeContext/index.js
 * PURPOSE: Public API for trade context module (Phase 58/59).
 * OWNERSHIP: Feature: architect/tradeMachine
 *
 * HISTORY:
 *  - 2026-01-30: Phase 58 - Created
 *  - 2026-01-30: Phase 59 - Moved validateTradeForContext to legacy/ namespace
 *
 * EXPORTS:
 * - buildPostTradeTeamsSnapshot: Build post-trade snapshot (PURE)
 * - validatePostTradeSnapshotForContext: Validate snapshot → context
 * - assertPostTradeSnapshot: Runtime assertion for PostTradeSnapshot shape
 * - assertValidatedTradeContext: Runtime assertion for ValidatedTradeContext shape
 * - assertTradeComputeInputs: Combined assertion for compute inputs
 *
 * LEGACY EXPORTS (from ./legacy/):
 * - legacy_validateTradeForContext: Deprecated convenience wrapper
 * - validateTradeForContext: Alias for legacy_validateTradeForContext
 */

// Snapshot + validation context builders
export {
  buildPostTradeTeamsSnapshot,
  validatePostTradeSnapshotForContext,
} from './tradeContext';

// Phase 59: Legacy helpers in explicit namespace
export {
  legacy_validateTradeForContext,
  validateTradeForContext,
} from './legacy';

// Runtime shape assertions
export {
  assertPostTradeSnapshot,
  assertValidatedTradeContext,
  assertTradeComputeInputs,
} from './assertions';

// Types are JSDoc-only, no runtime exports needed
// See: ./types.js for TypeDef documentation
