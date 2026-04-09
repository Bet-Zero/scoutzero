/**
 * FILE: src/features/architect/utils/persistenceContracts/enforcement.ts
 * PURPOSE: Enforcement logic for persistence contracts (test-on, production-off).
 * OWNERSHIP: Feature: architect/core
 *
 * ARCHITECT OWNERSHIP:
 * - Lower-level persistence hygiene and persistable-shape enforcement authority.
 * - Shared by committed-write authorities such as mutationPipeline.ts and seasonManager.ts.
 * - Not a mutation/apply or season-transition entrypoint on its own.
 *
 * HISTORY:
 *  - 2026-03-20: E123 - Retired same-path .js host imports for persistence contract helpers
 *  - 2026-03-11: Phase E50 - Migrated authoritative implementation to TypeScript
 *  - 2026-01-30: Phase 61 - Created for allowlist-based persistence contract enforcement
 *
 * LINKS:
 *  - Validator: src/features/architect/utils/persistenceContracts/validatePersistableShape.ts
 *  - Contracts: src/features/architect/utils/persistenceContracts/contracts.ts
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
  type PersistableDeepRules,
} from './validatePersistableShape';

type LooseRecord = Record<string, unknown>;

export interface PersistableContractLike {
  topLevel: readonly string[];
  deepRules: PersistableDeepRules | null;
}

export interface PersistableContractAssertionParams {
  obj: unknown;
  contract: PersistableContractLike;
  label: string;
}

export interface PersistableContractCheckResult {
  enforced: boolean;
  valid: boolean;
  violations: string[];
}

interface ImportMetaEnvLike {
  MODE?: string;
  VITE_ENFORCE_PERSIST_CONTRACTS?: string;
}

/**
 * Shared transient-key fence for committed-write persistence paths.
 *
 * These keys are mutation/validation artifacts and must not reach Firestore.
 * The helper lives below mutationPipeline.ts and seasonManager.ts so those two
 * sibling authorities can share one persistence hygiene layer.
 */
export const FORBIDDEN_TRANSIENT_KEYS = Object.freeze([
  '_validatedTradeContext',
  '_signingValidation',
  '_isPostTradeSnapshot',
  '_isValidatedTradeContext',
  '_rawValidation',
]);

export function sanitizeTransientFieldsForPersistence(
  obj: unknown,
  forbiddenKeys: readonly string[] = FORBIDDEN_TRANSIENT_KEYS
): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item: unknown) =>
      sanitizeTransientFieldsForPersistence(item, forbiddenKeys)
    );
  }

  if (typeof obj === 'object') {
    const result: LooseRecord = {};

    for (const [key, value] of Object.entries(obj as LooseRecord)) {
      if (forbiddenKeys.includes(key)) {
        continue;
      }
      result[key] = sanitizeTransientFieldsForPersistence(value, forbiddenKeys);
    }

    return result;
  }

  return obj;
}

/**
 * Determine if persistence contract enforcement is enabled.
 *
 * Rules:
 * 1. If NODE_ENV === 'test' → true (always enforce in test env)
 * 2. If ENFORCE_PERSIST_CONTRACTS === 'true' → true (explicit override)
 * 3. Otherwise → false (disabled in production)
 */
export function shouldEnforcePersistenceContracts(): boolean {
  // Check NODE_ENV first (works in Jest/Vitest/Node)
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.NODE_ENV === 'test') {
      return true;
    }
    if (process.env.ENFORCE_PERSIST_CONTRACTS === 'true') {
      return true;
    }
  }

  // Check Vite's import.meta.env (works in browser/Vite builds)
  // This is a fallback for Vite environments where process.env may not be defined
  try {
    const viteEnv = (import.meta as ImportMeta & { env?: ImportMetaEnvLike }).env;
    if (viteEnv) {
      if (viteEnv.MODE === 'test') {
        return true;
      }
      if (viteEnv.VITE_ENFORCE_PERSIST_CONTRACTS === 'true') {
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
 */
export function assertPersistableOrThrow({
  obj,
  contract,
  label,
}: PersistableContractAssertionParams): void {
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
 */
export function checkPersistableContract({
  obj,
  contract,
  label,
}: PersistableContractAssertionParams): PersistableContractCheckResult {
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
