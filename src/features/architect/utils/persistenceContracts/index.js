/**
 * FILE: src/features/architect/utils/persistenceContracts/index.js
 * PURPOSE: Public API surface for persistence contract enforcement.
 * OWNERSHIP: Feature: architect/core
 *
 * HISTORY:
 *  - 2026-03-20: E123 - Retired same-path persistence-contract shim hosts; barrel now resolves extensionless authorities
 *  - 2026-01-30: Phase 61 - Created for allowlist-based persistence contract enforcement
 *  - 2026-01-30: Phase 62 - Added exports for deadCap, capHolds, and amountByYear allowlists
 *  - 2026-01-30: Phase 64 - Added normalizeTeamTpeSchema and getTeamTpeList for TPE canonicalization
 *
 * LINKS:
 *  - Master Doc: docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
 *  - Contracts Doc: docs/architect/contracts/PERSISTENCE_CONTRACTS.md
 *
 * USAGE:
 *   import {
 *     assertPersistableOrThrow,
 *     shouldEnforcePersistenceContracts,
 *     PERSISTENCE_CONTRACTS,
 *   } from '@/features/architect/utils/persistenceContracts';
 *
 *   // At persistence boundary:
 *   assertPersistableOrThrow({
 *     obj: teamSnapshot,
 *     contract: PERSISTENCE_CONTRACTS.TEAM,
 *     label: 'TEAM',
 *   });
 */

// Contracts (allowlists)
export {
  TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST,
  TRADE_EXCEPTION_ITEM_ALLOWLIST,
  EXCEPTION_HISTORY_ITEM_ALLOWLIST,
  DEAD_CAP_ITEM_ALLOWLIST,
  DEAD_CAP_AMOUNT_BY_YEAR_ITEM_ALLOWLIST,
  CAP_HOLD_ITEM_ALLOWLIST,
  PLAYER_OVERRIDE_TOP_LEVEL_ALLOWLIST,
  EVENT_TOP_LEVEL_ALLOWLIST,
  EVENT_METADATA_TOP_LEVEL_ALLOWLIST,
  TEAM_DEEP_RULES,
  PERSISTENCE_CONTRACTS,
} from './contracts';

// Validation functions
export {
  findDisallowedKeyPaths,
  validatePersistableShape,
  formatViolationMessage,
} from './validatePersistableShape';

// Enforcement functions
export {
  shouldEnforcePersistenceContracts,
  assertPersistableOrThrow,
  checkPersistableContract,
} from './enforcement';

// Phase 64: TPE schema normalization (canonical persistence helpers)
export {
  normalizeTeamTpeSchema,
  getTeamTpeList,
  getTpeIdentityKey,
} from './normalizeTeamTpe';
