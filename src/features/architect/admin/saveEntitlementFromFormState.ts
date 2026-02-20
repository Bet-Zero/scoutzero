/**
 * FILE: src/features/architect/admin/saveEntitlementFromFormState.ts
 * PURPOSE: Unified save function for entitlement editing — routes vacuum vs world mode.
 *          Both Simple (QuickBuilder) and Advanced (tabbed editor) views call this function.
 * OWNERSHIP: Feature: architect/admin (Entitlement Editor Unification)
 *
 * HISTORY:
 *  - 2026-02-20: Created for Entitlement Editor Unification (Simple ↔ Advanced).
 *  - 2026-02-20: Added deterministic ID generation for dedupe/upsert semantics (R1-R4).
 *
 * INVARIANTS:
 *  - R2: One save semantics — same function for both views, same persist behavior.
 *  - R1: Deterministic IDs for creates — same logical entitlement always gets same ID.
 *  - Context-agnostic: storageMode determines backend, not the UI view.
 */

import { toast } from 'react-hot-toast';
import { db } from '@/firebaseConfig';
import type { EntitlementFormState } from './entitlementEditorFormState';
import { buildEntitlementDocument } from './entitlementEditorFormState';
import {
  validateEntitlementDocument,
  writeWorldEntitlement,
} from '../utils/entitlements/entitlementWriter';
import {
  applyVacuumEdit,
  applyVacuumCreate,
} from '../utils/entitlements/vacuumEntitlementOverlayStore';
import {
  rekeyVacuumCreate,
  resolveVacuumEditCollisions,
} from '../utils/entitlements/vacuumEntitlementOverlayStore';
import {
  getEntitlementDeterministicId,
  getVacuumDeterministicId,
  getEntitlementIdentityKey,
} from '../utils/entitlements/entitlementIdentity';
import { moveWorldEntitlement } from '../utils/entitlements/moveWorldEntitlement';
import { findVacuumCreateByIdentityKey } from '../utils/entitlements/vacuumEntitlementOverlayStore';
import {
  validateEntitlementExclusivity,
  type EntitlementViolation,
} from '../utils/entitlements/entitlementExclusivityValidator';
import { resolveEntitlementsForTeam } from '../utils/entitlements/entitlementResolver';

// ─── debug flag ──────────────────────────────────────────────────────────────
const __DEV_DEDUPE_LOG__ = import.meta.env.DEV;

// ─── types ───────────────────────────────────────────────────────────────────

export type StorageMode = 'world' | 'vacuum';

export interface SaveEntitlementArgs {
  storageMode: StorageMode;
  worldId: string | null;
  userId: string | null;
  entitlementId: string | undefined;
  formState: EntitlementFormState;
}

export interface SaveEntitlementResult {
  success: boolean;
  entitlementId: string;
  document: Record<string, unknown>;
  error?: string;
  /** Discriminator for structured error handling (e.g. exclusivity gate). */
  errorType?:
    | 'EXCLUSIVITY'
    | 'EXCLUSIVITY_VALIDATION_UNAVAILABLE'
    | 'VALIDATION';
  /** Violation details when errorType is 'EXCLUSIVITY'. */
  violations?: EntitlementViolation[];
}

// ─── save function ───────────────────────────────────────────────────────────

/**
 * Unified save for entitlement editing.
 * Both Simple and Advanced views call this same function.
 *
 * - Converts formState → document via buildEntitlementDocument()
 * - Validates the document
 * - Routes to vacuum overlay (localStorage) or world (Firestore) based on storageMode
 * - Returns { success, entitlementId, document } so callers can update their state
 */
