/**
 * FILE: src/features/architect/admin/ProtectionLadderTemplates.ts
 * PURPOSE: Pre-defined protection ladder templates for EntitlementEditorModal.
 * OWNERSHIP: Feature: architect/admin (TM-7 Pick Editor UX)
 *
 * HISTORY:
 *  - 2026-02-05: Created for TM-7 Pick Editor UX.
 */

import type { ProtectionLadderTierForm } from './entitlementEditorFormState';

export type ProtectionTemplate = {
  id: string;
  label: string;
  description: string;
  /** Offset years from the base seasonYear (0 = same year, 1 = next year, etc.) */
  tiers: Array<{
    yearOffset: number;
    condition: string;
    ifTriggered: 'roll' | 'convert' | 'cancel';
    rollToYearOffset?: number;
    convertToRound?: number;
  }>;
};

export const PROTECTION_TEMPLATES: ProtectionTemplate[] = [
  {
    id: 'unprotected',
    label: 'Unprotected',
    description: 'No protection - pick conveys regardless of position',
    tiers: [],
  },
  {
    id: 'lottery_top10_unprotected',
    label: 'Lottery -> Top 10 -> Unprotected',
    description: '3-year ladder: Lottery protected, rolls to Top 10, then unprotected',
    tiers: [
      { yearOffset: 0, condition: 'Lottery', ifTriggered: 'roll', rollToYearOffset: 1 },
      { yearOffset: 1, condition: 'Top 10', ifTriggered: 'roll', rollToYearOffset: 2 },
      { yearOffset: 2, condition: '', ifTriggered: 'cancel' },
    ],
  },
  {
    id: 'top3_unprotected',
    label: 'Top 3 -> Unprotected',
    description: '2-year ladder: Top 3 protected first year, unprotected second year',
    tiers: [
      { yearOffset: 0, condition: 'Top 3', ifTriggered: 'roll', rollToYearOffset: 1 },
      { yearOffset: 1, condition: '', ifTriggered: 'cancel' },
    ],
  },
  {
    id: 'top10_converts_2nd',
    label: 'Top 10 -> Converts to 2nd',
    description: 'If top 10, converts to 2nd round pick instead',
    tiers: [
      { yearOffset: 0, condition: 'Top 10', ifTriggered: 'convert', convertToRound: 2 },
    ],
  },
  {
    id: 'top5_top3_unprotected',
    label: 'Top 5 -> Top 3 -> Unprotected',
    description: '3-year ladder: Top 5 first, Top 3 second, unprotected third',
    tiers: [
      { yearOffset: 0, condition: 'Top 5', ifTriggered: 'roll', rollToYearOffset: 1 },
      { yearOffset: 1, condition: 'Top 3', ifTriggered: 'roll', rollToYearOffset: 2 },
      { yearOffset: 2, condition: '', ifTriggered: 'cancel' },
    ],
  },
  {
    id: 'lottery_converts_2nd',
    label: 'Lottery -> Converts to 2nd',
    description: 'If lottery pick, converts to 2nd round instead',
    tiers: [
      { yearOffset: 0, condition: 'Lottery', ifTriggered: 'convert', convertToRound: 2 },
    ],
  },
];

/**
 * Apply a template to generate actual tier forms based on a base year.
 * @param template - The template to apply
 * @param baseYear - The season year to base the ladder on
 * @returns Array of ProtectionLadderTierForm objects
 */
export const applyProtectionTemplate = (
  template: ProtectionTemplate,
  baseYear: number
): ProtectionLadderTierForm[] => {
  return template.tiers.map((tier) => ({
    year: String(baseYear + tier.yearOffset),
    condition: tier.condition,
    ifTriggered: tier.ifTriggered,
    rollToYear: tier.rollToYearOffset !== undefined
      ? String(baseYear + tier.rollToYearOffset)
      : '',
    convertToRound: tier.convertToRound !== undefined
      ? String(tier.convertToRound)
      : '',
  }));
};
