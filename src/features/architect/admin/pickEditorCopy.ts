/**
 * FILE: src/features/architect/admin/pickEditorCopy.ts
 * PURPOSE: Centralized UI copy, labels, and glossary for the Pick Right Wizard.
 *          All user-facing strings live here — no schema jargon in wizard mode.
 * OWNERSHIP: Feature: architect/admin (TM-9 Wizard Translation Layer)
 *
 * HISTORY:
 *  - 2026-02-05: Created for TM-9 Wizard Translation Layer.
 *
 * UX PRINCIPLE: The wizard speaks plain English. Schema/engine terms are reserved
 * for the Advanced Editor. If a schema term must appear, it goes into a tooltip
 * with a plain-English explanation via JARGON_GLOSSARY.
 */

import type { WizardModel, WizardIntent } from './pickRightWizardModel';

// ─── tradability badge ───────────────────────────────────────────────────────

export type TradabilityVariant = 'green' | 'amber' | 'red';

export type TradabilityBadge = {
  icon: string;
  label: string;
  reason: string;
  variant: TradabilityVariant;
};

/**
 * Derive a tradability badge from the wizard model.
 * This is purely computed from wizard state — no external data calls.
 */
export function deriveTradabilityStatus(model: WizardModel): TradabilityBadge {
  if (!model.intent) {
    return {
      icon: '❓',
      label: 'Unknown',
      reason: 'Select a pick right type',
      variant: 'amber',
    };
  }

  if (model.intent === 'protect_pick') {
    if (model.protection.customLadder.length > 0) {
      return {
        icon: '⚠️',
        label: 'Tradable with restriction',
        reason: `Has ${model.protection.customLadder.length} protection tier(s)`,
        variant: 'amber',
      };
    }
    return {
      icon: '✅',
      label: 'Tradable',
      reason: 'No restrictions',
      variant: 'green',
    };
  }

  if (model.intent === 'create_swap') {
    return {
      icon: '⚠️',
      label: 'Tradable with restriction',
      reason: 'Subject to swap right',
      variant: 'amber',
    };
  }

  if (model.intent === 'create_conveyance') {
    return {
      icon: '⚠️',
      label: 'Tradable with restriction',
      reason: 'Part of conveyance pool',
      variant: 'amber',
    };
  }

  return {
    icon: '❓',
    label: 'Unknown',
    reason: 'Could not determine status',
    variant: 'amber',
  };
}

// ─── wizard labels (user-facing) ─────────────────────────────────────────────

/** Labels used in wizard-mode UI — plain English, no schema jargon */
export const WIZARD_LABELS = {
  // Pick identity
  pickIdentity: 'Pick',
  pickHelp: 'Select the team, year, and round for this pick.',

  // Pick ownership
  pickOwnershipTitle: 'Pick Ownership',
  protectionPattern: 'Protection Pattern',
  protectionPatternHelp:
    'Choose a common protection pattern to auto-fill the ladder.',
  protectionLadder: 'Protection Ladder',
  clearLadder: 'Clear ladder',

  // Swap
  swapRightTitle: 'Swap Right',
  swapType: 'Swap Type',
  controllerPick: 'Controller Pick',
  controllerPickHelp:
    'The pick that controls the swap — the team with the right to choose.',
  targetDescription: 'Target Description',
  targetDescriptionHelp: 'Describe which pick(s) the swap targets.',
  targetDescriptionPlaceholder: 'e.g. BOS own 1st round pick',

  // Conveyance
  conveyanceRightTitle: 'Conveyance Right',
  poolOfPicks: 'Pool of Picks',
  poolOfPicksHelp: 'Add picks to the conveyance pool (minimum 2 required).',
  selectionMethod: 'Selection Method',
  selectionRank: 'Selection Rank',
  selectionRankHelp:
    'Which rank(s) to receive (e.g. 1 for best, or 1, 2 for top 2).',
  addPick: '+ Add Pick',

  // Description
  description: 'Description (optional)',
  descriptionPlaceholder:
    'e.g. 2027 BOS 1st, Lottery-protected via trade with PHI',

  // Review
  reviewTitle: 'Review & Apply',
  fieldSummary: 'Field Summary',
  openAdvanced: 'Open in Advanced Editor',
  saveDraft: 'Save Draft',
  apply: 'Apply',
  applying: 'Applying...',

  // General
  holderTeam: 'Team',
  seasonYear: 'Season Year',
  round: 'Round',
  kind: 'Type',
  entitlementId: 'Entitlement ID',
} as const;

/** Status labels for the review summary — replaces "Clean/Encumbered/Pooled" */
export const WIZARD_STATUS_LABELS: Record<string, string> = {
  clean: 'Tradable',
  encumbered: 'Restricted',
  pooled: 'Part of a pool',
};

/** Comparator labels — already user-friendly */
export const WIZARD_COMPARATOR_LABELS: Record<string, string> = {
  more_favorable: 'Most favorable',
  less_favorable: 'Least favorable',
  middle: 'Middle',
};

/** Kind labels — user-facing names */
export const WIZARD_KIND_LABELS: Record<string, string> = {
  pick_ownership: 'Pick Ownership',
  swap_right: 'Swap Right',
  conveyance_right: 'Conveyance Right',
};

/** Intent labels — what the user sees in the wizard */
export const WIZARD_INTENT_LABELS: Record<WizardIntent | '', string> = {
  protect_pick: 'Protect a Pick',
  create_swap: 'Create a Swap Right',
  create_conveyance: 'Create a Conveyance Right',
  '': 'Select Type',
};

// ─── tradability badge variant styles ────────────────────────────────────────

export const TRADABILITY_STYLES: Record<TradabilityVariant, string> = {
  green: 'bg-green-900/20 border border-green-700/40 text-green-300',
  amber: 'bg-amber-900/20 border border-amber-700/40 text-amber-300',
  red: 'bg-red-900/20 border border-red-700/40 text-red-300',
};

// ─── jargon glossary (for Advanced Editor tooltips) ──────────────────────────

/**
 * Maps schema terms to plain-English explanations.
 * Used only in Advanced Editor — never shown in wizard mode.
 */
export const JARGON_GLOSSARY: Record<string, string> = {
  underlyingPickId:
    'The canonical ID of the draft pick this entitlement refers to (e.g. BOS_2027_1).',
  underlyingStatus:
    'Whether this pick is "clean" (no other claims), "encumbered" (has protections or swaps), or "pooled" (part of a conveyance pool).',
  swapControllerPickId:
    'The canonical pick ID of the team that holds the swap right — they get to choose the better/worse pick.',
  swapTargetDefinition:
    'A text description of which pick(s) the swap is against.',
  poolUnderlyingPickIds:
    'The list of canonical pick IDs in the conveyance pool.',
  receivesRank:
    'Which position(s) to select from the pool (1 = best, 2 = second-best, etc.).',
  receivesComparator:
    'How to rank the pool picks: most favorable, least favorable, or middle.',
  protectionLadder:
    'A sequence of year-by-year protection tiers that determine when and how the pick conveys.',
  encumbered:
    'The pick has conditions attached (protections, swaps, or conveyances) that restrict when or how it can be traded.',
  clean: 'The pick has no restrictions and can be traded freely.',
};

// ─── selection method options (for dropdowns) ────────────────────────────────

export const SELECTION_METHOD_OPTIONS = [
  { value: 'most_favorable', label: 'Best (most favorable)' },
  { value: 'least_favorable', label: 'Worst (least favorable)' },
  { value: 'middle', label: 'Middle' },
] as const;
