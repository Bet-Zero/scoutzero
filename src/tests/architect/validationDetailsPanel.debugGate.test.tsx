// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Force the debug gate off so we exercise the finished-product view.
vi.mock(
  '@/features/architect/tradeMachine/utils/tradeMachineDebugFlag',
  () => ({
    TRADE_MACHINE_DEBUG_FLAG: 'hz.dev.tradeMachineDebug',
    isTradeMachineDebugEnabled: () => false,
  })
);

import { ValidationDetailsPanel } from '@/features/architect/tradeMachine/ValidationDetailsPanel';

afterEach(() => {
  cleanup();
});

describe('ValidationDetailsPanel debug gate', () => {
  it('hides the Development Tools panel when debug is disabled', () => {
    render(<ValidationDetailsPanel hasValidatorResult />);

    expect(
      screen.queryByRole('button', { name: /Development Tools/i })
    ).not.toBeInTheDocument();
  });

  it('still renders the production Validation Results panel', () => {
    render(<ValidationDetailsPanel hasValidatorResult />);

    expect(
      screen.getByRole('button', { name: /Validation Results/i })
    ).toBeInTheDocument();
  });
});
