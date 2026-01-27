/**
 * FILE: src/tests/architect/apronSemantics.test.js
 * PURPOSE: Guards against reversion of Second Apron semantic unification (Phase 38).
 *          Ensures "Second Apron Team" status requires STRICTLY > secondApron.
 */

import { describe, it, expect } from 'vitest';
import { getApronStatus as getLegacyApronStatus } from '@/features/architect/utils/capUtils';
import { getApronStatus as getTradeApronStatus } from '@/features/architect/utils/tradeHelpers';
// We need to import the internal helper from capLegalityValidation to test it directly
// Since it's not exported, we'll test it via public behavior if possible, or import if exported.
// Note: getHardCapStatus is internal to capLegalityValidation.
// Ideally we'd test a public function that relies on it. 
// OR, we can rely on the fact that we changed the code, and if we want to test it
// we'd need to mock the inputs to a public validator.
// Let's test the exported modules directly first.

describe('Phase 38: Second Apron Semantics Guardrails', () => {
  const CAP_SETTINGS = {
    salaryCap: 100,
    firstApron: 120,
    secondApron: 130
  };

  describe('Legacy capUtils.getApronStatus (Delegates to SSOT)', () => {
    it('returns ABOVE_SECOND_APRON only when strictly > secondApron', () => {
      // Case 1: Strictly Over
      expect(getLegacyApronStatus(131, CAP_SETTINGS)).toBe('ABOVE_SECOND_APRON');
      
      // Case 2: Exactly On Limit (Boundary)
      // Should NOT be second apron
      // It should be ABOVE_FIRST_APRON because 130 >= 120
      expect(getLegacyApronStatus(130, CAP_SETTINGS)).toBe('ABOVE_FIRST_APRON');
      
      // Case 3: Between aprons
      expect(getLegacyApronStatus(125, CAP_SETTINGS)).toBe('ABOVE_FIRST_APRON');
    });
  });

  describe('tradeHelpers.getApronStatus', () => {
    it('returns "2nd Apron" only when strictly > secondApron', () => {
       // Case 1: Strictly Over
       expect(getTradeApronStatus(131, CAP_SETTINGS)).toBe('2nd Apron');

       // Case 2: Exactly On Limit (Boundary)
       // Should match 1st Apron logic (>= firstApron)
       expect(getTradeApronStatus(130, CAP_SETTINGS)).toBe('1st Apron');
    });
  });
});
