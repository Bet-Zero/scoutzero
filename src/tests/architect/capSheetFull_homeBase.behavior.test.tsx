/**
 * FILE: src/tests/architect/capSheetFull_homeBase.behavior.test.tsx
 * PURPOSE: Cover the Full Cap Table "home base" enrichments — current-season
 *          dead-money/exceptions launchers, the exceptions readout slot, the
 *          row-level contract-action kebab, and the Free Agency launcher.
 * OWNERSHIP: Feature: architect/cap-sheet
 *
 * These enrichments only LAUNCH existing flows. The cap table must never become
 * a new mutation authority, so we assert it forwards to the injected authority /
 * callbacks rather than computing anything itself.
 */
import React from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  cleanup,
  render,
  screen,
  fireEvent,
  within,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { CapSheetFull } from '@/features/architect/capSheet/CapSheetFull';
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals/computeTeamCapTotals';

// The real modals are heavy and tested elsewhere. Mock them to thin shells that
// surface the year they received and a save trigger so we can assert the cap
// table forwards to the injected authority and scopes to the current season.
vi.mock('@/features/architect/capSheet/modals/ManageDeadMoneyModal', () => ({
  ManageDeadMoneyModal: ({ isOpen, currentYear, onSave }: any) =>
    isOpen ? (
      <div data-testid="mock-dead-money-modal">
        <span data-testid="mock-dead-money-year">{currentYear}</span>
        <button data-testid="mock-dead-money-save" onClick={() => onSave([])}>
          save dead money
        </button>
      </div>
    ) : null,
}));

vi.mock('@/features/architect/capSheet/modals/ManageExceptionsModal', () => ({
  ManageExceptionsModal: ({ isOpen, currentYear, onSave }: any) =>
    isOpen ? (
      <div data-testid="mock-exceptions-modal">
        <span data-testid="mock-exceptions-year">{currentYear}</span>
        <button data-testid="mock-exceptions-save" onClick={() => onSave({})}>
          save exceptions
        </button>
      </div>
    ) : null,
}));

const CURRENT_YEAR = 2026;

const teamCapSheet = {
  teamId: 'LAL',
  teamCode: 'LAL',
  players: [
    {
      id: 'player_42',
      name: 'Jane Doe',
      displayName: 'Jane Doe',
      bio: { playerId: 'player_42', displayName: 'Jane Doe' },
      contract: {
        salariesByYear: [
          { year: 2026, season: '2025-26', salary: 30_000_000, capHit: 30_000_000 },
        ],
      },
    },
    {
      id: 'player_99',
      name: 'John Q',
      displayName: 'John Q',
      bio: { playerId: 'player_99', displayName: 'John Q' },
      contract: {
        salariesByYear: [
          { year: 2026, season: '2025-26', salary: 5_000_000, capHit: 5_000_000 },
        ],
      },
    },
  ],
} as never;

afterEach(() => cleanup());

