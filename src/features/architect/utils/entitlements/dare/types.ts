/**
 * FILE: src/features/architect/utils/entitlements/dare/types.ts
 * PURPOSE: Type definitions for Draft Asset Resolution Engine (DARE)
 * OWNERSHIP: Feature: architect/entitlements
 *
 * HISTORY:
 *  - 2026-02-03: Created for Draft Asset Terms + Lifecycle Closure (B2/B3)
 *
 * LINKS:
 *  - Audit: docs/architect/DRAFT_ASSET_TERMS_AND_LIFECYCLE_COMPLETION_AUDIT.md
 */

import type { EffectiveEntitlement } from '../entitlementResolver';
import type { PickRuleDoc } from '../pickRulesResolver';

// =============================================================================
// INPUT TYPES
// =============================================================================

/**
 * Main input for DARE resolution.
 */
export interface DAREInput {
  /** World ID for scoped writes */
  worldId: string;
  /** Draft year to resolve (e.g., 2026) */
  draftYear: number;
  /** Map of team codes to draft positions (1-60) */
  positionsMap: Record<string, number>;
  /** All 30 teams with their entitlement inventories */
  teams: DARETeamInput[];
  /** ISO timestamp (defaults to now) */
  nowIso?: string;
  /** Resolution method for audit trail */
  method?: 'lottery' | 'season_advance' | 'manual';
  /** Optional: pre-resolved entitlements by team (avoids re-fetch) */
  entitlementsByTeam?: Map<string, EffectiveEntitlement[]>;
  /** Optional: pre-resolved pick rules */
  pickRulesById?: Record<string, PickRuleDoc>;
}

/**
 * Per-team input for DARE.
 */
export interface DARETeamInput {
  teamCode: string;
  entitlementIds: string[];
  /** Optional: pre-resolved entitlements for this team */
  entitlements?: EffectiveEntitlement[];
}

// =============================================================================
// OUTPUT TYPES
// =============================================================================

/**
 * Main output from DARE resolution.
 */
export interface DAREOutput {
  success: boolean;
  error?: string;

  /** Per-team entitlement ID updates (new inventories) */
  teamEntitlementIdUpdates: DARETeamUpdate[];

  /** World-scoped entitlement document writes */
  entitlementDocWrites: DAREEntitlementWrite[];

  /** Human-readable resolution summary */
  resolutionReceipt: DAREResolutionReceipt;

  /** Audit metadata */
  meta: DAREMeta;
}

/**
 * Per-team entitlement inventory update.
 */
export interface DARETeamUpdate {
  teamCode: string;
  /** Full post-resolution entitlement ID list */
  entitlementIds: string[];
  /** IDs added during this resolution */
  addedIds: string[];
  /** IDs removed during this resolution */
  removedIds: string[];
}

/**
 * Single entitlement document write operation.
 */
export interface DAREEntitlementWrite {
  action: 'upsert' | 'delete';
  entitlementId: string;
  /** Full Firestore path */
  path: string;
  /** Document data for upserts */
  document?: Partial<EffectiveEntitlement>;
  /** Human-readable reason for this write */
  reason: string;
}

// =============================================================================
// RESOLUTION OUTCOME TYPES
// =============================================================================

/**
 * Possible outcomes when resolving an entitlement.
 */
export type EntitlementResolutionOutcome =
  | 'conveyed' // Pick conveyed to receiving team (protection didn't trigger)
  | 'rolled' // Protection triggered, rolled to next year
  | 'converted' // Protection triggered, converted to different asset
  | 'swap_resolved' // Swap determined winner
  | 'expired' // Final year reached, must convey
  | 'unchanged'; // No resolution needed (missing data, wrong year, etc.)

/**
 * Full resolution result for a single entitlement.
 */
export interface EntitlementResolution {
  entitlementId: string;
  outcome: EntitlementResolutionOutcome;
  year: number;
  position?: number;
  originalOwner: string;
  newOwner?: string;

  /** For rolled entitlements */
  newEntitlementId?: string;
  newYear?: number;
  newProtection?: string;

  /** For converted entitlements */
  convertedToRound?: number;

  /** For swaps */
  swapWinner?: string;
  swapPosition?: number;
  swapLoser?: string;

  /** For pool swaps (Phase 17.4) */
  loserTeams?: string[];
  positionsCompared?: Record<string, number>;
  poolCandidates?: string[];

