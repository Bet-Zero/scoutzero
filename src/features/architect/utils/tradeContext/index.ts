/**
 * FILE: src/features/architect/utils/tradeContext/index.ts
 * PURPOSE: Public API for trade context module (Phase 58/59).
 * OWNERSHIP: Feature: architect/tradeMachine
 *
 * HISTORY:
 *  - 2026-03-20: E130 - TS-backed the tradeContext barrel and retired index.js
 *  - 2026-01-30: Phase 58 - Created
 *  - 2026-01-30: Phase 59 - Moved validateTradeForContext to legacy/ namespace
 *  - 2026-03-27: TM-3E - Narrowed barrel to canonical surfaces and legacy compatibility.
 *
 * EXPORTS:
 * - buildPostTradeTeamsSnapshot: Build post-trade snapshot (PURE)
 * - validatePostTradeSnapshotForContext: Validate snapshot to context
 * - buildTradeApplyPreparation: Centralized snapshot + validation handoff
 * - getTradePreviewAuthority: Canonical preview authority surface
 * - getFullLegalityPreview: Compatibility alias for preview authority callers
 * - FullLegalityPreviewResult: Type for preview-authority result wrapper
 * - assertPostTradeSnapshot: Runtime assertion for PostTradeSnapshot shape
 * - assertValidatedTradeContext: Runtime assertion for ValidatedTradeContext shape
 * - assertTradeComputeInputs: Combined assertion for compute inputs
 *
 * TM-3A/TM-3E CANONICAL EXECUTION EXPORTS (from ./tradeExecutionAuthority):
 * - validateTradeExecutionAuthority: Explicit execution authority surface for trade apply-time legality
 * - TradeExecutionAuthorityInput: Input type
 * - TradeExecutionAuthorityResult: Result type
 * - TradeExecutionAuditArtifacts: Audit artifacts type
 * - TradeExecutionAuthorityStage: Stage identifier type
 *
 * Supporting stage helpers remain in ./tradeExecutionAuthority.ts for direct imports
 * by authority-focused modules only; they are intentionally not barrel-exported.
 *
 * LEGACY EXPORTS (from ./legacy/):
 * - legacy_validateTradeForContext: Deprecated convenience wrapper
 * - validateTradeForContext: Alias for legacy_validateTradeForContext
 */

export {
  buildTradeApplyPreparation,
  buildPostTradeTeamsSnapshot,
  validatePostTradeSnapshotForContext,
  normalizeTradeTeamCodeLike,
  resolveOutgoingTradeDestinationTeamCode,
  getTradePreviewAuthority,
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
