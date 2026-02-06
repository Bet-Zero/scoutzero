/**
 * FILE: src/features/architect/admin/pickRightWizardDraft.ts
 * PURPOSE: localStorage draft helpers for Pick Right Wizard.
 * OWNERSHIP: Feature: architect/admin (TM-8 Pick Editor UX / TM-9 Translation Layer)
 *
 * HISTORY:
 *  - 2026-02-05: Created for TM-8 Pick Editor UX Overhaul.
 *  - 2026-02-05: TM-9 — Updated to v2 envelope format storing both WizardModel
 *                and EntitlementFormState. Supports v1 migration on load.
 *
 * Draft key format: pickrightdraft:{worldId}:{entitlementId|new}
 *
 * v2 envelope: { version: 2, wizardModel: WizardModel, formState: EntitlementFormState }
 * v1 (legacy): raw EntitlementFormState JSON — auto-migrated on load.
 */

import type { EntitlementFormState } from './entitlementEditorFormState';
import type { WizardModel } from './pickRightWizardModel';

const DRAFT_PREFIX = 'pickrightdraft';

/** v2 draft envelope stored in localStorage */
export type DraftEnvelope = {
  version: 2;
  wizardModel: WizardModel;
  formState: EntitlementFormState;
};

/** What loadDraft returns — could be v2 envelope or v1 raw formState */
export type LoadedDraft =
  | { wizardModel: WizardModel; formState: EntitlementFormState }
  | EntitlementFormState;

function draftKey(worldId: string, entitlementId: string): string {
  return `${DRAFT_PREFIX}:${worldId}:${entitlementId || 'new'}`;
}

/**
 * Persist the current wizard state to localStorage as a v2 envelope.
 * Does NOT write to Firestore — purely local.
 */
export function saveDraft(
  worldId: string,
  entitlementId: string | 'new',
  wizardModel: WizardModel,
  formState: EntitlementFormState
): void {
  try {
    const key = draftKey(worldId, entitlementId);
    const envelope: DraftEnvelope = { version: 2, wizardModel, formState };
    localStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

/**
 * Load a previously-saved draft from localStorage.
 *
 * Returns:
 * - v2 envelope shape: `{ wizardModel, formState }` (has 'wizardModel' key)
 * - v1 legacy shape: raw `EntitlementFormState` (has 'holderTeam' + 'kind' keys)
 * - null if no draft exists or data is corrupt
 *
 * Callers should check for 'wizardModel' in result to distinguish v1 vs v2.
 */
export function loadDraft(
  worldId: string,
  entitlementId: string | 'new'
): LoadedDraft | null {
  try {
    const key = draftKey(worldId, entitlementId);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    // v2 envelope
    if (parsed.version === 2 && parsed.wizardModel && parsed.formState) {
      return {
        wizardModel: parsed.wizardModel as WizardModel,
        formState: parsed.formState as EntitlementFormState,
      };
    }

    // v1 legacy: raw EntitlementFormState
    if ('holderTeam' in parsed && 'kind' in parsed) {
      return parsed as EntitlementFormState;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Remove a draft from localStorage.
 */
export function clearDraft(
  worldId: string,
  entitlementId: string | 'new'
): void {
  try {
    const key = draftKey(worldId, entitlementId);
    localStorage.removeItem(key);
  } catch {
    // silent
  }
}

/**
 * Check whether a draft exists in localStorage without loading it.
 */
export function hasDraft(
  worldId: string,
  entitlementId: string | 'new'
): boolean {
  try {
    const key = draftKey(worldId, entitlementId);
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}
