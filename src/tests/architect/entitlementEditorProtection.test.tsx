/**
 * FILE: src/tests/architect/entitlementEditorProtection.test.tsx
 * PURPOSE: Tests for TM-7 protection ladder templates and validation.
 * OWNERSHIP: Test suite (TM-7)
 */

import { describe, it, expect } from 'vitest';
import {
  PROTECTION_TEMPLATES,
  applyProtectionTemplate,
} from '@/features/architect/admin/ProtectionLadderTemplates';
import {
  createEntitlementFormState,
  buildEntitlementDocument,
} from '@/features/architect/admin/entitlementEditorFormState';

describe('TM-7: Protection Ladder Templates', () => {
  it('has expected template IDs', () => {
    const ids = PROTECTION_TEMPLATES.map((t) => t.id);
    expect(ids).toContain('unprotected');
    expect(ids).toContain('lottery_top10_unprotected');
    expect(ids).toContain('top3_unprotected');
    expect(ids).toContain('top10_converts_2nd');
  });

  it('unprotected template produces empty ladder', () => {
    const template = PROTECTION_TEMPLATES.find((t) => t.id === 'unprotected')!;
    const result = applyProtectionTemplate(template, 2026);
    expect(result).toHaveLength(0);
  });

  it('lottery_top10_unprotected template adjusts years to baseYear', () => {
    const template = PROTECTION_TEMPLATES.find(
      (t) => t.id === 'lottery_top10_unprotected'
    )!;
    const result = applyProtectionTemplate(template, 2027);

    expect(result).toHaveLength(3);
    expect(result[0].year).toBe('2027');
    expect(result[0].condition).toBe('Lottery');
    expect(result[0].ifTriggered).toBe('roll');
    expect(result[0].rollToYear).toBe('2028');

    expect(result[1].year).toBe('2028');
    expect(result[1].condition).toBe('Top 10');
    expect(result[1].ifTriggered).toBe('roll');
    expect(result[1].rollToYear).toBe('2029');

    expect(result[2].year).toBe('2029');
    expect(result[2].ifTriggered).toBe('cancel');
  });

  it('top3_unprotected template produces 2 tiers', () => {
    const template = PROTECTION_TEMPLATES.find(
      (t) => t.id === 'top3_unprotected'
    )!;
    const result = applyProtectionTemplate(template, 2028);

    expect(result).toHaveLength(2);
    expect(result[0].year).toBe('2028');
    expect(result[0].condition).toBe('Top 3');
    expect(result[0].ifTriggered).toBe('roll');
    expect(result[0].rollToYear).toBe('2029');

    expect(result[1].year).toBe('2029');
    expect(result[1].ifTriggered).toBe('cancel');
  });

  it('top10_converts_2nd template produces 1 tier with convert', () => {
    const template = PROTECTION_TEMPLATES.find(
      (t) => t.id === 'top10_converts_2nd'
    )!;
    const result = applyProtectionTemplate(template, 2026);

    expect(result).toHaveLength(1);
    expect(result[0].year).toBe('2026');
    expect(result[0].condition).toBe('Top 10');
    expect(result[0].ifTriggered).toBe('convert');
    expect(result[0].convertToRound).toBe('2');
  });

  it('template applied to form state round-trips through build', () => {
    const template = PROTECTION_TEMPLATES.find(
      (t) => t.id === 'top3_unprotected'
    )!;
    const tiers = applyProtectionTemplate(template, 2029);

    const formState = createEntitlementFormState({
      holderTeam: 'GSW',
      seasonYear: 2029,
      round: 1,
      kind: 'pick_ownership',
      underlyingPickId: 'GSW_2029_1st',
    });
    formState.protectionLadder = tiers;

    const doc = buildEntitlementDocument(formState);

    expect(doc.protectionLadder).toHaveLength(2);
    const ladder = doc.protectionLadder as Array<Record<string, unknown>>;
    expect(ladder[0].year).toBe(2029);
    expect(ladder[0].condition).toBe('Top 3');
    expect(ladder[0].ifTriggered).toBe('roll');
    expect(ladder[0].rollToYear).toBe(2030);

    expect(ladder[1].year).toBe(2030);
    expect(ladder[1].ifTriggered).toBe('cancel');
  });
});

describe('TM-7: Protection Ladder Validation (form-level)', () => {
  it('builds valid document when tiers have ascending years', () => {
    const formState = createEntitlementFormState({
      holderTeam: 'BOS',
      seasonYear: 2026,
      round: 1,
      kind: 'pick_ownership',
      underlyingPickId: 'BOS_2026_1st',
    });
    formState.protectionLadder = [
      {
        year: '2026',
        condition: 'Top 5',
        ifTriggered: 'roll',
        rollToYear: '2027',
        convertToRound: '',
      },
      {
        year: '2027',
        condition: '',
        ifTriggered: 'cancel',
        rollToYear: '',
        convertToRound: '',
      },
    ];

    const doc = buildEntitlementDocument(formState);
    const ladder = doc.protectionLadder as Array<Record<string, unknown>>;
    expect(ladder).toHaveLength(2);
    expect(ladder[0].year).toBe(2026);
    expect(ladder[1].year).toBe(2027);
  });

  it('preserves convertToRound for convert tiers', () => {
    const formState = createEntitlementFormState({
      holderTeam: 'PHI',
      seasonYear: 2028,
      round: 1,
      kind: 'pick_ownership',
      underlyingPickId: 'PHI_2028_1st',
    });
    formState.protectionLadder = [
      {
        year: '2028',
        condition: 'Lottery',
        ifTriggered: 'convert',
        rollToYear: '',
        convertToRound: '2',
      },
    ];

    const doc = buildEntitlementDocument(formState);
    const ladder = doc.protectionLadder as Array<Record<string, unknown>>;
    expect(ladder[0].ifTriggered).toBe('convert');
    expect(ladder[0].convertToRound).toBe(2);
  });
});
