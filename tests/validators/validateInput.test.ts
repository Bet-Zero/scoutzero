import { describe, expect, it } from 'vitest';
import { validateTradeInput } from '@/features/architect/utils/tradeMachine/utils/validateInput.ts';
import { validateTradeInput as utilsValidateTradeInput } from '@/features/architect/utils/tradeMachine/utils';
import capProjections from '@/features/architect/utils/capProjections';

const currentYear = 2025;

describe('validateTradeInput canonical surfaces', () => {
  it('preserves helper identity through the utils barrel', () => {
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
