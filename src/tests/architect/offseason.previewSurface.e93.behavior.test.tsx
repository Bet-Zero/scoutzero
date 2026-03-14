/**
 * FILE: src/tests/architect/offseason.previewSurface.e93.behavior.test.tsx
 * PURPOSE: Focused UI coverage for the E93 Offseason preview TS surface and kept JSX shims.
 * OWNERSHIP: Feature: architect/offseason
 *
 * HISTORY:
 *  - 2026-03-14: Added during TM_VALIDATOR_TS_OFFSEASON_PREVIEW_SURFACE_E93 execution.
 *
 * LINKS:
 *  - Return Package: return_packages/trade_machine/TM_VALIDATOR_TS_OFFSEASON_PREVIEW_SURFACE_E93_RETURN_PACKAGE.md
 *  - Master Doc: docs/architect/TRADE_MACHINE_MASTER.md
 *
 * @vitest-environment jsdom
 */
import React, { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import OffseasonTab from '@/features/architect/offseason/OffseasonTab/OffseasonTab';
import OptionManager from '@/features/architect/offseason/OffseasonTab/OptionManager';
import OffseasonTabJsxShim from '@/features/architect/offseason/OffseasonTab/OffseasonTab.jsx';
import OptionManagerJsxShim from '@/features/architect/offseason/OffseasonTab/OptionManager.jsx';
import type { OffseasonTeamCapSheet } from '@/features/architect/offseason/OffseasonTab/types';

const { mockRunOffseason } = vi.hoisted(() => ({
  mockRunOffseason: vi.fn(),
}));

vi.mock('@/features/architect/utils/runOffseason', () => ({
  runOffseason: mockRunOffseason,
}));

const CURRENT_YEAR = 2026;
const NEXT_SEASON_CODE = '2026-27';

const buildTeam = (
  players: Array<Record<string, unknown>>
): OffseasonTeamCapSheet => ({
  teamCode: 'TST',
  teamName: 'Test Team',
  players,
});

const makeOptionPlayer = ({
  playerId,
  name,
  displayName,
  option,
  salary,
  capHit,
}: {
  playerId?: string;
  name: string;
  displayName?: string;
  option: string;
  salary?: number;
  capHit?: number;
}) => ({
  ...(playerId ? { player_id: playerId } : {}),
  name,
  ...(displayName ? { displayName } : {}),
  contract: {
    salariesByYear: [
      {
        season: NEXT_SEASON_CODE,
        ...(salary != null ? { salary } : {}),
        ...(capHit != null ? { capHit } : {}),
        option,
      },
    ],
  },
});

const makeNonOptionPlayer = (playerId: string, name: string) => ({
  player_id: playerId,
  name,
  contract: {
    salariesByYear: [
      {
        season: NEXT_SEASON_CODE,
        salary: 2_000_000,
        option: null,
      },
    ],
  },
});

describe('Offseason preview surface E93 behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('keeps explicit in-folder JSX shims importable', () => {
    expect(OffseasonTabJsxShim).toBeTruthy();
    expect(OptionManagerJsxShim).toBeTruthy();
  });

  it('preserves OptionManager empty-state placement', () => {
    render(
      <OptionManager
        teamCapSheet={buildTeam([makeNonOptionPlayer('plain-1', 'Plain Player')])}
        currentYear={CURRENT_YEAR}
        onDecisionsReady={vi.fn()}
      />
    );

    const heading = screen.getByRole('heading', {
      name: 'Pending Contract Options – 2027',
    });
    const emptyState = screen.getByText('No player or team options pending.');

    expect(
      heading.compareDocumentPosition(emptyState) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Confirm Decisions' })
    ).not.toBeInTheDocument();
  });

  it('preserves option discovery order, header order, confirm-button placement, and decision payload shape', () => {
    const onDecisionsReady = vi.fn();
    const optionTeam = buildTeam([
      makeOptionPlayer({
        playerId: 'alpha-id',
        name: 'Alpha One',
        displayName: 'Alpha One',
        option: 'Player Option',
        salary: 12_500_000,
      }),
      makeNonOptionPlayer('skip-id', 'Skip Player'),
      makeOptionPlayer({
        name: 'Name Fallback',
        option: 'Team Option',
        capHit: 8_250_000,
      }),
    ]);

    render(
      <OptionManager
        teamCapSheet={optionTeam}
        currentYear={CURRENT_YEAR}
        onDecisionsReady={onDecisionsReady}
      />
    );

    expect(screen.getAllByRole('columnheader').map((node) => node.textContent)).toEqual([
      'Player',
      'Type',
      'Salary',
      'Decision',
    ]);

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getAllByRole('cell')[0]).toHaveTextContent('Alpha One');
    expect(within(rows[1]).getAllByRole('cell')[0]).toHaveTextContent(
      'Name Fallback'
    );

    const table = screen.getByRole('table');
    const confirmButton = screen.getByRole('button', {
      name: 'Confirm Decisions',
    });
    expect(
      table.compareDocumentPosition(confirmButton) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    expect(screen.getAllByRole('button', { name: 'Accept' })).toHaveLength(2);

    fireEvent.click(within(rows[1]).getByRole('button', { name: 'Accept' }));
    expect(within(rows[1]).getByRole('button', { name: 'Decline' })).toBeInTheDocument();

    fireEvent.click(confirmButton);

    expect(onDecisionsReady).toHaveBeenCalledTimes(1);
    expect(onDecisionsReady).toHaveBeenCalledWith({
      'alpha-id': {
        decision: 'exercise',
        optionType: 'Player Option',
        season: NEXT_SEASON_CODE,
      },
      'Name Fallback': {
        decision: 'decline',
        optionType: 'Team Option',
        season: NEXT_SEASON_CODE,
      },
    });
  });

  it('preserves confirmation transition, preview button text, deep-cloned snapshotting, and success-path setter order', async () => {
    const callOrder: string[] = [];
    const teamCapSheet = buildTeam([
      makeOptionPlayer({
        playerId: 'alpha-id',
        name: 'Alpha One',
        option: 'Player Option',
        salary: 12_500_000,
      }),
    ]);
    const updatedCapSheet = buildTeam([
      makeOptionPlayer({
        playerId: 'alpha-id',
        name: 'Alpha One',
        option: 'Player Option',
        salary: 13_000_000,
      }),
    ]);
    const summary = {
      exercisedOptions: [],
      declinedOptions: [],
      expiredContracts: [],
      expiredTPEs: [],
      capHoldsCreated: 0,
      transitionedExceptions: [],
      hardCapCleared: false,
    };
    const setTeamCapSheet = vi.fn((_: OffseasonTeamCapSheet) =>
      callOrder.push('setTeamCapSheet')
    );
    const setCurrentYear = vi.fn((_: number) => callOrder.push('setCurrentYear'));
    const setLastCapSheet = vi.fn((_: OffseasonTeamCapSheet) =>
      callOrder.push('setLastCapSheet')
    );
    const setOffseasonRun = vi.fn((_: boolean) => callOrder.push('setOffseasonRun'));
    const setOffseasonSummary = vi.fn((_: unknown) =>
      callOrder.push('setOffseasonSummary')
    );
    const setShowOffseasonModal = vi.fn((_: boolean) =>
      callOrder.push('setShowOffseasonModal')
    );
    const capProjections = { maxCap: 155_000_000 };

    mockRunOffseason.mockReturnValue({
      updatedCapSheet,
      summary,
    });

    render(
      <OffseasonTab
        teamCapSheet={teamCapSheet}
        setTeamCapSheet={setTeamCapSheet}
        currentYear={CURRENT_YEAR}
        setCurrentYear={setCurrentYear}
        capProjections={capProjections}
        setLastCapSheet={setLastCapSheet}
        offseasonRun={false}
        setOffseasonRun={setOffseasonRun}
        setOffseasonSummary={setOffseasonSummary}
        setShowOffseasonModal={setShowOffseasonModal}
        playersMap={{}}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Decisions' }));

    expect(
      screen.getByRole('heading', { name: 'All option decisions confirmed.' })
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Preview Advance to 2027' })
    );

    await waitFor(() => {
      expect(mockRunOffseason).toHaveBeenCalledTimes(1);
    });

    expect(mockRunOffseason).toHaveBeenCalledWith(
      teamCapSheet,
      CURRENT_YEAR,
      capProjections,
      {
        'alpha-id': {
          decision: 'exercise',
          optionType: 'Player Option',
          season: NEXT_SEASON_CODE,
        },
      }
    );

    expect(callOrder).toEqual([
      'setLastCapSheet',
      'setTeamCapSheet',
      'setCurrentYear',
      'setOffseasonSummary',
      'setShowOffseasonModal',
      'setOffseasonRun',
    ]);
    expect(setTeamCapSheet).toHaveBeenCalledWith(updatedCapSheet);
    expect(setCurrentYear).toHaveBeenCalledWith(2027);
    expect(setOffseasonSummary).toHaveBeenCalledWith(summary);
    expect(setShowOffseasonModal).toHaveBeenCalledWith(true);
    expect(setOffseasonRun).toHaveBeenCalledWith(true);

    expect(setLastCapSheet).toHaveBeenCalledTimes(1);
    const lastCapSheetSnapshot = setLastCapSheet.mock.calls[0]?.[0] as typeof teamCapSheet;
    expect(lastCapSheetSnapshot).toEqual(teamCapSheet);
    expect(lastCapSheetSnapshot).not.toBe(teamCapSheet);
    expect(lastCapSheetSnapshot.players).not.toBe(teamCapSheet.players);
  });

  it('preserves preview completion messaging after a successful advance', async () => {
    const teamCapSheet = buildTeam([
      makeOptionPlayer({
        playerId: 'alpha-id',
        name: 'Alpha One',
        option: 'Player Option',
        salary: 12_500_000,
      }),
    ]);

    mockRunOffseason.mockReturnValue({
      updatedCapSheet: teamCapSheet,
      summary: {
        exercisedOptions: [],
        declinedOptions: [],
        expiredContracts: [],
        expiredTPEs: [],
        capHoldsCreated: 0,
        transitionedExceptions: [],
        hardCapCleared: false,
      },
    });

    const OffseasonHarness = () => {
      const [nextTeamCapSheet, setNextTeamCapSheet] =
        useState<OffseasonTeamCapSheet>(teamCapSheet);
      const [currentYear, setCurrentYear] = useState(CURRENT_YEAR);
      const [offseasonRun, setOffseasonRun] = useState(false);
      const [, setLastCapSheet] = useState<unknown>(null);
      const [, setOffseasonSummary] = useState<unknown>(null);
      const [, setShowOffseasonModal] = useState(false);

      return (
        <OffseasonTab
          teamCapSheet={nextTeamCapSheet}
          setTeamCapSheet={setNextTeamCapSheet}
          currentYear={currentYear}
          setCurrentYear={setCurrentYear}
          capProjections={{}}
          setLastCapSheet={setLastCapSheet}
          offseasonRun={offseasonRun}
          setOffseasonRun={setOffseasonRun}
          setOffseasonSummary={setOffseasonSummary}
          setShowOffseasonModal={setShowOffseasonModal}
          playersMap={{}}
        />
      );
    };

    render(<OffseasonHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Decisions' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Preview Advance to 2027' })
    );

    expect(
      await screen.findByText('Preview computed — not saved')
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Preview shows projected state for 2028 season. Use World Season Advance to persist.'
      )
    ).toBeInTheDocument();
  });

  it('preserves local error text placement and thrown-message handling', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      mockRunOffseason.mockImplementation(() => {
        throw new Error('Engine exploded');
      });

      render(
        <OffseasonTab
          teamCapSheet={buildTeam([
            makeOptionPlayer({
              playerId: 'alpha-id',
              name: 'Alpha One',
              option: 'Player Option',
              salary: 12_500_000,
            }),
          ])}
          setTeamCapSheet={vi.fn()}
          currentYear={CURRENT_YEAR}
          setCurrentYear={vi.fn()}
          capProjections={{}}
          setLastCapSheet={vi.fn()}
          offseasonRun={false}
          setOffseasonRun={vi.fn()}
          setOffseasonSummary={vi.fn()}
          setShowOffseasonModal={vi.fn()}
          playersMap={{}}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Confirm Decisions' }));
      const previewButton = screen.getByRole('button', {
        name: 'Preview Advance to 2027',
      });
      fireEvent.click(previewButton);

      const errorText = await screen.findByText('Engine exploded');
      const heading = screen.getByRole('heading', { name: 'Offseason Manager' });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to advance offseason',
        expect.any(Error)
      );
      expect(
        heading.compareDocumentPosition(errorText) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
      expect(
        errorText.compareDocumentPosition(previewButton) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('preserves fallback error text when a thrown value has no message', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      mockRunOffseason.mockImplementation(() => {
        throw {};
      });

      render(
        <OffseasonTab
          teamCapSheet={buildTeam([
            makeOptionPlayer({
              playerId: 'alpha-id',
              name: 'Alpha One',
              option: 'Player Option',
              salary: 12_500_000,
            }),
          ])}
          setTeamCapSheet={vi.fn()}
          currentYear={CURRENT_YEAR}
          setCurrentYear={vi.fn()}
          capProjections={{}}
          setLastCapSheet={vi.fn()}
          offseasonRun={false}
          setOffseasonRun={vi.fn()}
          setOffseasonSummary={vi.fn()}
          setShowOffseasonModal={vi.fn()}
          playersMap={{}}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Confirm Decisions' }));
      fireEvent.click(
        screen.getByRole('button', { name: 'Preview Advance to 2027' })
      );

      expect(
        await screen.findByText('Failed to advance offseason')
      ).toBeInTheDocument();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to advance offseason',
        {}
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