describe('CapSheetFull — home-base enrichments', () => {
  it('does not render the Cap Tools surface or row kebab without enrichment props', () => {
    render(<CapSheetFull teamCapSheet={teamCapSheet} currentYear={CURRENT_YEAR} />);
    expect(screen.queryByTestId('cap-sheet-full-cap-tools')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('cap-sheet-full-player-row-kebab')
    ).not.toBeInTheDocument();
  });

  it('opens the dead-money modal scoped to the current season and forwards saves to the authority', async () => {
    const handleSetDeadCap = vi.fn().mockResolvedValue(true);
    const handleSetExceptions = vi.fn().mockResolvedValue(true);
    render(
      <CapSheetFull
        teamCapSheet={teamCapSheet}
        currentYear={CURRENT_YEAR}
        manualCapSheetMutationAuthority={{ handleSetDeadCap, handleSetExceptions }}
      />
    );

    fireEvent.click(
      screen.getByTestId('cap-sheet-full-manage-dead-money-button')
    );
    expect(screen.getByTestId('mock-dead-money-year')).toHaveTextContent(
      String(CURRENT_YEAR)
    );
    fireEvent.click(screen.getByTestId('mock-dead-money-save'));
    expect(handleSetDeadCap).toHaveBeenCalledTimes(1);
  });

  it('opens the exceptions modal scoped to the current season and forwards saves to the authority', () => {
    const handleSetDeadCap = vi.fn().mockResolvedValue(true);
    const handleSetExceptions = vi.fn().mockResolvedValue(true);
    render(
      <CapSheetFull
        teamCapSheet={teamCapSheet}
        currentYear={CURRENT_YEAR}
        manualCapSheetMutationAuthority={{ handleSetDeadCap, handleSetExceptions }}
      />
    );

    fireEvent.click(
      screen.getByTestId('cap-sheet-full-manage-exceptions-button')
    );
    expect(screen.getByTestId('mock-exceptions-year')).toHaveTextContent(
      String(CURRENT_YEAR)
    );
    fireEvent.click(screen.getByTestId('mock-exceptions-save'));
    expect(handleSetExceptions).toHaveBeenCalledTimes(1);
  });

  it('reveals the provided exceptions readout node when the section is expanded', () => {
    render(
      <CapSheetFull
        teamCapSheet={teamCapSheet}
        currentYear={CURRENT_YEAR}
        exceptionsReadout={<div data-testid="exceptions-readout-probe" />}
      />
    );
    // Collapsed by default so the table owns the screen.
    expect(
      screen.queryByTestId('exceptions-readout-probe')
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('cap-sheet-full-exceptions-toggle'));
    expect(
      screen.getByTestId('cap-sheet-full-exceptions-readout')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('exceptions-readout-probe')
    ).toBeInTheDocument();
  });

  it('fires onLaunchPlayerAction from the row kebab with the chosen action', () => {
    const onLaunchPlayerAction = vi.fn();
    render(
      <CapSheetFull
        teamCapSheet={teamCapSheet}
        currentYear={CURRENT_YEAR}
        onLaunchPlayerAction={onLaunchPlayerAction}
      />
    );

    const kebabs = screen.getAllByTestId('cap-sheet-full-player-row-kebab');
    fireEvent.click(kebabs[0]);
    fireEvent.click(screen.getByTestId('cap-sheet-full-player-row-action-waive'));

    expect(onLaunchPlayerAction).toHaveBeenCalledTimes(1);
    expect(onLaunchPlayerAction.mock.calls[0][1]).toBe('waive');
  });

  it('fires onLaunchFreeAgentSearch from the Sign Free Agent button', () => {
    const onLaunchFreeAgentSearch = vi.fn();
    render(
      <CapSheetFull
        teamCapSheet={teamCapSheet}
        currentYear={CURRENT_YEAR}
        onLaunchFreeAgentSearch={onLaunchFreeAgentSearch}
      />
    );

    fireEvent.click(screen.getByTestId('cap-sheet-full-sign-free-agent-button'));
    expect(onLaunchFreeAgentSearch).toHaveBeenCalledTimes(1);
  });

  it('extends season columns through the longest contract horizon', () => {
    const longContractCapSheet = {
      ...(teamCapSheet as unknown as Record<string, unknown>),
      players: [
        {
          id: 'long_contract',
          name: 'Long Contract',
          displayName: 'Long Contract',
          bio: { playerId: 'long_contract', displayName: 'Long Contract' },
          contract: {
            salariesByYear: [
              { year: 2026, season: '2025-26', salary: 10_000_000, capHit: 10_000_000 },
              { year: 2027, season: '2026-27', salary: 11_000_000, capHit: 11_000_000 },
              { year: 2028, season: '2027-28', salary: 12_000_000, capHit: 12_000_000 },
              { year: 2029, season: '2028-29', salary: 13_000_000, capHit: 13_000_000 },
              { year: 2030, season: '2029-30', salary: 14_000_000, capHit: 14_000_000 },
              { year: 2031, season: '2030-31', salary: 15_000_000, capHit: 15_000_000 },
              { year: 2032, season: '2031-32', salary: 16_000_000, capHit: 16_000_000 },
              { year: 2033, season: '2032-33', salary: 17_000_000, capHit: 17_000_000 },
              { year: 2034, season: '2033-34', salary: 18_000_000, capHit: 18_000_000 },
            ],
          },
        },
      ],
    } as never;

    render(
      <CapSheetFull
        teamCapSheet={longContractCapSheet}
        currentYear={CURRENT_YEAR}
      />
    );

    expect(screen.getByText('2033-34')).toBeInTheDocument();
    expect(screen.getByText('$18,000,000')).toBeInTheDocument();
  });

  it('shows canonical footer totals and expandable non-player money details', () => {
    const capSheetWithNonPlayerMoney = {
      ...(teamCapSheet as unknown as Record<string, unknown>),
      capHolds: [
        {
          playerId: 'hold_1',
          playerName: 'Cap Hold Player',
          season: '2025-26',
          amount: 5_000_000,
          type: 'FA Cap Hold',
          active: true,
          isSigned: false,
        },
      ],
      deadCap: [
        {
          playerId: 'waived_1',
          playerName: 'Waived Player',
          amountByYear: [{ season: '2025-26', amount: 2_000_000 }],
        },
      ],
    } as never;

    render(
      <CapSheetFull
        teamCapSheet={capSheetWithNonPlayerMoney}
        currentYear={CURRENT_YEAR}
      />
    );

    const totalsSurface = screen.getByLabelText(
      'Multi-year canonical yearly totals surface'
    );
    const expectedCurrentYearTotal = computeTeamCapTotals(
      capSheetWithNonPlayerMoney,
      CURRENT_YEAR
    ).totalCapAllocations;
    expect(
      within(totalsSurface).getByText(
        `$${expectedCurrentYearTotal.toLocaleString()}`
      )
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('cap-sheet-full-dead-money-toggle'));
    expect(screen.getByText('Waived Player')).toBeInTheDocument();
    expect(screen.getByText('$2,000,000')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('cap-sheet-full-cap-holds-toggle'));
    expect(screen.getByText('Cap Hold Player')).toBeInTheDocument();

    expect(
      screen.getByTestId('cap-sheet-full-incomplete-roster-charges')
    ).toHaveTextContent('Incomplete roster charges');
  });
});
