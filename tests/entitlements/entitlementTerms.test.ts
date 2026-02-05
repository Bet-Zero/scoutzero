/**
 * FILE: tests/entitlements/entitlementTerms.test.ts
 * PURPOSE: Unit tests for entitlement terms normalization and formatting.
 * OWNERSHIP: Trade Machine / Entitlements
 * HISTORY:
 *  - 2026-02-05: Created for TM-5 entitlement terms normalization
 * LINKS:
 *  - src/features/architect/utils/entitlements/entitlementTerms.ts
 */

import { describe, it, expect } from 'vitest';
import {
  decorateEntitlementForTrade,
  formatEntitlementTermsShort,
  getEntitlementDraftKey,
  normalizeEntitlementTerms,
} from '@/features/architect/utils/entitlements/entitlementTerms';

describe('entitlementTerms', () => {
  it('returns empty terms for plain pick', () => {
    const entitlement = {
      id: 'ent:LAL:2026:1:own:plain',
      kind: 'pick_ownership',
      seasonYear: 2026,
      round: 1,
      underlyingPickId: 'LAL_2026_1st',
    };

    const terms = normalizeEntitlementTerms(entitlement);
    expect(terms.empty).toBe(true);
    expect(terms.hasProtectionLadder).toBe(false);
    expect(terms.hasSwap).toBe(false);
    expect(terms.hasConveyance).toBe(false);
    expect(formatEntitlementTermsShort(terms)).toBe('');
  });

  it('normalizes protection ladder and formats short text', () => {
    const entitlement = {
      id: 'ent:LAL:2026:1:own:ladder',
      kind: 'pick_ownership',
      seasonYear: 2026,
      round: 1,
      protectionLadder: [
        { year: 2026, condition: 'Top 3', ifTriggered: 'roll', rollToYear: 2027 },
        { year: 2027, condition: 'Top 5', ifTriggered: 'cancel' },
      ],
    };

    const terms = normalizeEntitlementTerms(entitlement);
    expect(terms.hasProtectionLadder).toBe(true);
    expect(terms.protectionLadder?.currentTier?.year).toBe(2026);
    expect(formatEntitlementTermsShort(terms)).toBe('Top 3 prot -> 2027 1st');
  });

  it('parses swap_right role and swapType', () => {
    const entitlement = {
      id: 'ent:LAL:2028:1:swap:abc',
      kind: 'swap_right',
      seasonYear: 2028,
      round: 1,
      swapControllerPickId: 'LAL_2028_1st',
      swapTargetDefinition: 'Less favorable of BOS/NYK',
    };

    const terms = normalizeEntitlementTerms(entitlement);
    expect(terms.swap?.role).toBe('swap_right');
    expect(terms.swap?.swapType).toBe('worst_of');
    expect(formatEntitlementTermsShort(terms)).toBe('Swap (2028)');
  });

  it('normalizes conveyance fields and formatting', () => {
    const entitlement = {
      id: 'ent:LAL:2029:1:conv:def',
      kind: 'conveyance_right',
      seasonYear: 2029,
      round: 1,
      poolUnderlyingPickIds: ['ATL_2029_1st', 'SAS_2029_1st'],
      receivesRank: [1],
      receivesComparator: 'less_favorable',
    };

    const terms = normalizeEntitlementTerms(entitlement);
    expect(terms.hasConveyance).toBe(true);
    expect(terms.conveyance?.poolUnderlyingPickIds?.length).toBe(2);
    expect(terms.conveyance?.receivesRank).toEqual([1]);
    expect(terms.conveyance?.receivesComparator).toBe('less_favorable');
    expect(formatEntitlementTermsShort(terms)).toBe('Conveys (ranked)');
  });

  it('decorates entitlement with terms, termsShort, and draftKey', () => {
    const entitlement = {
      id: 'ent:LAL:2027:1:swap:decor',
      kind: 'swap_right',
      seasonYear: 2027,
      round: 1,
      swapControllerPickId: 'LAL_2027_1st',
      swapTargetDefinition: 'Option to swap with MIL',
    };

    const decorated = decorateEntitlementForTrade(entitlement);
    expect(decorated?.terms).toBeDefined();
    expect(decorated?.termsShort).toBe('Swap (2027)');
    expect(decorated?.draftKey).toBeDefined();

    const terms = normalizeEntitlementTerms(entitlement);
    const key = getEntitlementDraftKey(entitlement, terms);
    expect(decorated?.draftKey).toBe(key);
  });
});
