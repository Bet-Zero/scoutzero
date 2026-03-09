import { describe, expect, it } from 'vitest';
import * as tradeUtilityMisc from '@/features/architect/utils/tradeMachine/utils/tradeUtilityMisc.js';
import * as tradeUtilities from '@/features/architect/utils/tradeMachine/utils/tradeUtilities.js';

describe('tradeUtilityMisc surface', () => {
  it('keeps direct shim and tradeUtilities barrel exports aligned', () => {
    expect(tradeUtilities.isExpired).toBe(tradeUtilityMisc.isExpired);
    expect(tradeUtilities.formatDate).toBe(tradeUtilityMisc.formatDate);
    expect(tradeUtilities.formatSalary).toBe(tradeUtilityMisc.formatSalary);
    expect(tradeUtilities.isMeaningfulProtection).toBe(
      tradeUtilityMisc.isMeaningfulProtection
    );
    expect(tradeUtilities.getPickOptions).toBe(tradeUtilityMisc.getPickOptions);
    expect(tradeUtilities.normalizeProtectionValue).toBe(
      tradeUtilityMisc.normalizeProtectionValue
    );
  });

  it('preserves isExpired behavior through both import paths', () => {
    const pastDate = '2000-01-01T12:00:00';
    const futureDate = '2999-01-01T12:00:00';

    expect(tradeUtilityMisc.isExpired(null)).toBe(false);
    expect(tradeUtilities.isExpired(null)).toBe(false);
    expect(tradeUtilityMisc.isExpired(pastDate)).toBe(true);
    expect(tradeUtilities.isExpired(pastDate)).toBe(true);
    expect(tradeUtilityMisc.isExpired(futureDate)).toBe(false);
    expect(tradeUtilities.isExpired(futureDate)).toBe(false);
  });

  it('preserves formatDate behavior through both import paths', () => {
    const middayDate = '2026-01-15T12:00:00';

    expect(tradeUtilityMisc.formatDate(null)).toBe('N/A');
    expect(tradeUtilities.formatDate(null)).toBe('N/A');
    expect(tradeUtilityMisc.formatDate(middayDate)).toBe('Jan 15, 2026');
    expect(tradeUtilities.formatDate(middayDate)).toBe('Jan 15, 2026');
  });

  it('preserves formatSalary behavior through both import paths', () => {
    expect(tradeUtilityMisc.formatSalary(undefined)).toBe('$0');
    expect(tradeUtilities.formatSalary(undefined)).toBe('$0');
    expect(tradeUtilityMisc.formatSalary(1234567)).toBe('$1,234,567');
    expect(tradeUtilities.formatSalary(1234567)).toBe('$1,234,567');
  });

  it('preserves normalizeProtectionValue behavior through both import paths', () => {
    const passThroughValue = { label: 'keep me' };

    expect(tradeUtilityMisc.normalizeProtectionValue(null)).toBeNull();
    expect(tradeUtilities.normalizeProtectionValue(null)).toBeNull();
    expect(tradeUtilityMisc.normalizeProtectionValue(0)).toBeNull();
    expect(tradeUtilities.normalizeProtectionValue(0)).toBeNull();
    expect(tradeUtilityMisc.normalizeProtectionValue('Swap (+)')).toBeNull();
    expect(tradeUtilities.normalizeProtectionValue('Swap (+)')).toBeNull();
    expect(tradeUtilityMisc.normalizeProtectionValue('Swap (-)')).toBeNull();
    expect(tradeUtilities.normalizeProtectionValue('Swap (-)')).toBeNull();
    expect(tradeUtilityMisc.normalizeProtectionValue('Top 5')).toBe('Top 5');
    expect(tradeUtilities.normalizeProtectionValue('Top 5')).toBe('Top 5');
    expect(tradeUtilityMisc.normalizeProtectionValue(passThroughValue)).toBe(
      passThroughValue
    );
    expect(tradeUtilities.normalizeProtectionValue(passThroughValue)).toBe(
      passThroughValue
    );
  });

  it('preserves representative protection helper behavior through both import paths', () => {
    const pickWithMeta = {
      protection: 'Top 3',
      protectionMeta: {
        type: 'position',
        maxPosition: 3,
      },
    };

    expect(tradeUtilityMisc.isMeaningfulProtection('Top 5')).toBe(true);
    expect(tradeUtilities.isMeaningfulProtection('Top 5')).toBe(true);
    expect(tradeUtilityMisc.isMeaningfulProtection('Swap (+)')).toBe(false);
    expect(tradeUtilities.isMeaningfulProtection('Swap (+)')).toBe(false);
    expect(tradeUtilityMisc.isMeaningfulProtection(pickWithMeta)).toBe(true);
    expect(tradeUtilities.isMeaningfulProtection(pickWithMeta)).toBe(true);

    expect(tradeUtilityMisc.getPickOptions()).toEqual(
      tradeUtilities.getPickOptions()
    );
    expect(tradeUtilityMisc.getPickOptions().map((option) => option.value)).toEqual([
      '',
      'Top 3',
      'Top 5',
      'Top 8',
      'Top 10',
      'Lottery',
      'Top 20',
    ]);
  });
});
