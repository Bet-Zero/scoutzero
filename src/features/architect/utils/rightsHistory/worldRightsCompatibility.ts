/** Clean-break compatibility fence for BZE-273 saved worlds. */

import { RIGHTS_LEDGER_WORLD_VERSION } from '@/schemas/rightsEventLedger';

export type RightsWorldCompatibility =
  | { readonly compatible: true; readonly version: number }
  | { readonly compatible: false; readonly version: null; readonly message: string };

export function resolveRightsWorldCompatibility(
  metadata: unknown
): RightsWorldCompatibility {
  const value =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>).rightsLedgerVersion
      : undefined;
  if (value === RIGHTS_LEDGER_WORLD_VERSION) {
    return Object.freeze({ compatible: true as const, version: value });
  }
  return Object.freeze({
    compatible: false as const,
    version: null,
    message:
      'This Team Plan predates governed rights history. Recreate it to manage free-agent rights.',
  });
}
