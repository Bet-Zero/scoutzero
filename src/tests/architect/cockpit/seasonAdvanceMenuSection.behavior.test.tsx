/**
 * FILE: src/tests/architect/cockpit/seasonAdvanceMenuSection.behavior.test.tsx
 * PURPOSE: Guard the relocated Season Advance trigger (BZE-250). Season advance
 *          moved out of the V1-hidden Offseason room into the top-bar World-menu
 *          popover; this section is the trigger surface. Pins that it exposes the
 *          Advance Season + Draft positions actions, honestly gates them on an
 *          active world / loaded season, and fires the open callbacks.
 * OWNERSHIP: Test suite
 */
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { SeasonAdvanceMenuSection } from '@/features/architect/cockpit/SeasonAdvanceMenuSection';

afterEach(cleanup);

const baseProps = {
  hasActiveWorld: true,
  canAdvance: true,
  worldSeasonLabel: '2026-27',
  worldSeasonLoading: false,
  disabledReason: null as string | null,
  onOpenAdvance: () => undefined,
  onOpenDraftPositions: () => undefined,
};

describe('SeasonAdvanceMenuSection (relocated World-menu Season Advance)', () => {
  it('shows the current world season and both actions when a world is active', () => {
    render(<SeasonAdvanceMenuSection {...baseProps} />);
    expect(
      screen.getByText(/Current world season: 2026-27/i)
    ).toBeInTheDocument();
    expect(screen.getByTestId('cockpit-season-advance-open')).toBeEnabled();
    expect(
      screen.getByTestId('cockpit-season-advance-draft-positions')
    ).toBeEnabled();
  });

  it('opens the advance wizard and the draft-positions editor via callbacks', () => {
    const onOpenAdvance = vi.fn();
    const onOpenDraftPositions = vi.fn();
    render(
      <SeasonAdvanceMenuSection
        {...baseProps}
        onOpenAdvance={onOpenAdvance}
        onOpenDraftPositions={onOpenDraftPositions}
      />
    );
    fireEvent.click(screen.getByTestId('cockpit-season-advance-open'));
    fireEvent.click(
      screen.getByTestId('cockpit-season-advance-draft-positions')
    );
    expect(onOpenAdvance).toHaveBeenCalledTimes(1);
    expect(onOpenDraftPositions).toHaveBeenCalledTimes(1);
  });

  it('disables advance (but not by rendering the room) when the season is still loading', () => {
    render(
      <SeasonAdvanceMenuSection
        {...baseProps}
        canAdvance={false}
        worldSeasonLabel={null}
        worldSeasonLoading
      />
    );
    expect(screen.getByText(/Loading world season/i)).toBeInTheDocument();
    expect(screen.getByTestId('cockpit-season-advance-open')).toBeDisabled();
  });

  it('honestly gates on an active world and surfaces the reason', () => {
    const onOpenAdvance = vi.fn();
    render(
      <SeasonAdvanceMenuSection
        {...baseProps}
        hasActiveWorld={false}
        canAdvance={false}
        worldSeasonLabel={null}
        disabledReason="Select a world to unlock season advance."
        onOpenAdvance={onOpenAdvance}
      />
    );
    expect(
      screen.getByText(/Select a world to unlock season advance\./i)
    ).toBeInTheDocument();
    const advance = screen.getByTestId('cockpit-season-advance-open');
    expect(advance).toBeDisabled();
    expect(
      screen.getByTestId('cockpit-season-advance-draft-positions')
    ).toBeDisabled();
    fireEvent.click(advance);
    expect(onOpenAdvance).not.toHaveBeenCalled();
  });
});
