/**
 * FILE: src/features/architect/utils/mutationPipeline.js
 * PURPOSE: Centralized mutation pipeline for all Architect world mutations.
 * OWNERSHIP: Feature: architect/core
 *
 * HISTORY:
 *  - 2025-12-17: Created per ARCHITECT_GAP_ANALYSIS.md Phase 1 implementation
 *  - 2025-12-25: Removed legacy teamPlans reference (worlds-only cleanup)
 *  - 2026-01-18: Phase 7.2 option decline FA-year derivation + cap hold amounts
 *  - 2026-01-18: Phase 7.3 option state invariant validation wiring
 *  - 2026-01-30: Phase 58 - Extracted trade context helpers to tradeContext module
 *  - 2026-01-30: Phase 59 - Removed validateTradeForPipeline, moved validateTradeForContext to legacy namespace
 *
 * LINKS:
 *  - Plan: plans/cap-sheet-contract-rules-phase-7-3/plan.md
 *  - Trade Context Module: src/features/architect/utils/tradeContext/
 *  - Latest Chunk: n/a (no chunks used)
 *
 * DESIGN CONSTRAINTS (NON-NEGOTIABLE):
 * 1) All Firestore writes MUST occur in one place (persistWorldMutation)
 * 2) All mutation computation MUST be pure (no Firestore, no React state)
 * 3) UI components and hooks MUST NOT write to Firestore directly
 * 4) World context (worldId) MUST be respected for all reads and writes
 * 5) The pipeline must be movable into Cloud Functions later with minimal rewrite
 * 6) Trade validation follows: snapshot → validate → compute/persist (Phase 56/58)
 *
 * MUTATION TYPES SUPPORTED:
 * - executeTrade
 * - signFreeAgent
 * - waivePlayer
 * - extendPlayer
 * - optionDecision
 * - renounceRights
 */

import { db } from '@/firebaseConfig';
import { writeBatch, serverTimestamp } from 'firebase/firestore';
import { getTeam, getPlayer } from '@/features/architect/utils/teamLoader';
import { updateWorldStats } from '@/features/architect/utils/worldManager';
import { validateTrade } from '@/features/architect/utils/tradeMachine';
import { buildTradeTeamInput } from '@/features/architect/utils/schemaAdapter';
import {
  toEndYear,
  toSeasonCode,
} from '@/features/architect/utils/seasonFormat';
import { getPlayerId } from '@/features/architect/utils/capHelpers';
import {
  worldTeamRef,
  worldPlayerRef,
  worldMetadataRef,
} from '@/features/architect/utils/architectFirestorePaths';
import { collection, doc } from 'firebase/firestore';
import { ARCHITECT_WORLDS_COLLECTION } from '@/constants/collections';
import { getCapSettings } from '@/features/architect/utils/tradeMachine/utils/capSettingsProvider.js';
// Cap legality validators for non-trade mutations (Phase 5 Production Hardening)
import {
  validateSigning,
  validateWaive,
  validateExtension,
  validateOptionDecision,
  validateRenounceRights,
  validateDeadCap,
  validateExceptions,
  isOverrideEnabled,
} from '@/features/architect/utils/capLegalityValidation';
import {
  normalizeContractForWorld,
  normalizeFutureContract,
  normalizeSalaryRow,
} from '@/features/architect/utils/contractNormalization';
import {
  computeExpectedCapHoldAmount,
  deriveFreeAgencyYearFromOptionSeason,
  getRightsTypeFromPlayer,
} from '@/features/architect/utils/capHoldTransitionHelpers';
import { createTPE } from '@/features/architect/utils/tradeMachine/utils/tradeUtilities';
import {
  appendExceptionHistory,
  createTpeConsumptionHistoryEntry,
  createTpeCreationHistoryEntry,
} from '@/features/architect/utils/exceptionHistory/historyHelpers';

// Phase 72: SSOT for team cap totals computation
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals';

// Phase 61: Persistence contract enforcement (allowlist-based)
// Phase 64: Added normalizeTeamTpeSchema for TPE canonicalization
import {
  assertPersistableOrThrow,
  PERSISTENCE_CONTRACTS,
  normalizeTeamTpeSchema,
} from '@/features/architect/utils/persistenceContracts';

// Phase 86: League-wide invariant validation (cross-team duplicate player prevention)
// Phase B5: Entitlement invariant validation (cross-team duplicate entitlement prevention)
import {
  validateMutationLeagueInvariants,
  validateMutationEntitlementInvariants,
} from '@/features/architect/utils/leagueInvariants';

// ==============================================================================
// PHASE 58: TRADE CONTEXT MODULE RE-EXPORTS
// ==============================================================================
// Phase 58 extracted snapshot/validation context helpers to dedicated module.
// These re-exports maintain backward compatibility for existing imports.
import {
  buildPostTradeTeamsSnapshot,
  validatePostTradeSnapshotForContext,
  assertPostTradeSnapshot,
  assertValidatedTradeContext,
  assertTradeComputeInputs,
} from '@/features/architect/utils/tradeContext';

// Re-export for backward compatibility
export { buildPostTradeTeamsSnapshot, validatePostTradeSnapshotForContext };

// Phase 59: Legacy helpers moved to tradeContext/legacy/ namespace
// Import from '@/features/architect/utils/tradeContext/legacy' for deprecated validateTradeForContext

// ==============================================================================
// PHASE 58: LEGACY FUNCTION MARKER (kept for reference, replaced by tradeContext module)
// ==============================================================================
// The following comment block shows what was removed in Phase 58:
// - buildPostTradeTeamsSnapshot(): Moved to tradeContext/tradeContext.js
// - validatePostTradeSnapshotForContext(): Moved to tradeContext/tradeContext.js
// - validateTradeForContext(): Moved to tradeContext/tradeContext.js (deprecated wrapper)

// ==============================================================================
// UNDEFINED VALUE SANITIZATION
// ==============================================================================

/**
 * Recursively find all paths in an object where the value is undefined.
 * Returns an array of dot-notation paths (e.g., ["contract.totalValue", "player.name"]).
 * @param {any} obj - Object to inspect
 * @param {string} [parentPath] - Current path (used in recursion)
 * @returns {string[]} Array of paths with undefined values
 */
function findUndefinedPaths(obj, parentPath = '') {
  const undefinedPaths = [];

  if (obj === null || typeof obj !== 'object') {
    return undefinedPaths;
  }

  const entries = Array.isArray(obj)
    ? obj.map((v, i) => [i, v])
    : Object.entries(obj);

  for (const [key, value] of entries) {
    const currentPath = parentPath ? `${parentPath}.${key}` : String(key);

    if (value === undefined) {
      undefinedPaths.push(currentPath);
    } else if (value !== null && typeof value === 'object') {
      undefinedPaths.push(...findUndefinedPaths(value, currentPath));
    }
  }

  return undefinedPaths;
}

/**
 * Recursively remove all undefined values from an object or array.
 * Returns a new object/array with undefined values stripped.
 * - For objects: keys with undefined values are omitted
 * - For arrays: undefined elements are filtered out
 * @param {any} obj - Object or array to sanitize
 * @returns {any} Sanitized copy with no undefined values
 */
function removeUndefinedDeep(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => removeUndefinedDeep(item));
  }

  if (typeof obj === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        result[key] = removeUndefinedDeep(value);
      }
    }
    return result;
  }

  // Primitive values pass through unchanged
  return obj;
}

// ==============================================================================
// PHASE 60: TRANSIENT FIELD SANITIZATION FOR PERSISTENCE
// ==============================================================================

/**
 * FORBIDDEN TRANSIENT KEYS (Phase 60)
 *
 * These keys are used internally during the mutation pipeline but MUST NOT be
 * persisted to Firestore. They are intermediate validation/context artifacts.
 *
 * - _validatedTradeContext: Pre-validated trade context for dedup (Phase 55/56)
 * - _signingValidation: Pre-validated signing result for S&T (Phase 48)
 * - _isPostTradeSnapshot: Sentinel flag for snapshot shape detection (Phase 58)
 * - _isValidatedTradeContext: Sentinel flag for validated context detection (Phase 56)
 * - _rawValidation: Raw validation result for debugging (Phase 56)
 *
 * NOTE: _meta is NOT in this list - it's legitimately used for computed totals display (UI).
 */
const FORBIDDEN_TRANSIENT_KEYS = Object.freeze([
  '_validatedTradeContext',
  '_signingValidation',
  '_isPostTradeSnapshot',
  '_isValidatedTradeContext',
  '_rawValidation',
]);

/**
 * Recursively remove forbidden transient keys from an object before Firestore persistence.
 * This is a surgical sanitizer that targets only known transient keys - it does NOT
 * strip all underscore-prefixed keys (e.g., _meta is preserved for UI use).
 *
 * @param {any} obj - Object to sanitize
 * @param {string[]} [forbiddenKeys] - Override forbidden key list (for testing)
 * @returns {any} Sanitized copy with transient keys removed
 */
function sanitizeTransientFieldsForPersistence(
  obj,
  forbiddenKeys = FORBIDDEN_TRANSIENT_KEYS
) {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) =>
      sanitizeTransientFieldsForPersistence(item, forbiddenKeys)
    );
  }

  if (typeof obj === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip forbidden transient keys
      if (forbiddenKeys.includes(key)) {
        continue;
      }
      result[key] = sanitizeTransientFieldsForPersistence(value, forbiddenKeys);
    }
    return result;
  }

  // Primitive values pass through unchanged
  return obj;
}

// Export for testing
export { FORBIDDEN_TRANSIENT_KEYS, sanitizeTransientFieldsForPersistence };

/**
 * Dev-only guard that validates an object has no undefined values before Firestore write.
 * In DEV: logs error details and throws.
 * In PROD: silently returns (caller should sanitize).
 * @param {any} obj - Object to validate
 * @param {string} label - Description of the object (for error messages)
 */
function guardAgainstUndefined(obj, label) {
  const undefinedPaths = findUndefinedPaths(obj);

  if (undefinedPaths.length === 0) {
    return; // All good
  }

  const isDev = import.meta.env?.DEV || process.env.NODE_ENV === 'development';

  if (isDev) {
    // Log detailed error for debugging
    console.error(`[mutationPipeline] Undefined values detected in ${label}:`, {
      undefinedPaths,
      objectKeys: Object.keys(obj || {}),
      shallowPreview: JSON.stringify(
        obj,
        (k, v) => (v === undefined ? '__UNDEFINED__' : v),
        2
      )?.slice(0, 500),
    });
    throw new Error(
      `Firestore write blocked: ${label} contains undefined values at paths: ${undefinedPaths.join(', ')}. ` +
        `Fix the data source or add defaults. Object keys: [${Object.keys(obj || {}).join(', ')}]`
    );
  }
  // In production, we silently allow (caller will sanitize before writing)
}

// ==============================================================================
// TYPES (JSDoc for IDE support)
// ==============================================================================

/**
 * @typedef {'executeTrade' | 'signFreeAgent' | 'waivePlayer' | 'extendPlayer' | 'optionDecision' | 'renounceRights' | 'storeOfferSheet' | 'matchOfferSheet' | 'declineOfferSheet' | 'finalizeMatchedOfferSheet' | 'finalizeDeclinedOfferSheet' | 'signAndTrade' | 'setDeadCap' | 'setExceptions'} MutationType
 */

/**
 * @typedef {Object} MutationInput
 * @property {string} userId - User performing the mutation
 * @property {string} worldId - Target world ID
 * @property {string} seasonId - Current season (e.g., "2025-26")
 * @property {MutationType} mutationType - Type of mutation
 * @property {Object} payload - Mutation-specific payload
 * @property {number} [timestamp] - Optional timestamp (defaults to Date.now())
 */

/**
 * @typedef {Object} MutationResult
 * @property {boolean} success - Whether mutation succeeded
 * @property {Array<{teamCode: string, team: Object}>} [changedTeams] - Updated team snapshots
 * @property {Array<{playerId: string, player: Object}>} [changedPlayers] - Updated player overrides
 * @property {Object} [worldPatch] - Metadata updates applied to world
 * @property {Object} [event] - Event log entry created
 * @property {string} [error] - Error message if failed
 */

/**
 * @typedef {Object} ComputeResult
 * @property {boolean} success
 * @property {Array<{teamCode: string, team: Object}>} teamUpdates
 * @property {Array<{playerId: string, player: Object}>} playerUpdates
 * @property {Object} metadata - Event metadata
 * @property {string} [error]
 */

/**
 * @typedef {Object} OfferSheet
 * @property {string} id - Unique ID
 * @property {string} playerId - Target player ID
 * @property {string} playerName - Player name (snapshot)
 * @property {string} offeringTeamCode - Team making the offer
 * @property {string} homeTeamCode - RFA home team
 * @property {string} seasonKey - Season context (e.g. "2025-26")
 * @property {number} year - Cap year
 * @property {number} contractYears - Length
 * @property {Array<{season: string, salary: number, capHit: number, guaranteed: boolean}>} salariesByYear
 * @property {'PENDING_MATCH' | 'MATCHED' | 'DECLINED'} status
 * @property {string} createdAt - ISO timestamp
 */

// ==============================================================================
// OVERRIDE SANITIZATION
// ==============================================================================

