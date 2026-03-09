import { describe, expect, it } from 'vitest';
import { validateTradeInput } from '@/features/architect/utils/tradeMachine/utils/validateInput.js';
import { validateTradeInput as compatValidateTradeInput } from '@/features/architect/utils/tradeMachine/validators/index.js';
import capProjections from '@/features/architect/utils/capProjections.js';

const currentYear = 2025;

describe('validateTradeInput JS shim', () => {
  it('preserves helper identity through the validator compatibility path', () => {
    expect(compatValidateTradeInput).toBe(validateTradeInput);
  });

  it('preserves direct validateInput.js behavior', () => {
    expect(
      validateTradeInput({
        capProjections,
        currentYear,
      })
    ).toEqual(['Teams must be provided as an array']);
  });
});
