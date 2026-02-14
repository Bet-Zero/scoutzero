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
      reason: 'Part of pick pool',
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
  protectionPattern: 'Protection',
  protectionPatternHelp:
    'Choose a common protection. For custom rules, use the Advanced Editor.',
  protectionLadder: 'Protection Ladder',
  clearLadder: 'Clear',

  // Swap
  swapRightTitle: 'Swap',
  swapType: 'Swap Direction',
  swapBestOf: 'Swap most favorable',
  swapWorstOf: 'Swap least favorable',
  controllerPick: 'Your Pick',
  controllerPickHelp:
    'The pick your team controls — the one you can choose to swap.',
  targetDescription: 'Details',
  targetDescriptionHelp:
    'Describe what the swap is against (auto-filled from pick).',
  targetDescriptionPlaceholder: 'e.g. BOS own 1st round pick',
  yourPick: 'Your pick',
  theirPick: 'Their pick',

  // Pool (renamed from Conveyance)
  poolTitle: 'Pool',
  poolOfPicks: 'Picks in Pool',
  poolOfPicksHelp:
    'A pool lets you receive the most/least favorable pick from a set.',
  poolReceives: 'Receives',
  addPick: '+ Add Pick',

  // Description
  description: 'Description (optional)',
  descriptionPlaceholder:
    'e.g. 2027 BOS 1st, Lottery-protected via trade with PHI',

  // Review / Apply
  reviewTitle: 'Review & Apply',
  fieldSummary: 'Summary',
  openAdvanced: 'Open Advanced Editor',
  saveDraft: 'Save Draft',
  apply: 'Apply',
  applying: 'Applying...',

  // General
  holderTeam: 'Team',
  seasonYear: 'Season Year',
  round: 'Round',
  kind: 'Type',
  entitlementId: 'Entitlement ID',

  // Quick Builder — removed jargon labels
  selectionMethod: 'Selection Method',
  selectionRank: 'Selection Rank',
  selectionRankHelp:
    'Which rank(s) to receive (e.g. 1 for best, or 1, 2 for top 2).',
  conveyanceRightTitle: 'Conveyance Right',
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
  pick_ownership: 'Protection',
  swap_right: 'Swap',
  conveyance_right: 'Pool',
};

/** Intent labels — what the user sees in the wizard */
export const WIZARD_INTENT_LABELS: Record<WizardIntent | '', string> = {
  protect_pick: 'Protect a Pick',
  create_swap: 'Create a Swap',
  create_conveyance: 'Create a Pool',
  '': 'Select Type',
};

/** Intent descriptions — shown on action cards in Quick Builder */
export const WIZARD_INTENT_DESCRIPTIONS: Record<WizardIntent, string> = {
  protect_pick: 'Add standard protections to a pick before trading it.',
  create_swap: 'Swap the most or least favorable pick between two teams.',
  create_conveyance: 'Receive the best/worst pick from a set of picks.',
};

// ─── pool chip presets (Quick Builder T4) ────────────────────────────────────

export type PoolChipPreset = {
  id: string;
  label: string;
  comparator: 'more_favorable' | 'less_favorable' | 'middle';
  ranks: number[];
};

/** Quick Builder pool chips — translate to comparator + ranks internally */
export const POOL_CHIP_PRESETS: PoolChipPreset[] = [
  { id: 'best', label: 'Best', comparator: 'more_favorable', ranks: [1] },
  { id: 'top2', label: 'Top 2', comparator: 'more_favorable', ranks: [1, 2] },
  { id: 'worst', label: 'Worst', comparator: 'less_favorable', ranks: [1] },
  {
    id: 'bottom2',
    label: 'Bottom 2',
    comparator: 'less_favorable',
    ranks: [1, 2],
  },
  { id: 'middle', label: 'Middle', comparator: 'middle', ranks: [1] },
];

/**
 * Reverse-detect a pool chip from comparator + ranks.
 * Returns the chip id or null if no match.
 */
export function detectPoolChip(
  comparator: string,
  ranks: number[]
): string | null {
  const sorted = [...ranks].sort((a, b) => a - b);
  for (const chip of POOL_CHIP_PRESETS) {
    const chipSorted = [...chip.ranks].sort((a, b) => a - b);
    if (
      chip.comparator === comparator &&
      chipSorted.length === sorted.length &&
      chipSorted.every((v, i) => v === sorted[i])
    ) {
      return chip.id;
    }
  }
  return null;
}

// ─── tradability badge variant styles ────────────────────────────────────────

export const TRADABILITY_STYLES: Record<TradabilityVariant, string> = {
  green: 'bg-green-900/20 border border-green-700/40 text-green-300',
  amber: 'bg-amber-900/20 border border-amber-700/40 text-amber-300',
  red: 'bg-red-900/20 border border-red-700/40 text-red-300',
};

// ─── banned jargon words (Quick Builder T5) ─────────────────────────────────

/**
 * Words that must NOT appear in the Quick Builder UI.
 * Used by tests to verify jargon-free rendering.
 */
export const BANNED_JARGON_WORDS: string[] = [
  'underlying',
  'status',
  'encumbered',
  'clean',
  'conveyance',
  'comparator',
  'rank',
  'receivesRank',
  'receivesComparator',
  'underlyingPickId',
  'underlyingStatus',
  'swapControllerPickId',
  'swapTargetDefinition',
  'poolUnderlyingPickIds',
];

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
