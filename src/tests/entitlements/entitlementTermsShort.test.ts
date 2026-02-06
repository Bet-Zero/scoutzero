/**
 * FILE: src/tests/entitlements/entitlementTermsShort.test.ts
 * PURPOSE: Test formatEntitlementTermsShort() swapType visibility (TM-6)
 * OWNERSHIP: Test suite
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeEntitlementTerms,
  formatEntitlementTermsShort,
} from '@/features/architect/utils/entitlements/entitlementTerms';

describe('formatEntitlementTermsShort - TM-6 swapType visibility', () => {
  it('shows "Swap best" for best_of swapType', () => {
    const entitlement = {
      kind: 'swap_right',
      seasonYear: 2028,
      round: 1,
      swapType: 'best_of',
      swapControllerPickId: 'LAL_2028_1st',
      swapTargetDefinition: 'Option to swap with MIL',
    };
    const terms = normalizeEntitlementTerms(entitlement);
    const result = formatEntitlementTermsShort(terms);
    expect(result).toBe('Swap best (2028)');
  });

  it('shows "Swap worst" for worst_of swapType', () => {
    const entitlement = {
      kind: 'swap_right',
      seasonYear: 2028,
      round: 1,
      swapType: 'worst_of',
      swapControllerPickId: 'LAL_2028_1st',
      swapTargetDefinition: 'Must take worst of pool',
    };
    const terms = normalizeEntitlementTerms(entitlement);
    const result = formatEntitlementTermsShort(terms);
    expect(result).toBe('Swap worst (2028)');
  });

  it('defaults to "Swap best" when swapType is missing', () => {
    const entitlement = {
      kind: 'swap_right',
      seasonYear: 2027,
      round: 1,
      swapControllerPickId: 'BOS_2027_1st',
      swapTargetDefinition: 'Option to swap with PHI',
    };
    const terms = normalizeEntitlementTerms(entitlement);
    const result = formatEntitlementTermsShort(terms);
    expect(result).toBe('Swap best (2027)');
  });

  it('shows "Swap best" without year when seasonYear is missing', () => {
    const entitlement = {
      kind: 'swap_right',
      round: 1,
      swapType: 'best_of',
      swapControllerPickId: 'CHI_2029_1st',
    };
    const terms = normalizeEntitlementTerms(entitlement);
    const result = formatEntitlementTermsShort(terms);
    expect(result).toBe('Swap best');
  });

  it('shows "Swap worst" without year when seasonYear is missing', () => {
    const entitlement = {
      kind: 'swap_right',
      round: 1,
      swapType: 'worst_of',
      swapControllerPickId: 'CHI_2029_1st',
    };
    const terms = normalizeEntitlementTerms(entitlement);
    const result = formatEntitlementTermsShort(terms);
    expect(result).toBe('Swap worst');
  });

  it('parses worst_of from swapTargetDefinition when explicit swapType missing', () => {
    const entitlement = {
      kind: 'swap_right',
      seasonYear: 2029,
      round: 1,
      swapControllerPickId: 'MIA_2029_1st',
      swapTargetDefinition: 'Must take worst of MIA/ATL/ORL',
    };
    const terms = normalizeEntitlementTerms(entitlement);
    const result = formatEntitlementTermsShort(terms);
    expect(result).toBe('Swap worst (2029)');
  });

  it('parses worst_of from description when explicit swapType missing', () => {
    const entitlement = {
      kind: 'swap_right',
      seasonYear: 2030,
      round: 1,
      swapControllerPickId: 'OKC_2030_1st',
      description: 'Less favorable pick in the pool',
    };
    const terms = normalizeEntitlementTerms(entitlement);
    const result = formatEntitlementTermsShort(terms);
    expect(result).toBe('Swap worst (2030)');
  });
});
