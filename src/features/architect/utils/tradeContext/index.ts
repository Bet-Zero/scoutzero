/**
 * FILE: src/features/architect/utils/tradeContext/index.ts
 * PURPOSE: Public API for trade context module (Phase 58/59).
 * OWNERSHIP: Feature: architect/tradeMachine
 *
 * HISTORY:
 *  - 2026-03-20: E130 - TS-backed the tradeContext barrel and retired index.js
 *  - 2026-01-30: Phase 58 - Created
 *  - 2026-01-30: Phase 59 - Moved validateTradeForContext to legacy/ namespace
 *
 * EXPORTS:
 * - buildPostTradeTeamsSnapshot: Build post-trade snapshot (PURE)
 * - validatePostTradeSnapshotForContext: Validate snapshot to context
 * - getFullLegalityPreview: TM-1A apply-path preview without world-state gates
 * - FullLegalityPreviewResult: Type for apply-path preview result
 * - assertPostTradeSnapshot: Runtime assertion for PostTradeSnapshot shape
 * - assertValidatedTradeContext: Runtime assertion for ValidatedTradeContext shape
 * - assertTradeComputeInputs: Combined assertion for compute inputs
 *
 * TM-3A EXPORTS (from ./tradeExecutionAuthority):
 * - validateTradeExecutionAuthority: Explicit execution authority surface for trade apply-time legality
 * - TradeExecutionAuthorityInput: Input type
 * - TradeExecutionAuthorityResult: Result type
 * - TradeExecutionAuditArtifacts: Audit artifacts type
 * - TradeExecutionAuthorityStage: Stage identifier type
 *
 * LEGACY EXPORTS (from ./legacy/):
 * - legacy_validateTradeForContext: Deprecated convenience wrapper
 * - validateTradeForContext: Alias for legacy_validateTradeForContext
 */

export {
  buildPostTradeTeamsSnapshot,
  validatePostTradeSnapshotForContext,
  normalizeTradeTeamCodeLike,
  resolveOutgoingTradeDestinationTeamCode,
  getFullLegalityPreview,
  type FullLegalityPreviewResult,
} from './tradeContext';

export {
  legacy_validateTradeForContext,
  validateTradeForContext,
} from './legacy';

export {
  assertPostTradeSnapshot,
  assertValidatedTradeContext,
  assertTradeComputeInputs,
} from './assertions';

export {
  validateTradeExecutionAuthority,
  type TradeExecutionAuthorityInput,
  type TradeExecutionAuthorityResult,
  type TradeExecutionAuditArtifacts,
  type TradeExecutionAuthorityStage,
} from './tradeExecutionAuthority';