/**
 * Strip override metadata from payload if override is not enabled.
 *
 * SECURITY: This is a defense-in-depth mechanism. Even if the client UI
 * allows override actions to pass through, the pipeline will strip the
 * override metadata unless VITE_ENABLE_CBA_OVERRIDE=true.
 *
 * @param {Object} payload - Mutation payload
 * @returns {Object} Sanitized payload with override metadata removed if disabled
 */
function sanitizePayloadForOverride(payload) {
  if (!payload) return payload;

  const overrideEnabled = isOverrideEnabled();

  // If override is enabled (dev mode), allow override metadata through
  if (overrideEnabled) {
    return payload;
  }

  // In production (override disabled), strip override-related fields
  const {
    overrideUsed,
    overrideReasons,
    overrideTimestamp,
    overrideMetadata,
    forceTrade,
    ...sanitized
  } = payload;

  // Log if we stripped override data (helps detect bypass attempts in monitoring)
  if (overrideUsed || overrideMetadata || forceTrade) {
    console.warn(
      '[mutationPipeline] Stripped override metadata from payload. ' +
        'Override is disabled in production. Set VITE_ENABLE_CBA_OVERRIDE=true for dev mode.'
    );
  }

  return sanitized;
}

// ==============================================================================
// WORLD TIME SSOT (Phase 20)
// ==============================================================================

/**
 * Resolve canonical asOfDate for the mutation.
 *
 * This is the SINGLE SOURCE OF TRUTH for "world time" in the mutation pipeline.
 * Used for timing-based CBA rules (e.g., stretch timing, offer sheet 48-hour window).
 *
 * Priority:
 * 1. payloadAsOfDate - Explicit date from mutation payload (highest priority)
 * 2. worldAsOfDate - Date from world metadata (if set)
 * 3. System fallback - Current date (produces warning)
 *
 * @param {Object} params
 * @param {string|null} params.payloadAsOfDate - asOfDate from mutation payload
 * @param {string|null} params.worldAsOfDate - asOfDate from world metadata
 * @returns {{ asOfDate: string, defaulted: boolean }}
 */
export function resolveWorldAsOfDate({ payloadAsOfDate, worldAsOfDate }) {
  // Priority 1: Payload-supplied date
  if (payloadAsOfDate && typeof payloadAsOfDate === 'string') {
    return { asOfDate: payloadAsOfDate, defaulted: false };
  }

  // Priority 2: World metadata date
  if (worldAsOfDate && typeof worldAsOfDate === 'string') {
    return { asOfDate: worldAsOfDate, defaulted: false };
  }

  // Priority 3: System fallback (with warning)
  return {
    asOfDate: new Date().toISOString().slice(0, 10),
    defaulted: true,
  };
}

// ==============================================================================
// MAIN ENTRY POINT
// ==============================================================================

/**
 * Apply a mutation to an Architect world.
 *
 * This is the SINGLE public entrypoint for all world mutations.
 * All mutations flow through: READ → COMPUTE → VALIDATE → PERSIST → POST-UPDATE
 *
 * @param {MutationInput} input - Mutation parameters
 * @returns {Promise<MutationResult>} - Result of the mutation
 */
export async function applyWorldMutation({
  userId,
  worldId,
  seasonId,
  mutationType,
  payload,
  timestamp = Date.now(),
}) {
  // Input validation
  if (!userId) {
    return { success: false, error: 'userId is required' };
  }
  if (!worldId) {
    return { success: false, error: 'worldId is required' };
  }
  if (!seasonId) {
    return { success: false, error: 'seasonId is required' };
  }
  if (!mutationType) {
    return { success: false, error: 'mutationType is required' };
  }
  if (!payload) {
    return { success: false, error: 'payload is required' };
  }

  // SECURITY: Strip override metadata if override is disabled
  // This prevents clients from bypassing validation by sending overrideMetadata
  const sanitizedPayload = sanitizePayloadForOverride(payload);

  try {
    // PHASE 1: READ - Load required current state
    const currentState = await loadStateForMutation(
      worldId,
      mutationType,
      sanitizedPayload
    );

    // Phase 20: Load world metadata asOfDate for SSOT resolution
    let worldAsOfDate = null;
    try {
      const { getDoc } = await import('firebase/firestore');
      const worldRef = worldMetadataRef(worldId);
      const worldSnap = await getDoc(worldRef);
      if (worldSnap.exists()) {
        worldAsOfDate = worldSnap.data()?.asOfDate || null;
      }
    } catch (e) {
      // Non-critical: proceed with no world date (will use payload or fallback)
      console.warn('Could not load world asOfDate:', e.message);
    }

    // Phase 20: Resolve canonical asOfDate SSOT
    const { asOfDate, defaulted: dateDefaulted } = resolveWorldAsOfDate({
      payloadAsOfDate: sanitizedPayload.asOfDate,
      worldAsOfDate,
    });

    // PHASE 2: COMPUTE (PURE) - Calculate mutation result
    const computeResult = computeWorldMutation({
      mutationType,
      payload: sanitizedPayload,
      currentState,
      seasonId,
      timestamp,
      asOfDate, // Phase 20: World time SSOT
      worldId,
    });

    if (!computeResult.success) {
      return { success: false, error: computeResult.error };
    }

    // PHASE 3: VALIDATE - Ensure mutation is legal
    const validationResult = validateMutation({
      mutationType,
      payload: sanitizedPayload,
      currentState,
      computeResult,
      seasonId,
      asOfDate, // Phase 20: World time SSOT
      dateDefaulted, // Phase 20: Flag for warning emission
    });

    if (!validationResult.valid) {
      return {
        success: false,
        error: validationResult.error || 'Validation failed',
        violations: validationResult.violations,
        warnings: validationResult.warnings || [],
      };
    }

    // PHASE 3.5: LEAGUE INVARIANTS - Validate no cross-team duplicates
    // Phase 86: Prevents players from appearing on multiple teams
    const leagueInvariantResult = await validateMutationLeagueInvariants(
      worldId,
      mutationType,
      sanitizedPayload,
      computeResult
    );

    if (!leagueInvariantResult.valid) {
      return {
        success: false,
        error: leagueInvariantResult.error || 'League invariant violation',
        violations: leagueInvariantResult.duplicates
          ? [
              {
                rule: 'LEAGUE_DUPLICATE_PLAYER',
                details: leagueInvariantResult.duplicates,
              },
            ]
          : [],
        warnings: [],
      };
    }

    // PHASE 3.6: ENTITLEMENT INVARIANTS - Validate no cross-team duplicate entitlements
    // Phase B5: Prevents entitlements from appearing on multiple teams after trade
    const entitlementInvariantResult = await validateMutationEntitlementInvariants(
      worldId,
      mutationType,
      computeResult
    );

    if (!entitlementInvariantResult.valid) {
      return {
        success: false,
        error: entitlementInvariantResult.error || 'Entitlement invariant violation',
        violations: entitlementInvariantResult.duplicates
          ? [
              {
                rule: 'LEAGUE_DUPLICATE_ENTITLEMENT',
                details: entitlementInvariantResult.duplicates,
              },
            ]
          : [],
        warnings: [],
      };
    }

    // PHASE 4: PERSIST - Write to Firestore (ONLY place that writes)
    // DEV DEBUG: Check for UID mismatch which causes PERMISSION_DENIED
    if (import.meta.env.DEV) {
      try {
        const worldRef = worldMetadataRef(worldId);
        const { getDoc } = await import('firebase/firestore');
        const worldSnap = await getDoc(worldRef);
        if (worldSnap.exists()) {
          const worldData = worldSnap.data();
          const worldOwner = worldData.createdBy;
          if (worldOwner !== userId) {
            console.error(
              `🚨 UID MISMATCH: World createdBy=${worldOwner} but current userId=${userId}\n` +
                `This causes PERMISSION_DENIED. Fix: In Emulator UI, update createdBy to ${userId}`
            );
          }
        }
      } catch (e) {
        console.warn('DEV DEBUG: Could not check world ownership:', e.message);
      }
    }

    const persistResult = await persistWorldMutation({
      worldId,
      seasonId,
      mutationType,
      computeResult,
      timestamp,
      payloadAsOfDate: sanitizedPayload.asOfDate, // Phase 20: Only persist if explicitly provided
    });

    if (!persistResult.success) {
      return { success: false, error: persistResult.error };
    }

    // PHASE 5: POST-UPDATE - Update world stats and metadata
    const teamCodes = computeResult.teamUpdates.map((u) => u.teamCode);
    await updateWorldStats(
      worldId,
      getMutationActionType(mutationType),
      teamCodes
    );

    // Return success result
    return {
      success: true,
      changedTeams: computeResult.teamUpdates,
      changedPlayers: computeResult.playerUpdates,
      worldPatch: persistResult.worldPatch,
      event: persistResult.event,
      warnings: validationResult.warnings || [],
    };
  } catch (error) {
    console.error(`applyWorldMutation failed for ${mutationType}:`, error);
    return {
      success: false,
      error: error.message || 'Unknown error during mutation',
    };
  }
}

// ==============================================================================
// PHASE 1: READ - Load state for mutation
// ==============================================================================

/**
 * Load required state for a mutation.
 * Uses teamLoader to respect world → parent → base fallback chain.
 *
 * @param {string} worldId
 * @param {MutationType} mutationType
 * @param {Object} payload
 * @returns {Promise<Object>} Current state needed for mutation
 */
async function loadStateForMutation(worldId, mutationType, payload) {
  switch (mutationType) {
    case 'executeTrade': {
      // Load all teams involved in trade
      const teamCodes = payload.teams.map((t, index) => {
        const code = t.teamCode || t.team?.teamCode;
        if (!code) {
          throw new Error(
            `Missing teamCode for trade entry at index ${index}. Payload: ${JSON.stringify(t)}`
          );
        }
        return code;
      });

      const teamStates = await Promise.all(
        teamCodes.map((code) => getTeam(worldId, code))
      );
      return {
        teams: teamCodes.map((code, i) => ({
          teamCode: code,
          team: teamStates[i],
        })),
      };
    }

    case 'signFreeAgent': {
      const teamCode = payload.teamCode;
      const playerId = payload.playerId;
      if (!teamCode || !playerId)
        throw new Error('Missing teamCode or playerId');

      const [team, player] = await Promise.all([
        getTeam(worldId, teamCode),
        getPlayer(worldId, teamCode, playerId),
      ]);

      // For RFA finalization, we may need to clean up the home team's incomingOfferSheets
      const homeTeamCode = player.teamCode || player.contract?.signingTeam;
      let homeTeam = null;
      if (homeTeamCode && homeTeamCode !== teamCode) {
        homeTeam = await getTeam(worldId, homeTeamCode);
      }

      return { team, player, teamCode, homeTeam };
    }

    case 'waivePlayer': // fallthrough
    case 'extendPlayer': // fallthrough
    case 'optionDecision': {
      // Load single team and player
      const teamCode = payload.teamCode;
      const playerId = payload.playerId;

      if (!teamCode) {
        throw new Error(`Missing teamCode in payload for ${mutationType}`);
      }
      if (!playerId) {
        throw new Error(`Missing playerId in payload for ${mutationType}`);
      }

      const team = await getTeam(worldId, teamCode);
      const player = await getPlayer(worldId, teamCode, playerId);
      return { team, player, teamCode };
    }

    case 'storeOfferSheet': {
      // Load offering team and player first
      const teamCode = payload.teamCode;
      const playerId = payload.playerId;
      if (!teamCode || !playerId)
        throw new Error('Missing teamCode or playerId');

      const [offeringTeam, player] = await Promise.all([
        getTeam(worldId, teamCode),
        getPlayer(worldId, teamCode, playerId),
      ]);

      // If player belongs to another team, load that home team too
      // (needed for mirroring incomingOfferSheets)
      const homeTeamCode = player.teamCode || player.contract?.signingTeam;
      let homeTeam = null;

      if (homeTeamCode && homeTeamCode !== teamCode) {
        homeTeam = await getTeam(worldId, homeTeamCode);
      }

      // Normalize return structure to include both
      return {
        team: offeringTeam, // Maintain 'team' as the primary actor (offering team)
        player,
        teamCode,
        homeTeam,
      };
    }

    case 'matchOfferSheet':
    case 'declineOfferSheet':
    case 'finalizeMatchedOfferSheet':
    case 'finalizeDeclinedOfferSheet': {
      // Load home team (actor) and offering team (target)
      const {
        teamCode: homeTeamCode,
        offeringTeamCode,
        offerSheetId,
      } = payload;

      if (!homeTeamCode) throw new Error(`Missing homeTeamCode`);
      if (!offeringTeamCode) throw new Error(`Missing offeringTeamCode`);
      if (!offerSheetId) throw new Error(`Missing offerSheetId`);

      const [homeTeam, offeringTeam] = await Promise.all([
        getTeam(worldId, homeTeamCode),
        getTeam(worldId, offeringTeamCode),
      ]);

      return { homeTeam, offeringTeam, offerSheetId };
    }

    case 'signAndTrade': {
      const { teamCode, destinationTeamCode, playerId } = payload;
      if (!teamCode) throw new Error('Missing source teamCode');
      if (!destinationTeamCode) throw new Error('Missing destinationTeamCode');
      if (!playerId) throw new Error('Missing playerId');

      const [team, destinationTeam, player] = await Promise.all([
        getTeam(worldId, teamCode),
        getTeam(worldId, destinationTeamCode),
        getPlayer(worldId, teamCode, playerId),
      ]);

      return { team, destinationTeam, player, teamCode, destinationTeamCode };
    }

    case 'renounceRights': {
      // Renounce rights: player may only exist in team's players array or cap holds
      // (free agents with cap holds might not have a base player record)
      const teamCode = payload.teamCode;
      const playerId = payload.playerId;

      if (!teamCode) {
        throw new Error(`Missing teamCode in payload for renounceRights`);
      }
      if (!playerId) {
        throw new Error(`Missing playerId in payload for renounceRights`);
      }

      const team = await getTeam(worldId, teamCode);

      // Try to find player in team's players array first (prioritize ID match)
      const playerInTeam = (team.players || []).find((p) => {
        const pid = p.player_id || p.id;
        // Prioritize exact ID match
        if (pid && pid === playerId) return true;
        // Fall back to name match only if ID isn't available
        if (!pid && p.name === playerId) return true;
        return false;
      });

      // If found in team, use that data
      if (playerInTeam) {
        return { team, player: playerInTeam, teamCode };
      }

      // Try to find in cap holds
      const capHold = (team.capHolds || []).find(
        (h) => h.playerId === playerId || h.playerName === playerId
      );

      if (capHold) {
        // Build minimal player object from cap hold
        // Use 'None' for bird rights since we're renouncing (will be cleared anyway)
        return {
          team,
          player: {
            player_id: capHold.playerId,
            name: capHold.playerName,
            displayName: capHold.playerName,
            contract: { birdRights: { status: 'None' } },
          },
          teamCode,
        };
      }

      // Finally, try base player collection
      try {
        const player = await getPlayer(worldId, teamCode, playerId);
        return { team, player, teamCode };
      } catch (err) {
        throw new Error(
          `Player ${playerId} not found in team roster, cap holds, or base collection`
        );
      }
    }

    case 'setDeadCap': {
      const { teamCode } = payload;
      if (!teamCode) throw new Error('Missing teamCode');
      const team = await getTeam(worldId, teamCode);
      return { team, teamCode };
    }

    case 'setExceptions': {
      const { teamCode } = payload;
      if (!teamCode) throw new Error('Missing teamCode');
      const team = await getTeam(worldId, teamCode);
      return { team, teamCode };
    }

    default:
      throw new Error(`Unknown mutation type: ${mutationType}`);
  }
}

