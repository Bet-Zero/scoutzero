/**
 * FILE: src/features/architect/utils/persistenceContracts/contracts.js
 * PURPOSE: Persistence contracts (allowlists) defining which fields may be written to Firestore.
 * OWNERSHIP: Feature: architect/core
 *
 * HISTORY:
 *  - 2026-01-30: Phase 61 - Created for allowlist-based persistence contract enforcement
 *  - 2026-01-30: Phase 62 - Added deep rules for deadCap[], capHolds[], and nested amountByYear[]
 *  - 2026-01-30: Phase 64 - Removed tradeExceptions from allowlists (TPE schema canonicalization)
 *
 * LINKS:
 *  - Master Doc: docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
 *  - Contracts Doc: docs/architect/contracts/PERSISTENCE_CONTRACTS.md
 *  - Zod Schemas: src/schemas/architect.ts
 *
 * DESIGN:
 * These are PERSISTENCE CONTRACTS - they define what fields are allowed to be written
 * to Firestore, NOT the full runtime UI model. This is a different concern from Phase 60
 * transient field sanitization (which removes known debugging keys).
 *
 * Purpose: Prevent schema drift by catching unknown/debug/accidental fields before
 * they creep into Firestore world data over time.
 *
 * Scope (Phase 61):
 * - Top-level keys only for team/player/event docs
 * - Plus two critical nested allowlists: tradeExceptions[] items, exceptionHistory[] items
 *
 * Scope (Phase 62):
 * - Added deep rules for deadCap[] and capHolds[] items
 * - Added nested deep rule for deadCap[].amountByYear[] items (3-level nesting)
 *
 * NOTE: These lists should be kept minimal. When adding new persisted fields,
 * update the appropriate allowlist here AND document the change.
 */

// ==============================================================================
// TEAM OVERLAY PERSISTENCE CONTRACT
// ==============================================================================
// Doc path: architect_worlds/{worldId}/teams/{teamCode}
// Reference: BaseTeamDocZ / WorldTeamSnapshotZ in src/schemas/architect.ts

/**
 * Top-level keys allowed on team overlay documents.
 * Any key not in this list will trigger a contract violation in test environments.
 */
export const TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST = Object.freeze([
  // Identity
  'teamCode',
  'teamName',
  'abbreviation',
  'city',
  'conference',
  'division',
  'season',

  // Core roster data
  'roster', // Array of player IDs
  'players', // Phase 63: Array of full player objects (used by mutation pipeline)

  // Financial structures
  'deadCap', // Array of DeadCapItemZ
  'capHolds', // Array of CapHoldItemZ
  'exceptions', // ExceptionsZ object (contains mle, bae, tpe[], etc.)
  // Phase 64: 'tradeExceptions' REMOVED from allowlist. Legacy TPE data is now normalized
  // into exceptions.tpe[] via normalizeTeamTpeSchema() before persistence. See Phase 64 docs.
  'exceptionHistory', // Array of history entries (TPE lifecycle tracking)

  // Draft assets
  'draftPicks', // Legacy array (backward compat)
  'draftPicksInventory', // Picks team owns
  'draftPicksObligations', // Picks team owes
  'draftPicksContested', // Swaps/conditionals

  // Entitlements
  'entitlementIds', // Array of entitlement IDs

  // Computed totals (UI display - _meta is separate)
  'totals', // TeamTotalsZ object

  // Metadata
  'source', // ArchitectSourceZ object
  'lastUpdated',
  'version',
  'mergedAt',

  // Phase 60: _meta is intentionally preserved for UI computed totals
  '_meta',

  // Hard cap tracking
  'hardCapLevel',
  'hardCapReason',
  'hardCapTriggeredBy',
  'hardCapped', // Legacy boolean
]);

// ==============================================================================
// TRADE EXCEPTION ITEM PERSISTENCE CONTRACT
// ==============================================================================
// Path: team.exceptions.tpe[] items
// Reference: TradeExceptionZ in src/schemas/architect.ts + runtime shape in mutationPipeline.js

/**
 * Keys allowed on individual trade exception items within exceptions.tpe[].
 */
export const TRADE_EXCEPTION_ITEM_ALLOWLIST = Object.freeze([
  'id',
  'amount', // Runtime: initial amount (used interchangeably with totalAmount)
  'totalAmount', // Max lifetime value
  'usedAmount', // Amount consumed
  'remainingAmount', // Amount still available
  'createdFrom', // Source description (e.g., "Trade with LAL")
  'createdOn', // ISO date string
  'createdSeason', // Season code (e.g., "2025-26")
  'expiresOn', // ISO date string
  'isUsed', // Boolean: fully consumed
  'notes', // Optional notes
]);

