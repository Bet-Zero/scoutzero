/**
 * FILE: src/features/architect/admin/wizardToEntitlement.ts
 * PURPOSE: Translation layer — converts WizardModel → EntitlementFormState / document.
 *          Pure functions only. No side effects, no Firestore access.
 * OWNERSHIP: Feature: architect/admin (TM-9 Wizard Translation Layer)
 *
 * HISTORY:
 *  - 2026-02-05: Created for TM-9 Wizard Translation Layer.
 *
 * This is the key deliverable of TM-9. The wizard collects user-facing choices
 * via WizardModel; this module converts those choices into the exact
 * EntitlementFormState expected by the existing validation/save pipeline.
 */

import type {
  EntitlementFormState,
  EntitlementKind,
} from './entitlementEditorFormState';
import { buildEntitlementDocument } from './entitlementEditorFormState';
import type {
  WizardModel,
  WizardPick,
  WizardSelectionMethod,
} from './pickRightWizardModel';
import { wizardPickToId } from './pickRightWizardModel';
import { validateEntitlementDocument } from '../utils/entitlements/entitlementWriter';

// ─── intent → kind mapping ──────────────────────────────────────────────────

const INTENT_TO_KIND: Record<string, EntitlementKind> = {
  protect_pick: 'pick_ownership',
  create_swap: 'swap_right',
  create_conveyance: 'conveyance_right',
};

// ─── selection method mapping (user-facing → schema) ─────────────────────────

const SELECTION_METHOD_TO_COMPARATOR: Record<WizardSelectionMethod, string> = {
  most_favorable: 'more_favorable',
  least_favorable: 'less_favorable',
  middle: 'middle',
};

// ─── core translation ────────────────────────────────────────────────────────

/**
 * Translate a WizardModel into an EntitlementFormState.
 *
 * This is the primary translation function. The resulting form state can be
 * fed directly into buildEntitlementDocument() → validateEntitlementDocument()
 * → writeWorldEntitlement() without any modification.
 */
export function wizardToFormState(model: WizardModel): EntitlementFormState {
  const kind = INTENT_TO_KIND[model.intent] || '';
  const pickId = wizardPickToId(model.pick);

  // Base form state — always set regardless of intent
  const base: EntitlementFormState = {
    id: model.existingEntitlementId || '',
    holderTeam: model.pick.team.toUpperCase(),
    seasonYear: String(model.pick.year),
    round: String(model.pick.round),
    kind: kind as EntitlementFormState['kind'],
    description: model.description,

    // Defaults — overridden per intent below
    underlyingPickId: '',
    underlyingStatus: '',
    swapControllerPickId: '',
    swapTargetDefinition: '',
    swapType: '',
    poolUnderlyingPickIdsText: '',
    receivesRankText: '',
    receivesComparator: '',
    protectionLadder: [],
  };

  // Intent-specific field population
  switch (model.intent) {
    case 'protect_pick':
      return populatePickOwnership(base, model, pickId);
    case 'create_swap':
      return populateSwapRight(base, model);
    case 'create_conveyance':
      return populateConveyanceRight(base, model);
    default:
      return base;
  }
}

/**
 * Convenience: translate WizardModel directly into document shape.
 * Equivalent to buildEntitlementDocument(wizardToFormState(model)).
 */
export function wizardToDocument(model: WizardModel): Record<string, unknown> {
  return buildEntitlementDocument(wizardToFormState(model));
}

/**
 * Validate a WizardModel by translating it and running the existing validator.
 * Returns the same shape as validateEntitlementDocument().
 */
export function validateWizardModel(model: WizardModel): {
  valid: boolean;
  error?: string;
  errors?: string[];
} {
  const document = wizardToDocument(model);
  return validateEntitlementDocument(document);
}

// ─── intent-specific population ──────────────────────────────────────────────

function populatePickOwnership(
  base: EntitlementFormState,
  model: WizardModel,
  pickId: string
): EntitlementFormState {
  const hasProtections = model.protection.customLadder.length > 0;

  return {
    ...base,
    underlyingPickId: pickId,
    // Auto-derive status: if protections exist → encumbered, otherwise clean
    underlyingStatus: hasProtections ? 'encumbered' : 'clean',
    protectionLadder: model.protection.customLadder,
  };
}

function populateSwapRight(
  base: EntitlementFormState,
  model: WizardModel
): EntitlementFormState {
  const controllerPickId = wizardPickToId(model.swap.controllerPick);

  return {
    ...base,
    swapType: model.swap.swapType,
    swapControllerPickId: controllerPickId,
    swapTargetDefinition: model.swap.targetDescription,
  };
}

function populateConveyanceRight(
  base: EntitlementFormState,
  model: WizardModel
): EntitlementFormState {
  // Convert pool picks to newline-separated canonical IDs
  const poolPickIds = model.conveyance.poolPicks.map((p: WizardPick) =>
    wizardPickToId(p)
  );

  return {
    ...base,
    poolUnderlyingPickIdsText: poolPickIds.join('\n'),
    receivesComparator: SELECTION_METHOD_TO_COMPARATOR[
      model.conveyance.selectionMethod
    ] as EntitlementFormState['receivesComparator'],
    receivesRankText: model.conveyance.selectionRanks.join(', '),
  };
}