// ==============================================================================
// PHASE 2: COMPUTE (PURE) - Calculate mutation result
// ==============================================================================

/**
 * Compute mutation result without side effects.
 * This function is PURE - no Firestore, no Date.now(), deterministic output.
 *
 * @param {Object} params
 * @param {MutationType} params.mutationType
 * @param {Object} params.payload
 * @param {Object} params.currentState
 * @param {string} params.seasonId
 * @param {number} params.timestamp
 * @returns {ComputeResult}
 */
export function computeWorldMutation({
  mutationType,
  payload,
  currentState,
  seasonId,
  timestamp,
  worldId,
}) {
  switch (mutationType) {
    case 'executeTrade': {
      // Phase 56: Build snapshot → validate snapshot → compute with context
      // Step 1: Build post-trade snapshot (pure function, no validation)
      const postTradeSnapshot = buildPostTradeTeamsSnapshot({
        payload,
        currentState,
        seasonId,
        timestamp,
      });

      // Step 2: Validate the post-trade snapshot ONCE
      const validatedContext = validatePostTradeSnapshotForContext({
        snapshot: postTradeSnapshot,
        payload,
        seasonId,
      });

      // Step 3: Call pure computeTradeResult with pre-validated context
      const result = computeTradeResult({
        payload,
        currentState,
        seasonId,
        timestamp,
        historyContext: { worldId, mutationType },
        postTradeSnapshot,
        validatedContext,
      });

      return result;
    }

    case 'signFreeAgent':
      return computeSigningResult({
        payload,
        currentState,
        seasonId,
        timestamp,
      });

    case 'waivePlayer':
      return computeWaiveResult({ payload, currentState, seasonId, timestamp });

    case 'extendPlayer':
      return computeExtensionResult({
        payload,
        currentState,
        seasonId,
        timestamp,
      });

    case 'storeOfferSheet':
      return computeStoreOfferSheetResult({
        payload,
        currentState,
        seasonId,
        timestamp,
      });

    case 'matchOfferSheet':
      return computeMatchOfferSheetResult({
        payload,
        currentState,
        seasonId,
        timestamp,
      });

    case 'declineOfferSheet':
      return computeDeclineOfferSheetResult({
        payload,
        currentState,
        seasonId,
        timestamp,
      });

    case 'finalizeMatchedOfferSheet':
      return computeFinalizeMatchedOfferSheetResult({
        payload,
        currentState,
        seasonId,
        timestamp,
      });

    case 'finalizeDeclinedOfferSheet':
      return computeFinalizeDeclinedOfferSheetResult({
        payload,
        currentState,
        seasonId,
        timestamp,
      });

    case 'optionDecision':
      return computeOptionResult({
        payload,
        currentState,
        seasonId,
        timestamp,
      });

    case 'renounceRights':
      return computeRenounceResult({
        payload,
        currentState,
        seasonId,
        timestamp,
      });

    case 'signAndTrade':
      return computeSignAndTradeResult({
        payload,
        currentState,
        seasonId,
        timestamp,
        worldId,
        historyContext: { worldId, mutationType },
      });

    case 'setDeadCap':
      return computeSetDeadCapResult({
        payload,
        currentState,
        seasonId,
        timestamp,
      });

    case 'setExceptions':
      return computeSetExceptionsResult({
        payload,
        currentState,
        seasonId,
        timestamp,
      });

    default:
      return {
        success: false,
        error: `Unknown mutation type: ${mutationType}`,
      };
  }
}

/**
 * Compute trade result
 *
 * Phase 56: PURE FUNCTION - Does NOT call validateTrade internally.
 * Requires validatedContext (from validatePostTradeSnapshotForContext) and
 * postTradeSnapshot (from buildPostTradeTeamsSnapshot) to be passed in.
 *
 * This function only:
 * - Applies SSOT outputs for persistence (createdTPE, consumption from matchIncoming)
 * - Writes tradeExceptions[] and exceptionHistory[]
 * - Returns compute result with team/player updates
 *
 * @param {Object} params
 * @param {Object} params.payload - Trade payload
 * @param {Object} params.currentState - Current team states (used for reference only)
 * @param {string} params.seasonId - Season ID
 * @param {number} params.timestamp - Mutation timestamp
 * @param {Object} [params.historyContext] - History context for audit logging
 * @param {Object} params.postTradeSnapshot - Result from buildPostTradeTeamsSnapshot (REQUIRED for Phase 56)
 * @param {Object} params.validatedContext - Result from validatePostTradeSnapshotForContext (REQUIRED for Phase 56)
 */
