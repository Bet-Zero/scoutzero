/**
 * FILE: src/features/architect/utils/tradeContext/assertions.ts
 * PURPOSE: Runtime assertions for trade context shapes (PostTradeSnapshot, ValidatedTradeContext).
 * OWNERSHIP: Feature: architect/tradeMachine
 *
 * HISTORY:
 *  - 2026-01-30: Phase 58 - Created with minimal runtime assertions for shape validation
 *
 * LINKS:
 *  - Master Doc: docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
 *  - Types: src/features/architect/utils/tradeContext/types.ts
 *  - Phase 58: Trade Context Extraction + Shape Hardening
 *
 * DESIGN:
 * These assertions are intentionally minimal and fast. They check:
 * 1. Presence of sentinel flags
 * 2. Required top-level fields exist
 * 3. Arrays are arrays (not null/undefined)
 *
 * They do NOT deep-validate every field - that's the validator's job.
 * Assertions are used at key pipeline boundaries to catch integration mistakes early.
 */

import type {
  AssertTradeComputeInputsParams,
  PostTradeSnapshot,
  ValidatedTradeContext,
} from './types';

// ==============================================================================
// PHASE 58: RUNTIME SHAPE ASSERTIONS
// ==============================================================================

/**
 * Assert that a value is a valid PostTradeSnapshot.
 * Throws a clear error if the shape is invalid.
 */
export function assertPostTradeSnapshot(
  snapshot: PostTradeSnapshot | null | undefined,
  callSite = 'unknown'
): asserts snapshot is PostTradeSnapshot {
  if (!snapshot) {
    throw new Error(
      `[Phase 58 invariant violated at ${callSite}] PostTradeSnapshot is null/undefined. ` +
        'Use buildPostTradeTeamsSnapshot() to create a snapshot before calling this function.'
    );
  }

  if (!Array.isArray(snapshot.teamUpdates)) {
    throw new Error(
      `[Phase 58 invariant violated at ${callSite}] PostTradeSnapshot.teamUpdates must be an array. ` +
        `Got: ${typeof snapshot.teamUpdates}`
    );
  }

  if (!Array.isArray(snapshot.validationTeams)) {
    throw new Error(
      `[Phase 58 invariant violated at ${callSite}] PostTradeSnapshot.validationTeams must be an array. ` +
        `Got: ${typeof snapshot.validationTeams}`
    );
  }

  for (let i = 0; i < snapshot.teamUpdates.length; i++) {
    const update = snapshot.teamUpdates[i];
    if (!update.teamCode) {
      throw new Error(
        `[Phase 58 invariant violated at ${callSite}] PostTradeSnapshot.teamUpdates[${i}].teamCode is missing.`
      );
    }
    if (!update.team) {
      throw new Error(
        `[Phase 58 invariant violated at ${callSite}] PostTradeSnapshot.teamUpdates[${i}].team is missing.`
      );
    }
  }
}

/**
 * Assert that a value is a valid ValidatedTradeContext.
 * Throws a clear error if the shape is invalid.
 */
export function assertValidatedTradeContext(
  ctx: ValidatedTradeContext | null | undefined,
  callSite = 'unknown'
): asserts ctx is ValidatedTradeContext {
  if (!ctx) {
    throw new Error(
      `[Phase 58 invariant violated at ${callSite}] ValidatedTradeContext is null/undefined. ` +
        'Use validatePostTradeSnapshotForContext() to create a context before calling this function.'
    );
  }

  if (!ctx._isValidatedTradeContext) {
    throw new Error(
      `[Phase 58 invariant violated at ${callSite}] ValidatedTradeContext._isValidatedTradeContext must be true. ` +
        'This context was not created by validatePostTradeSnapshotForContext(). ' +
        'Ensure you are passing the correct object.'
    );
  }

  if (typeof ctx.legal !== 'boolean') {
    throw new Error(
      `[Phase 58 invariant violated at ${callSite}] ValidatedTradeContext.legal must be a boolean. ` +
        `Got: ${typeof ctx.legal}`
    );
  }

  if (!Array.isArray(ctx.teamResults)) {
    throw new Error(
      `[Phase 58 invariant violated at ${callSite}] ValidatedTradeContext.teamResults must be an array. ` +
        `Got: ${typeof ctx.teamResults}`
    );
  }

  if (!Array.isArray(ctx.validationTeams)) {
    throw new Error(
      `[Phase 58 invariant violated at ${callSite}] ValidatedTradeContext.validationTeams must be an array. ` +
        `Got: ${typeof ctx.validationTeams}`
    );
  }
}

/**
 * Validate both snapshot and context together (convenience wrapper).
 * Used at the entry of computeTradeResult.
 */
export function assertTradeComputeInputs({
  postTradeSnapshot,
  validatedContext,
  callSite = 'computeTradeResult',
}: AssertTradeComputeInputsParams): void {
  assertPostTradeSnapshot(postTradeSnapshot as PostTradeSnapshot, callSite);
  assertValidatedTradeContext(
    validatedContext as ValidatedTradeContext,
    callSite
  );
}