// ==============================================================================
// EXCEPTION HISTORY ITEM PERSISTENCE CONTRACT
// ==============================================================================
// Path: team.exceptionHistory[] items
// Reference: historyHelpers.js createTpe*HistoryEntry functions

/**
 * Keys allowed on individual exception history entries.
 * Covers TPE_CREATED, TPE_CONSUMED, and TPE_EXPIRED entry types.
 */
export const EXCEPTION_HISTORY_ITEM_ALLOWLIST = Object.freeze([
  // Common fields (all entry types)
  'historyKey', // Deterministic dedup key
  'type', // TPE_CREATED | TPE_CONSUMED | TPE_EXPIRED
  'teamCode',
  'tpeId',
  'timestamp', // ISO timestamp
  'seasonId', // Season code
  'seasonYear', // End year number

  // Optional context fields
  'worldId', // World context (if not global)
  'mutationId', // Mutation reference

  // TPE_CREATED specific
  'amountCreated',
  'createdFrom',
  'createdSeason',
  'expiresOn',

  // TPE_CONSUMED specific
  'amountConsumed',
  'remainingAmountAfter',
  'fullyConsumed',
  'absorbedPlayers', // Array of { playerId, name, amountAbsorbed }

  // TPE_EXPIRED specific
  'amountExpired',
  'totalAmount',
  'toSeason', // Target season after expiry
]);

// ==============================================================================
// DEAD CAP ITEM PERSISTENCE CONTRACT
// ==============================================================================
// Path: team.deadCap[] items
// Reference: DeadCapItemZ in src/schemas/architect.ts

/**
 * Keys allowed on individual dead cap items within deadCap[].
 * Phase 62: Added for deep validation of dead cap entries.
 */
export const DEAD_CAP_ITEM_ALLOWLIST = Object.freeze([
  'playerId',
  'playerName',
  'originalSalary',
  'amountByYear', // Array of year-by-year amounts (nested deep rule)
  'waiveDate',
  'notes',
]);

/**
 * Keys allowed on individual amountByYear items within deadCap[].amountByYear[].
 * Phase 62: 3-level nesting support for dead cap year breakdown.
 */
export const DEAD_CAP_AMOUNT_BY_YEAR_ITEM_ALLOWLIST = Object.freeze([
  'season',
  'amount',
  'isStretched',
]);

// ==============================================================================
// CAP HOLD ITEM PERSISTENCE CONTRACT
// ==============================================================================
// Path: team.capHolds[] items
// Reference: CapHoldItemZ in src/schemas/architect.ts

/**
 * Keys allowed on individual cap hold items within capHolds[].
 * Phase 62: Added for deep validation of cap hold entries.
 */
export const CAP_HOLD_ITEM_ALLOWLIST = Object.freeze([
  'playerId',
  'playerName',
  'amount',
  'type',
  'season',
  'isSigned',
  'expiresOn',
  'notes',
  // CAP_SHEET_E2E_SSOT_PARITY_E1: Added fields produced by resolveOffseasonTransition
  // and consumed by getActiveUnsignedCapHolds (capHolds.ts:55)
  'active', // Boolean flag for cap hold filtering
  'reason', // Informational field for cap hold origin
]);

// ==============================================================================
// PLAYER OVERRIDE PERSISTENCE CONTRACT
// ==============================================================================
// Doc path: architect_worlds/{worldId}/teams/{teamCode}/players/{playerId}
// Reference: BasePlayerDocZ in src/schemas/architect.ts

/**
 * Top-level keys allowed on player override documents.
 */
export const PLAYER_OVERRIDE_TOP_LEVEL_ALLOWLIST = Object.freeze([
  // Identity
  'playerId',
  'displayName',
  'teamCode',
  'teamName',

  // Player bio
  'bio', // Nested object (position, age, etc.)

  // Contract data
  'contract', // BasePlayerContractZ object
  'futureContract', // Optional future contract

  // Representation
  'representation', // Agent/agency info

  // Metadata
  'source', // Provider info
  'lastUpdated',
  'version',

  // RFA/Signing context (Phase 18+)
  'rfaOfferSheet',
  'rfaOfferSheetOnly',
  'rfaContext',
]);

// ==============================================================================
// EVENT PERSISTENCE CONTRACT
// ==============================================================================
// Doc path: architect_worlds/{worldId}/events/{eventId}
// Reference: persistWorldMutation() event construction in mutationPipeline.js

/**
 * Top-level keys allowed on event log documents.
 */
