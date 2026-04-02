/**
 * FILE: src/tests/architect/offseason.worldAdvanceAftermath.e110.behavior.test.tsx
 * PURPOSE: Focused UI coverage for OffseasonSection world-advance aftermath handling.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * @vitest-environment jsdom
 */

import React from 'react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { OffseasonSection } from '@/features/architect/GMDashboard/sections/OffseasonSection';

const { mockGetWorldMetadata } = vi.hoisted(() => ({
  mockGetWorldMetadata: vi.fn(),
}));

vi.mock('@/features/architect/utils/worldManager', () => ({
  getWorldMetadata: (...args: unknown[]) => mockGetWorldMetadata(...args),
}));

vi.mock('@/features/architect/GMDashboard/components/DraftPositionsInput', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-draft-positions-input" />,
}));

vi.mock('@/features/architect/offseason/OffseasonTab', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-offseason-tab" />,
}));

vi.mock('@/features/architect/GMDashboard/components/SeasonAdvanceModal', () => ({
  __esModule: true,
  default: ({
    isOpen,
    onWorldAdvanceComplete,
  }: {
    isOpen?: boolean;
    onWorldAdvanceComplete?: ((result: unknown) => void) | null;
  }) => {
    if (!isOpen) {
      return null;
    }

    return (
      <div data-testid="mock-season-advance-modal">
        <button
          type="button"
          onClick={() =>
            onWorldAdvanceComplete?.({
              success: true,
              toSeason: '2026-27',
              updatedTeams: ['LAL'],
              summary: {
                declinedOptions: [{ playerId: 'option_1', playerName: 'Option One' }],
              },
              worldAdvanceAftermath: {
                nextWorldSeason: '2026-27',
                nextViewingYear: 2027,
                offseasonSummary: {
                  declinedOptions: ['Option One'],
                  expiredContracts: [],
                  expiredTPEs: [],
                  exercisedOptions: [],
                  stepienUpdates: [],
                },
              },
            })
          }
        >
          Emit successful advance
        </button>
        <button
          type="button"
          onClick={() =>
            onWorldAdvanceComplete?.({
              success: false,
              error: 'Advance rejected',
            })
          }
        >
          Emit failed advance
        </button>
        <button
          type="button"
          onClick={() =>
            onWorldAdvanceComplete?.({
              success: true,
              toSeason: '2026-27',
              updatedTeams: ['LAL'],
            })
          }
        >
          Emit malformed success
        </button>
      </div>
    );
  },
}));

function buildOffseasonSectionProps() {
  return {
    teamCapSheet: { players: [], capHolds: [] },
    setTeamCapSheet: vi.fn(),
    currentYear: 2026,
    setCurrentYear: vi.fn(),
    capProjections: {},
    setLastCapSheet: vi.fn(),
    offseasonRun: false,
    setOffseasonRun: vi.fn(),
    setOffseasonSummary: vi.fn(),
    setShowOffseasonModal: vi.fn(),
    playersMap: {},
    worldId: 'world_alpha',
    teamCode: 'LAL',
    onReloadWorldData: vi.fn(),
  };
}

describe('OffseasonSection world-advance aftermath behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    window.localStorage.clear();
    mockGetWorldMetadata.mockResolvedValue({
      currentSeason: '2025-26',
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('applies wrapper aftermath only from the normalized success result payload', async () => {
    const props = buildOffseasonSectionProps();

    render(<OffseasonSection {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Advance Season' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Emit successful advance' })
    );

    await waitFor(() => {
      expect(props.setCurrentYear).toHaveBeenCalledWith(2027);
    });
    expect(props.setOffseasonRun).toHaveBeenCalledWith(true);
    expect(props.setOffseasonSummary).toHaveBeenCalledWith({
      declinedOptions: ['Option One'],
      expiredContracts: [],
      expiredTPEs: [],
      exercisedOptions: [],
      stepienUpdates: [],
    });
    expect(props.setShowOffseasonModal).toHaveBeenCalledWith(true);
    expect(props.onReloadWorldData).toHaveBeenCalledTimes(1);
  });

  it('ignores failure and malformed success callbacks that lack normalized aftermath truth', async () => {
    const props = buildOffseasonSectionProps();

    render(<OffseasonSection {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Advance Season' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Emit failed advance' })
    );

    expect(props.setCurrentYear).not.toHaveBeenCalled();
    expect(props.setOffseasonRun).not.toHaveBeenCalled();
    expect(props.setOffseasonSummary).not.toHaveBeenCalled();
    expect(props.setShowOffseasonModal).not.toHaveBeenCalled();
    expect(props.onReloadWorldData).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Emit malformed success' }));

    expect(props.setCurrentYear).not.toHaveBeenCalled();
    expect(props.setOffseasonRun).not.toHaveBeenCalled();
    expect(props.setOffseasonSummary).not.toHaveBeenCalled();
    expect(props.setShowOffseasonModal).not.toHaveBeenCalled();
    expect(props.onReloadWorldData).not.toHaveBeenCalled();
  });
});
