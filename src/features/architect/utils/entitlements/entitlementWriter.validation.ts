/**
 * Wave 46 Step 1: Types, validation helpers, and write-payload builder
 * extracted from entitlementWriter.ts (lines 37–438).
 *
 * Exports all public types, EntitlementIdCollisionError, assertNoEntitlementIdCollision,
 * isEntitlementAuthoringEnabled, validateEntitlementDocument, CLEARABLE_FIELDS,
 * and buildWorldEntitlementWritePayload.
 */

import { serverTimestamp, deleteField } from 'firebase/firestore';
import { resolveStoredOrComputedIdentityKey } from './entitlementIdentity';

// =============================================================================
// TYPES
// =============================================================================

export interface WriteEntitlementParams {
  worldId: string;
  entitlementId: string;
  document: Record<string, unknown>;
  userId: string;
}

export interface WriteEntitlementResult {
  success: boolean;
  error?: string;
  errorType?: 'ENTITLEMENT_ID_COLLISION';
  path?: string;
}

export interface AttachEntitlementParams {
  worldId: string;
  teamCode: string;
  entitlementId: string;
  userId: string;
}

export interface WriteEntitlementAndAttachParams
  extends WriteEntitlementParams {
  teamCode?: string;
}

export interface EntitlementIdCollisionDetails {
  worldId: string;
  entitlementId: string;
  existingIdentityKey: string;
  incomingIdentityKey: string;
}

export class EntitlementIdCollisionError extends Error {
  readonly code = 'ENTITLEMENT_ID_COLLISION';

  readonly details: EntitlementIdCollisionDetails;

  constructor(details: EntitlementIdCollisionDetails, contextLabel: string) {
    super(
      `${contextLabel}: ENTITLEMENT_ID_COLLISION for "${details.entitlementId}" in world "${details.worldId}" (existing identityKey "${details.existingIdentityKey}" vs incoming "${details.incomingIdentityKey}").`
    );
    this.name = 'EntitlementIdCollisionError';
    this.details = details;
  }
}

function resolveIdentityKeyForCollision(
  document: Record<string, unknown>,
  contextLabel: string,
  fieldLabel: string
): string {
  const identityKey = resolveStoredOrComputedIdentityKey(document);
  if (!identityKey) {
    throw new Error(
      `${contextLabel}: Cannot resolve ${fieldLabel} identityKey for deterministic collision check.`
    );
  }
  return identityKey;
}

export function assertNoEntitlementIdCollision(params: {
  worldId: string;
  entitlementId: string;
  incomingDocument: Record<string, unknown>;
  existingDocument: Record<string, unknown> | null;
  contextLabel: string;
}): void {
  const {
    worldId,
    entitlementId,
    incomingDocument,
    existingDocument,
    contextLabel,
  } = params;

  if (!existingDocument) {
    return;
  }

  const existingIdentityKey = resolveIdentityKeyForCollision(
    existingDocument,
    contextLabel,
    'existing'
  );
  const incomingIdentityKey = resolveIdentityKeyForCollision(
    incomingDocument,
    contextLabel,
    'incoming'
  );

  if (existingIdentityKey === incomingIdentityKey) {
    return;
  }

  throw new EntitlementIdCollisionError(
    {
      worldId,
      entitlementId,
      existingIdentityKey,
      incomingIdentityKey,
    },
    contextLabel
  );
}

/**
 * Minimal entitlement document schema for validation.
 */
export interface MinimalEntitlementDoc {
  id?: string;
  holderTeam?: string;
  seasonYear?: number;
  round?: number;
  kind?: 'pick_ownership' | 'swap_right' | 'conveyance_right';
  underlyingPickId?: string;
  description?: string;
  underlyingStatus?: 'pooled' | 'encumbered' | 'clean';
  swapControllerPickId?: string;
  swapTargetDefinition?: string;
  poolUnderlyingPickIds?: string[];
  receivesRank?: number[];
  receivesComparator?: 'more_favorable' | 'less_favorable' | 'middle';
  protectionLadder?: Array<{
    year?: number;
    condition?: string;
    ifTriggered?: 'roll' | 'convert' | 'cancel';
    rollToYear?: number;
    convertToRound?: number;
  }>;
  // TM-ENTITLEMENTS-ADV-E1: Chained/linked entitlement support
  linkedEntitlementIds?: string[];
  residualOfEntitlementId?: string;
  [key: string]: unknown;
}

