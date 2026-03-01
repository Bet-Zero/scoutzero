// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ValidationDetailsPanel from '@/features/architect/tradeMachine/ValidationDetailsPanel';

function openDevTools() {
  fireEvent.click(screen.getByRole('button', { name: /Development Tools/i }));
}

describe('ValidationDetailsPanel DEV S&T injector controls', () => {
  it('does not render injector controls when showSntInjector is false', () => {
    render(<ValidationDetailsPanel hasValidatorResult />);
    openDevTools();

    expect(screen.queryByTestId('section-snt-injector')).not.toBeInTheDocument();
  });

  it('renders injector controls and fires callbacks when enabled', () => {
    const onInject = vi.fn();
    const onClear = vi.fn();

    render(
      <ValidationDetailsPanel
        showSntInjector
        hasInjectedSntPlayers
        onInjectSntPlayers={onInject}
        onClearInjectedSntPlayers={onClear}
      />
    );

    openDevTools();

    expect(screen.getByTestId('section-snt-injector')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Inject S&T Test Players' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear Injected Players' }));

    expect(onInject).toHaveBeenCalledTimes(1);
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});