  /** For cycle detection (Phase 17.4) */
  cycleNodes?: string[];
  cycleEntitlementIds?: string[];

  /** For conflict resolution (Phase 17.5) */
  conflictWinnerEntitlementId?: string;

  /** For ranked conveyance (Phase 17.5) - which pick was selected from pool */
  selectedPickId?: string;

  /** Audit trail */
  reason: string;
  resolvedAt: string;
  method: string;
}

// =============================================================================
// RECEIPT TYPES
// =============================================================================

/**
 * Human-readable resolution summary.
 */
export interface DAREResolutionReceipt {
  draftYear: number;
  resolvedAt: string;
  totalResolutions: number;

  /** Count by outcome type */
  byOutcome: Record<EntitlementResolutionOutcome, number>;

  /** Detailed entries */
  entries: DAREReceiptEntry[];

  /** Warnings encountered */
  warnings: string[];
}

/**
 * Single entry in the resolution receipt.
 */
export interface DAREReceiptEntry {
  entitlementId: string;
  teamCode: string;
  description: string;
  outcome: EntitlementResolutionOutcome;
  details: string;
}

// =============================================================================
// METADATA TYPES
// =============================================================================

/**
 * Audit metadata for DARE execution.
 */
export interface DAREMeta {
  executedAt: string;
  draftYear: number;
  method: string;
  teamsProcessed: number;
  entitlementsProcessed: number;
  writeCount: number;
}

// =============================================================================
// PROTECTION LADDER TYPES (TASK 2 / B4)
// =============================================================================

/**
 * Single tier in a protection ladder.
 */
export interface ProtectionLadderTier {
  /** Year this tier applies to */
  year: number;
  /** Protection condition (e.g., "Top 3", "Lottery", "Unprotected") */
  condition: string;
  /** What happens if protection triggers */
  ifTriggered: 'roll' | 'convert' | 'cancel';
  /** Year to roll to (if ifTriggered === 'roll') */
  rollToYear?: number;
  /** Round to convert to (if ifTriggered === 'convert') */
  convertToRound?: number;
  /** Source reference for audit */
  source?: string;
}

/**
 * Full protection ladder (array of tiers).
 */
export type ProtectionLadder = ProtectionLadderTier[];

// =============================================================================
// ENTITLEMENT DOCUMENT SHAPE (for world writes)
// =============================================================================

/**
 * Shape of a resolved entitlement document.
 * Extends base entitlement with resolution fields.
 */
export interface ResolvedEntitlementDoc {
  // Core fields (from base)
  id: string;
  holderTeam: string;
  seasonYear: number;
  round: number;
  kind: 'pick_ownership' | 'swap_right' | 'conveyance_right';
  underlyingPickId?: string;
  description?: string;
  underlyingStatus?: string;

  // Resolution fields (added by DARE)
  resolved?: boolean;
  resolvedAt?: string;
  resolvedOutcome?: EntitlementResolutionOutcome;
  resolvedPosition?: number;

  // Swap-specific resolution
  swapWinner?: string;
  swapPosition?: number;

  // Conveyance-specific resolution
  rolledToEntitlementId?: string;
  rolledFromEntitlementId?: string;
  rolledFromYear?: number;
  convertedToEntitlementId?: string;
  convertedFromEntitlementId?: string;
  convertedFromRound?: number;

  // Audit fields
  createdAt?: string;
  createdReason?: string;
  protection?: string;
}

// =============================================================================
// HELPER TYPE GUARDS
// =============================================================================

/**
 * Type guard: Check if entitlement is a pick_ownership.
 */
export function isPickOwnership(
  ent: EffectiveEntitlement
): ent is EffectiveEntitlement & { kind: 'pick_ownership' } {
  return ent?.kind === 'pick_ownership';
}

/**
 * Type guard: Check if entitlement is a swap_right.
 */
export function isSwapRight(
  ent: EffectiveEntitlement
): ent is EffectiveEntitlement & { kind: 'swap_right' } {
  return ent?.kind === 'swap_right';
}

/**
 * Type guard: Check if entitlement is a conveyance_right.
 */
export function isConveyanceRight(
  ent: EffectiveEntitlement
): ent is EffectiveEntitlement & { kind: 'conveyance_right' } {
  return ent?.kind === 'conveyance_right';
}
