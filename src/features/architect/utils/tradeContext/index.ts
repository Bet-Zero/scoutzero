/**
 * FILE: src/features/architect/utils/tradeContext/index.ts
 * PURPOSE: Canonical public API for trade context module.
 * OWNERSHIP: Feature: architect/tradeMachine
 *
 * HISTORY:
 *  - 2026-03-20: E130 - TS-backed the tradeContext barrel and retired index.js
 *  - 2026-01-30: Phase 58 - Created
 *  - 2026-01-30: Phase 59 - Moved validateTradeForContext to legacy/ namespace
 *  - 2026-03-27: TM-3E - Exposed canonical preview/execution authority surfaces
 *  - 2026-03-27: TM-4B - Narrowed barrel to canonical-only exports
 *
 * CANONICAL EXPORTS:
 * - buildPostTradeTeamsSnapshot: Build post-trade snapshot (PURE)
 * - validatePostTradeSnapshotForContext: Validate snapshot to context
 * - buildTradeApplyPreparation: Centralized snapshot + validation handoff
 * - normalizeTradeTeamCodeLike: Canonical team-code normalization helper
 * - resolveOutgoingTradeDestinationTeamCode: Canonical trade-routing helper
 * - getTradePreviewAuthority: Canonical preview authority surface
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
 * LEGACY COMPATIBILITY IMPORTS:
 * - Import from ./legacy for deprecated compatibility aliases such as
 *   validateTradeForContext() and getFullLegalityPreview().
 */

export {
  buildTradeApplyPreparation,
  buildPostTradeTeamsSnapshot,
  validatePostTradeSnapshotForContext,
  normalizeTradeTeamCodeLike,
  resolveOutgoingTradeDestinationTeamCode,
  getTradePreviewAuthority,
  type FullLegalityPreviewResult,
} from './tradeContext';

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
