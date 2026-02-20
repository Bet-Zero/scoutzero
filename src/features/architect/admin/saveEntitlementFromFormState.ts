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
  getEntitlementDeterministicId,
  getVacuumDeterministicId,
} from '../utils/entitlements/entitlementIdentity';

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
  const id =
    entitlementId ||
    (document.id as string) ||
    getEntitlementDeterministicId(document);

  // 4. Route based on storage mode
  if (storageMode === 'vacuum') {
    return saveVacuum({ entitlementId: id, document });
  } else {
    return saveWorld({ worldId, userId, entitlementId: id, document });
  }
}

// ─── vacuum save ─────────────────────────────────────────────────────────────

function saveVacuum(args: {
  entitlementId: string | undefined;
  document: Record<string, unknown>;
}): SaveEntitlementResult {
  const { entitlementId, document } = args;
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
    finalId = entitlementId;
  } else if (entitlementId && entitlementId.startsWith('vacuum:')) {
    // Re-editing an existing vacuum create — overwrite the create entry
    applyVacuumCreate(teamCode, entitlementId, document);
    finalId = entitlementId;
  } else {
    // Creating new — generate a deterministic vacuum-prefixed ID
    // R1: Same logical entitlement always gets the same ID, enabling dedupe.
    finalId = getVacuumDeterministicId(document);
    applyVacuumCreate(teamCode, finalId, document);
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
}): Promise<SaveEntitlementResult> {
  const { worldId, userId, entitlementId, document } = args;

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
