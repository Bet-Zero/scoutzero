/**
 * FILE: src/features/architect/utils/persistenceContracts/validatePersistableShape.ts
 * PURPOSE: Validate objects against persistence contracts (allowlists) before Firestore writes.
 * OWNERSHIP: Feature: architect/core
 *
 * HISTORY:
 *  - 2026-03-20: E123 - Retired same-path .js contract-host guidance in favor of TS authority paths
 *  - 2026-03-11: Phase E50 - Migrated authoritative implementation to TypeScript
 *  - 2026-01-30: Phase 61 - Created for allowlist-based persistence contract validation
 *  - 2026-01-30: Phase 62 - Extended to support 3-level nesting (e.g., deadCap[].amountByYear[])
 *
 * LINKS:
 *  - Contracts: src/features/architect/utils/persistenceContracts/contracts.ts
 *  - Master Doc: docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
 *
 * DESIGN:
 * This validator reports exact paths of disallowed keys, enabling actionable error messages.
 * It supports shallow top-level validation plus optional deep rules for specific nested arrays.
 *
 * Deep rule path formats:
 * - Direct key: 'exceptionHistory' → validates team.exceptionHistory[] items
 * - Nested path: 'exceptions.tpe' → validates team.exceptions.tpe[] items
 * - 3-level nested: 'deadCap.amountByYear' → validates team.deadCap[].amountByYear[] items
 */

export type PersistableAllowlist = readonly string[];
export type PersistableDeepRules = Record<string, PersistableAllowlist>;

export interface FindDisallowedKeyPathsParams {
  obj: unknown;
  allowlist: PersistableAllowlist;
  pathPrefix?: string;
  deepRules?: PersistableDeepRules | null;
  maxDepth?: number;
}

export interface PersistableShapeValidationParams {
  obj: unknown;
  allowlist: PersistableAllowlist;
  label: string;
  deepRules?: PersistableDeepRules | null;
}

export interface PersistableShapeValidationResult {
  valid: boolean;
  violations: string[];
  label: string;
}

/**
 * Find all key paths in an object that are NOT in the allowlist.
 */
export function findDisallowedKeyPaths({
  obj,
  allowlist,
  pathPrefix = '',
  deepRules = null,
  maxDepth = 10,
}: FindDisallowedKeyPathsParams): string[] {
  const violations: string[] = [];

  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return violations;
  }

  if (maxDepth <= 0) {
    return violations; // Safety: don't recurse infinitely
  }

  const allowSet = new Set(allowlist);

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = pathPrefix ? `${pathPrefix}.${key}` : key;

    // Check if this top-level key is allowed
    if (!allowSet.has(key)) {
      violations.push(currentPath);
      // Don't recurse into disallowed keys - just report the top-level violation
      continue;
    }

    // If we have deep rules for this path, validate nested content
    if (deepRules) {
      // Check for exact path match (e.g., 'exceptionHistory', 'deadCap', 'capHolds')
      const deepAllowlist = deepRules[key];

      // Check for nested path match (e.g., 'exceptions.tpe')
      const nestedPathMatch = Object.keys(deepRules).find((rulePath) => {
        const pathParts = rulePath.split('.');
        if (pathParts.length === 2 && pathParts[0] === key) {
          return true;
        }
        return false;
      });

      // Phase 62: Check for 3-level nested rules (e.g., 'deadCap.amountByYear')
      // These apply to array items within the current array
      const nestedArrayRules: PersistableDeepRules = {};
      for (const rulePath of Object.keys(deepRules)) {
        const pathParts = rulePath.split('.');
        // If rule path is 'deadCap.amountByYear' and current key is 'deadCap',
        // we need to validate amountByYear within each deadCap item
        if (pathParts.length === 2 && pathParts[0] === key) {
          nestedArrayRules[pathParts[1]] = deepRules[rulePath];
        }
      }

      if (deepAllowlist && Array.isArray(value)) {
        // Validate each array item against the deep allowlist
        value.forEach((item, index) => {
          if (item && typeof item === 'object') {
            // Phase 62: Build nested deep rules for this item's nested arrays
            const itemDeepRules =
              Object.keys(nestedArrayRules).length > 0
                ? nestedArrayRules
                : null;

            const itemViolations = findDisallowedKeyPaths({
              obj: item,
              allowlist: deepAllowlist,
              pathPrefix: `${currentPath}[${index}]`,
              deepRules: itemDeepRules,
              maxDepth: maxDepth - 1,
            });
            violations.push(...itemViolations);
          }
        });
      } else if (nestedPathMatch && value && typeof value === 'object') {
        // Handle nested object paths like 'exceptions.tpe'
        const [, nestedKey] = nestedPathMatch.split('.');
        const nestedAllowlist = deepRules[nestedPathMatch];
        const nestedValue = (value as Record<string, unknown>)[nestedKey];

        if (nestedAllowlist && Array.isArray(nestedValue)) {
          nestedValue.forEach((item, index) => {
            if (item && typeof item === 'object') {
              const itemViolations = findDisallowedKeyPaths({
                obj: item,
                allowlist: nestedAllowlist,
                pathPrefix: `${currentPath}.${nestedKey}[${index}]`,
                deepRules: null,
                maxDepth: maxDepth - 1,
              });
              violations.push(...itemViolations);
            }
          });
        }
      }
    }
  }

  return violations;
}

/**
 * Validate an object against a persistence contract.
 */
export function validatePersistableShape({
  obj,
  allowlist,
  label,
  deepRules = null,
}: PersistableShapeValidationParams): PersistableShapeValidationResult {
  const violations = findDisallowedKeyPaths({
    obj,
    allowlist,
    pathPrefix: label.toLowerCase(),
    deepRules,
  });

  return {
    valid: violations.length === 0,
    violations,
    label,
  };
}

/**
 * Format violations into a human-readable error message.
 */
export function formatViolationMessage(
  violations: string[],
  label: string,
  maxShow = 25
): string {
  if (violations.length === 0) {
    return '';
  }

  const shown = violations.slice(0, maxShow);
  const remaining = violations.length - shown.length;

  let message = `[PERSISTENCE CONTRACT VIOLATION] ${label} document has ${violations.length} disallowed field(s):\n`;
  message += shown.map((v) => `  - ${v}`).join('\n');

  if (remaining > 0) {
    message += `\n  ... and ${remaining} more`;
  }

  message += `\n\nTo fix: Update allowlist in src/features/architect/utils/persistenceContracts/contracts.ts if this field is intentional.`;

  return message;
}
