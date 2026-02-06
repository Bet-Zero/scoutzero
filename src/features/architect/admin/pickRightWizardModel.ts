/**
 * FILE: src/features/architect/admin/pickRightWizardModel.ts
 * PURPOSE: Front-facing wizard data model for Pick Right creation/editing.
 *          Contains ONLY user-facing choices — no schema/engine jargon.
 * OWNERSHIP: Feature: architect/admin (TM-9 Wizard Translation Layer)
 *
 * HISTORY:
 *  - 2026-02-05: Created for TM-9 Wizard Translation Layer.
 *
 * The WizardModel is the single source of truth for wizard-mode state.
 * It is translated into EntitlementFormState via wizardToEntitlement.ts
 * before being fed into the existing validation/save pipeline.
 */

import type {
  EntitlementFormState,
  ProtectionLadderTierForm,
} from './entitlementEditorFormState';
import { generatePickId } from '@/features/architect/utils/tradeMachine/utils/pickIdUtils';

// ─── types ───────────────────────────────────────────────────────────────────

/** The user's high-level intent — no schema jargon */
export type WizardIntent = 'protect_pick' | 'create_swap' | 'create_conveyance';

/** A pick identity expressed in plain user-facing terms */
export type WizardPick = {
  team: string; // 3-letter team code (e.g. "BOS")
  year: number; // Draft year (e.g. 2027)
  round: 1 | 2; // Round number
};

/** Protection configuration for pick ownership */
export type WizardProtection = {
  templateId: string;
  customLadder: ProtectionLadderTierForm[];
};

/** Swap right configuration */
export type WizardSwap = {
  swapType: 'best_of' | 'worst_of';
  controllerPick: WizardPick;
  targetDescription: string;
};

/** User-facing selection method labels (mapped to schema values by translation layer) */
export type WizardSelectionMethod =
  | 'most_favorable'
  | 'least_favorable'
  | 'middle';

/** Conveyance right configuration */
export type WizardConveyance = {
  poolPicks: WizardPick[];
  selectionMethod: WizardSelectionMethod;
  selectionRanks: number[];
};

/** The complete front-facing wizard state */
export type WizardModel = {
  intent: WizardIntent | '';
  pick: WizardPick;
  description: string;
  protection: WizardProtection;
  swap: WizardSwap;
  conveyance: WizardConveyance;
  existingEntitlementId: string;
};

// ─── factories ───────────────────────────────────────────────────────────────

export function createDefaultWizardPick(
  team = 'LAL',
  year = 2026,
  round: 1 | 2 = 1
): WizardPick {
  return { team, year, round };
}

export function createDefaultWizardModel(
  overrides?: Partial<WizardModel>
): WizardModel {
  return {
    intent: '',
    pick: createDefaultWizardPick(),
    description: '',
    protection: { templateId: '', customLadder: [] },
    swap: {
      swapType: 'best_of',
      controllerPick: createDefaultWizardPick(),
      targetDescription: '',
    },
    conveyance: {
      poolPicks: [],
      selectionMethod: 'most_favorable',
      selectionRanks: [1],
    },
    existingEntitlementId: '',
    ...overrides,
  };
}

// ─── reverse mapping: FormState → WizardModel ────────────────────────────────

/**
 * Best-effort conversion from EntitlementFormState to WizardModel.
 * Returns null if the form state cannot be cleanly represented in wizard terms
 * (e.g., unknown kind, missing data that the wizard requires).
 */
export function formStateToWizardModel(
  formState: EntitlementFormState
): WizardModel | null {
  const kind = formState.kind;
  if (!kind) return null;

  // Map kind → intent
  const intentMap: Record<string, WizardIntent> = {
    pick_ownership: 'protect_pick',
    swap_right: 'create_swap',
    conveyance_right: 'create_conveyance',
  };
  const intent = intentMap[kind];
  if (!intent) return null;

  // Base pick from holderTeam / seasonYear / round
  const pick: WizardPick = {
    team: formState.holderTeam || 'LAL',
    year: Number(formState.seasonYear) || 2026,
    round: (Number(formState.round) === 2 ? 2 : 1) as 1 | 2,
  };

  // Protection
  const protection: WizardProtection = {
    templateId: '', // We can't reliably reverse-detect which template was used
    customLadder: formState.protectionLadder || [],
  };

  // Swap — parse controller pick ID back to WizardPick
  let controllerPick = createDefaultWizardPick(
    pick.team,
    pick.year,
    pick.round
  );
  if (formState.swapControllerPickId) {
    const parts = formState.swapControllerPickId.split('_');
    if (parts.length === 3) {
      controllerPick = {
        team: parts[0],
        year: Number(parts[1]) || pick.year,
        round: (Number(parts[2]) === 2 ? 2 : 1) as 1 | 2,
      };
    }
  }

  const swap: WizardSwap = {
    swapType: (formState.swapType as 'best_of' | 'worst_of') || 'best_of',
    controllerPick,
    targetDescription: formState.swapTargetDefinition || '',
  };

  // Conveyance — parse pool IDs back to WizardPick[]
  const poolIds = formState.poolUnderlyingPickIdsText
    .split(/[\n,]/)
    .map((id) => id.trim())
    .filter(Boolean);

  const poolPicks: WizardPick[] = poolIds.map((id) => {
    const parts = id.split('_');
    if (parts.length === 3) {
      return {
        team: parts[0],
        year: Number(parts[1]) || pick.year,
        round: (Number(parts[2]) === 2 ? 2 : 1) as 1 | 2,
      };
    }
    return createDefaultWizardPick(pick.team, pick.year, pick.round);
  });

  // Map receivesComparator → selectionMethod
  const comparatorMap: Record<string, WizardSelectionMethod> = {
    more_favorable: 'most_favorable',
    less_favorable: 'least_favorable',
    middle: 'middle',
  };

  const selectionRanks = formState.receivesRankText
    .split(/[\n,]/)
    .map((r) => r.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isFinite(n));

  const conveyance: WizardConveyance = {
    poolPicks,
    selectionMethod:
      comparatorMap[formState.receivesComparator] || 'most_favorable',
    selectionRanks: selectionRanks.length > 0 ? selectionRanks : [1],
  };

  return {
    intent,
    pick,
    description: formState.description || '',
    protection,
    swap,
    conveyance,
    existingEntitlementId: formState.id || '',
  };
}

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Convert a WizardPick to a canonical pick ID string */
export function wizardPickToId(pick: WizardPick): string {
  return generatePickId({
    originalTeam: pick.team,
    year: pick.year,
    round: pick.round,
  });
}

/** Parse a canonical pick ID string into a WizardPick (best-effort) */
export function pickIdToWizardPick(
  pickId: string,
  fallback?: Partial<WizardPick>
): WizardPick {
  const parts = pickId.split('_');
  if (parts.length === 3) {
    return {
      team: parts[0],
      year: Number(parts[1]) || fallback?.year || 2026,
      round: (Number(parts[2]) === 2 ? 2 : 1) as 1 | 2,
    };
  }
  return {
    team: fallback?.team || 'LAL',
    year: fallback?.year || 2026,
    round: fallback?.round || 1,
  };
}
