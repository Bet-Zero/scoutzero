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
  writeWorldEntitlementAndAttachToTeamAtomic,
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
import { findVacuumCreateByIdentityKey } from '../utils/entitlements/vacuumEntitlementOverlayStore';
import {
  validateEntitlementExclusivity,
  type EntitlementDocLike,
  type EntitlementViolation,
} from '../utils/entitlements/entitlementExclusivityValidator';
import {
  resolveEntitlement,
  resolveEntitlementsForTeam,
} from '../utils/entitlements/entitlementResolver';
import {
  runLeagueClaimUniquenessGate,
  type LeagueClaimConflict,
} from '../utils/entitlements/leagueClaimUniquenessGate';

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
  saveOperation?:
    | 'VACUUM_CREATE'
    | 'VACUUM_EDIT'
    | 'CREATE'
    | 'UPDATE_SAME_IDENTITY'
    | 'DUPLICATE_AS_NEW';
  createdNewEntitlement?: boolean;
  originalEntitlementId?: string;
  /** Discriminator for structured error handling (e.g. exclusivity gate). */
  errorType?:
    | 'EXCLUSIVITY'
    | 'EXCLUSIVITY_VALIDATION_UNAVAILABLE'
    | 'CLAIM_UNIQUENESS'
    | 'COLLISION'
    | 'LINKAGE'
    | 'VALIDATION';
  /** Violation details when errorType is 'EXCLUSIVITY'. */
  violations?: EntitlementViolation[];
  /** League-wide claim conflicts when errorType is 'CLAIM_UNIQUENESS'. */
  claimConflicts?: LeagueClaimConflict[];
  /** Missing linked entitlement IDs when errorType is 'LINKAGE'. */
  missingLinkedEntitlementIds?: string[];
  /** Missing residual entitlement ID when errorType is 'LINKAGE'. */
  missingResidualEntitlementId?: string;
}

type WorldSaveOperation = 'CREATE' | 'UPDATE_SAME_IDENTITY' | 'DUPLICATE_AS_NEW';

// ─── save function ───────────────────────────────────────────────────────────

function buildPostSaveTeamEntitlements(params: {
  currentEntitlements: EntitlementDocLike[];
  existingEntitlementId?: string;
  finalEntitlementId: string;
  candidateDocument: Record<string, unknown>;
  saveOperation: WorldSaveOperation;
}): EntitlementDocLike[] {
  const {
    currentEntitlements,
    existingEntitlementId,
    finalEntitlementId,
    candidateDocument,
    saveOperation,
  } = params;

  const idsToRemove = new Set<string>();
  if (saveOperation === 'UPDATE_SAME_IDENTITY') {
    if (existingEntitlementId) idsToRemove.add(existingEntitlementId);
    idsToRemove.add(finalEntitlementId);
  } else {
    // Create and duplicate-as-new preserve original entitlement identity.
    // We only remove finalEntitlementId to avoid duplicate rows if it already exists.
    idsToRemove.add(finalEntitlementId);
  }

  const postSave = currentEntitlements.filter((entitlement) => {
    const currentId = (entitlement.id as string) || '';
    return !idsToRemove.has(currentId);
  });

  postSave.push({
    ...(candidateDocument as EntitlementDocLike),
    id: finalEntitlementId,
  });

  return postSave;
}

function computeWorldSaveOperation(params: {
  entitlementId: string | undefined;
  document: Record<string, unknown>;
}): {
  operation: WorldSaveOperation;
  computedDeterministicId: string;
  finalEntitlementId: string;
} {
  const { entitlementId, document } = params;
  const computedDeterministicId = getEntitlementDeterministicId(document);

  if (!entitlementId) {
    return {
      operation: 'CREATE',
      computedDeterministicId,
      finalEntitlementId: computedDeterministicId,
    };
  }

  if (entitlementId === computedDeterministicId) {
    return {
      operation: 'UPDATE_SAME_IDENTITY',
      computedDeterministicId,
      finalEntitlementId: entitlementId,
    };
  }

  return {
    operation: 'DUPLICATE_AS_NEW',
    computedDeterministicId,
    finalEntitlementId: computedDeterministicId,
  };
}

async function validateLinkedResidualReferences(params: {
  storageMode: StorageMode;
  worldId: string | null;
  document: Record<string, unknown>;
}): Promise<
  | { valid: true }
  | {
      valid: false;
      error: string;
      missingLinkedEntitlementIds?: string[];
      missingResidualEntitlementId?: string;
    }
