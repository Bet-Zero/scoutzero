/**
 * FILE: src/features/architect/utils/persistenceContracts/enforcement.js
 * PURPOSE: Enforcement logic for persistence contracts (test-on, production-off).
 * OWNERSHIP: Feature: architect/core
 *
 * HISTORY:
 *  - 2026-01-30: Phase 61 - Created for allowlist-based persistence contract enforcement
 *
 * LINKS:
 *  - Validator: src/features/architect/utils/persistenceContracts/validatePersistableShape.js
 *  - Contracts: src/features/architect/utils/persistenceContracts/contracts.js
 *  - Master Doc: docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
 *
 * DESIGN:
 * - Enforcement is ENABLED by default in test environments (NODE_ENV=test)
 * - Enforcement is DISABLED by default in production builds
 * - Can be explicitly enabled via ENFORCE_PERSIST_CONTRACTS=true env var
 *
 * This ensures contract violations are caught in CI/testing but don't break production.
 */

import {
  validatePersistableShape,
  formatViolationMessage,
} from './validatePersistableShape.js';

/**
 * Determine if persistence contract enforcement is enabled.
 *
 * Rules:
 * 1. If NODE_ENV === 'test' → true (always enforce in test env)
 * 2. If ENFORCE_PERSIST_CONTRACTS === 'true' → true (explicit override)
 * 3. Otherwise → false (disabled in production)
 *
 * @returns {boolean} Whether enforcement is enabled
 */
export function shouldEnforcePersistenceContracts() {
  // Check NODE_ENV first (works in Jest/Vitest/Node)
  // eslint-disable-next-line no-undef
  if (typeof process !== 'undefined' && process.env) {
    // eslint-disable-next-line no-undef
    if (process.env.NODE_ENV === 'test') {
      return true;
    }
    // eslint-disable-next-line no-undef
    if (process.env.ENFORCE_PERSIST_CONTRACTS === 'true') {
      return true;
    }
  }

  // Check Vite's import.meta.env (works in browser/Vite builds)
  // This is a fallback for Vite environments where process.env may not be defined
  try {
    // @ts-ignore - import.meta.env may not exist in all environments
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      if (import.meta.env.MODE === 'test') {
        return true;
      }
      // @ts-ignore
      if (import.meta.env.VITE_ENFORCE_PERSIST_CONTRACTS === 'true') {
        return true;
      }
    }
  } catch {
    // import.meta not available, continue with defaults
  }

  // Default: disabled in production
  return false;
}

/**
 * Assert that an object conforms to its persistence contract.
 *
 * Behavior:
 * - If enforcement disabled: NO-OP (returns immediately)
 * - If enforcement enabled and violations found: THROWS with actionable error
 *
 * @param {Object} params - Assertion parameters
 * @param {any} params.obj - Object to validate
 * @param {Object} params.contract - Contract from PERSISTENCE_CONTRACTS
 * @param {string[]} params.contract.topLevel - Top-level allowlist
 * @param {Object|null} params.contract.deepRules - Nested path allowlists
 * @param {string} params.label - Document type label (e.g., 'TEAM', 'PLAYER', 'EVENT')
 * @throws {Error} If enforcement is enabled and violations are found
 */
export function assertPersistableOrThrow({ obj, contract, label }) {
  // Skip if enforcement is disabled
  if (!shouldEnforcePersistenceContracts()) {
    return;
  }

  // Skip null/undefined objects (nothing to validate)
  if (obj === null || obj === undefined) {
    return;
  }

  // Validate against contract
  const result = validatePersistableShape({
    obj,
    allowlist: contract.topLevel,
    label,
    deepRules: contract.deepRules,
  });

  // Throw if violations found
  if (!result.valid) {
    const message = formatViolationMessage(result.violations, label);
    throw new Error(message);
  }
}

/**
 * Check an object against a persistence contract without throwing.
 * Useful for debugging or conditional logging.
 *
 * @param {Object} params - Check parameters
 * @param {any} params.obj - Object to validate
 * @param {Object} params.contract - Contract from PERSISTENCE_CONTRACTS
 * @param {string} params.label - Document type label
 * @returns {{ enforced: boolean, valid: boolean, violations: string[] }}
 */
export function checkPersistableContract({ obj, contract, label }) {
  const enforced = shouldEnforcePersistenceContracts();

  if (!enforced || obj === null || obj === undefined) {
    return { enforced, valid: true, violations: [] };
  }

  const result = validatePersistableShape({
    obj,
    allowlist: contract.topLevel,
    label,
    deepRules: contract.deepRules,
  });

  return {
    enforced,
    valid: result.valid,
    violations: result.violations,
  };
}
