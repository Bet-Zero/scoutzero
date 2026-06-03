/**
 * FILE: src/tests/architect/cockpit/playerActionMenu.test.tsx
 * PURPOSE: Unit coverage for the unified PlayerActionMenu foundation
 *          (interconnectivity Slice 2a): the context builder's id/label
 *          resolution and the menu's intent-only emission (primary buttons,
 *          pin↔unpin toggle, overflow menu, Full-Cap-only extraItems).
 * OWNERSHIP: Feature: architect/cockpit
 */
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {
  PlayerActionMenu,
  type PlayerActionContext,
} from '@/features/architect/cockpit';

// Pure builder logic is covered in playerActionContext.test.ts (node gate);
// this file covers the component's intent-only rendering under jsdom.

const CONTEXT: PlayerActionContext = {
  playerId: 'p1',
  playerLabel: 'LeBron James',
  sourceRoom: 'roster',
};

describe('PlayerActionMenu', () => {
  afterEach(() => cleanup());

  it('renders visible actions as primary buttons and emits the action + context', () => {
    const onAction = vi.fn();
    render(
      <PlayerActionMenu
        context={CONTEXT}
        visibleActions={['open', 'pin', 'trade']}
        onAction={onAction}
      />
    );
    fireEvent.click(screen.getByTestId('player-action-menu-open'));
    expect(onAction).toHaveBeenCalledWith('open', CONTEXT);
    fireEvent.click(screen.getByTestId('player-action-menu-trade'));
    expect(onAction).toHaveBeenCalledWith('trade', CONTEXT);
  });

  it('shows Pin and emits "pin" when not pinned', () => {
    const onAction = vi.fn();
    render(
      <PlayerActionMenu
        context={CONTEXT}
        visibleActions={['pin']}
        onAction={onAction}
      />
    );
    const btn = screen.getByTestId('player-action-menu-pin');
    expect(btn).toHaveTextContent('Pin');
    fireEvent.click(btn);
    expect(onAction).toHaveBeenCalledWith('pin', CONTEXT);
  });

  it('shows Unpin and emits "unpin" when already pinned', () => {
    const onAction = vi.fn();
    render(
      <PlayerActionMenu
        context={CONTEXT}
        visibleActions={['pin']}
        isPinned
        onAction={onAction}
      />
    );
    const btn = screen.getByTestId('player-action-menu-pin');
    expect(btn).toHaveTextContent('Unpin');
    fireEvent.click(btn);
    expect(onAction).toHaveBeenCalledWith('unpin', CONTEXT);
  });

  it('hides the overflow trigger when there is nothing to overflow', () => {
    render(
      <PlayerActionMenu
        context={CONTEXT}
        visibleActions={['open']}
        onAction={vi.fn()}
      />
    );
    expect(screen.queryByTestId('player-action-menu-overflow')).toBeNull();
  });

  it('opens the overflow menu and emits overflow actions', () => {
    const onAction = vi.fn();
    render(
      <PlayerActionMenu
        context={CONTEXT}
        visibleActions={['open']}
        overflowActions={['view-on-cap', 'find-in-history']}
        onAction={onAction}
      />
    );
    expect(screen.queryByTestId('player-action-menu-overflow-menu')).toBeNull();
    fireEvent.click(screen.getByTestId('player-action-menu-overflow'));
    expect(
      screen.getByTestId('player-action-menu-overflow-menu')
    ).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('player-action-menu-overflow-view-on-cap'));
    expect(onAction).toHaveBeenCalledWith('view-on-cap', CONTEXT);
  });

  it('renders Full-Cap-only extraItems in the overflow and routes them to their own owner', () => {
    const onAction = vi.fn();
    const onWaive = vi.fn();
    render(
      <PlayerActionMenu
        context={CONTEXT}
        visibleActions={['open']}
        overflowActions={['view-on-roster']}
        extraItems={[
          { id: 'waive', label: 'Waive', onSelect: onWaive, testId: 'fullcap-waive' },
        ]}
        onAction={onAction}
      />
    );
    fireEvent.click(screen.getByTestId('player-action-menu-overflow'));
    fireEvent.click(screen.getByTestId('fullcap-waive'));
    expect(onWaive).toHaveBeenCalledTimes(1);
    // extraItems must NOT flow through the universal intent sink.
    expect(onAction).not.toHaveBeenCalled();
  });

  it('namespaces test ids by testIdPrefix', () => {
    render(
      <PlayerActionMenu
        context={CONTEXT}
        visibleActions={['open']}
        overflowActions={['view-on-cap']}
        onAction={vi.fn()}
        testIdPrefix="cap-sheet-full-player-row"
      />
    );
    expect(
      screen.getByTestId('cap-sheet-full-player-row')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('cap-sheet-full-player-row-open')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('cap-sheet-full-player-row-overflow')
    ).toBeInTheDocument();
  });
});