function computeTradeResult({
  payload,
  currentState,
  seasonId,
  timestamp,
  historyContext = {},
  postTradeSnapshot,
  validatedContext,
}) {
  // Phase 58: Use shared assertions from tradeContext module
  // (replaces Phase 56 inline checks with centralized assertions)
  assertTradeComputeInputs({
    postTradeSnapshot,
    validatedContext,
    callSite: 'computeTradeResult',
  });

  const playerUpdates = [];

  const currentYear = toEndYear(seasonId);
  const timestampISO = new Date(timestamp).toISOString();
  const historyContextRef = historyContext || {};
  const resolvedWorldId =
    historyContextRef.worldId || payload?.tradeCtx?.worldId || null;
  const resolvedMutationType = historyContextRef.mutationType || 'executeTrade';
  const resolvedMutationId = historyContextRef.mutationId;
  const getTpeRemaining = (tpe) =>
    Number(tpe?.remainingAmount ?? tpe?.amount ?? 0) || 0;

  // Phase 56: Use pre-built snapshot teamUpdates (already has roster changes applied)
  // Deep clone to avoid mutating the snapshot
  const teamUpdates = postTradeSnapshot.teamUpdates.map(
    ({ teamCode, team }) => ({
      teamCode,
      team: JSON.parse(JSON.stringify(team)),
    })
  );

  // Phase 56: Use validation results from validatedContext (already validated once)
  const validation = validatedContext._rawValidation || {
    legal: validatedContext.legal,
    teamResults: validatedContext.teamResults || [],
  };

  // Phase 56: Use validationTeams from context (has matchIncoming populated by validator)
  const validationTeams =
    validatedContext.validationTeams || postTradeSnapshot.validationTeams;

  // Warn if multi-team trade without directed routing (informational only)
  if (payload.teams.length > 2) {
    const hasDirectedRouting = payload.teams.some((t) =>
      (t.sends || []).some(
        (s) =>
          s.receivingTeamIndex !== undefined || s.receivingTeamId !== undefined
      )
    );
    if (!hasDirectedRouting) {
      console.warn(
        'Multi-team trade detected without directed routing (receivingTeamIndex/receivingTeamId). ' +
          'All sends will be distributed to all other teams. For directed trades, specify receivingTeamIndex on each send.'
      );
    }
  }

  // ============================================================================
  // Phase 56: Apply validated TPE creation/consumption to each team
  // (validation already ran externally via validatePostTradeSnapshotForContext)
  // ============================================================================
  teamUpdates.forEach((teamUpdate, idx) => {
    const teamResult = validation.teamResults?.[idx];
    if (!teamResult) return;

    const updatedTeam = teamUpdate.team;
    const currentTPEs = updatedTeam.tradeExceptions || [];
    const historyEntries = [];
    const tpeAbsorptionDetails = new Map();

    // 1. Apply TPE consumption from validator
    // The validator's tradeExceptions rule modifies TPE objects with updated remaining/used amounts
    const tradeExceptionsResult = teamResult.rules?.tradeExceptions;
    let updatedTPEs = [...currentTPEs];

    // If validator processed TPEs, apply consumption from incoming players with tpeId
    // Phase 50 fix: Check for existence of tradeExceptionsResult, not details
    // (details is empty string when no violations, which was incorrectly falsy)
    if (tradeExceptionsResult) {
      // The validator already updated the TPE objects in place during validation
      // We need to extract the consumed amounts from the incoming players that used TPEs
      const incomingPlayers = validationTeams[idx].receives || [];
      const tpeUsageMap = new Map(); // tpeId -> consumed amount
      const tpeConsumptionWarnings = []; // Phase 47C: Track missing matchIncoming warnings

      incomingPlayers.forEach((player) => {
        // Phase 47C: Only process TPE consumption if tpeId is set
        if (!player.tpeId) return;

        // Phase 47C SSOT: Use matchIncoming ONLY - no salary fallback
        // If matchIncoming is missing for a TPE player, log warning and skip consumption
        if (
          player.matchIncoming === undefined ||
          player.matchIncoming === null
        ) {
          tpeConsumptionWarnings.push({
            playerId: player.player_id || player.name,
            tpeId: player.tpeId,
            reason:
              'matchIncoming missing for TPE consumption - consumption skipped',
          });
          return; // Skip this player - no consumption without validator-produced value
        }

        const consumed = Number(player.matchIncoming) || 0;
        if (consumed <= 0) {
          return;
        }
        const current = tpeUsageMap.get(player.tpeId) || 0;
        tpeUsageMap.set(player.tpeId, current + consumed);

        const absorptionList = tpeAbsorptionDetails.get(player.tpeId) || [];
        absorptionList.push({
          playerId: player.player_id || player.id || player.playerId || null,
          name: player.name || player.displayName || player.playerName || null,
          amountAbsorbed: consumed,
        });
        tpeAbsorptionDetails.set(player.tpeId, absorptionList);
      });

      // Log warnings in dev mode for debugging
      if (tpeConsumptionWarnings.length > 0) {
        const isDev =
          import.meta.env?.DEV || process.env.NODE_ENV === 'development';
        if (isDev) {
          console.warn(
            '[mutationPipeline] Phase 47C TPE consumption warnings:',
            tpeConsumptionWarnings
          );
        }
        // Attach warnings to team result for visibility (non-blocking)
        teamResult._tpeConsumptionWarnings = tpeConsumptionWarnings;
      }

      // Apply consumption to TPEs
      updatedTPEs = currentTPEs.map((tpe) => {
        const consumed = tpeUsageMap.get(tpe.id) || 0;
        if (consumed === 0) return tpe;

        const currentRemaining = getTpeRemaining(tpe);
        const currentUsed = tpe.usedAmount ?? 0;
        const newRemaining = Math.max(0, currentRemaining - consumed);
        const newUsed = currentUsed + consumed;

        return {
          ...tpe,
          remainingAmount: newRemaining,
          usedAmount: newUsed,
          isUsed: newRemaining === 0,
        };
      });
    }

    // 2. Apply TPE creation from validator (SSOT)
    // Phase 47C: Idempotent creation with signature-based duplicate detection
    // Build consumption history entries before creation adds new TPEs
    currentTPEs.forEach((previousTpe) => {
      const nextTpe =
        updatedTPEs.find((candidate) => candidate.id === previousTpe.id) ||
        previousTpe;
      const previousRemaining = getTpeRemaining(previousTpe);
      const nextRemaining = getTpeRemaining(nextTpe);
      const consumedAmount = Math.max(0, previousRemaining - nextRemaining);
      if (consumedAmount <= 0) {
        return;
      }

      const consumptionEntry = createTpeConsumptionHistoryEntry({
        teamCode: teamUpdate.teamCode,
        tpeId: previousTpe.id,
        amountConsumed: consumedAmount,
        remainingAmountAfter: nextRemaining,
        fullyConsumed: nextRemaining === 0,
        absorbedPlayers: tpeAbsorptionDetails.get(previousTpe.id) || [],
        seasonId,
        seasonYear: currentYear,
        timestampISO,
        worldId: resolvedWorldId,
        mutationType: resolvedMutationType,
        mutationId: resolvedMutationId,
      });

      if (consumptionEntry) {
        historyEntries.push(consumptionEntry);
      }
    });

    const createdTPE = teamResult.createdTPE;
    if (createdTPE) {
      const teamCode = teamUpdate.teamCode;

      // Phase 47C: Preserve validator-provided id if present
      const tpeId =
        createdTPE.id ||
        `tpe_${teamCode}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const outgoingPlayers = payload.teams[idx]?.sends || [];
      const createdFrom =
        outgoingPlayers
          .map((p) => p.name || p.displayName)
          .filter(Boolean)
          .join(', ') || 'Trade';

      /**
       * Phase 47C: Idempotent creation - signature-based duplicate detection
       * Signature: (createdSeason, expiresOn, totalAmount, createdFrom)
       * If an equivalent TPE already exists, do not add again.
       *
       * RATIONALE: A TPE is unique per trade. If the same trade is rerun:
       * - createdSeason + expiresOn + totalAmount + createdFrom will match
       * - We skip adding to prevent duplicates on retries
       */
      const newTPESignature = [
        createdTPE.createdSeason,
        createdTPE.expiresOn,
        createdTPE.amount,
        createdFrom,
      ].join('|');

      const hasDuplicateById = updatedTPEs.some((t) => t.id === tpeId);
      const hasDuplicateBySignature = updatedTPEs.some((t) => {
        const existingSignature = [
          t.createdSeason,
          t.expiresOn,
          t.totalAmount ?? t.amount,
          t.createdFrom,
        ].join('|');
        return existingSignature === newTPESignature;
      });

      if (!hasDuplicateById && !hasDuplicateBySignature) {
        updatedTPEs.push({
          id: tpeId,
          amount: createdTPE.amount,
          totalAmount: createdTPE.amount,
          remainingAmount: createdTPE.amount,
          usedAmount: 0,
          createdSeason: createdTPE.createdSeason,
          expiresOn: createdTPE.expiresOn,
          createdFrom,
          isUsed: false,
        });

        const creationEntry = createTpeCreationHistoryEntry({
          teamCode,
          tpeId,
          amountCreated: createdTPE.amount,
          createdFrom,
          createdSeason: createdTPE.createdSeason,
          expiresOn: createdTPE.expiresOn,
          seasonId,
          seasonYear: currentYear,
          timestampISO,
          worldId: resolvedWorldId,
          mutationType: resolvedMutationType,
          mutationId: resolvedMutationId,
        });

        if (creationEntry) {
          historyEntries.push(creationEntry);
        }
      } else {
        // Dev logging for duplicate detection
        const isDev =
          import.meta.env?.DEV || process.env.NODE_ENV === 'development';
        if (isDev) {
          console.info(
            '[mutationPipeline] Phase 47C: Duplicate TPE detected, skipping creation',
            {
              tpeId,
              byId: hasDuplicateById,
              bySignature: hasDuplicateBySignature,
            }
          );
        }
      }
    }

    // Persist the updated TPE array
    updatedTeam.tradeExceptions = updatedTPEs;

    if (historyEntries.length > 0) {
      appendExceptionHistory(updatedTeam, historyEntries);
    }
  });

  // Phase 11.3: Build entitlementsTraded structure for event log
  // Format: { [teamCode]: { out: string[], in: string[] } }
  // Phase 11.3.1: Respect toTeamId routing when present (for multi-team trades)
  const entitlementsTraded = payload.teams.reduce((acc, teamTrade) => {
    const teamKey =
      teamTrade.team?.id || teamTrade.teamCode || teamTrade.teamId;
    if (!teamKey) return acc;

    // Outgoing entitlement IDs from this team (unchanged)
    const outIds = (
      teamTrade.outgoingEntitlements ||
      teamTrade.entitlementsOut ||
      []
    )
      .map((e) => e.entitlementId || e.id)
      .filter(Boolean);

    // Incoming entitlement IDs: respect toTeamId routing when present
    // Phase 11.3.1: Only include entitlement if:
    //   - toTeamId is NOT set (broadcast mode - all teams receive)
    //   - OR toTeamId matches this team's key (teamKey or teamCode)
    const inIds = [];
    payload.teams.forEach((otherTrade) => {
      const otherTeamKey =
        otherTrade.team?.id || otherTrade.teamCode || otherTrade.teamId;
      if (otherTeamKey !== teamKey) {
        (
          otherTrade.outgoingEntitlements ||
          otherTrade.entitlementsOut ||
          []
        ).forEach((e) => {
          const id = e.entitlementId || e.id;
          if (!id) return;

          // Phase 11.3.1: Check toTeamId routing
          const routedTo = e.toTeamId;
          if (!routedTo) {
            // No routing specified: broadcast to all other teams (backward compatible)
            inIds.push(id);
          } else {
            // Routing specified: only include if this team matches
            // Compare against both teamKey and teamCode for defensive matching
            const teamCode = teamTrade.teamCode || teamTrade.team?.teamCode;
            if (routedTo === teamKey || routedTo === teamCode) {
              inIds.push(id);
            }
          }
        });
      }
    });

    // Only add entry if there are entitlement transfers
    if (outIds.length > 0 || inIds.length > 0) {
      acc[teamKey] = { out: [...new Set(outIds)], in: [...new Set(inIds)] };
    }
    return acc;
  }, {});

  // Phase 56: Return pure compute result - validation context is passed through, not created here
  return {
    success: true,
    teamUpdates,
    playerUpdates,
    metadata: {
      type: 'trade',
      teamsInvolved: teamUpdates.map((u) => u.teamCode),
      playersTraded: payload.teams.flatMap((t) =>
        (t.sends || []).map((p) => p.player_id || p.id || p.name)
      ),
      // Phase 11.3: Include entitlement transfers per team (IDs only for lightweight payload)
      entitlementsTraded:
        Object.keys(entitlementsTraded).length > 0
          ? entitlementsTraded
          : undefined,
      timestamp,
    },
    // Phase 56: Pass through the provided validated context (created externally)
    _validatedTradeContext: validatedContext,
  };
}

/**
 * Compute free agent signing result
 */
function computeSigningResult({ payload, currentState, seasonId, timestamp }) {
  const { team, player, teamCode } = currentState;
  const { contract, signedUsing } = payload;

  const updatedTeam = { ...team };

  // Add player to roster if not already present
  const playerId = payload.playerId || player.player_id || player.id;
  if (!updatedTeam.roster?.includes(playerId)) {
    updatedTeam.roster = [...(updatedTeam.roster || []), playerId];
  }

  // Update or add player to players array
  const existingIndex = (updatedTeam.players || []).findIndex(
    (p) => (p.player_id || p.id) === playerId
  );

  // Normalize contract for world persistence (canonical field names/types)
  const normalizedContract = normalizeContractForWorld({
    ...contract,
    signingTeam: teamCode,
    signingDate: new Date(timestamp).toISOString(),
  });

  const updatedPlayer = {
    ...player,
    teamCode,
    teamName: team.teamName,
    contract: normalizedContract,
  };

  if (existingIndex >= 0) {
    updatedTeam.players = [...updatedTeam.players];
    updatedTeam.players[existingIndex] = updatedPlayer;
  } else {
    updatedTeam.players = [...(updatedTeam.players || []), updatedPlayer];
  }

  // Update exceptions if used
  if (signedUsing) {
    const exceptionType = signedUsing.toLowerCase();
    const contractValue = contract?.totalValue || 0;

    if (exceptionType === 'mle' && updatedTeam.exceptions?.mle) {
      updatedTeam.exceptions = {
        ...updatedTeam.exceptions,
        mle: {
          ...updatedTeam.exceptions.mle,
          usedAmount:
            (updatedTeam.exceptions.mle.usedAmount || 0) + contractValue,
          remainingAmount:
            (updatedTeam.exceptions.mle.remainingAmount || 0) - contractValue,
        },
      };

      // Trigger hard cap if using non-taxpayer MLE
      if (updatedTeam.exceptions.mle.type === 'non-taxpayer') {
        updatedTeam.totals = updatedTeam.totals || {};
        updatedTeam.totals.isHardCapped = true;
        updatedTeam.totals.hardCapLevel = 'firstApron';
        updatedTeam.totals.hardCapDetail = 'Triggered by Non-Taxpayer MLE';
      }
    } else if (exceptionType === 'bae' && updatedTeam.exceptions?.bae) {
      updatedTeam.exceptions = {
        ...updatedTeam.exceptions,
        bae: {
          ...updatedTeam.exceptions.bae,
          usedAmount:
            (updatedTeam.exceptions.bae.usedAmount || 0) + contractValue,
          remainingAmount:
            (updatedTeam.exceptions.bae.remainingAmount || 0) - contractValue,
        },
      };
    } else if (
      // Phase 74: Room Exception usage tracking
      // Matches 'room', 'room mle', 'roommle', 'rmle' etc.
      (exceptionType === 'room' ||
        exceptionType === 'room mle' ||
        exceptionType === 'roommle' ||
        exceptionType === 'rmle') &&
      updatedTeam.exceptions?.room
    ) {
      updatedTeam.exceptions = {
        ...updatedTeam.exceptions,
        room: {
          ...updatedTeam.exceptions.room,
          usedAmount:
            (updatedTeam.exceptions.room.usedAmount || 0) + contractValue,
          remainingAmount:
            (updatedTeam.exceptions.room.remainingAmount || 0) - contractValue,
        },
      };
      // Note: Room Exception does NOT trigger hard cap (unlike Non-Taxpayer MLE)
    }
  }

  // Remove cap hold if player had one
  if (updatedTeam.capHolds) {
    updatedTeam.capHolds = updatedTeam.capHolds.filter(
      (hold) => hold.playerId !== playerId
    );
  }

  // Remove pending offer sheet if finalizing an RFA offer
  // (processed offer sheets are removed to prevent state staleness)
  // Remove pending offer sheet if finalizing an RFA offer
  // (processed offer sheets are removed to prevent state staleness)
  if (normalizedContract.rfaOfferSheet && updatedTeam.offerSheets) {
    updatedTeam.offerSheets = updatedTeam.offerSheets.filter(
      (os) => os.playerId !== playerId
    );
  }

  // Update source metadata
  updatedTeam.source = {
    ...updatedTeam.source,
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  // Recalculate totals
  updatedTeam.totals = computeTeamCapTotals(updatedTeam, toEndYear(seasonId));

  const teamUpdates = [{ teamCode, team: updatedTeam }];

  // Cleanup incomingOfferSheets on home team if applicable
  if (
    normalizedContract.rfaOfferSheet &&
    currentState.homeTeam &&
    currentState.homeTeam.incomingOfferSheets
  ) {
    const updatedHomeTeam = { ...currentState.homeTeam };
    updatedHomeTeam.incomingOfferSheets =
      updatedHomeTeam.incomingOfferSheets.filter(
        (os) => os.playerId !== playerId
      );
    // Only add update if something changed
    if (
      updatedHomeTeam.incomingOfferSheets.length !==
      currentState.homeTeam.incomingOfferSheets.length
    ) {
      updatedHomeTeam.source = {
        ...updatedHomeTeam.source,
        lastModifiedAt: new Date(timestamp).toISOString(),
      };
      teamUpdates.push({
        teamCode: currentState.homeTeam.teamCode,
        team: updatedHomeTeam,
      });
    }
  }

  return {
    success: true,
    teamUpdates,
    playerUpdates: [{ playerId, player: updatedPlayer }],
    metadata: {
      type: 'signing',
      teamCode,
      playerId,
      playerName: player.displayName || player.name,
      contract: normalizedContract,
      timestamp,
      signedUsing,
    },
  };
}

/**
 * Compute waive result
 */
function computeWaiveResult({ payload, currentState, seasonId, timestamp }) {
  const { team, player, teamCode } = currentState;
  const { stretch = false, stretchYears = 3 } = payload;

  // Prioritize payload ID, then fall back to player object properties
  const playerId = payload.playerId || player.player_id || player.id;

  // Invariant check (Dev only)
  if (!playerId) {
    console.error(
      '[computeWaiveResult] CRITICAL: deadCap entry missing playerId',
      {
        payloadId: payload.playerId,
        playerObj: player,
      }
    );
    // In dev, we want to explode so we catch this
    if (process.env.NODE_ENV !== 'production') {
      throw new Error('deadCap entry missing playerId');
    }
  }

  const updatedTeam = { ...team };

  // Remove player from roster
  updatedTeam.roster = (updatedTeam.roster || []).filter(
    (id) => id !== playerId
  );

  // Remove player from players array
  updatedTeam.players = (updatedTeam.players || []).filter(
    (p) => (p.player_id || p.id) !== playerId
  );

  // Calculate dead cap
  const contract = player.contract;
  const remainingSalary = contract?.guaranteedValue || 0;

  if (stretch && remainingSalary > 0) {
    // Calculate stretched amounts with remainder distribution to avoid rounding loss
    const baseStretchedAmount = Math.floor(remainingSalary / stretchYears);
    const remainder = remainingSalary - baseStretchedAmount * stretchYears;

    updatedTeam.deadCap = updatedTeam.deadCap || [];
    updatedTeam.deadCap.push({
      playerId,
      playerName: player.displayName || playerId,
      originalSalary: remainingSalary,
      amountByYear: Array.from({ length: stretchYears }, (_, i) => {
        // Use toSeasonCode for consistent season formatting
        const startYear = toEndYear(seasonId);
        const yearEndYear = startYear + i;
        // Distribute remainder to first years to avoid losing money
        const yearAmount = baseStretchedAmount + (i < remainder ? 1 : 0);
        return {
          season: toSeasonCode(yearEndYear),
          amount: yearAmount,
          isStretched: true,
        };
      }),
      waiveDate: new Date(timestamp).toISOString(),
      notes: `Stretched over ${stretchYears} years`,
    });
  } else if (remainingSalary > 0) {
    updatedTeam.deadCap = updatedTeam.deadCap || [];
    updatedTeam.deadCap.push({
      playerId,
      playerName: player.displayName || playerId,
      originalSalary: remainingSalary,
      amountByYear: [
        {
          season: seasonId,
          amount: remainingSalary,
          isStretched: false,
        },
      ],
      waiveDate: new Date(timestamp).toISOString(),
    });
  }

  // Update source metadata
  updatedTeam.source = {
    ...updatedTeam.source,
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  // Recalculate totals
  updatedTeam.totals = computeTeamCapTotals(updatedTeam, toEndYear(seasonId));

  return {
    success: true,
    teamUpdates: [{ teamCode, team: updatedTeam }],
    playerUpdates: [],
    metadata: {
      type: 'waive',
      teamCode,
      playerId,
      playerName: player.displayName || player.name,
      stretched: stretch,
      deadCapAmount: remainingSalary,
      timestamp,
    },
  };
}

/**
 * Compute extension result
 */
function computeExtensionResult({
  payload,
  currentState,
  seasonId,
  timestamp,
}) {
  const { team, player, teamCode } = currentState;
  const { extension } = payload;

  const playerId = payload.playerId || player.player_id || player.id;
  const updatedTeam = { ...team };

  // Update player's contract in players array
  const playerIndex = (updatedTeam.players || []).findIndex(
    (p) => (p.player_id || p.id) === playerId
  );

  if (playerIndex === -1) {
    return {
      success: false,
      error: `Player ${playerId} not found on team ${teamCode}`,
    };
  }

  // Build and normalize futureContract with canonical field names
  const rawFutureContract = {
    ...(updatedTeam.players[playerIndex].futureContract || {}),
    salariesByYear: [
      ...(updatedTeam.players[playerIndex].futureContract?.salariesByYear ||
        []),
      ...(extension.salariesByYear || []).map((y) => ({
        ...normalizeSalaryRow(y),
        isExtensionSeason: true,
      })),
    ],
    isExtension: true,
    signingDate: new Date(timestamp).toISOString(),
  };

  const updatedPlayer = {
    ...updatedTeam.players[playerIndex],
    futureContract: normalizeFutureContract(rawFutureContract),
  };

  updatedTeam.players = [...updatedTeam.players];
  updatedTeam.players[playerIndex] = updatedPlayer;

  // Update source metadata
  updatedTeam.source = {
    ...updatedTeam.source,
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  return {
    success: true,
    teamUpdates: [{ teamCode, team: updatedTeam }],
    playerUpdates: [{ playerId, player: updatedPlayer }],
    metadata: {
      type: 'extension',
      teamCode,
      playerId,
      playerName: player.displayName || player.name,
      extensionYears: extension.salariesByYear?.length || 0,
      timestamp,
    },
  };
}

/**
 * Compute option decision result
 */
function computeOptionResult({ payload, currentState, seasonId, timestamp }) {
  const { team, player, teamCode } = currentState;
  const { accepted, targetYear } = payload;

  const playerId = payload.playerId || player.player_id || player.id;
  const updatedTeam = { ...team };

  // Find player in team
  const playerIndex = (updatedTeam.players || []).findIndex(
    (p) => (p.player_id || p.id) === playerId
  );

  if (playerIndex === -1) {
    return {
      success: false,
      error: `Player ${playerId} not found on team ${teamCode}`,
    };
  }

  const playerData = updatedTeam.players[playerIndex];
  const salaries = playerData.contract?.salariesByYear || [];

  // Find the option year entry
  const optionIndex = salaries.findIndex((y) => {
    const yearEnd = toEndYear(y.season);
    return yearEnd === targetYear && y.option;
  });

  if (optionIndex === -1) {
    return { success: false, error: `No option found for year ${targetYear}` };
  }

  let updatedPlayer;
  let newCapHold = null;

  if (accepted) {
    // Accepted: mark option as used (canonical boolean format)
    const updatedSalaries = [...salaries];
    updatedSalaries[optionIndex] = {
      ...normalizeSalaryRow(updatedSalaries[optionIndex]),
      optionUsed: true, // CANONICAL: boolean, not string
    };

    updatedPlayer = {
      ...playerData,
      contract: normalizeContractForWorld({
        ...playerData.contract,
        salariesByYear: updatedSalaries,
      }),
    };
  } else {
    const optionSeason = salaries[optionIndex]?.season || null;
    const faYearInfo = deriveFreeAgencyYearFromOptionSeason(
      optionSeason,
      targetYear
    );
    const freeAgencyYear =
      typeof faYearInfo.year === 'number' ? faYearInfo.year : targetYear - 1;

    // Declined: remove this year and all future years
    const filteredSalaries = salaries
      .filter((_, idx) => idx < optionIndex)
      .map(normalizeSalaryRow);

    updatedPlayer = {
      ...playerData,
      contract: normalizeContractForWorld({
        ...playerData.contract,
        salariesByYear: filteredSalaries,
        freeAgency: {
          year: freeAgencyYear,
          type: 'UFA',
        },
      }),
      freeAgentYear: freeAgencyYear,
    };

    // Create cap hold for declined option
    const priorRow = salaries[optionIndex - 1];
    const lastSalary = priorRow?.salary ?? priorRow?.capHit ?? 0;
    const rightsType = getRightsTypeFromPlayer(playerData);
    const capHoldExpectation = computeExpectedCapHoldAmount({
      player: playerData,
      lastSalary,
      rules: null,
      rightsType,
    });

    if (lastSalary > 0 && capHoldExpectation.amount > 0) {
      newCapHold = {
        playerId,
        playerName: playerData.displayName || playerData.name || '',
        amount: capHoldExpectation.amount,
        type: 'FA Cap Hold',
        season: toSeasonCode(targetYear),
        isSigned: false,
        reason: capHoldExpectation.usedFallback
          ? 'Declined Option (fallback multiplier)'
          : 'Declined Option',
        notes: capHoldExpectation.usedFallback
          ? 'Fallback multiplier used due to missing/unsupported Bird rights type.'
          : undefined,
        active: true,
      };
    }

    // Remove from roster if option declined (becomes FA)
    updatedTeam.roster = (updatedTeam.roster || []).filter(
      (id) => id !== playerId
    );
    updatedTeam.players = (updatedTeam.players || []).filter(
      (p) => (p.player_id || p.id) !== playerId
    );
  }

  // Update player in team's players array if still on roster
  if (accepted) {
    updatedTeam.players = [...updatedTeam.players];
    updatedTeam.players[playerIndex] = updatedPlayer;
  }

  // Add cap hold if created
  if (newCapHold) {
    updatedTeam.capHolds = [...(updatedTeam.capHolds || []), newCapHold];
  }

  // Update source metadata
  updatedTeam.source = {
    ...updatedTeam.source,
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  // Recalculate totals
  updatedTeam.totals = computeTeamCapTotals(updatedTeam, toEndYear(seasonId));

  return {
    success: true,
    teamUpdates: [{ teamCode, team: updatedTeam }],
    playerUpdates: accepted ? [{ playerId, player: updatedPlayer }] : [],
    metadata: {
      type: 'option',
      teamCode,
      playerId,
      playerName: player.displayName || player.name,
      optionType: salaries[optionIndex]?.option,
      accepted,
      targetYear,
      timestamp,
    },
  };
}

/**
 * Compute renounce rights result
 *
 * Renouncing rights removes the team's cap hold on a free agent
 * and clears their Bird rights association with this team.
 * The player remains in the FA pool but cannot be re-signed using Bird rights.
 */
function computeRenounceResult({ payload, currentState, seasonId, timestamp }) {
  const { team, player, teamCode } = currentState;
  const playerId = payload.playerId || player.player_id || player.id;
  const playerName = player.displayName || player.name;

  const updatedTeam = { ...team };

  // 1. Remove the player's cap hold from the team
  // Match by playerId first (primary), then by playerName (fallback) using OR logic
  if (updatedTeam.capHolds && Array.isArray(updatedTeam.capHolds)) {
    updatedTeam.capHolds = updatedTeam.capHolds.filter((hold) => {
      // Remove if playerId matches
      if (hold.playerId === playerId) return false;
      // Also remove if playerName matches (in case IDs don't align)
      if (hold.playerName === playerName) return false;
      return true;
    });
  }

  // 2. Mark the player's Bird rights as renounced/cleared for this team
  // Update player entry if present in team's players array
  // Prioritize ID matching over name matching
  if (updatedTeam.players && Array.isArray(updatedTeam.players)) {
    updatedTeam.players = updatedTeam.players.map((p) => {
      const pid = p.player_id || p.id;
      // Prioritize exact ID match, then fall back to name match
      const isMatch =
        pid === playerId || (pid == null && p.name === playerName);
      if (isMatch) {
        return {
          ...p,
          rightsRenounced: true,
          renouncedAt: new Date(timestamp).toISOString(),
          contract: {
            ...(p.contract || {}),
            birdRights: {
              ...(p.contract?.birdRights || {}),
              status: 'None',
              renouncedBy: teamCode,
              renouncedAt: new Date(timestamp).toISOString(),
            },
          },
        };
      }
      return p;
    });
  }

  // Update source metadata
  updatedTeam.source = {
    ...updatedTeam.source,
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  // Recalculate totals (cap holds affect cap space)
  updatedTeam.totals = computeTeamCapTotals(updatedTeam, toEndYear(seasonId));

  return {
    success: true,
    teamUpdates: [{ teamCode, team: updatedTeam }],
    playerUpdates: [],
    metadata: {
      type: 'renounce',
      teamCode,
      playerId,
      playerName: player.displayName || player.name,
      timestamp,
    },
  };
}

/**
 * Compute set exceptions result (Phase 27)
 *
 * Replaces the team.exceptions object with the payload exceptions (full replacement).
 * This is the simplest and most audit-grade approach.
 */
function computeSetExceptionsResult({
  payload,
  currentState,
  seasonId,
  timestamp,
}) {
  const { teamCode } = payload;
  const { team } = currentState;

  // Validate payload.exceptions is an object or null/undefined (to clear)
  if (payload.exceptions !== null && payload.exceptions !== undefined) {
    if (
      typeof payload.exceptions !== 'object' ||
      Array.isArray(payload.exceptions)
    ) {
      return {
        success: false,
        error: 'Invalid exceptions payload: must be an object or null',
      };
    }
  }

  // Full replacement: update exceptions field on team
  const updatedTeam = {
    ...team,
    exceptions: payload.exceptions || {},
  };

  // Update source metadata
  updatedTeam.source = {
    ...updatedTeam.source,
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  return {
    success: true,
    teamUpdates: [{ teamCode, team: updatedTeam }],
    playerUpdates: [],
    metadata: {
      actionType: 'setExceptions',
      teamCode,
      timestamp,
    },
  };
}

// ==============================================================================
// PHASE 3: VALIDATE - Ensure mutation is legal
// ==============================================================================

/**
 * Validate mutation before persistence.
 *
 * Phase 5 Enhancement: All mutation types now have real validation.
 * Previously only trades were validated; signings/waives/etc bypassed validation.
 *
 * IMPORTANT: This function blocks persistence when violations exist.
 * There is no bypass mechanism - illegal states cannot be persisted.
 *
 * @param {Object} params
 * @param {string} [params.asOfDate] - Phase 20: World time SSOT
 * @param {boolean} [params.dateDefaulted] - Phase 20: True if asOfDate was defaulted
 * @returns {{valid: boolean, error?: string, violations?: Array}}
 */
function validateMutation({
  mutationType,
  payload,
  currentState,
  computeResult,
  seasonId,
  asOfDate,
  dateDefaulted,
}) {
  // Phase 20: Collect warnings including world time defaulted warning
  const pipelineWarnings = [];

  if (dateDefaulted) {
    pipelineWarnings.push({
      rule: 'world_time_defaulted',
      message: `World time was defaulted to ${asOfDate}. For accurate timing-based validation, provide asOfDate in payload or world metadata.`,
      severity: 'warning',
      asOfDateUsed: asOfDate,
    });
  }

  // Trade validation uses the full Trade Machine
  if (mutationType === 'executeTrade') {
    // Phase 56+: Trade validation MUST have already occurred via validatePostTradeSnapshotForContext
    // computeWorldMutation guarantees _validatedTradeContext is attached to computeResult
    if (computeResult?._validatedTradeContext?._isValidatedTradeContext) {
      const preValidated = computeResult._validatedTradeContext;
      return {
        valid: preValidated.legal,
        error: preValidated.error,
        violations: preValidated.violations || [],
        warnings: [...(preValidated.warnings || []), ...pipelineWarnings],
      };
    }

    // Phase 57: Hard error if context is missing - no fallback validation
    // This should never happen if the pipeline is correctly structured
    throw new Error(
      '[validateMutation] Phase 57 violation: executeTrade requires pre-validated context. ' +
        'computeWorldMutation must attach _validatedTradeContext via validatePostTradeSnapshotForContext.'
    );
  }

  const currentYear = toEndYear(seasonId);

  // Non-trade mutations use capLegalityValidation
  switch (mutationType) {
    case 'setDeadCap': {
      const result = validateDeadCap(payload.deadCap);
      return {
        valid: result.violations.length === 0,
        error: result.violations[0]?.message || null,
        violations: result.violations,
        warnings: pipelineWarnings,
      };
    }

    case 'setExceptions': {
      const result = validateExceptions(payload.exceptions);
      return {
        valid: result.violations.length === 0,
        error: result.violations[0]?.message || null,
        violations: result.violations,
        warnings: [...(result.warnings || []), ...pipelineWarnings],
      };
    }

    case 'signFreeAgent': {
      const result = validateSigning({
        team: currentState.team,
        player: currentState.player,
        contract: payload.contract,
        signedUsing: payload.signedUsing,
        year: currentYear,
        asOfDate, // Phase 20: Pass world time to validator (unused now, ready for Phase 21)
      });
      return {
        valid: result.valid,
        error: result.violations[0]?.message || null,
        violations: result.violations,
        warnings: [...result.warnings, ...pipelineWarnings],
      };
    }

    case 'waivePlayer': {
      const result = validateWaive({
        team: currentState.team,
        player: currentState.player,
        stretch: payload.stretch,
        year: currentYear,
        isGracePeriod: payload.isGracePeriod || false,
        asOfDate, // Phase 21: World time for stretch timing check
      });
      return {
        valid: result.valid,
        error: result.violations[0]?.message || null,
        violations: result.violations,
        warnings: result.warnings,
      };
    }

    case 'extendPlayer': {
      const result = validateExtension({
        team: currentState.team,
        player: currentState.player,
        extension: payload.extension,
        year: currentYear,
      });
      return {
        valid: result.valid,
        error: result.violations[0]?.message || null,
        violations: result.violations,
        warnings: result.warnings,
      };
    }

    case 'optionDecision': {
      // Phase 7.1: Pass updatedTeam to validate cap hold transitions
      const updatedTeam = computeResult?.teamUpdates?.find(
        (u) => u.teamCode === currentState.team.teamCode
      )?.team;
      const updatedPlayer = computeResult?.playerUpdates?.find(
        (u) => u.playerId === getPlayerId(currentState.player)
      )?.player;

      const result = validateOptionDecision({
        originalTeam: currentState.team,
        originalPlayer: currentState.player,
        updatedTeam,
        updatedPlayer,
        accepted: payload.accepted,
        targetYear: payload.targetYear,
        currentYear,
      });
      return {
        valid: result.valid,
        error: result.violations[0]?.message || null,
        violations: result.violations,
        warnings: result.warnings,
      };
    }

    case 'storeOfferSheet': {
      // Reuse validateSigning with store-only context
      // The payload.contract MUST have rfaOfferSheetOnly=true (validation checked in capLegality)
      const result = validateSigning({
        team: currentState.team,
        player: currentState.player,
        contract: payload.contract,
        signedUsing: payload.signedUsing,
        year: currentYear,
      });
      return {
        valid: result.valid,
        error: result.violations[0]?.message || null,
        violations: result.violations,
        warnings: result.warnings,
      };
    }

    case 'matchOfferSheet': {
      // Validate Match Action (including 48h window check)
      const offerSheet = currentState.homeTeam?.incomingOfferSheets?.find(
        (os) => os.id === currentState.offerSheetId
      );
      const result = validateOfferSheetResolution({
        offerSheet,
        actingTeamCode: payload.teamCode,
        action: 'match',
        asOfDate, // Phase 21
      });
      return {
        valid: result.valid,
        error: result.violations[0]?.message || null,
        violations: result.violations,
        warnings: [...result.warnings, ...pipelineWarnings],
      };
    }

    case 'declineOfferSheet': {
      // Validate Decline Action
      const offerSheet = currentState.homeTeam?.incomingOfferSheets?.find(
        (os) => os.id === currentState.offerSheetId
      );
      const result = validateOfferSheetResolution({
        offerSheet,
        actingTeamCode: payload.teamCode,
        action: 'decline',
        asOfDate, // Phase 21
      });
      return {
        valid: result.valid,
        error: result.violations[0]?.message || null,
        violations: result.violations,
        warnings: [...result.warnings, ...pipelineWarnings],
      };
    }

    case 'storeOfferSheet': {
      const result = validateSigning({
        team: currentState.team,
        player: currentState.player,
        contract: payload.contract,
        signedUsing: payload.signedUsing,
        year: currentYear,
      });
      return {
        valid: result.valid,
        error: result.violations[0]?.message || null,
        violations: result.violations,
        warnings: result.warnings,
      };
    }

    case 'matchOfferSheet':
    case 'declineOfferSheet': {
      // Handled above (split cases)
      return { valid: true };
    }

    case 'renounceRights': {
      const result = validateRenounceRights({
        team: currentState.team,
        player: currentState.player,
      });
      return {
        valid: result.valid,
        error: result.violations[0]?.message || null,
        violations: result.violations,
        warnings: result.warnings,
      };
    }

    case 'signAndTrade': {
      // Phase 56+: S&T validation MUST have already occurred via computeSignAndTradeResult
      // which calls validateSigning + validatePostTradeSnapshotForContext before computeTradeResult
      const hasPreValidatedSigning =
        computeResult?._signingValidation?.valid !== undefined;
      const hasPreValidatedTrade =
        computeResult?._validatedTradeContext?._isValidatedTradeContext;

      if (hasPreValidatedSigning && hasPreValidatedTrade) {
        const preSigningResult = computeResult._signingValidation;
        const preTradeResult = computeResult._validatedTradeContext;

        return {
          valid: preSigningResult.valid && preTradeResult.legal,
          error: preSigningResult.valid
            ? preTradeResult.error
            : preSigningResult.violations?.[0]?.message ||
              'Signing validation failed',
          violations: [
            ...(preSigningResult.violations || []),
            ...(preTradeResult.violations || []),
          ],
          warnings: [
            ...(preSigningResult.warnings || []),
            ...(preTradeResult.warnings || []),
            ...pipelineWarnings,
          ],
        };
      }

      // Phase 57: Hard error if contexts are missing - no fallback validation
      // computeSignAndTradeResult must attach both _signingValidation and _validatedTradeContext
      throw new Error(
        '[validateMutation] Phase 57 violation: signAndTrade requires pre-validated contexts. ' +
          'computeSignAndTradeResult must attach _signingValidation and _validatedTradeContext.'
      );
    }

    default:
      // Unknown mutation type - fail closed for security
      // If you're adding a new mutation type, add validation logic above
      console.warn(
        `Unknown mutation type: ${mutationType}, blocking for safety`
      );
      return {
        valid: false,
        error: `Unknown mutation type: ${mutationType}`,
        violations: [
          {
            rule: 'unknown_type',
            message: `Unknown mutation type: ${mutationType}`,
            severity: 'error',
          },
        ],
        warnings: [],
      };
  }
}

// ==============================================================================
// PHASE 59: LEGACY VALIDATION HELPERS REMOVED
// ==============================================================================
// validateTradeForPipeline was a deprecated function that validated PRE-TRADE state.
// It has been removed in Phase 59 as no production or test code uses it.
// The correct approach (Phase 56+) validates POST-TRADE state via:
//   buildPostTradeTeamsSnapshot → validatePostTradeSnapshotForContext → compute/persist
//
// validateTradeForContext has been moved to tradeContext/legacy/ namespace.
// Import from '@/features/architect/utils/tradeContext/legacy' if needed.

// ==============================================================================
// PHASE 4: PERSIST - Write to Firestore (ONLY place that writes)
// ==============================================================================

/**
 * Persist mutation to Firestore.
 * THIS IS THE ONLY PLACE THAT WRITES TO FIRESTORE FOR MUTATIONS.
 *
 * @param {Object} params
 * @returns {Promise<{success: boolean, worldPatch?: Object, event?: Object, error?: string}>}
 */
async function persistWorldMutation({
  worldId,
  seasonId,
  mutationType,
  computeResult,
  timestamp,
  payloadAsOfDate, // Phase 20: Only write asOfDate if explicitly provided in payload
}) {
  const batch = writeBatch(db);

  try {
    // 1. Write team snapshots
    for (const { teamCode, team } of computeResult.teamUpdates) {
      // Guard against undefined values (dev throws, prod allows)
      guardAgainstUndefined(
        team,
        `architect_worlds/${worldId}/teams/${teamCode}`
      );
      // Phase 60: Sanitize transient fields first
      const afterSanitize = sanitizeTransientFieldsForPersistence(team);
      // Phase 64: Normalize TPE schema (tradeExceptions → exceptions.tpe)
      // This ensures legacy tradeExceptions[] is merged into canonical exceptions.tpe[]
      // and the legacy field is removed BEFORE contract validation
      const afterTpeNormalize = normalizeTeamTpeSchema(afterSanitize);
      // Phase 61: Validate against persistence contract (test-only enforcement)
      // Ordering: sanitize → normalize TPE → validate contract → removeUndefined
      assertPersistableOrThrow({
        obj: afterTpeNormalize,
        contract: PERSISTENCE_CONTRACTS.TEAM,
        label: 'TEAM',
      });
      // Then remove undefined values
      const sanitizedTeam = removeUndefinedDeep(afterTpeNormalize);
      const teamRef = worldTeamRef(worldId, teamCode);
      batch.set(teamRef, sanitizedTeam);
    }

    // 2. Write player overrides (if any)
    for (const { playerId, player } of computeResult.playerUpdates) {
      // Player overrides go in the team's players subcollection
      const teamCode = player.teamCode;
      if (teamCode) {
        // Guard against undefined values (dev throws, prod allows)
        guardAgainstUndefined(
          player,
          `architect_worlds/${worldId}/teams/${teamCode}/players/${playerId}`
        );
        // Phase 60: Sanitize transient fields first
        const afterSanitize = sanitizeTransientFieldsForPersistence(player);
        // Phase 61: Validate against persistence contract (test-only enforcement)
        // Ordering: sanitize → validate contract → removeUndefined
        assertPersistableOrThrow({
          obj: afterSanitize,
          contract: PERSISTENCE_CONTRACTS.PLAYER,
          label: 'PLAYER',
        });
        // Then remove undefined values
        const sanitizedPlayer = removeUndefinedDeep(afterSanitize);
        const playerRef = worldPlayerRef(worldId, teamCode, playerId);
        batch.set(playerRef, sanitizedPlayer);
      }
    }

    // 3. Write event log entry
    // Use timestamp + random suffix to avoid collisions if multiple mutations occur at same millisecond
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const eventId = `${mutationType}_${timestamp}_${randomSuffix}`;
    const eventsCol = collection(
      db,
      ARCHITECT_WORLDS_COLLECTION,
      worldId,
      'events'
    );
    const eventRef = doc(eventsCol, eventId);

    // Phase 60/61: Sanitize and validate metadata first
    const sanitizedMetadataRaw = sanitizeTransientFieldsForPersistence(
      computeResult.metadata
    );
    // Phase 61: Validate metadata against persistence contract (test-only enforcement)
    assertPersistableOrThrow({
      obj: sanitizedMetadataRaw,
      contract: PERSISTENCE_CONTRACTS.EVENT_METADATA,
      label: 'EVENT_METADATA',
    });
    const sanitizedMetadata = removeUndefinedDeep(sanitizedMetadataRaw);

    const event = {
      eventId,
      type: mutationType,
      timestamp: new Date(timestamp).toISOString(),
      seasonId,
      metadata: sanitizedMetadata,
      teamsAffected: computeResult.teamUpdates.map((u) => u.teamCode),
    };

    // Phase 60: Sanitize entire event (defense-in-depth)
    const afterEventSanitize = sanitizeTransientFieldsForPersistence(event);
    // Phase 61: Validate event against persistence contract (test-only enforcement)
    // Ordering: sanitize → validate contract → removeUndefined
    assertPersistableOrThrow({
      obj: afterEventSanitize,
      contract: PERSISTENCE_CONTRACTS.EVENT,
      label: 'EVENT',
    });
    const sanitizedEvent = removeUndefinedDeep(afterEventSanitize);
    batch.set(eventRef, sanitizedEvent);

    // 4. Update world metadata
    // Use lastModifiedTeams (not modifiedTeams) to clarify this field records
    // only teams modified by this single mutation, not cumulative history
    const worldPatch = {
      lastModifiedAt: serverTimestamp(),
      lastModifiedTeams: computeResult.teamUpdates.map((u) => u.teamCode),
    };

    // Phase 20: Only update asOfDate if explicitly provided in payload
    // This prevents silent overwrites and allows mutations to reference a date
    // without advancing world time
    if (payloadAsOfDate && typeof payloadAsOfDate === 'string') {
      worldPatch.asOfDate = payloadAsOfDate;
    }

    const metadataRef = worldMetadataRef(worldId);
    batch.update(metadataRef, worldPatch);

    // Commit all writes atomically
    await batch.commit();

    return {
      success: true,
      worldPatch,
      event,
    };
  } catch (error) {
    console.error('persistWorldMutation failed:', error);
    return {
      success: false,
      error: error.message || 'Failed to persist mutation',
    };
  }
}

function computeStoreOfferSheetResult({
  payload,
  currentState,
  seasonId,
  timestamp,
}) {
  const { team: offeringTeam, player, teamCode, homeTeam } = currentState;
  const { contract, worldId } = payload;
  const currentYear = toEndYear(seasonId);

  // Validate store-only invariants programmatically just in case
  if (contract.rfaOfferSheetOnly !== true || contract.rfaOfferSheet !== true) {
    return {
      success: false,
      error:
        'storeOfferSheet requires rfaOfferSheet=true and rfaOfferSheetOnly=true',
    };
  }

  const playerId = player.player_id || player.id;
  const homeTeamCode = player.teamCode || player.contract?.signingTeam;

  // Phase 18.2: worldId is REQUIRED for audit-grade dedupKey
  // Cannot store offer sheet without worldId - fail fast
  if (!worldId) {
    return {
      success: false,
      error:
        'worldId is required for offer sheet identity. Cannot store offer sheet without worldId.',
    };
  }

  // Phase 18.1/18.2: Generate DETERMINISTIC dedupKey for idempotency
  // Format: os:{worldId}:{offeringTeamCode}:{playerId}:{seasonKey}
  // This is stable across retries (no timestamp dependency)
  const dedupKey = `os:${worldId}:${teamCode}:${playerId}:${seasonId}`;

  // Generate unique ID (includes timestamp for uniqueness, but NOT used for dedup)
  const offerSheetId =
    payload.offerSheetId || `os_${teamCode}_${playerId}_${timestamp}`;

  // Build canonical OfferSheet object
  const offerSheet = {
    id: offerSheetId,
    dedupKey, // Phase 18.1: Deterministic key for idempotency
    playerId,
    playerName: player.displayName || player.name,
    offeringTeamCode: teamCode,
    homeTeamCode,
    seasonKey: seasonId,
    year: currentYear,
    contractYears: contract.contractYears || contract.years || 1,
    salariesByYear: contract.salariesByYear?.map(normalizeSalaryRow) || [],
    status: 'PENDING_MATCH',
    createdAt: new Date(timestamp).toISOString(),
    totalValue: contract.totalValue,
  };

  const updatedOfferingTeam = { ...offeringTeam };

  // Phase 18.1: DEDUPLICATION - Check by id first, then by dedupKey
  // This ensures retries don't create duplicates even with different timestamps
  let existingIndex = (updatedOfferingTeam.offerSheets || []).findIndex(
    (os) => os.id === offerSheetId
  );
  if (existingIndex === -1) {
    // Not found by ID, try dedupKey
    existingIndex = (updatedOfferingTeam.offerSheets || []).findIndex(
      (os) => os.dedupKey === dedupKey
    );
  }

  if (existingIndex !== -1) {
    // UPDATE IN PLACE - preserve existing ID if found by dedupKey
    const existingSheet = updatedOfferingTeam.offerSheets[existingIndex];
    const newSheets = [...updatedOfferingTeam.offerSheets];
    newSheets[existingIndex] = {
      ...offerSheet,
      id: existingSheet.id, // Preserve original ID
      createdAt: existingSheet.createdAt, // Preserve original creation time
    };
    updatedOfferingTeam.offerSheets = newSheets;
  } else {
    updatedOfferingTeam.offerSheets = [
      ...(updatedOfferingTeam.offerSheets || []),
      offerSheet,
    ];
  }

  // Update source metadata
  updatedOfferingTeam.source = {
    ...updatedOfferingTeam.source,
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  const teamUpdates = [{ teamCode, team: updatedOfferingTeam }];

  // MIRRORING: Add to home team's incomingOfferSheets if home team exists
  if (homeTeam) {
    const updatedHomeTeam = { ...homeTeam };

    // Phase 18.1: Same dedup logic for home team
    let existingHomeIndex = (
      updatedHomeTeam.incomingOfferSheets || []
    ).findIndex((os) => os.id === offerSheetId);
    if (existingHomeIndex === -1) {
      existingHomeIndex = (updatedHomeTeam.incomingOfferSheets || []).findIndex(
        (os) => os.dedupKey === dedupKey
      );
    }

    if (existingHomeIndex !== -1) {
      const existingSheet =
        updatedHomeTeam.incomingOfferSheets[existingHomeIndex];
      const newSheets = [...updatedHomeTeam.incomingOfferSheets];
      newSheets[existingHomeIndex] = {
        ...offerSheet,
        id: existingSheet.id,
        createdAt: existingSheet.createdAt,
      };
      updatedHomeTeam.incomingOfferSheets = newSheets;
    } else {
      updatedHomeTeam.incomingOfferSheets = [
        ...(updatedHomeTeam.incomingOfferSheets || []),
        offerSheet,
      ];
    }

    updatedHomeTeam.source = {
      ...updatedHomeTeam.source,
      lastModifiedAt: new Date(timestamp).toISOString(),
    };
    teamUpdates.push({ teamCode: homeTeam.teamCode, team: updatedHomeTeam });
  }

  return {
    success: true,
    teamUpdates,
    playerUpdates: [],
    metadata: {
      type: 'storeOfferSheet',
      teamCode,
      playerId: offerSheet.playerId,
      offerSheetId: offerSheet.id,
      dedupKey, // Phase 18.1: Include for traceability
      timestamp,
    },
  };
}

/**
 * Compute match offer sheet result
 */
function computeMatchOfferSheetResult({
  payload,
  currentState,
  seasonId,
  timestamp,
}) {
  const { offeringTeam, homeTeam, offerSheetId } = currentState;

  // Find offer sheet on offering team
  const offerSheetIndex = (offeringTeam.offerSheets || []).findIndex(
    (os) => os.id === offerSheetId
  );
  if (offerSheetIndex === -1) {
    return {
      success: false,
      error: `Offer sheet ${offerSheetId} not found on team ${offeringTeam.teamCode}`,
    };
  }

  const existingSheet = offeringTeam.offerSheets[offerSheetIndex];

  if (existingSheet.status !== 'PENDING_MATCH') {
    return {
      success: false,
      error: `Offer sheet status is ${existingSheet.status}, expected PENDING_MATCH`,
    };
  }

  // Update status
  const updatedOfferSheet = {
    ...existingSheet,
    status: 'MATCHED',
    matchedAt: new Date(timestamp).toISOString(),
  };

  const updatedOfferingTeam = { ...offeringTeam };
  updatedOfferingTeam.offerSheets = [...updatedOfferingTeam.offerSheets];
  updatedOfferingTeam.offerSheets[offerSheetIndex] = updatedOfferSheet;
  updatedOfferingTeam.source = {
    ...updatedOfferingTeam.source,
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  const teamUpdates = [
    { teamCode: offeringTeam.teamCode, team: updatedOfferingTeam },
  ];

  // MIRRORING: Update logic on home team
  if (homeTeam && homeTeam.incomingOfferSheets) {
    const homeIndex = homeTeam.incomingOfferSheets.findIndex(
      (os) => os.id === offerSheetId
    );
    if (homeIndex !== -1) {
      const updatedHomeTeam = { ...homeTeam };
      updatedHomeTeam.incomingOfferSheets = [
        ...updatedHomeTeam.incomingOfferSheets,
      ];
      updatedHomeTeam.incomingOfferSheets[homeIndex] = updatedOfferSheet;
      updatedHomeTeam.source = {
        ...updatedHomeTeam.source,
        lastModifiedAt: new Date(timestamp).toISOString(),
      };
      teamUpdates.push({ teamCode: homeTeam.teamCode, team: updatedHomeTeam });
    }
  }

  return {
    success: true,
    teamUpdates,
    playerUpdates: [],
    metadata: {
      type: 'matchOfferSheet',
      offeringTeamCode: offeringTeam.teamCode,
      homeTeamCode: homeTeam.teamCode,
      offerSheetId,
      timestamp,
    },
  };
}

/**
 * Compute decline offer sheet result
 */
function computeDeclineOfferSheetResult({
  payload,
  currentState,
  seasonId,
  timestamp,
}) {
  const { offeringTeam, homeTeam, offerSheetId } = currentState;

  // Find offer sheet
  const offerSheetIndex = (offeringTeam.offerSheets || []).findIndex(
    (os) => os.id === offerSheetId
  );
  if (offerSheetIndex === -1) {
    return { success: false, error: `Offer sheet ${offerSheetId} not found` };
  }

  const existingSheet = offeringTeam.offerSheets[offerSheetIndex];
  if (existingSheet.status !== 'PENDING_MATCH') {
    return {
      success: false,
      error: `Offer sheet status is ${existingSheet.status}, expected PENDING_MATCH`,
    };
  }

  const updatedOfferSheet = {
    ...existingSheet,
    status: 'DECLINED',
    declinedAt: new Date(timestamp).toISOString(),
  };

  const updatedOfferingTeam = { ...offeringTeam };
  updatedOfferingTeam.offerSheets = [...updatedOfferingTeam.offerSheets];
  updatedOfferingTeam.offerSheets[offerSheetIndex] = updatedOfferSheet;
  updatedOfferingTeam.source = {
    ...updatedOfferingTeam.source,
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  const teamUpdates = [
    { teamCode: offeringTeam.teamCode, team: updatedOfferingTeam },
  ];

  // MIRRORING: Update logic on home team
  if (homeTeam && homeTeam.incomingOfferSheets) {
    const homeIndex = homeTeam.incomingOfferSheets.findIndex(
      (os) => os.id === offerSheetId
    );
    if (homeIndex !== -1) {
      const updatedHomeTeam = { ...homeTeam };
      updatedHomeTeam.incomingOfferSheets = [
        ...updatedHomeTeam.incomingOfferSheets,
      ];
      updatedHomeTeam.incomingOfferSheets[homeIndex] = updatedOfferSheet;
      updatedHomeTeam.source = {
        ...updatedHomeTeam.source,
        lastModifiedAt: new Date(timestamp).toISOString(),
      };
      teamUpdates.push({ teamCode: homeTeam.teamCode, team: updatedHomeTeam });
    }
  }

  return {
    success: true,
    teamUpdates,
    playerUpdates: [],
    metadata: {
      type: 'declineOfferSheet',
      offeringTeamCode: offeringTeam.teamCode,
      homeTeamCode: homeTeam.teamCode,
      offerSheetId,
      timestamp,
    },
  };
}

/**
 * Compute MATCHED offer sheet finalization.
 *
 * GOAL:
 * 1. Validate status is MATCHED (and acting team is home team - handled by validator).
 * 2. Apply the contract terms from offer sheet to the home team's player.
 * 3. Remove offer sheet from BOTH home and offering teams.
 */
function computeFinalizeMatchedOfferSheetResult({
  payload,
  currentState,
  seasonId,
  timestamp,
}) {
  const { homeTeam, offeringTeam, offerSheetId } = currentState; // Loaded by loadStateForMutation
  const { teamCode } = payload; // Should be homeTeamCode

  // 1. Find the offer sheet (on home team)
  const incomingOfferSheets = homeTeam.incomingOfferSheets || [];
  const offerSheet = incomingOfferSheets.find((os) => os.id === offerSheetId);

  // Validation happens in validateMutation via validateOfferSheetResolution,
  // but we can do a sanity check here or let it fail if missing.
  if (!offerSheet) {
    return {
      success: false,
      error: `Offer sheet ${offerSheetId} not found on home team.`,
    };
  }

  // 2. Prepare Home Team Update
  const updatedHomeTeam = { ...homeTeam };

  // 2a. Remove from incomingOfferSheets
  updatedHomeTeam.incomingOfferSheets = incomingOfferSheets.filter(
    (os) => os.id !== offerSheetId
  );

  // 2b. Apply contract to player
  // We need to find the player on the home team roster/players list.
  // The offer sheet has playerId.
  const playerId = offerSheet.playerId;
  const playerIndex = (updatedHomeTeam.players || []).findIndex(
    (p) => (p.player_id || p.id) === playerId
  );

  if (playerIndex === -1) {
    return {
      success: false,
      error: `Player ${playerId} not found on home team roster for contract application.`,
    };
  }

  // Clone the player to update contract
  const updatedPlayer = { ...updatedHomeTeam.players[playerIndex] };

  // Construct new contract from offer sheet
  // Offer sheet structure: salariesByYear: [{ season, salary, capHit, guaranteed }]
  // We need to convert this to the standard contract format.
  const newContract = {
    contractType: 'Standard', // Offer sheets are standard contracts
    signedUsing: 'Match', // Or "Matched Offer Sheet"
    signingTeam: teamCode,
    contractLength: offerSheet.contractYears,
    salariesByYear: offerSheet.salariesByYear.map((s) => ({
      season: s.season,
      salary: s.salary,
      capHit: s.capHit,
      guaranteed: s.guaranteed,
    })),
  };

  updatedPlayer.contract = newContract;

  // Update player in team array
  updatedHomeTeam.players = [
    ...updatedHomeTeam.players.slice(0, playerIndex),
    updatedPlayer,
    ...updatedHomeTeam.players.slice(playerIndex + 1),
  ];

  // Recalculate totals
  updatedHomeTeam.totals = computeTeamCapTotals(
    updatedHomeTeam,
    toEndYear(seasonId)
  );

  // 3. Prepare Offering Team Update
  const updatedOfferingTeam = { ...offeringTeam };

  // 3a. Remove from offerSheets (outgoing)
  updatedOfferingTeam.offerSheets = (
    updatedOfferingTeam.offerSheets || []
  ).filter((os) => os.id !== offerSheetId);

  return {
    success: true,
    teamUpdates: [
      { teamCode: homeTeam.teamCode, team: updatedHomeTeam },
      { teamCode: offeringTeam.teamCode, team: updatedOfferingTeam },
    ],
    metadata: {
      type: 'finalizeMatchedOfferSheet',
      offerSheetId,
      playerId,
      homeTeam: homeTeam.teamCode,
      offeringTeam: offeringTeam.teamCode,
      timestamp,
    },
  };
}

/**
 * Phase 18.1: Compute DECLINED offer sheet finalization.
 *
 * GOAL:
 * 1. Validate status is DECLINED (and acting team is offering team - handled by validator).
 * 2. Remove offer sheet from BOTH teams (explicit cleanup).
 * 3. Apply the contract terms from offer sheet to the offering team's player (signing).
 */
function computeFinalizeDeclinedOfferSheetResult({
  payload,
  currentState,
  seasonId,
  timestamp,
}) {
  const { offeringTeam, homeTeam, offerSheetId } = currentState;
  const { teamCode, dedupKey } = payload; // Phase 18.2: Accept dedupKey for dual lookup

  // 1. Find the offer sheet (on offering team)
  // Phase 18.2: Find by id first, then by dedupKey
  const offerSheets = offeringTeam.offerSheets || [];
  let offerSheet = offerSheets.find((os) => os.id === offerSheetId);
  if (!offerSheet && dedupKey) {
    offerSheet = offerSheets.find((os) => os.dedupKey === dedupKey);
  }

  if (!offerSheet) {
    return {
      success: false,
      error: `Offer sheet ${offerSheetId} not found on offering team.`,
    };
  }

  if (offerSheet.status !== 'DECLINED') {
    return {
      success: false,
      error: `Offer sheet status is ${offerSheet.status}, expected DECLINED.`,
    };
  }

  // 2. Prepare Offering Team Update
  const updatedOfferingTeam = { ...offeringTeam };

  // 2a. Remove from offerSheets (by id OR dedupKey for robustness)
  updatedOfferingTeam.offerSheets = offerSheets.filter(
    (os) => os.id !== offerSheetId && (!dedupKey || os.dedupKey !== dedupKey)
  );

  // 2b. Add player to roster with contract terms
  // Find or create player entry
  const playerId = offerSheet.playerId;
  let playerIndex = (updatedOfferingTeam.players || []).findIndex(
    (p) => (p.player_id || p.id) === playerId
  );

  // Construct new contract from offer sheet
  const newContract = {
    contractType: 'Standard',
    signedUsing: 'Offer Sheet',
    signingTeam: teamCode,
    contractLength: offerSheet.contractYears,
    salariesByYear: offerSheet.salariesByYear.map((s) => ({
      season: s.season,
      salary: s.salary,
      capHit: s.capHit,
      guaranteed: s.guaranteed,
    })),
  };

  if (playerIndex !== -1) {
    // Update existing player's contract
    const updatedPlayer = {
      ...updatedOfferingTeam.players[playerIndex],
      contract: newContract,
      teamCode,
    };
    updatedOfferingTeam.players = [
      ...updatedOfferingTeam.players.slice(0, playerIndex),
      updatedPlayer,
      ...updatedOfferingTeam.players.slice(playerIndex + 1),
    ];
  } else {
    // Create new player entry
    const newPlayer = {
      player_id: playerId,
      id: playerId,
      name: offerSheet.playerName,
      displayName: offerSheet.playerName,
      contract: newContract,
      teamCode,
    };
    updatedOfferingTeam.players = [
      ...(updatedOfferingTeam.players || []),
      newPlayer,
    ];
  }

  // Update roster
  if (!updatedOfferingTeam.roster?.includes(playerId)) {
    updatedOfferingTeam.roster = [
      ...(updatedOfferingTeam.roster || []),
      playerId,
    ];
  }

  // Recalculate totals
  updatedOfferingTeam.totals = computeTeamCapTotals(
    updatedOfferingTeam,
    toEndYear(seasonId)
  );

  updatedOfferingTeam.source = {
    ...updatedOfferingTeam.source,
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  // 3. Prepare Home Team Update (cleanup only)
  const updatedHomeTeam = { ...homeTeam };

  // 3a. Remove from incomingOfferSheets (by id OR dedupKey for robustness)
  updatedHomeTeam.incomingOfferSheets = (
    updatedHomeTeam.incomingOfferSheets || []
  ).filter(
    (os) => os.id !== offerSheetId && (!dedupKey || os.dedupKey !== dedupKey)
  );

  // 3b. Remove player from roster if present (they're leaving)
  if (updatedHomeTeam.roster?.includes(playerId)) {
    updatedHomeTeam.roster = updatedHomeTeam.roster.filter(
      (id) => id !== playerId
    );
  }

  // 3c. Remove player from players array if present
  if (
    updatedHomeTeam.players?.some((p) => (p.player_id || p.id) === playerId)
  ) {
    updatedHomeTeam.players = updatedHomeTeam.players.filter(
      (p) => (p.player_id || p.id) !== playerId
    );
  }

  // Recalculate home team totals
  updatedHomeTeam.totals = computeTeamCapTotals(
    updatedHomeTeam,
    toEndYear(seasonId)
  );

  updatedHomeTeam.source = {
    ...updatedHomeTeam.source,
    type: 'world-snapshot',
    lastModifiedAt: new Date(timestamp).toISOString(),
  };

  return {
    success: true,
    teamUpdates: [
      { teamCode: offeringTeam.teamCode, team: updatedOfferingTeam },
      { teamCode: homeTeam.teamCode, team: updatedHomeTeam },
    ],
    metadata: {
      type: 'finalizeDeclinedOfferSheet',
      offerSheetId,
      playerId,
      offeringTeam: offeringTeam.teamCode,
      homeTeam: homeTeam.teamCode,
      timestamp,
    },
  };
}

/**
 * Compute Sign and Trade result.
 *
 * 1. Signs player to Source Team.
 * 2. Trades player to Destination Team.
 */
function computeSignAndTradeResult({
  payload,
  currentState,
  seasonId,
  timestamp,
  worldId,
  historyContext = {},
}) {
  const { team, destinationTeam, player } = currentState;
  const { teamCode, destinationTeamCode } = payload;

  // 1. Compute Signing Result
  const signingPayload = {
    teamCode,
    playerId: payload.playerId,
    contract: payload.contract,
    signedUsing: payload.signedUsing,
  };

  const signingState = { team, player, teamCode };
  const signingResult = computeSigningResult({
    payload: signingPayload,
    currentState: signingState,
    seasonId,
    timestamp,
  });

  if (!signingResult.success) {
    return {
      success: false,
      error: signingResult.error || 'Signing step failed',
    };
  }

  // Phase 48: Validate signing BEFORE proceeding to trade computation
  // This ensures signing validation failure short-circuits before validateTrade is called
  const currentYear = toEndYear(seasonId);
  const signingValidation = validateSigning({
    team,
    player,
    contract: payload.contract,
    signedUsing: payload.signedUsing,
    year: currentYear,
  });

  if (!signingValidation.valid) {
    return {
      success: false,
      error:
        signingValidation.violations?.[0]?.message ||
        'Signing validation failed',
      violations: signingValidation.violations,
      warnings: signingValidation.warnings,
    };
  }

  // Extract updated source team and player (now signed) from signing result
  const updatedSourceTeam = signingResult.teamUpdates[0].team;
  const signedPlayer = signingResult.playerUpdates[0].player;

  // 2. Construct trade payload and state (using post-signing state per Phase 48)
  const tradePayload = {
    teams: [
      {
        teamCode: teamCode,
        sends: [
          {
            ...signedPlayer, // Send the fully signed player object with new contract
            receivingTeamId: destinationTeamCode,
            receivingTeamIndex: 1,
          },
        ],
      },
      {
        teamCode: destinationTeamCode,
        sends: [],
      },
    ],
  };

  // Construct trade state (Source has signed player, Dest is original)
  const tradeState = {
    teams: [
      { teamCode, team: updatedSourceTeam },
      { teamCode: destinationTeamCode, team: destinationTeam },
    ],
  };

  // Phase 56: Build snapshot → validate snapshot → compute with context
  // Step 1: Build post-trade snapshot from post-signing state
  const postTradeSnapshot = buildPostTradeTeamsSnapshot({
    payload: tradePayload,
    currentState: tradeState,
    seasonId,
    timestamp,
  });

  // Step 2: Validate the post-trade snapshot ONCE
  const tradeValidatedContext = validatePostTradeSnapshotForContext({
    snapshot: postTradeSnapshot,
    payload: tradePayload,
    seasonId,
  });

  // Step 3: Call pure computeTradeResult with pre-validated context
  const tradeResult = computeTradeResult({
    payload: tradePayload,
    currentState: tradeState,
    seasonId,
    timestamp,
    historyContext: {
      worldId: historyContext.worldId || worldId,
      mutationType: historyContext.mutationType || 'signAndTrade',
      mutationId: historyContext.mutationId,
    },
    postTradeSnapshot,
    validatedContext: tradeValidatedContext,
  });

  if (!tradeResult.success) {
    return { success: false, error: tradeResult.error || 'Trade step failed' };
  }

  // 3. Return Combined Result
  // Phase 56: Attach validated contexts for validateMutation de-duplication
  return {
    success: true,
    teamUpdates: tradeResult.teamUpdates, // Contains both Source (minus player) and Dest (plus player)
    playerUpdates: tradeResult.playerUpdates, // Player with new teamCode
    metadata: {
      type: 'signAndTrade',
      sourceTeam: teamCode,
      destinationTeam: destinationTeamCode,
      playerId: payload.playerId,
      contract: payload.contract,
      timestamp,
    },
    // Phase 56: Attach validated contexts for validateMutation de-duplication
    _signingValidation: signingValidation,
    _validatedTradeContext: tradeValidatedContext,
  };
}

// ==============================================================================
// HELPER FUNCTIONS
// ==============================================================================

/**
 * Map mutation type to action type for stats tracking
 */
function getMutationActionType(mutationType) {
  switch (mutationType) {
    case 'executeTrade':
      return 'trade';
    case 'signFreeAgent':
      return 'signing';
    case 'waivePlayer':
      return 'waive';
    case 'extendPlayer':
      return 'signing';
    case 'optionDecision':
      return 'signing';
    case 'renounceRights':
      return 'renounce';
    case 'storeOfferSheet':
    case 'matchOfferSheet':
    case 'declineOfferSheet':
    case 'finalizeMatchedOfferSheet':
    case 'finalizeDeclinedOfferSheet':
    case 'signAndTrade':
      return 'signing';
    default:
      return 'unknown';
  }
}

/**
 * Compute set dead cap result
 */
function computeSetDeadCapResult({
  payload,
  currentState,
  seasonId,
  timestamp,
}) {
  const { teamCode } = payload;
  const { team } = currentState;

  if (!payload.deadCap || !Array.isArray(payload.deadCap)) {
    return {
      success: false,
      error: 'Invalid deadCap payload: must be an array',
    };
  }

  // Update deadCap
  const updatedTeam = {
    ...team,
    deadCap: payload.deadCap,
    // Add logic to clean up legacy fields if we want to force migration?
    // For now, let's keep it simple: new schema takes precedence in computation anyway.
  };

  return {
    success: true,
    teamUpdates: [{ teamCode, team: updatedTeam }],
    playerUpdates: [],
    metadata: {
      actionType: 'setDeadCap',
      timestamp,
    },
  };
}
