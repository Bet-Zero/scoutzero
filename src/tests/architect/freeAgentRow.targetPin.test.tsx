/**
 * FILE: src/tests/architect/freeAgentRow.targetPin.test.tsx
 * PURPOSE: Cover the Free Agency row's unified player actions (interconnectivity
 *          Slice 2e): Pin-as-Target / Remove-target + Compare/Guide routing.
 *          FreeAgentRow renders no contract modal, so this avoids the broad FA
 *          pool suite's pre-existing EditContractModal-mock failures.
 * OWNERSHIP: Feature: architect/freeAgency
 */
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { FreeAgentRow } from '@/features/architect/freeAgency/FreeAgentPool/FreeAgentRow';
import type { FreeAgentSurfaceEntry } from '@/features/architect/freeAgency/FreeAgentPool/types';

const ENTRY: FreeAgentSurfaceEntry = {
  freeAgent: { name: 'Free Agent', birdRights: 'None' },
  surfacePlayer: {
    id: 'fa1',
    name: 'Free Agent',
    bio: { displayName: 'Free Agent', playerId: 'fa1' },
  },
  playerId: 'fa1',
  selectionKey: 'fa1',
};

afterEach(() => cleanup());

describe('FreeAgentRow — unified player actions', () => {
  it('pins a free agent as a target through onPlayerAction', () => {
    const onPlayerAction = vi.fn();
    render(
      <FreeAgentRow
        entry={ENTRY}
        openMenuSelectionKey="fa1"
        setOpenMenuSelectionKey={vi.fn()}
        onPlayerAction={onPlayerAction}
        pinnedPlayerIds={[]}
      />
    );

    const item = screen.getByTestId('free-agent-row-target-fa1');
    expect(item).toHaveTextContent('Pin as target');
    fireEvent.click(item);
    expect(onPlayerAction).toHaveBeenCalledWith(
      'pin',
      expect.objectContaining({
        playerId: 'fa1',
        sourceRoom: 'fa',
        isFreeAgentTarget: true,
      })
    );
  });

  it('offers Remove-target and emits unpin when the FA is already pinned', () => {
    const onPlayerAction = vi.fn();
    render(
      <FreeAgentRow
        entry={ENTRY}
        openMenuSelectionKey="fa1"
        setOpenMenuSelectionKey={vi.fn()}
        onPlayerAction={onPlayerAction}
        pinnedPlayerIds={['fa1']}
      />
    );

    const item = screen.getByTestId('free-agent-row-target-fa1');
    expect(item).toHaveTextContent('Remove target');
    fireEvent.click(item);
    expect(onPlayerAction).toHaveBeenCalledWith(
      'unpin',
      expect.objectContaining({ playerId: 'fa1' })
    );
  });

  it('does not render unified actions without onPlayerAction', () => {
    render(
      <FreeAgentRow
        entry={ENTRY}
        openMenuSelectionKey="fa1"
        setOpenMenuSelectionKey={vi.fn()}
      />
    );
    expect(screen.queryByTestId('free-agent-row-target-fa1')).toBeNull();
  });
});