export async function saveEntitlementFromFormState(
  args: SaveEntitlementArgs
): Promise<SaveEntitlementResult> {
  const { storageMode, worldId, userId, entitlementId, formState } = args;

  // 1. Build document from form state
  const document = buildEntitlementDocument(formState);

  // 2. Validate
  const validation = validateEntitlementDocument(document);
  if (!validation.valid) {
    const errors = validation.errors || [
      validation.error || 'Validation failed',
    ];
    const errorMsg = errors[0] || 'Validation failed';
    toast.error(errorMsg);
    return {
      success: false,
      entitlementId: entitlementId || '',
      document,
      error: errorMsg,
    };
  }

  // 3. Determine entitlement ID
  // R1: For creates (no existing ID), use deterministic ID based on identity fields.
  // This enables upsert semantics — same logical entitlement always gets same ID.
  const isCreate = !entitlementId;
  const id =
    entitlementId ||
    (document.id as string) ||
    getEntitlementDeterministicId(document);

  // R3: Compute identityKey for dedupe and debug logging
  const identityKey = getEntitlementIdentityKey(document);

  // Debug proof (dev-only): log identity and dedupe info at save time
  if (__DEV_DEDUPE_LOG__) {
    console.group('[entitlement-dedupe] save');
    console.log('identityKey:', identityKey);
    console.log('deterministic ID:', getEntitlementDeterministicId(document));
    console.log('final ID (pre-dedupe):', id);
    console.log('isCreate:', isCreate);
    console.log('storageMode:', storageMode);
    console.groupEnd();
  }

  // 4. Exclusivity gate — block overlapping claims before any write.
  //    CBA Art. VII §12: No team may hold two ownership claims on the same pick.
  //    See: docs/architect/TRADE_MACHINE_ENTITLEMENTS_ADVANCED_MASTER.md §10
  const holderTeam = document.holderTeam as string;
  if (holderTeam) {
    try {
      const currentEntitlements = await resolveEntitlementsForTeam(
        storageMode === 'world' ? worldId : null,
        holderTeam
      );
      const exclusivityCheck = validateEntitlementExclusivity({
        entitlements: currentEntitlements,
        candidate: { id: entitlementId, doc: document },
      });
      if (!exclusivityCheck.valid) {
        const firstViolation = exclusivityCheck.violations[0];
        const errorMsg =
          firstViolation?.message || 'Entitlement exclusivity conflict';
        toast.error(errorMsg);
        return {
          success: false,
          entitlementId: entitlementId || '',
          document,
          error: errorMsg,
          errorType: 'EXCLUSIVITY',
          violations: exclusivityCheck.violations,
        };
      }
    } catch (exclusivityError) {
      // Integrity-first (TM-EXCL-E1.1): if resolver or validator fails, BLOCK the save.
      // Rationale: cannot verify exclusivity = cannot proceed.
      if (__DEV_DEDUPE_LOG__) {
        console.warn(
          '[exclusivity-gate] resolver/validator error, blocking save:',
          exclusivityError
        );
      }
      return {
        success: false,
        entitlementId: entitlementId || '',
        document,
        error: 'Exclusivity validation unavailable — save blocked.',
        errorType: 'EXCLUSIVITY_VALIDATION_UNAVAILABLE' as const,
      };
    }
  }

  // 5. Route based on storage mode
  if (storageMode === 'vacuum') {
    return saveVacuum({
      entitlementId: id,
      originalEntitlementId: entitlementId,
      document,
    });
  } else {
    return saveWorld({
      worldId,
      userId,
      entitlementId: id,
      originalEntitlementId: entitlementId,
      document,
    });
  }
}

// ─── vacuum save ─────────────────────────────────────────────────────────────

function saveVacuum(args: {
  entitlementId: string | undefined;
  originalEntitlementId: string | undefined;
  document: Record<string, unknown>;
}): SaveEntitlementResult {
  const { entitlementId, originalEntitlementId, document } = args;
  const teamCode = document.holderTeam as string;

  if (!teamCode) {
    toast.error('Holder team is required.');
    return {
      success: false,
      entitlementId: entitlementId || '',
      document,
      error: 'Holder team is required.',
    };
  }

  let finalId: string;

  if (entitlementId && !entitlementId.startsWith('vacuum:')) {
    // Editing an existing base entitlement — store as edit overlay
    applyVacuumEdit(teamCode, entitlementId, document);
    // R3: After editing a base entitlement, check for collisions against vacuum creates.
    // The edit's effective identity must not duplicate any existing create.
    resolveVacuumEditCollisions(teamCode, document);
    finalId = entitlementId;
  } else if (entitlementId && entitlementId.startsWith('vacuum:')) {
    // Re-editing an existing vacuum create
    // R3: Detect identity-change — compute new deterministic vacuum ID
    const computedVacId = getVacuumDeterministicId(document);
    if (originalEntitlementId && originalEntitlementId !== computedVacId) {
      // Identity changed — rekey: move from old vacuum ID to new
      rekeyVacuumCreate(
        teamCode,
        originalEntitlementId,
        computedVacId,
        document
      );
      finalId = computedVacId;
    } else {
      // Same identity — normal overwrite
      applyVacuumCreate(teamCode, entitlementId, document);
      finalId = entitlementId;
    }
  } else {
    // Creating new — generate a deterministic vacuum-prefixed ID
    // R1: Same logical entitlement always gets the same ID, enabling dedupe.
    finalId = getVacuumDeterministicId(document);

    // R3: identityKey dedupe safety net — even if deterministic IDs differ
    // (e.g. legacy random-ID entry), check for an existing create with the
    // same identity and upsert into it instead of creating a duplicate.
    const identityKey = getEntitlementIdentityKey(document);
    const existing = findVacuumCreateByIdentityKey(teamCode, identityKey);
    if (existing && existing.vacuumId !== finalId) {
      if (__DEV_DEDUPE_LOG__) {
        console.log(
          '[entitlement-dedupe] vacuum create: identityKey match found →',
          existing.vacuumId,
          '→ upsert (rekey to',
          finalId,
          ')'
        );
      }
      // Rekey: remove the old entry, write under the new deterministic ID
      rekeyVacuumCreate(teamCode, existing.vacuumId, finalId, document);
    } else {
      applyVacuumCreate(teamCode, finalId, document);
    }

    if (__DEV_DEDUPE_LOG__) {
      console.log('[entitlement-dedupe] vacuum create: wrote', finalId);
    }
  }

  toast.success('Saved (this session only)');
  return {
    success: true,
    entitlementId: finalId,
    document: { ...document, id: finalId },
  };
}

