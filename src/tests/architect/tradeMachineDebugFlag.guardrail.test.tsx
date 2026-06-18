// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  TRADE_MACHINE_DEBUG_FLAG,
  isTradeMachineDebugEnabled,
} from '@/features/architect/tradeMachine/utils/tradeMachineDebugFlag';

afterEach(() => {
  window.localStorage.clear();
});

describe('Trade Machine debug flag', () => {
  it('does not expose Development Tools by default in dev/test builds', () => {
    expect(isTradeMachineDebugEnabled()).toBe(false);
  });

  it('exposes Development Tools only when the explicit runtime flag is set', () => {
    window.localStorage.setItem(TRADE_MACHINE_DEBUG_FLAG, 'true');

    expect(isTradeMachineDebugEnabled()).toBe(true);
  });
});
