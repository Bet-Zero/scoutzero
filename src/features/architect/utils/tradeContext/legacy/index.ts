/**
 * FILE: src/features/architect/utils/tradeContext/legacy/index.ts
 * PURPOSE: LEGACY namespace for deprecated trade context helpers (Phase 59/E44).
 * OWNERSHIP: Feature: architect/tradeMachine
 *
 * ⚠️⚠️⚠️ WARNING: LEGACY NAMESPACE ⚠️⚠️⚠️
 *
 * These functions are DEPRECATED and exist ONLY for:
 * - Backward compatibility with external tooling
 * - Legacy test compatibility
 * - Quick UI previews (non-mutation paths)
 *
 * 🚫 DO NOT IMPORT IN MUTATION MODULES:
 * - mutationPipeline.js
 * - Any file under utils/mutation/
 * - computeTradeResult or persistWorldMutation regions
 *
 * The mutation pipeline uses the Phase 56/58 canonical path:
 *   buildPostTradeTeamsSnapshot → validatePostTradeSnapshotForContext → compute/persist
 *
 * HISTORY:
 *  - 2026-01-30: Phase 59 - Moved validateTradeForContext here from tradeContext.js
 *  - 2026-03-10: E44 - TS-backed the legacy wrapper and left index.js as a pure shim
 *
 * LINKS:
 *  - Master Doc: docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
 *  - Return Package: docs/architect/return_packages/PHASE_59_LEGACY_TRADE_VALIDATION_RETIREMENT_GUARDRAILS_EXECUTION_RETURN_PACKAGE.md
 */

import {
  buildPostTradeTeamsSnapshot,
  validatePostTradeSnapshotForContext,
} from '../tradeContext';
import type {
  TradeContextCurrentState,
  TradeContextPayload,
  ValidatedTradeContext,
} from '../types';

// ==============================================================================
// LEGACY CONVENIENCE WRAPPER - NOT FOR MUTATION GATING
// ==============================================================================

/**
 * 🚫🚫🚫 LEGACY FUNCTION - DO NOT USE IN MUTATION PIPELINE 🚫🚫🚫
 *
 * @deprecated Phase 59: This function is DEPRECATED and must NOT be used for mutation gating.
 *
 * Legacy convenience wrapper that builds a snapshot and validates in one call.
 * Moved to legacy/ namespace in Phase 59 to prevent accidental mutation usage.
 *
 * ⚠️ DO NOT USE FOR MUTATION GATING:
 * - The mutation pipeline (executeTrade, signAndTrade) MUST NOT use this function.
 * - Mutation paths use buildPostTradeTeamsSnapshot + validatePostTradeSnapshotForContext
 *   explicitly, with the validated context passed to computeTradeResult.
 *
 * ALLOWED USE CASES:
 * - Quick UI previews of trade legality before user commits
 * - Test helpers that need a simple validation call
 * - External tooling that doesn't go through the mutation pipeline
 */
export function legacy_validateTradeForContext({
  payload,
  currentState,
  seasonId,
}: {
  payload: TradeContextPayload;
  currentState: TradeContextCurrentState;
  seasonId: string;
}): ValidatedTradeContext {
  // Keep timestamp timing and delegation order exact for legacy compatibility.
  const timestamp = Date.now();
  const snapshot = buildPostTradeTeamsSnapshot({
    payload,
    currentState,
    seasonId,
    timestamp,
  });
  return validatePostTradeSnapshotForContext({ snapshot, payload, seasonId });
}

/**
 * Alias export for backward compatibility.
 * @deprecated Use legacy_validateTradeForContext for clarity, or migrate to
 * buildPostTradeTeamsSnapshot + validatePostTradeSnapshotForContext.
 */
export const validateTradeForContext = legacy_validateTradeForContext;
