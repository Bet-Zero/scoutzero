/**
 * FILE: src/features/architect/utils/exceptions/index.ts
 * PURPOSE: Public API for exception lifecycle module.
 * OWNERSHIP: Feature: architect/cap-sheet
 *
 * HISTORY:
 *  - 2026-03-20: E130 - TS-backed the exception lifecycle barrel and retired index.js
 *  - 2026-02-01: Phase 76 - Created for Exception Lifecycle MVP
 *  - 2026-02-03: Phase 86 - Canonical exception lifecycle updates (mle/tpmle/bae/room + dpe)
 *
 * LINKS:
 *  - Master Doc: docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
 */

export {
  resetTeamNonTpeExceptionsForNewSeason,
  validateNonTpeExceptionsForYear,
  NON_TPE_EXCEPTION_TYPES,
} from './exceptionLifecycle';
export {
  CANONICAL_NON_TPE_EXCEPTION_KEYS,
  buildDerivedExceptionCompatibilityAliases,
  getCanonicalExceptionAvailability,
  getCanonicalExceptionEntry,
  getCanonicalExceptionKeyForSigningMechanism,
  normalizeCanonicalTeamExceptions,
  normalizeTeamExceptionOwnership,
} from './exceptionOwnership';
export type {
  CanonicalNonTpeExceptionAvailability,
  CanonicalNonTpeExceptionKey,
  CanonicalNonTpeExceptionState,
} from './exceptionOwnership';
