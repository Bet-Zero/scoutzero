/**
 * FILE: src/tests/architect/pickTermsPreview.test.tsx
 * PURPOSE: Tests for TM-7 PickTermsPreview component data computation.
 * OWNERSHIP: Test suite (TM-7)
 */

import { describe, it, expect } from 'vitest';
import {
  createEntitlementFormState,
  buildEntitlementDocument,
} from '@/features/architect/admin/entitlementEditorFormState';
import {
  normalizeEntitlementTerms,
  formatEntitlementTermsShort,
} from '@/features/architect/utils/entitlements/entitlementTerms';

/**
 * Helper: simulate the same data pipeline the PickTermsPreview component uses.
 */
const computePreview = (initialDoc: Record<string, unknown>) => {
  const formState = createEntitlementFormState(initialDoc);
  const document = buildEntitlementDocument(formState);
  const terms = normalizeEntitlementTerms(document);
  const termsShort = formatEntitlementTermsShort(terms);
  return { formState, document, terms, termsShort };
};

describe('TM-7: PickTermsPreview data pipeline', () => {
  it('produces termsShort for a protection ladder entitlement', () => {
    const { terms, termsShort } = computePreview({
      holderTeam: 'LAL',
      seasonYear: 2026,
      round: 1,
      kind: 'pick_ownership',
      underlyingPickId: 'LAL_2026_1st',
      protectionLadder: [
        {
          year: 2026,
          condition: 'Top 3',
          ifTriggered: 'roll',
          rollToYear: 2027,
        },
        { year: 2027, condition: '', ifTriggered: 'cancel' },
      ],
    });

    expect(terms.hasProtectionLadder).toBe(true);
    expect(terms.hasSwap).toBe(false);
    expect(terms.hasConveyance).toBe(false);
    expect(termsShort).toBeTruthy();
    expect(typeof termsShort).toBe('string');
    expect(termsShort.length).toBeGreaterThan(0);
  });

  it('produces termsShort for a swap entitlement with best_of', () => {
    const { terms, termsShort } = computePreview({
      holderTeam: 'BOS',
      seasonYear: 2027,
      round: 1,
      kind: 'swap_right',
      swapControllerPickId: 'BOS_2027_1st',
      swapTargetDefinition: 'PHI 2027 1st',
      swapType: 'best_of',
    });

    expect(terms.hasSwap).toBe(true);
    expect(termsShort).toBeTruthy();
  });

  it('produces termsShort for a swap entitlement with worst_of', () => {
    const { terms, termsShort } = computePreview({
      holderTeam: 'MIA',
      seasonYear: 2028,
      round: 1,
      kind: 'swap_right',
      swapControllerPickId: 'MIA_2028_1st',
      swapTargetDefinition: 'NYK 2028 1st',
      swapType: 'worst_of',
    });

    expect(terms.hasSwap).toBe(true);
    expect(termsShort).toBeTruthy();
  });

  it('produces termsShort for a conveyance entitlement', () => {
    const { terms, termsShort } = computePreview({
      holderTeam: 'GSW',
      seasonYear: 2027,
      round: 1,
      kind: 'conveyance_right',
      poolUnderlyingPickIds: ['ATL_2027_1st', 'SAS_2027_1st'],
      receivesRank: [1],
      receivesComparator: 'more_favorable',
    });

    expect(terms.hasConveyance).toBe(true);
    expect(termsShort).toBeTruthy();
  });

  it('returns empty termsShort for minimal ownership without ladder', () => {
    const { terms, termsShort } = computePreview({
      holderTeam: 'DEN',
      seasonYear: 2026,
      round: 1,
      kind: 'pick_ownership',
      underlyingPickId: 'DEN_2026_1st',
    });

    expect(terms.hasProtectionLadder).toBe(false);
    expect(terms.hasSwap).toBe(false);
    expect(terms.hasConveyance).toBe(false);
    // termsShort may be empty string for a simple ownership
    expect(typeof termsShort).toBe('string');
  });

  it('preview updates when form state changes', () => {
    const initialDoc = {
      holderTeam: 'PHI',
      seasonYear: 2026,
      round: 1,
      kind: 'pick_ownership',
      underlyingPickId: 'PHI_2026_1st',
    };

    // Initial - no ladder
    const preview1 = computePreview(initialDoc);
    expect(preview1.terms.hasProtectionLadder).toBe(false);

    // Now add a ladder
    const withLadder = {
      ...initialDoc,
      protectionLadder: [
        {
          year: 2026,
          condition: 'Lottery',
          ifTriggered: 'roll',
          rollToYear: 2027,
        },
      ],
    };
    const preview2 = computePreview(withLadder);
    expect(preview2.terms.hasProtectionLadder).toBe(true);
    expect(preview2.termsShort).not.toBe(preview1.termsShort);
  });
});
