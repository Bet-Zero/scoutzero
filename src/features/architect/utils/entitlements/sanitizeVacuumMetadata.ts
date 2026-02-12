/**
 * FILE: src/features/architect/utils/entitlements/sanitizeVacuumMetadata.ts
 * PURPOSE: Strip internal vacuum resolver metadata (__vacuumEdited, __vacuumSessionOnly)
 *          from entitlement documents before they reach payloads, receipts, exports, or writes.
 * OWNERSHIP: Feature: architect/tradeMachine (TM-VACUUM-E3 Sanitization)
 *
 * HISTORY:
 *  - 2026-02-12: Created for TM-VACUUM-E3 — sanitization task.
 */

/** Internal vacuum metadata keys injected by the resolver merge seam */
const VACUUM_METADATA_KEYS = ['__vacuumEdited', '__vacuumSessionOnly'] as const;

/**
 * Remove vacuum resolver metadata from a single entitlement document.
 * Returns a new object (shallow copy) without the __vacuum* keys.
 * Returns the same reference if no vacuum keys are present.
 */
export function sanitizeEntitlement<
  T extends Record<string, unknown> | null | undefined,
>(entitlement: T): T {
  if (!entitlement || typeof entitlement !== 'object') return entitlement;

  const hasVacuumKeys = VACUUM_METADATA_KEYS.some(
    (key) => key in entitlement
  );
  if (!hasVacuumKeys) return entitlement;

  const cleaned = { ...entitlement };
  for (const key of VACUUM_METADATA_KEYS) {
    delete cleaned[key];
  }
  return cleaned as T;
}

/**
 * Remove vacuum resolver metadata from an array of entitlement documents.
 */
export function sanitizeEntitlements<
  T extends Record<string, unknown>,
>(entitlements: T[]): T[] {
  if (!Array.isArray(entitlements)) return entitlements;
  return entitlements.map((ent) => sanitizeEntitlement(ent));
}

/**
 * Check whether a document contains any vacuum metadata keys.
 * Useful for assertions in tests.
 */
export function hasVacuumMetadata(
  doc: Record<string, unknown> | null | undefined
): boolean {
  if (!doc || typeof doc !== 'object') return false;
  return VACUUM_METADATA_KEYS.some((key) => key in doc);
}
