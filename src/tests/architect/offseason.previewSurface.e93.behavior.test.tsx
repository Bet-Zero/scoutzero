/**
 * FILE: src/tests/architect/offseason.previewSurface.e93.behavior.test.tsx
 * PURPOSE: Focused UI coverage for the E93 Offseason preview TS surface after shim retirement.
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
import React from 'react';
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
import type { OffseasonTeamCapSheet } from '@/features/architect/offseason/OffseasonTab/types';

const { mockRunOffseason } = vi.hoisted(() => ({
  mockRunOffseason: vi.fn(),
}));

vi.mock('@/features/architect/utils/runOffseason', () => ({
  runOffseason: mockRunOffseason,
}));

const CURRENT_YEAR = 2026;
const NEXT_SEASON_CODE = '2026-27';
const OFFSEASON_TAB_AUTHORITY_SPECIFIER =
  '../../features/architect/offseason/OffseasonTab/OffseasonTab.tsx';
const OPTION_MANAGER_AUTHORITY_SPECIFIER =
  '../../features/architect/offseason/OffseasonTab/OptionManager.tsx';

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

function renderPreviewSurface({
  teamCapSheet = buildTeam([
    makeOptionPlayer({
      playerId: 'alpha-id',
      name: 'Alpha One',
      option: 'Player Option',
      salary: 12_500_000,
    }),
  ]),
  capProjections = {},
}: {
  teamCapSheet?: OffseasonTeamCapSheet;
  capProjections?: Record<string, unknown>;
} = {}) {
  return render(
    <OffseasonTab
      teamCapSheet={teamCapSheet}
      currentYear={CURRENT_YEAR}
      capProjections={capProjections}
      playersMap={{}}
    />
  );
}

describe('Offseason preview surface E93 behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('keeps extensionless imports aligned with the TSX authorities', async () => {
    const offseasonTabAuthority = await import(OFFSEASON_TAB_AUTHORITY_SPECIFIER);
    const optionManagerAuthority = await import(
      OPTION_MANAGER_AUTHORITY_SPECIFIER
    );

    expect(Object.keys(offseasonTabAuthority)).toEqual(['default']);
    expect(Object.keys(optionManagerAuthority)).toEqual(['default']);
    expect(offseasonTabAuthority.default).toBe(OffseasonTab);
    expect(optionManagerAuthority.default).toBe(OptionManager);
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

  it('keeps preview completion local to OffseasonTab and surfaces explicit non-persisting aftermath copy', async () => {
    const teamCapSheet = buildTeam([
      makeOptionPlayer({
        playerId: 'alpha-id',
        name: 'Alpha One',
        option: 'Player Option',
        salary: 12_500_000,
      }),
    ]);
    const capProjections = { maxCap: 155_000_000 };

    mockRunOffseason.mockReturnValue({
      updatedCapSheet: buildTeam([]),
      summary: {
        exercisedOptions: [
          {
            playerId: 'alpha-id',
            playerName: 'Alpha One',
            optionType: 'player',
            salary: 12_500_000,
          },
        ],
        declinedOptions: [
          {
            playerId: 'beta-id',
            playerName: 'Beta Two',
            optionType: 'team',
            salary: 5_000_000,
          },
        ],
        expiredContracts: [
          {
            playerId: 'gamma-id',
            playerName: 'Gamma Three',
            lastSalary: 4_000_000,
          },
        ],
        expiredTPEs: [
          {
            amount: 3_500_000,
            source: 'Existing Trade',
          },
        ],
        capHoldsCreated: 2,
        transitionedExceptions: ['room'],
        hardCapCleared: true,
      },
    });

    renderPreviewSurface({ teamCapSheet, capProjections });

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Decisions' }));

    expect(
      screen.getByRole('heading', { name: 'All option decisions confirmed.' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'This preview stays local to this DEV surface. It will not update the world, dashboard year, or shared offseason summary.'
      )
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

    expect(
      await screen.findByTestId('offseason-preview-aftermath')
    ).toBeInTheDocument();
    expect(screen.getByText('Preview computed — not saved')).toBeInTheDocument();
    expect(
      screen.getByTestId('offseason-preview-aftermath-copy')
    ).toHaveTextContent(
      'Preview shows projected state for the 2026-27 season only. No world state, dashboard year, or shared offseason summary was updated. Use World Season Advance to persist real changes.'
    );
    expect(screen.getByText('Projected Exercised Options')).toBeInTheDocument();
    expect(screen.getByText('Alpha One')).toBeInTheDocument();
    expect(screen.getByText('Projected Declined Options')).toBeInTheDocument();
    expect(screen.getByText('Beta Two')).toBeInTheDocument();
    expect(screen.getByText('Projected Expired Contracts')).toBeInTheDocument();
    expect(screen.getByText('Gamma Three')).toBeInTheDocument();
    expect(
      screen.getByText('Projected Expired Trade Exceptions')
    ).toBeInTheDocument();
    expect(screen.getByText('$3,500,000 from Existing Trade')).toBeInTheDocument();
    expect(screen.getByText('Projected Exception Transitions')).toBeInTheDocument();
    expect(screen.getByText('room')).toBeInTheDocument();
    expect(screen.getByText('Projected cap holds created: 2')).toBeInTheDocument();
    expect(
      screen.getByText('Hard cap would be cleared in this projected season.')
    ).toBeInTheDocument();
  });

  it('keeps reset and edit paths local after a computed preview', async () => {
    mockRunOffseason.mockReturnValue({
      updatedCapSheet: buildTeam([]),
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

    renderPreviewSurface();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Decisions' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Preview Advance to 2027' })
    );

    expect(
      await screen.findByTestId('offseason-preview-aftermath')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reset Preview' }));

    expect(
      screen.queryByTestId('offseason-preview-aftermath')
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Preview Advance to 2027' })
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Preview Advance to 2027' })
    );
    expect(mockRunOffseason).toHaveBeenCalledTimes(2);

    expect(
      await screen.findByTestId('offseason-preview-aftermath')
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Decisions' }));

    expect(
      screen.queryByTestId('offseason-preview-aftermath')
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Pending Contract Options – 2027' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Confirm Decisions' })
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

      renderPreviewSurface();

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

      renderPreviewSurface();

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
