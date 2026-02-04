/**
 * FILE: src/features/architect/utils/entitlements/dare/index.ts
 * PURPOSE: Barrel exports for Draft Asset Resolution Engine (DARE)
 * OWNERSHIP: Feature: architect/entitlements
 *
 * HISTORY:
 *  - 2026-02-03: Created for Draft Asset Terms + Lifecycle Closure (B2/B3/B4)
 *
 * LINKS:
 *  - Audit: docs/architect/DRAFT_ASSET_TERMS_AND_LIFECYCLE_COMPLETION_AUDIT.md
 */

// =============================================================================
// CORE RESOLVER
// =============================================================================

export {
  resolveAllDraftAssets,
  resolveTeamDraftAssets,
  validateDAREInput,
} from './dareResolver';

// =============================================================================
// PROTECTION LADDER (B4)
// =============================================================================

export {
  buildProtectionLadder,
  parseProtectionCondition,
  parseProtectionThreshold,
  protectionTriggers,
  getCurrentProtectionTier,
  getNextProtectionTier,
  isFinalProtectionYear,
} from './protectionLadderFactory';

// =============================================================================
// RESOLUTION ADAPTERS
// =============================================================================

export { resolveSwapForEntitlement } from './swapResolutionAdapter';

export {
  resolveConveyanceForEntitlement,
  resolveConveyanceForEntitlements,
} from './conveyanceResolutionAdapter';

// =============================================================================
// SWAP GRAPH (Phase 17.4.1)
// =============================================================================

export {
  buildSwapGraph,
  detectSwapCycles,
  getDeterministicSwapOrder,
} from './swapGraph';

export type {
  SwapGraphNode,
  SwapGraphEdge,
  SwapGraph,
  CycleDetectionResult,
} from './swapGraph';

// =============================================================================
// ENTITLEMENT MUTATOR
// =============================================================================

export {
  applyDAREResultsToBatch,
  buildRolledEntitlementDoc,
  buildConvertedEntitlementDoc,
  buildResolvedEntitlementDoc,
  buildEntitlementWritesFromResolution,
  buildTeamUpdatesFromResolutions,
} from './entitlementMutator';

// =============================================================================
// RECEIPT
// =============================================================================

export {
  buildResolutionReceipt,
  resolutionToReceiptEntry,
  formatReceiptAsText,
  formatReceiptAsSummary,
} from './resolutionReceipt';

// =============================================================================
// TYPES
// =============================================================================

export type {
  // Input types
  DAREInput,
  DARETeamInput,
  // Output types
  DAREOutput,
  DARETeamUpdate,
  DAREEntitlementWrite,
  // Resolution types
  EntitlementResolutionOutcome,
  EntitlementResolution,
  // Receipt types
  DAREResolutionReceipt,
  DAREReceiptEntry,
  // Metadata
  DAREMeta,
  // Protection ladder types
  ProtectionLadderTier,
  ProtectionLadder,
  // Document types
  ResolvedEntitlementDoc,
} from './types';

export {
  // Type guards
  isPickOwnership,
  isSwapRight,
  isConveyanceRight,
} from './types';