export const EVENT_TOP_LEVEL_ALLOWLIST = Object.freeze([
  // Legacy envelope fields (backward compatibility)
  'eventId',
  'id',
  'type', // Mutation type (e.g., 'executeTrade', 'signFreeAgent')
  'timestamp', // ISO timestamp
  'seasonId', // Season code
  'metadata', // Nested object with type-specific data
  'teamsAffected', // Array of team codes

  // CapAuditEventV1 envelope fields
  'schemaVersion',
  'validatorVersion',
  'operationId',
  'mutationType',
  'occurredAt',
  'worldId',
  'teamCodes',
  'playerIds',
  'beforeTotalsByTeam',
  'afterTotalsByTeam',
  'valid',
  'violations',
  'warnings',
  'diffSummary',
  'mutationMetadata',
]);

/**
 * Keys allowed on event.metadata for different mutation types.
 * This is a union of all allowed metadata fields across mutation types.
 */
export const EVENT_METADATA_TOP_LEVEL_ALLOWLIST = Object.freeze([
  // Common
  'type', // Mutation type echo
  'timestamp', // ISO timestamp
  'summary',
  'actionType',
  'dedupKey',

  // Trade events
  'teamsInvolved', // Array of team codes
  'playersTraded', // Array of player info objects
  'entitlementsTraded', // Object with team-keyed entitlement changes
  'picksTraded', // Array of pick info objects

  // Sign-and-Trade events (Phase 63)
  'sourceTeam', // Origin team code
  'destinationTeam', // Receiving team code
  'contract', // Signed contract details object

  // Offer sheet workflow events
  'offeringTeamCode',
  'homeTeamCode',
  'offerSheetId',
  'offeringTeam',
  'homeTeam',

  // Signing events
  'playerId',
  'playerName',
  'signingTeam',
  'contractValue',
  'contractYears',
  'signedUsing', // Exception type used

  // Waive/Release events
  'waivedPlayer',
  'stretchProvision',
  'stretched',
  'buyout',
  'buyoutAmount',
  'stretchYears',
  'deadCapAmount',

  // Option events
  'optionType',
  'optionDecision',
  'accepted',
  'targetYear',
  'effectiveSeason',

  // Extension events
  'extensionType',
  'extensionYears',
  'extensionTerms',

  // Renounce events
  'renouncedPlayer',
  'capHoldRemoved',
  'teamCode', // Team renouncing the player's rights
  'rightsUsed',

  // Cap admin details
  'exceptionChanges',
  'deadCapChanges',

  // Season advance events
  'fromSeason',
  'toSeason',
  'expiredExceptions',
  'advancedPlayers',

  // Draft events
  'draftYear',
  'draftRound',
  'draftPick',
  'selectedPlayer',

  // General
  'notes',
  'reason',
]);

// ==============================================================================
// DEEP RULES CONFIGURATION
// ==============================================================================

/**
 * Configuration for nested array validation.
 * Maps parent key paths to their item allowlists.
 *
 * Used by validatePersistableShape to apply allowlists to array item contents.
 *
 * Path formats:
 * - Direct key: 'exceptionHistory' → validates team.exceptionHistory[] items
 * - Nested path: 'exceptions.tpe' → validates team.exceptions.tpe[] items
 * - 3-level nested: 'deadCap.amountByYear' → validates team.deadCap[].amountByYear[] items
 */
export const TEAM_DEEP_RULES = Object.freeze({
  // Phase 61: Trade exception lifecycle arrays
  // Phase 64: ONLY exceptions.tpe is canonical. tradeExceptions is legacy read-only.
  // Legacy tradeExceptions is normalized into exceptions.tpe via normalizeTeamTpeSchema()
  // before persistence, so no deep rule is needed for tradeExceptions.
  'exceptions.tpe': TRADE_EXCEPTION_ITEM_ALLOWLIST,
  exceptionHistory: EXCEPTION_HISTORY_ITEM_ALLOWLIST,

  // Phase 62: Dead cap and cap hold arrays
  deadCap: DEAD_CAP_ITEM_ALLOWLIST,
  'deadCap.amountByYear': DEAD_CAP_AMOUNT_BY_YEAR_ITEM_ALLOWLIST,
  capHolds: CAP_HOLD_ITEM_ALLOWLIST,
});

/**
 * Mapping of document types to their contracts for easy lookup.
 */
export const PERSISTENCE_CONTRACTS = Object.freeze({
  TEAM: {
    topLevel: TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST,
    deepRules: TEAM_DEEP_RULES,
  },
  PLAYER: {
    topLevel: PLAYER_OVERRIDE_TOP_LEVEL_ALLOWLIST,
    deepRules: null,
  },
  EVENT: {
    topLevel: EVENT_TOP_LEVEL_ALLOWLIST,
    deepRules: null,
  },
  EVENT_METADATA: {
    topLevel: EVENT_METADATA_TOP_LEVEL_ALLOWLIST,
    deepRules: null,
  },
});
