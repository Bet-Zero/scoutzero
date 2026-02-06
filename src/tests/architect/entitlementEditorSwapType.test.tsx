/**
 * FILE: src/tests/architect/entitlementEditorSwapType.test.tsx
 * PURPOSE: Tests for TM-7 swapType round-trip: form -> document -> form, and preview display.
 * OWNERSHIP: Test suite (TM-7)
 */

import { describe, it, expect } from 'vitest';
import {
  createEntitlementFormState,
  buildEntitlementDocument,
} from '@/features/architect/admin/entitlementEditorFormState';

describe('TM-7: swapType round-trip', () => {
  it('initializes swapType from empty initialDocument', () => {
    const formState = createEntitlementFormState({
      holderTeam: 'BOS',
      seasonYear: 2027,
      round: 1,
      kind: 'swap_right',
    });
    expect(formState.swapType).toBe('');
  });

  it('initializes swapType from initialDocument with best_of', () => {
    const formState = createEntitlementFormState({
      holderTeam: 'BOS',
      seasonYear: 2027,
      round: 1,
      kind: 'swap_right',
      swapType: 'best_of',
    });
    expect(formState.swapType).toBe('best_of');
  });

  it('initializes swapType from initialDocument with worst_of', () => {
    const formState = createEntitlementFormState({
      holderTeam: 'LAL',
      seasonYear: 2028,
      round: 1,
      kind: 'swap_right',
      swapType: 'worst_of',
    });
    expect(formState.swapType).toBe('worst_of');
  });

  it('round-trips swapType through document build', () => {
    const formState = createEntitlementFormState({
      holderTeam: 'MIA',
      seasonYear: 2026,
      round: 1,
      kind: 'swap_right',
      swapType: 'best_of',
      swapControllerPickId: 'MIA_2026_1st',
      swapTargetDefinition: 'PHI 2026 1st',
    });

    const doc = buildEntitlementDocument(formState);
    expect(doc.swapType).toBe('best_of');

    // Now re-create form state from the built document
    const restored = createEntitlementFormState(doc as Record<string, unknown>);
    expect(restored.swapType).toBe('best_of');
  });

  it('omits swapType from document when empty', () => {
    const formState = createEntitlementFormState({
      holderTeam: 'ATL',
      seasonYear: 2027,
      round: 1,
      kind: 'swap_right',
      swapControllerPickId: 'ATL_2027_1st',
    });

    const doc = buildEntitlementDocument(formState);
    expect(doc.swapType).toBeUndefined();
  });

  it('preserves swapType when updating other fields', () => {
    const formState = createEntitlementFormState({
      holderTeam: 'DEN',
      seasonYear: 2028,
      round: 1,
      kind: 'swap_right',
      swapType: 'worst_of',
      swapControllerPickId: 'DEN_2028_1st',
      swapTargetDefinition: 'OKC 2028 1st',
    });

    // Simulate user changing target definition
    const updatedState = { ...formState, swapTargetDefinition: 'SAS 2028 1st' };
    const doc = buildEntitlementDocument(updatedState);

    expect(doc.swapType).toBe('worst_of');
    expect(doc.swapTargetDefinition).toBe('SAS 2028 1st');
  });
});