// ─── world save ──────────────────────────────────────────────────────────────

async function saveWorld(args: {
  worldId: string | null;
  userId: string | null;
  entitlementId: string;
  document: Record<string, unknown>;
  /** Original ID passed to saveEntitlementFromFormState (before deterministic fallback). */
  originalEntitlementId: string | undefined;
}): Promise<SaveEntitlementResult> {
  const { worldId, userId, entitlementId, document, originalEntitlementId } =
    args;

  if (!worldId) {
    const errorMsg = 'World ID is required for world saves.';
    toast.error(errorMsg);
    return {
      success: false,
      entitlementId: entitlementId || '',
      document,
      error: errorMsg,
    };
  }

  if (!entitlementId) {
    const errorMsg = 'Entitlement ID could not be determined.';
    toast.error(errorMsg);
    return {
      success: false,
      entitlementId: '',
      document,
      error: errorMsg,
    };
  }

  // ── R1: Detect identity-change on edit ──
  // If this is an edit (originalEntitlementId exists) and the computed
  // deterministic ID differs from the original, this is an identity-change.
  // We must "move" the record: write to new ID + delete old ID.
  const computedId = getEntitlementDeterministicId(document);
  const isEdit = !!originalEntitlementId;
  const identityChanged = isEdit && originalEntitlementId !== computedId;

  if (__DEV_DEDUPE_LOG__) {
    console.group('[entitlement-dedupe] world save');
    console.log('identityKey:', document.identityKey);
    console.log('deterministic ID:', computedId);
    console.log('entitlementId (passed):', entitlementId);
    console.log('originalEntitlementId:', originalEntitlementId);
    console.log('isEdit:', isEdit, '| identityChanged:', identityChanged);
    console.groupEnd();
  }

  if (identityChanged) {
    // Move: write to computedId, delete originalEntitlementId, update team inventory
    const moveResult = await moveWorldEntitlement(db, {
      worldId,
      fromId: originalEntitlementId!,
      toId: computedId,
      document,
      userId: userId || '',
    });

    if (!moveResult.success) {
      const errorMsg = moveResult.error || 'Move failed';
      toast.error(errorMsg);
      return {
        success: false,
        entitlementId: originalEntitlementId!,
        document,
        error: errorMsg,
      };
    }

    toast.success('Entitlement saved (identity updated)');
    return {
      success: true,
      entitlementId: computedId,
      document: { ...document, id: computedId },
    };
  }

  // Normal write (no identity-change)
  const result = await writeWorldEntitlement(db, {
    worldId,
    entitlementId,
    document,
    userId: userId || '',
  });

  if (!result.success) {
    const errorMsg = result.error || 'Write failed';
    toast.error(errorMsg);
    return {
      success: false,
      entitlementId,
      document,
      error: errorMsg,
    };
  }

  toast.success('Entitlement saved');
  return {
    success: true,
    entitlementId,
    document: { ...document, id: entitlementId },
  };
}
