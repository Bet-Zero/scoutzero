import { describe, expect, it } from 'vitest';
import { validateTradeInput } from '@/features/architect/utils/tradeMachine/utils/validateInput.ts';
import { validateTradeInput as compatValidateTradeInput } from '@/features/architect/utils/tradeMachine/validators/index.js';
import { validateTradeInput as utilsValidateTradeInput } from '@/features/architect/utils/tradeMachine/utils/index.js';
import capProjections from '@/features/architect/utils/capProjections.js';

const currentYear = 2025;

describe('validateTradeInput compatibility surface', () => {
  it('preserves helper identity through the kept compatibility barrels', () => {
    expect(compatValidateTradeInput).toBe(validateTradeInput);
    expect(utilsValidateTradeInput).toBe(validateTradeInput);
  });

  it('preserves authoritative validateTradeInput behavior', () => {
    expect(
      validateTradeInput({
        capProjections,
        currentYear,
      })
    ).toEqual(['Teams must be provided as an array']);
  });
});
