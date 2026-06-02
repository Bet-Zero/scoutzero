/**
 * FILE: src/tests/architect/cockpit/TradeOverlay.test.tsx
 * PURPOSE: Guard the core promise of the Trade Machine overlay — that closing
 *          and reopening it does NOT unmount its child subtree, so an
 *          in-progress draft (and any local UI state) is exactly where the
 *          user left it on reopen. Also covers the close affordances.
 * OWNERSHIP: Test suite
 */
import { afterEach, describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import {
  cleanup,
  render,
  screen,
  fireEvent,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TradeOverlay } from '@/features/architect/cockpit/TradeOverlay';

afterEach(cleanup);

/**
 * Stand-in for TradeEditor: owns local state we can mutate, so we can prove the
 * subtree survives an open→closed→open cycle without remounting (a remount
 * would reset the counter back to 0).
 */
const StatefulChild = () => {
  const [count, setCount] = useState(0);
  return (
    <div>
      <span data-testid="draft-count">{count}</span>
      <button type="button" onClick={() => setCount((c) => c + 1)}>
        add asset
      </button>
    </div>
  );
};

describe('TradeOverlay', () => {
  it('keeps its child mounted across close/reopen so the draft persists', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <TradeOverlay open onClose={onClose}>
        <StatefulChild />
      </TradeOverlay>
    );

    // Build up some "draft" state.
    fireEvent.click(screen.getByText('add asset'));
    fireEvent.click(screen.getByText('add asset'));
    fireEvent.click(screen.getByText('add asset'));
    expect(screen.getByTestId('draft-count')).toHaveTextContent('3');

    // Close the overlay — the host keeps it mounted, only toggling `open`.
    rerender(
      <TradeOverlay open={false} onClose={onClose}>
        <StatefulChild />
      </TradeOverlay>
    );
    // Hidden, but still in the DOM (not unmounted).
    const overlay = screen.getByTestId('trade-overlay');
    expect(overlay).toHaveAttribute('data-open', 'false');
    expect(overlay).toHaveClass('hidden');
    expect(screen.getByTestId('draft-count')).toHaveTextContent('3');

    // Reopen — state is exactly where we left it (no remount → still 3).
    rerender(
      <TradeOverlay open onClose={onClose}>
        <StatefulChild />
      </TradeOverlay>
    );
    expect(screen.getByTestId('trade-overlay')).toHaveAttribute(
      'data-open',
      'true'
    );
    expect(screen.getByTestId('draft-count')).toHaveTextContent('3');
  });

  it('closes via the close button and the Escape key while open', () => {
    const onClose = vi.fn();
    render(
      <TradeOverlay open onClose={onClose}>
        <div>body</div>
      </TradeOverlay>
    );

    fireEvent.click(screen.getByTestId('trade-overlay-close'));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('does not respond to Escape while closed', () => {
    const onClose = vi.fn();
    render(
      <TradeOverlay open={false} onClose={onClose}>
        <div>body</div>
      </TradeOverlay>
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
