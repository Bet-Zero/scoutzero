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
import { RIGHTS_LEDGER_WORLD_VERSION } from '@/features/architect/utils/rightsHistory';
import type { GovernedWaiverLifecycle } from '@/schemas/governedWaiver';
import type { PlayerRulesProfileTeamCapSheet } from '@/features/architect/types/playerRulesProfiles';

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

const teamCapSheet: PlayerRulesProfileTeamCapSheet & { teamId: string } = {
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
          { season: '2025-26', salary: 30_000_000, capHit: 30_000_000 },
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
          { season: '2025-26', salary: 5_000_000, capHit: 5_000_000 },
        ],
      },
    },
  ],
};

afterEach(() => cleanup());

describe('CapSheetFull — home-base enrichments', () => {
  it('does not render the Cap Tools surface or row kebab without enrichment props', () => {
    render(
      <CapSheetFull teamCapSheet={teamCapSheet} currentYear={CURRENT_YEAR} />
    );
    expect(
      screen.queryByTestId('cap-sheet-full-cap-tools')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('cap-sheet-full-player-row-overflow')
    ).not.toBeInTheDocument();
  });

  it('opens the dead-money modal scoped to the current season and forwards saves to the authority', async () => {
    const handleSetDeadCap = vi.fn().mockResolvedValue(true);
    const handleSetExceptions = vi.fn().mockResolvedValue(true);
    render(
      <CapSheetFull
        teamCapSheet={teamCapSheet}
        currentYear={CURRENT_YEAR}
        manualCapSheetMutationAuthority={{
          handleSetDeadCap,
          handleSetExceptions,
        }}
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

  it('shows waiver responsibility as pending through exact expiry day, then as terminated dead money', () => {
    const allocation = {
      season: '2026-27',
      protectedBaseCompensation: 10_000_000,
      buyoutReduction: 4_000_000,
      playerPayment: 6_000_000,
      teamSalary: 6_000_000,
      setOffReduction: null,
      isTeamSalaryStretched: false,
    };
    const event = (
      eventVersion: number,
      eventKind: GovernedWaiverLifecycle['events'][number]['eventKind'],
      effectiveAt: string,
      predecessorEventId: string | null
    ) => ({
      eventId: `waiver-event-${eventVersion}`,
      eventVersion,
      eventKind,
      effectiveAt,
      recordedAt: '2026-07-15T12:01:00-04:00',
      predecessorEventId,
      authoringIdentity: 'test-user',
      canonLeafIds: ['CBA2-R01.1'],
    });
    const governedLifecycle = {
      lifecycleVersion: 1,
      lifecycleId: 'waiver-lifecycle-1',
      worldId: 'world-waiver-status',
      teamId: 'LAL',
      playerId: 'waived-player',
      playerName: 'Waived Player',
      contractId: 'waived-contract',
      path: 'buyout',
      leagueReceivedAt: '2026-07-15T12:00:00-04:00',
      expiresAt: '2026-07-17T12:00:00-04:00',
      terminationAt: '2026-07-17T12:00:00-04:00',
      requestIrrevocable: true,
      outcome: 'ordinary-unclaimed',
      events: [
        event(1, 'waiver-request', '2026-07-15T12:00:00-04:00', null),
        event(
          2,
          'buyout-agreement',
          '2026-07-15T12:00:00-04:00',
          'waiver-event-1'
        ),
        event(
          3,
          'waiver-expiry',
          '2026-07-17T12:00:00-04:00',
          'waiver-event-2'
        ),
        event(
          4,
          'contract-termination',
          '2026-07-17T12:00:00-04:00',
          'waiver-event-3'
        ),
        event(
          5,
          'set-off-authority',
          '2026-07-17T12:00:00-04:00',
          'waiver-event-4'
        ),
      ],
      originalContractSeasons: ['2026-27'],
      protectedBaseCompensation: 10_000_000,
      buyoutReduction: 4_000_000,
      buyoutAgreementAt: '2026-07-15T12:00:00-04:00',
      playerSignatureRecorded: true,
      teamSignatureRecorded: true,
      stretchElectionAt: null,
      stretchBranch: null,
      stretchYears: null,
      salaryCapAtElection: null,
      formerPlayerCeilingAtElection: null,
      allocationsBeforeStretch: [allocation],
      allocations: [allocation],
      paymentAllocations: [allocation],
      setOffStatus: 'needs-authenticated-earnings',
      setOffFormula: 'Authenticated earnings required.',
      setOffApplication: null,
      originalContractEndsAt: '2027-06-30T23:59:59-04:00',
      reacquisitionRestrictedUntil: '2027-07-15T12:00:00-04:00',
      contractAuthority: {
        ledgerId: 'contract-ledger-1',
        ledgerVersion: 1,
        stateDigest: 'fnv1a64:0123456789abcdef',
      },
      canonLeafIds: ['CBA2-R01.1'],
    } satisfies GovernedWaiverLifecycle;
    const waiverTeam = {
      ...teamCapSheet,
      deadCap: [
        {
          playerId: 'waived-player',
          playerName: 'Waived Player',
          originalSalary: 10_000_000,
          amountByYear: [
            { season: '2026-27', amount: 10_000_000, isStretched: false },
          ],
          waiveDate: '2026-07-15T12:00:00-04:00',
          governedLifecycle,
        },
      ],
    };
    const context = {
      worldId: 'world-waiver-status',
      teamId: 'LAL',
      asOfDate: '2026-07-17',
      worldVersion: RIGHTS_LEDGER_WORLD_VERSION,
    };
    const { rerender } = render(
      <CapSheetFull
        teamCapSheet={waiverTeam}
        currentYear={2027}
        governedRightsContext={context}
      />
    );
    fireEvent.click(screen.getByTestId('cap-sheet-full-dead-money-toggle'));
    expect(
      screen.getByTestId('cap-sheet-full-governed-waiver-status')
    ).toHaveAttribute('data-waiver-status', 'pending');
    expect(
      screen.getByTestId('cap-sheet-full-governed-waiver-status')
    ).toHaveTextContent(/expires Jul 17, 2026.*12:00 PM ET/i);
    expect(
      screen.getByTestId('cap-sheet-full-governed-waiver-status')
    ).toHaveClass('whitespace-normal');
    expect(
      screen.getAllByTestId('cap-sheet-full-dead-money-amount')[0]
    ).toHaveTextContent('$10,000,000');

    rerender(
      <CapSheetFull
        teamCapSheet={waiverTeam}
        currentYear={2027}
        governedRightsContext={{ ...context, asOfDate: '2026-07-18' }}
      />
    );
    expect(
      screen.getByTestId('cap-sheet-full-governed-waiver-status')
    ).toHaveAttribute('data-waiver-status', 'terminated');
    expect(
      screen.getByTestId('cap-sheet-full-governed-waiver-status')
    ).toHaveTextContent(/contract terminated/i);
    expect(
      screen.getAllByTestId('cap-sheet-full-dead-money-amount')[0]
    ).toHaveTextContent('$6,000,000');
  });

  it('opens the exceptions modal scoped to the current season and forwards saves to the authority', () => {
    const handleSetDeadCap = vi.fn().mockResolvedValue(true);
    const handleSetExceptions = vi.fn().mockResolvedValue(true);
    render(
      <CapSheetFull
        teamCapSheet={teamCapSheet}
        currentYear={CURRENT_YEAR}
        manualCapSheetMutationAuthority={{
          handleSetDeadCap,
          handleSetExceptions,
        }}
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
    expect(screen.getByTestId('exceptions-readout-probe')).toBeInTheDocument();
  });

  it('fires onLaunchPlayerAction from the row overflow menu with the chosen action', () => {
    const onLaunchPlayerAction = vi.fn();
    render(
      <CapSheetFull
        teamCapSheet={teamCapSheet}
        currentYear={CURRENT_YEAR}
        onLaunchPlayerAction={onLaunchPlayerAction}
        standardWaiveExposureClassification="V1 supported"
        standardBuyoutExposureClassification="V1 supported"
      />
    );

    const overflows = screen.getAllByTestId(
      'cap-sheet-full-player-row-overflow'
    );
    fireEvent.click(overflows[0]);
    const waiveAction = screen.getByTestId(
      'cap-sheet-full-player-row-action-waive'
    );
    expect(waiveAction).toHaveTextContent(/^Waive$/);
    expect(waiveAction).toHaveAttribute(
      'data-action-exposure-classification',
      'V1 supported'
    );
    expect(
      screen.getByTestId('cap-sheet-full-player-row-action-stretch')
    ).toHaveAttribute('data-action-exposure-classification', 'preview-only');
    expect(
      screen.getByTestId('cap-sheet-full-player-row-action-buyout')
    ).toHaveAttribute('data-action-exposure-classification', 'V1 supported');
    fireEvent.click(waiveAction);

    expect(onLaunchPlayerAction).toHaveBeenCalledTimes(1);
    expect(onLaunchPlayerAction.mock.calls[0][1]).toBe('waive');
  });

  it('routes Pin via onTogglePin and Trade/navigation via onPlayerAction from the overflow menu', () => {
    const onTogglePin = vi.fn();
    const onPlayerAction = vi.fn();
    render(
      <CapSheetFull
        teamCapSheet={teamCapSheet}
        currentYear={CURRENT_YEAR}
        onTogglePin={onTogglePin}
        onPlayerAction={onPlayerAction}
      />
    );

    // Pin reuses the existing pin plumbing, not the unified intent sink.
    fireEvent.click(
      screen.getAllByTestId('cap-sheet-full-player-row-overflow')[0]
    );
    fireEvent.click(
      screen.getByTestId('cap-sheet-full-player-row-overflow-pin')
    );
    expect(onTogglePin).toHaveBeenCalledTimes(1);
    expect(onPlayerAction).not.toHaveBeenCalled();

    // Trade (and navigation) route outward through onPlayerAction with context.
    fireEvent.click(
      screen.getAllByTestId('cap-sheet-full-player-row-overflow')[0]
    );
    fireEvent.click(
      screen.getByTestId('cap-sheet-full-player-row-overflow-trade')
    );
    expect(onPlayerAction).toHaveBeenCalledTimes(1);
    expect(onPlayerAction.mock.calls[0][0]).toBe('trade');
    expect(onPlayerAction.mock.calls[0][1].sourceRoom).toBe('capfull');
    expect(onPlayerAction.mock.calls[0][1].targetYear).toBe(CURRENT_YEAR);
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

    fireEvent.click(
      screen.getByTestId('cap-sheet-full-sign-free-agent-button')
    );
    expect(onLaunchFreeAgentSearch).toHaveBeenCalledTimes(1);
  });

  it('keeps the Full Cap free-agent launcher preview-only until upstream proof marks it supported', () => {
    const onLaunchFreeAgentSearch = vi.fn();
    const { rerender } = render(
      <CapSheetFull
        teamCapSheet={teamCapSheet}
        currentYear={CURRENT_YEAR}
        onLaunchFreeAgentSearch={onLaunchFreeAgentSearch}
      />
    );

    const previewLauncher = screen.getByTestId(
      'cap-sheet-full-sign-free-agent-button'
    );
    expect(previewLauncher).toHaveAttribute(
      'data-action-exposure-classification',
      'preview-only'
    );
    expect(previewLauncher).toHaveTextContent(/Preview/i);

    rerender(
      <CapSheetFull
        teamCapSheet={teamCapSheet}
        currentYear={CURRENT_YEAR}
        onLaunchFreeAgentSearch={onLaunchFreeAgentSearch}
        standardFreeAgentLauncherExposureClassification="V1 supported"
      />
    );

    const supportedLauncher = screen.getByTestId(
      'cap-sheet-full-sign-free-agent-button'
    );
    expect(supportedLauncher).toHaveAttribute(
      'data-action-exposure-classification',
      'V1 supported'
    );
    expect(supportedLauncher).not.toHaveTextContent(/Preview/i);
    // BZE-209: supported signing carries no badge — 'V1' was internal release
    // vocabulary. Support state stays asserted via the data attribute above.
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
              {
                year: 2026,
                season: '2025-26',
                salary: 10_000_000,
                capHit: 10_000_000,
              },
              {
                year: 2027,
                season: '2026-27',
                salary: 11_000_000,
                capHit: 11_000_000,
              },
              {
                year: 2028,
                season: '2027-28',
                salary: 12_000_000,
                capHit: 12_000_000,
              },
              {
                year: 2029,
                season: '2028-29',
                salary: 13_000_000,
                capHit: 13_000_000,
              },
              {
                year: 2030,
                season: '2029-30',
                salary: 14_000_000,
                capHit: 14_000_000,
              },
              {
                year: 2031,
                season: '2030-31',
                salary: 15_000_000,
                capHit: 15_000_000,
              },
              {
                year: 2032,
                season: '2031-32',
                salary: 16_000_000,
                capHit: 16_000_000,
              },
              {
                year: 2033,
                season: '2032-33',
                salary: 17_000_000,
                capHit: 17_000_000,
              },
              {
                year: 2034,
                season: '2033-34',
                salary: 18_000_000,
                capHit: 18_000_000,
              },
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

  it('fails the salary-book footer closed while preserving non-player money details', () => {
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
    expect(within(totalsSurface).getAllByText('Needs input').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByTestId('cap-sheet-full-dead-money-toggle'));
    expect(screen.getByText('Waived Player')).toBeInTheDocument();
    expect(screen.getByText('$2,000,000')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('cap-sheet-full-cap-holds-toggle'));
    expect(screen.getByText('Cap Hold Player')).toBeInTheDocument();

    expect(
      screen.getByTestId('cap-sheet-full-incomplete-roster-charges')
    ).toHaveTextContent('Incomplete roster charges');
  });

  it('renders free-agent options separately from roster rows with honest exposure', () => {
    const onOpenFreeAgentOption = vi.fn();
    const onRemoveFreeAgentOption = vi.fn();

    const { rerender } = render(
      <CapSheetFull
        teamCapSheet={teamCapSheet}
        currentYear={CURRENT_YEAR}
        freeAgentOptions={[
          {
            selectionKey: 'fa_1',
            playerId: 'fa_1',
            freeAgent: {
              id: 'fa_1',
              name: 'Desk Option',
              askingSalary: 8_000_000,
            },
            surfacePlayer: {
              id: 'fa_1',
              name: 'Desk Option',
              displayName: 'Desk Option',
            },
          },
        ]}
        onOpenFreeAgentOption={onOpenFreeAgentOption}
        onRemoveFreeAgentOption={onRemoveFreeAgentOption}
      />
    );

    const optionsSurface = screen.getByTestId('cap-sheet-full-fa-options');
    expect(optionsSurface).toHaveTextContent('Desk Option');
    const previewOpenSigning = within(optionsSurface).getByRole('button', {
      name: /open signing for desk option \(preview only\)/i,
    });
    expect(previewOpenSigning).toHaveAttribute(
      'data-action-exposure-classification',
      'preview-only'
    );
    expect(previewOpenSigning).toHaveTextContent(/Preview/i);

    rerender(
      <CapSheetFull
        teamCapSheet={teamCapSheet}
        currentYear={CURRENT_YEAR}
        standardFreeAgentLauncherExposureClassification="V1 supported"
        freeAgentOptions={[
          {
            selectionKey: 'fa_1',
            playerId: 'fa_1',
            freeAgent: {
              id: 'fa_1',
              name: 'Desk Option',
              askingSalary: 8_000_000,
            },
            surfacePlayer: {
              id: 'fa_1',
              name: 'Desk Option',
              displayName: 'Desk Option',
            },
          },
        ]}
        onOpenFreeAgentOption={onOpenFreeAgentOption}
        onRemoveFreeAgentOption={onRemoveFreeAgentOption}
      />
    );

    const supportedOptionsSurface = screen.getByTestId(
      'cap-sheet-full-fa-options'
    );
    const supportedOpenSigning = within(supportedOptionsSurface).getByRole(
      'button',
      {
        name: /^open signing for desk option$/i,
      }
    );
    expect(supportedOpenSigning).toHaveAttribute(
      'data-action-exposure-classification',
      'V1 supported'
    );
    // BZE-209: supported signing carries no visible badge — support state
    // stays asserted via the data attribute above.
    expect(supportedOpenSigning).not.toHaveTextContent(/V1/i);
    fireEvent.click(
      within(supportedOptionsSurface).getByRole('button', {
        name: /open signing/i,
      })
    );
    fireEvent.click(
      within(supportedOptionsSurface).getByRole('button', {
        name: /remove desk option/i,
      })
    );

    expect(onOpenFreeAgentOption).toHaveBeenCalledWith('fa_1');
    expect(onRemoveFreeAgentOption).toHaveBeenCalledWith('fa_1');
    expect(
      screen.getAllByTestId('cap-sheet-full-player-row-button')
    ).toHaveLength(2);
  });

  it('highlights every focused player and affected footer total year', () => {
    render(
      <CapSheetFull
        teamCapSheet={teamCapSheet}
        currentYear={CURRENT_YEAR}
        highlightPlayerIds={['player_42', 'player_99']}
      />
    );

    expect(
      screen.getAllByTestId('cap-sheet-full-player-row-highlighted')
    ).toHaveLength(2);
    expect(
      screen.getAllByTestId('cap-sheet-full-total-cell-highlighted')
    ).toHaveLength(1);
  });
});