> {
  const { storageMode, worldId, document } = params;
  if (storageMode !== 'world' || !worldId) {
    return { valid: true };
  }

  const linkedIds = Array.isArray(document.linkedEntitlementIds)
    ? [
        ...new Set(
          (document.linkedEntitlementIds as unknown[])
            .filter((id): id is string => typeof id === 'string')
            .map((id) => id.trim())
            .filter(Boolean)
        ),
      ]
    : [];
  const residualId =
    typeof document.residualOfEntitlementId === 'string'
      ? document.residualOfEntitlementId.trim()
      : '';

  if (linkedIds.length === 0 && !residualId) {
    return { valid: true };
  }

  const linkedResults = await Promise.all(
    linkedIds.map(async (linkedId) => ({
      linkedId,
      doc: await resolveEntitlement(worldId, linkedId),
    }))
  );
  const missingLinkedEntitlementIds = linkedResults
    .filter((result) => !result.doc)
    .map((result) => result.linkedId);

  let missingResidualEntitlementId: string | undefined;
  if (residualId) {
    const resolvedResidual = await resolveEntitlement(worldId, residualId);
    if (!resolvedResidual) {
      missingResidualEntitlementId = residualId;
    }
  }

  if (
    missingLinkedEntitlementIds.length === 0 &&
    !missingResidualEntitlementId
  ) {
    return { valid: true };
  }

  const problems: string[] = [];
  if (missingLinkedEntitlementIds.length > 0) {
    problems.push(`missing linked entitlements: ${missingLinkedEntitlementIds.join(', ')}`);
  }
  if (missingResidualEntitlementId) {
    problems.push(`missing residual target: ${missingResidualEntitlementId}`);
  }

  return {
    valid: false,
    error: `Linkage validation failed (${problems.join(' | ')})`,
    missingLinkedEntitlementIds,
    missingResidualEntitlementId,
  };
}

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
  const worldSaveMeta = computeWorldSaveOperation({ entitlementId, document });
  const effectiveEntitlementIdForValidation =
    storageMode === 'world' ? worldSaveMeta.finalEntitlementId : id;

  // R3: Compute identityKey for dedupe and debug logging
  const identityKey = getEntitlementIdentityKey(document);

  // Debug proof (dev-only): log identity and dedupe info at save time
  if (__DEV_DEDUPE_LOG__) {
    console.group('[entitlement-dedupe] save');
    console.log('identityKey:', identityKey);
    console.log('deterministic ID:', getEntitlementDeterministicId(document));
    console.log('final ID (pre-dedupe):', id);
    if (storageMode === 'world') {
      console.log('world save operation:', worldSaveMeta.operation);
      console.log(
        'world save final ID:',
        worldSaveMeta.finalEntitlementId
      );
    }
    console.log('isCreate:', isCreate);
    console.log('storageMode:', storageMode);
    console.groupEnd();
  }

  // 3.5 Linked/residual reference gate (world mode only).
  // Missing references are now blocking legality (M4).
  let linkageValidation: Awaited<
    ReturnType<typeof validateLinkedResidualReferences>
  >;
  try {
    linkageValidation = await validateLinkedResidualReferences({
      storageMode,
      worldId,
      document,
    });
  } catch (linkageError) {
    const errorMsg =
      linkageError instanceof Error
        ? linkageError.message
        : 'Linkage validation unavailable';
    toast.error(`Linkage validation unavailable (${errorMsg})`);
    return {
      success: false,
      entitlementId: entitlementId || '',
      document,
      error: `Linkage validation unavailable (${errorMsg})`,
      errorType: 'LINKAGE',
    };
  }
  if (linkageValidation.valid === false) {
    toast.error(linkageValidation.error);
    return {
      success: false,
      entitlementId: entitlementId || '',
      document,
      error: linkageValidation.error,
      errorType: 'LINKAGE',
      missingLinkedEntitlementIds:
        linkageValidation.missingLinkedEntitlementIds,
      missingResidualEntitlementId:
        linkageValidation.missingResidualEntitlementId,
    };
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

      const candidateIdForValidation = effectiveEntitlementIdForValidation;
      const exclusivityCheck = validateEntitlementExclusivity({
        entitlements: currentEntitlements,
        candidate: { id: candidateIdForValidation, doc: document },
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

      // R1: League-wide claim uniqueness gate for world/admin writes.
      // We validate post-save state for the edited team against all teams.
      if (storageMode === 'world' && worldId) {
        const postSaveTeamSet = buildPostSaveTeamEntitlements({
          currentEntitlements,
          existingEntitlementId: entitlementId,
          finalEntitlementId: candidateIdForValidation,
          candidateDocument: document,
          saveOperation: worldSaveMeta.operation,
        });

        const leagueGateResult = await runLeagueClaimUniquenessGate({
          worldId,
          context: 'ENTITLEMENT_SAVE',
          scopeMode: 'FULL_LEAGUE',
          postMutationEntitlementsByTeam: {
            [holderTeam]: postSaveTeamSet,
          },
        });

        if (!leagueGateResult.ok) {
          const failedGateResult = leagueGateResult as Exclude<
            typeof leagueGateResult,
            { ok: true }
          >;
          toast.error(failedGateResult.message);
          return {
            success: false,
            entitlementId: entitlementId || '',
            document,
            error: failedGateResult.message,
            errorType:
              failedGateResult.errorType === 'CLAIM_UNIQUENESS_VIOLATION'
                ? 'CLAIM_UNIQUENESS'
                : 'EXCLUSIVITY_VALIDATION_UNAVAILABLE',
            claimConflicts: failedGateResult.conflicts,
          };
        }
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
      entitlementId: isCreate ? undefined : id,
      originalEntitlementId: entitlementId,
      document,
    });
  } else {
    return saveWorld({
      worldId,
      userId,
      entitlementId:
        storageMode === 'world' ? worldSaveMeta.finalEntitlementId : id,
      originalEntitlementId: entitlementId,
      document,
      saveOperation: worldSaveMeta.operation,
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
  let saveOperation: SaveEntitlementResult['saveOperation'] = 'VACUUM_CREATE';

  if (entitlementId && !entitlementId.startsWith('vacuum:')) {
    // Editing an existing base entitlement — store as edit overlay
    applyVacuumEdit(teamCode, entitlementId, document);
    // R3: After editing a base entitlement, check for collisions against vacuum creates.
    // The edit's effective identity must not duplicate any existing create.
    resolveVacuumEditCollisions(teamCode, document);
    finalId = entitlementId;
    saveOperation = 'VACUUM_EDIT';
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
    saveOperation = 'VACUUM_EDIT';
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
    saveOperation,
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
  saveOperation: WorldSaveOperation;
}): Promise<SaveEntitlementResult> {
  const {
    worldId,
    userId,
    entitlementId,
    document,
    originalEntitlementId,
    saveOperation,
  } = args;

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

  if (__DEV_DEDUPE_LOG__) {
    console.group('[entitlement-dedupe] world save');
    console.log('identityKey:', document.identityKey);
    console.log('deterministic ID:', getEntitlementDeterministicId(document));
    console.log('entitlementId (passed):', entitlementId);
    console.log('originalEntitlementId:', originalEntitlementId);
    console.log('saveOperation:', saveOperation);
    console.groupEnd();
  }

  if (saveOperation === 'CREATE' || saveOperation === 'DUPLICATE_AS_NEW') {
    const createResult = await writeWorldEntitlementAndAttachToTeamAtomic(db, {
      worldId,
      entitlementId,
      document,
      userId: userId || '',
    });

    if (!createResult.success) {
      const errorMsg = createResult.error || 'Atomic create+attach failed';
      toast.error(errorMsg);
      return {
        success: false,
        entitlementId: originalEntitlementId || entitlementId,
        document,
        error: errorMsg,
        errorType:
          createResult.errorType === 'ENTITLEMENT_ID_COLLISION'
            ? 'COLLISION'
            : undefined,
      };
    }

    if (saveOperation === 'DUPLICATE_AS_NEW') {
      toast.success('Saved as new entitlement');
    } else {
      toast.success('Entitlement saved');
    }

    return {
      success: true,
      entitlementId,
      document: { ...document, id: entitlementId },
      saveOperation,
      createdNewEntitlement: saveOperation === 'DUPLICATE_AS_NEW',
      originalEntitlementId,
    };
  }

  // UPDATE_SAME_IDENTITY
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
      errorType:
        result.errorType === 'ENTITLEMENT_ID_COLLISION'
          ? 'COLLISION'
          : undefined,
    };
  }

  toast.success('Entitlement saved');
  return {
    success: true,
    entitlementId,
    document: { ...document, id: entitlementId },
    saveOperation,
    createdNewEntitlement: false,
    originalEntitlementId,
  };
}