// =============================================================================
// FEATURE FLAG CHECK
// =============================================================================

/**
 * Check if entitlement authoring is enabled via feature flag.
 */
export function isEntitlementAuthoringEnabled(): boolean {
  try {
    // Handle both Vite and Node.js environments
    const env =
      typeof import.meta !== 'undefined' && import.meta.env
        ? import.meta.env
        : typeof process !== 'undefined'
          ? process.env
          : {};
    return env.VITE_FEATURE_ENTITLEMENT_AUTHORING === 'true';
  } catch {
    return false;
  }
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate an entitlement document has required fields.
 * Returns validation result with error message if invalid.
 */
export function validateEntitlementDocument(
  document: Record<string, unknown>
): { valid: boolean; error?: string; errors?: string[] } {
  const errors: string[] = [];
  if (!document || typeof document !== 'object') {
    return {
      valid: false,
      error: 'Document must be an object',
      errors: ['Document must be an object'],
    };
  }

  // Required fields
  const requiredFields = ['holderTeam', 'seasonYear', 'round', 'kind'];
  for (const field of requiredFields) {
    if (document[field] === undefined || document[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Validate kind
  const validKinds = ['pick_ownership', 'swap_right', 'conveyance_right'];
  if (!validKinds.includes(document.kind as string)) {
    errors.push(
      `Invalid kind "${document.kind}". Must be one of: ${validKinds.join(', ')}`
    );
  }

  // Validate round
  if (document.round !== 1 && document.round !== 2) {
    errors.push(`Invalid round "${document.round}". Must be 1 or 2`);
  }

  // Validate seasonYear
  const year = document.seasonYear as number;
  if (typeof year !== 'number' || year < 2020 || year > 2040) {
    errors.push(`Invalid seasonYear "${year}". Must be between 2020 and 2040`);
  }

  // Validate holderTeam
  const team = document.holderTeam as string;
  if (typeof team !== 'string' || team.length !== 3) {
    errors.push(`Invalid holderTeam "${team}". Must be 3-letter team code`);
  }

  // Kind-specific requirements
  const kind = document.kind as string;
  if (kind === 'pick_ownership') {
    if (!document.underlyingPickId) {
      errors.push('pick_ownership requires underlyingPickId');
    }
  }

  if (kind === 'swap_right') {
    if (!document.swapControllerPickId) {
      errors.push('swap_right requires swapControllerPickId');
    }
    if (!document.swapTargetDefinition) {
      errors.push('swap_right requires swapTargetDefinition');
    }
  }

  if (kind === 'conveyance_right') {
    const pool = document.poolUnderlyingPickIds as string[] | undefined;
    if (!Array.isArray(pool) || pool.length === 0) {
      errors.push('conveyance_right requires poolUnderlyingPickIds[]');
    }
    const ranks = document.receivesRank as number[] | undefined;
    if (!Array.isArray(ranks) || ranks.length === 0) {
      errors.push('conveyance_right requires receivesRank[]');
    }
    const comparator = document.receivesComparator as string | undefined;
    const validComparators = ['more_favorable', 'less_favorable', 'middle'];
    if (!validComparators.includes(comparator || '')) {
      errors.push(
        `conveyance_right requires receivesComparator (${validComparators.join(', ')})`
      );
    }
  }

  // Optional: underlyingStatus validation
  if (document.underlyingStatus) {
    const validStatuses = ['pooled', 'encumbered', 'clean'];
    if (!validStatuses.includes(document.underlyingStatus as string)) {
      errors.push(
        `Invalid underlyingStatus "${document.underlyingStatus}". Must be one of: ${validStatuses.join(', ')}`
      );
    }
  }

  // Optional: protectionLadder validation
  if (document.protectionLadder !== undefined) {
    if (!Array.isArray(document.protectionLadder)) {
      errors.push('protectionLadder must be an array of tiers');
    } else {
      document.protectionLadder.forEach((tier, index) => {
        if (!tier || typeof tier !== 'object') {
          errors.push(`protectionLadder[${index}] must be an object`);
          return;
        }
        const tierYear = (tier as Record<string, unknown>).year;
        if (typeof tierYear !== 'number' || !Number.isFinite(tierYear)) {
          errors.push(`protectionLadder[${index}].year must be a number`);
        }
        const condition = (tier as Record<string, unknown>).condition;
        if (typeof condition !== 'string' || condition.trim().length === 0) {
          errors.push(`protectionLadder[${index}].condition is required`);
        }
        const ifTriggered = (tier as Record<string, unknown>).ifTriggered;
        const validActions = ['roll', 'convert', 'cancel'];
        if (!validActions.includes(ifTriggered as string)) {
          errors.push(
            `protectionLadder[${index}].ifTriggered must be one of: ${validActions.join(', ')}`
          );
        } else if (ifTriggered === 'roll') {
          const rollToYear = (tier as Record<string, unknown>).rollToYear;
          if (typeof rollToYear !== 'number' || !Number.isFinite(rollToYear)) {
            errors.push(
              `protectionLadder[${index}].rollToYear is required for roll`
            );
          }
        } else if (ifTriggered === 'convert') {
          const convertToRound = (tier as Record<string, unknown>)
            .convertToRound;
          if (convertToRound !== 1 && convertToRound !== 2) {
            errors.push(
              `protectionLadder[${index}].convertToRound must be 1 or 2 for convert`
            );
          }
        }
      });
    }
  }

  // TM-ENTITLEMENTS-ADV-E1: linkedEntitlementIds validation
  if (document.linkedEntitlementIds !== undefined) {
    if (!Array.isArray(document.linkedEntitlementIds)) {
      errors.push('linkedEntitlementIds must be an array of strings');
    } else {
      const docId = document.id as string | undefined;
      const linkedIds = document.linkedEntitlementIds as string[];
      // Check all entries are strings
      const invalidEntries = linkedIds.filter(
        (id) => typeof id !== 'string' || id.trim().length === 0
      );
      if (invalidEntries.length > 0) {
        errors.push('linkedEntitlementIds must contain only non-empty strings');
      }
      // Check for self-reference
      if (docId && linkedIds.includes(docId)) {
        errors.push('linkedEntitlementIds must not include self.id');
      }
      // Check for duplicates
      const uniqueIds = new Set(linkedIds);
      if (uniqueIds.size !== linkedIds.length) {
        errors.push('linkedEntitlementIds must not contain duplicates');
      }
    }
  }

  // TM-ENTITLEMENTS-ADV-E1: residualOfEntitlementId validation
  if (document.residualOfEntitlementId !== undefined) {
    const residualId = document.residualOfEntitlementId;
    if (typeof residualId !== 'string' || residualId.trim().length === 0) {
      errors.push('residualOfEntitlementId must be a non-empty string');
    } else {
      const docId = document.id as string | undefined;
      if (docId && residualId === docId) {
        errors.push('residualOfEntitlementId must not equal self.id');
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, error: errors[0], errors };
  }

  return { valid: true, errors: [] };
}

// =============================================================================
// WRITE PAYLOAD BUILDER
// =============================================================================

/**
 * Fields that are conditionally included in buildEntitlementDocument().
 * When these fields are absent from the document, a merge:true write would
 * leave stale data behind. We explicitly deleteField() for any of these
 * not present in the payload. (BUG #2 fix — TM-ENTITLEMENTS-ADV-E1)
 */
const CLEARABLE_FIELDS = [
  'protectionLadder',
  'poolUnderlyingPickIds',
  'receivesRank',
  'receivesComparator',
  'linkedEntitlementIds',
  'coveredByEntitlementIds',
  'swapType',
  'swapControllerPickId',
  'swapTargetDefinition',
  'residualOfEntitlementId',
  'description',
  'underlyingPickId',
  'underlyingStatus',
] as const;

export function buildWorldEntitlementWritePayload(params: {
  entitlementId: string;
  document: Record<string, unknown>;
  userId: string;
}): Record<string, unknown> {
  const { entitlementId, document, userId } = params;

  return {
    ...document,
    // BUG #2 fix: explicitly delete clearable fields absent from the payload
    // so merge:true doesn't leave stale data behind.
    ...Object.fromEntries(
      CLEARABLE_FIELDS.filter((field) => !(field in document)).map((field) => [
        field,
        deleteField(),
      ])
    ),
    id: entitlementId,
    _lastModifiedAt: serverTimestamp(),
    _lastModifiedBy: userId,
    _authoredManually: true,
    // TM-VACUUM-E3: Ensure vacuum metadata never leaks to Firestore
    __vacuumEdited: deleteField(),
    __vacuumSessionOnly: deleteField(),
  };
}
