/**
 * FILE: src/features/architect/utils/tradeContext/types.js
 * PURPOSE: Canonical JSDoc typedefs for trade snapshot and validation context shapes.
 * OWNERSHIP: Feature: architect/tradeMachine
 *
 * HISTORY:
 *  - 2026-01-30: Phase 58 - Created with canonical PostTradeSnapshot and ValidatedTradeContext typedefs
 *
 * LINKS:
 *  - Master Doc: docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
 *  - Phase 58: Trade Context Extraction + Shape Hardening
 */

// ==============================================================================
// PHASE 58: CANONICAL TRADE CONTEXT SHAPES
// ==============================================================================

/**
 * @typedef {Object} TeamUpdate
 * @property {string} teamCode - Team code (e.g., "BOS", "LAL")
 * @property {Object} team - The team object with updated roster/players/TPEs
 */

/**
 * @typedef {Object} ValidationTeam
 * @property {Object} team - POST-TRADE team state
 * @property {string} teamCode - Team code
 * @property {Array} sends - Players being sent
 * @property {Array} receives - Players being received
 * @property {Array} picksOut - Draft picks going out
 * @property {Array} picksIn - Draft picks coming in
 * @property {number} cashSent - Cash sent
 * @property {number} cashReceived - Cash received
 */

/**
 * @typedef {Object} PostTradeSnapshot
 * @description Result from buildPostTradeTeamsSnapshot(). Contains the post-trade team
 * state AFTER roster moves but BEFORE validation. This snapshot is passed to
 * validatePostTradeSnapshotForContext() for validation, then to computeTradeResult().
 *
 * @property {TeamUpdate[]} teamUpdates - Array of { teamCode, team } with roster changes applied
 * @property {ValidationTeam[]} validationTeams - Array in format expected by validateTrade
 * @property {Array} payloadTeams - Original payload.teams for reference
 * @property {boolean} [_isPostTradeSnapshot] - Sentinel flag for shape detection (Phase 58)
 */

/**
 * @typedef {Object} TeamResult
 * @property {Object} [createdTPE] - Created TPE object if salary mismatch (for over-cap teams)
 * @property {Object} [rules] - Validation rules results including tradeExceptions
 * @property {Array} [violations] - Array of violation objects
 */

/**
 * @typedef {Object} ValidatedTradeContext
 * @description Result from validatePostTradeSnapshotForContext(). Contains validation
 * results after running validateTrade() exactly ONCE on the post-trade snapshot.
 * This context is passed to computeTradeResult() which trusts it without re-validating.
 *
 * @property {boolean} legal - Is the trade legal?
 * @property {boolean} valid - Alias for legal (for compatibility)
 * @property {string|null} reason - Reason if not legal
 * @property {string|null} error - Error message if not legal
 * @property {Array} violations - Validation violations (flattened from teamResults)
 * @property {Array} warnings - Validation warnings
 * @property {TeamResult[]} teamResults - Per-team validation results (createdTPE, rules.tradeExceptions)
 * @property {ValidationTeam[]} validationTeams - The validated teams with matchIncoming populated
 * @property {Object} [_rawValidation] - Raw validation result (for debugging)
 * @property {boolean} _isValidatedTradeContext - Sentinel flag, MUST be true (Phase 56/58)
 */

/**
 * @typedef {Object} ComputeTradeResultParams
 * @property {Object} payload - Trade payload with teams array
 * @property {Object} currentState - Current team states (used for reference only)
 * @property {string} seasonId - Season ID (e.g., "2025-26")
 * @property {number} timestamp - Mutation timestamp
 * @property {Object} [historyContext] - History context for audit logging
 * @property {PostTradeSnapshot} postTradeSnapshot - Result from buildPostTradeTeamsSnapshot (REQUIRED)
 * @property {ValidatedTradeContext} validatedContext - Result from validatePostTradeSnapshotForContext (REQUIRED)
 */

export {};
