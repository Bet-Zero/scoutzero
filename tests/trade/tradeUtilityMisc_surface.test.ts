import { describe, expect, it } from 'vitest';
import * as utilsBarrel from '@/features/architect/utils/tradeMachine/utils';
import * as tradeUtilityMisc from '@/features/architect/utils/tradeMachine/utils/tradeUtilityMisc';
import * as tpeValidation from '@/features/architect/utils/tradeMachine/utils/tpeValidation';

describe('trade utility surface', () => {
  it('keeps misc helper identity through the surviving utils barrel', () => {
    expect(utilsBarrel.isExpired).toBe(tradeUtilityMisc.isExpired);
    expect(utilsBarrel.formatDate).toBe(tradeUtilityMisc.formatDate);
    expect(utilsBarrel.formatSalary).toBe(tradeUtilityMisc.formatSalary);
    expect(utilsBarrel.isMeaningfulProtection).toBe(
      tradeUtilityMisc.isMeaningfulProtection
    );
    expect(utilsBarrel.getPickOptions).toBe(tradeUtilityMisc.getPickOptions);
    expect(utilsBarrel.normalizeProtectionValue).toBe(
      tradeUtilityMisc.normalizeProtectionValue
    );
  });

  it('keeps TPE helper identity through the surviving utils barrel', () => {
    expect(utilsBarrel.createTPE).toBe(tpeValidation.createTPE);
    expect(utilsBarrel.isPriorYearTPE).toBe(tpeValidation.isPriorYearTPE);
  });

  it('preserves isExpired behavior through both import paths', () => {
    const pastDate = '2000-01-01T12:00:00';
    const futureDate = '2999-01-01T12:00:00';

    expect(tradeUtilityMisc.isExpired(null)).toBe(false);
    expect(utilsBarrel.isExpired(null)).toBe(false);
    expect(tradeUtilityMisc.isExpired(pastDate)).toBe(true);
    expect(utilsBarrel.isExpired(pastDate)).toBe(true);
    expect(tradeUtilityMisc.isExpired(futureDate)).toBe(false);
    expect(utilsBarrel.isExpired(futureDate)).toBe(false);
  });

  it('preserves formatDate behavior through both import paths', () => {
    const middayDate = '2026-01-15T12:00:00';

    expect(tradeUtilityMisc.formatDate(null)).toBe('N/A');
    expect(utilsBarrel.formatDate(null)).toBe('N/A');
    expect(tradeUtilityMisc.formatDate(middayDate)).toBe('Jan 15, 2026');
    expect(utilsBarrel.formatDate(middayDate)).toBe('Jan 15, 2026');
  });

  it('preserves formatSalary behavior through both import paths', () => {
    expect(tradeUtilityMisc.formatSalary(undefined)).toBe('$0');
    expect(utilsBarrel.formatSalary(undefined)).toBe('$0');
    expect(tradeUtilityMisc.formatSalary(1234567)).toBe('$1,234,567');
    expect(utilsBarrel.formatSalary(1234567)).toBe('$1,234,567');
  });

  it('preserves normalizeProtectionValue behavior through both import paths', () => {
    const passThroughValue = { label: 'keep me' };

    expect(tradeUtilityMisc.normalizeProtectionValue(null)).toBeNull();
    expect(utilsBarrel.normalizeProtectionValue(null)).toBeNull();
    expect(tradeUtilityMisc.normalizeProtectionValue(0)).toBeNull();
    expect(utilsBarrel.normalizeProtectionValue(0)).toBeNull();
    expect(tradeUtilityMisc.normalizeProtectionValue('Swap (+)')).toBeNull();
    expect(utilsBarrel.normalizeProtectionValue('Swap (+)')).toBeNull();
    expect(tradeUtilityMisc.normalizeProtectionValue('Swap (-)')).toBeNull();
    expect(utilsBarrel.normalizeProtectionValue('Swap (-)')).toBeNull();
    expect(tradeUtilityMisc.normalizeProtectionValue('Top 5')).toBe('Top 5');
    expect(utilsBarrel.normalizeProtectionValue('Top 5')).toBe('Top 5');
    expect(tradeUtilityMisc.normalizeProtectionValue(passThroughValue)).toBe(
      passThroughValue
    );
    expect(utilsBarrel.normalizeProtectionValue(passThroughValue)).toBe(
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
    expect(utilsBarrel.isMeaningfulProtection('Top 5')).toBe(true);
    expect(tradeUtilityMisc.isMeaningfulProtection('Swap (+)')).toBe(false);
    expect(utilsBarrel.isMeaningfulProtection('Swap (+)')).toBe(false);
    expect(tradeUtilityMisc.isMeaningfulProtection(pickWithMeta)).toBe(true);
    expect(utilsBarrel.isMeaningfulProtection(pickWithMeta)).toBe(true);

    expect(tradeUtilityMisc.getPickOptions()).toEqual(
      utilsBarrel.getPickOptions()
    );
    expect(
      tradeUtilityMisc.getPickOptions().map((option) => option.value)
    ).toEqual(['', 'Top 3', 'Top 5', 'Top 8', 'Top 10', 'Lottery', 'Top 20']);
  });
});
