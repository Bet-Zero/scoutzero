// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CapSheetFull } from '@/features/architect/capSheet/CapSheetFull';
import { RIGHTS_LEDGER_WORLD_VERSION } from '@/features/architect/utils/rightsHistory';
import { withGovernedSalaryBooks } from '@/tests/fixtures/governedSalaryBookInputs';
import {
  RIGHTS_FIXTURE_AS_OF_DATE,
  RIGHTS_FIXTURE_PLAYER_ID,
  RIGHTS_FIXTURE_TEAM_ID,
  RIGHTS_FIXTURE_WORLD_ID,
  makeRightsEstablishedEvent,
  makeRightsLedger,
} from '../fixtures/architect/rightsHistory';

const PLAYER = {
  id: RIGHTS_FIXTURE_PLAYER_ID,
  player_id: RIGHTS_FIXTURE_PLAYER_ID,
  name: 'Governed Rights Player',
  displayName: 'Governed Rights Player',
  bio: {
    playerId: RIGHTS_FIXTURE_PLAYER_ID,
    displayName: 'Governed Rights Player',
  },
  contract: {
    salariesByYear: [
      {
        season: '2025-26',
        salary: 10_000_000,
        capHit: 10_000_000,
      },
    ],
    birdRights: { status: 'None' },
    freeAgency: { type: 'UFA', year: 2026, capHold: 999 },
  },
};

const governedContext = {
  worldId: RIGHTS_FIXTURE_WORLD_ID,
  teamId: RIGHTS_FIXTURE_TEAM_ID,
  asOfDate: RIGHTS_FIXTURE_AS_OF_DATE,
  worldVersion: RIGHTS_LEDGER_WORLD_VERSION,
};

const team = {
  teamId: RIGHTS_FIXTURE_TEAM_ID,
  teamCode: RIGHTS_FIXTURE_TEAM_ID,
  players: [PLAYER],
  capHolds: [
    {
      playerId: RIGHTS_FIXTURE_PLAYER_ID,
      playerName: PLAYER.displayName,
      amount: 999,
      season: '2026-27',
      type: 'UFA',
      active: true,
      isSigned: false,
    },
  ],
  rightsLedger: makeRightsLedger(),
};

afterEach(cleanup);

describe('Full Cap Table governed rights consumer', () => {
  it('keeps a governed option hold actionable without exposing Sign & Trade', () => {
    const signAndTrade = vi.fn();
    const renounceCapHold = vi.fn();
    render(
      <CapSheetFull
        teamCapSheet={{
          ...team,
          players: [],
          capHolds: [
            {
              ...team.capHolds[0],
              priorTeamOfferCeiling: 12_000_000,
              governedContractEventId: 'governed-option-decline-event',
            },
          ],
        } as never}
        currentYear={2027}
        playersMap={{ [RIGHTS_FIXTURE_PLAYER_ID]: PLAYER }}
        governedRightsContext={governedContext}
        onSignAndTradeFreeAgent={signAndTrade}
        onRenounceCapHold={renounceCapHold}
      />
    );

    expect(
      screen.getByTestId('cap-sheet-full-fa-decision-row')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('cap-sheet-full-fa-resign-cell')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('cap-sheet-full-fa-sign-and-trade-button')
    ).not.toBeInTheDocument();
    expect(signAndTrade).not.toHaveBeenCalled();

    const absolve = screen.getByTestId('cap-sheet-full-fa-absolve-button');
    expect(absolve).toBeEnabled();
    fireEvent.click(absolve);
    expect(renounceCapHold).toHaveBeenCalledWith(
      expect.objectContaining({
        governedContractEventId: 'governed-option-decline-event',
        priorTeamOfferCeiling: 12_000_000,
      })
    );

    cleanup();
    render(
      <CapSheetFull
        teamCapSheet={{ ...team, players: [] } as never}
        currentYear={2027}
        playersMap={{ [RIGHTS_FIXTURE_PLAYER_ID]: PLAYER }}
        governedRightsContext={governedContext}
      />
    );
    expect(
      screen.queryByTestId('cap-sheet-full-fa-decision-row')
    ).not.toBeInTheDocument();

    cleanup();
    render(
      <CapSheetFull
        teamCapSheet={{
          ...team,
          players: [],
          capHolds: [
            {
              ...team.capHolds[0],
              priorTeamOfferCeiling: '12000000',
              governedContractEventId: 'governed-option-decline-event',
            },
          ],
        } as never}
        currentYear={2027}
        playersMap={{ [RIGHTS_FIXTURE_PLAYER_ID]: PLAYER }}
        governedRightsContext={governedContext}
      />
    );
    expect(
      screen.queryByTestId('cap-sheet-full-fa-decision-row')
    ).not.toBeInTheDocument();
  });

  it('preserves Sign & Trade for an ordinary eligible hold', () => {
    const signAndTrade = vi.fn();
    render(
      <CapSheetFull
        teamCapSheet={team as never}
        currentYear={2027}
        playersMap={{ [RIGHTS_FIXTURE_PLAYER_ID]: PLAYER }}
        governedRightsContext={governedContext}
        onSignAndTradeFreeAgent={signAndTrade}
      />
    );

    expect(
      screen.getByTestId('cap-sheet-full-fa-decision-row')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('cap-sheet-full-fa-resign-cell')
    ).toBeInTheDocument();
    const signAndTradeButton = screen.getByTestId(
      'cap-sheet-full-fa-sign-and-trade-button'
    );
    expect(signAndTradeButton).toBeInTheDocument();
    fireEvent.click(signAndTradeButton);
    expect(signAndTrade).toHaveBeenCalledWith(PLAYER);
  });

  it.each([
    [
      'ceiling-only',
      {
        priorTeamOfferCeiling: 12_000_000,
        governedContractEventId: undefined,
      },
    ],
    [
      'event-only',
      {
        priorTeamOfferCeiling: undefined,
        governedContractEventId: 'governed-option-decline-event',
      },
    ],
  ])('hides Sign & Trade for a %s governed assertion', (_label, markers) => {
    render(
      <CapSheetFull
        teamCapSheet={{
          ...team,
          capHolds: [{ ...team.capHolds[0], ...markers }],
        } as never}
        currentYear={2027}
        playersMap={{ [RIGHTS_FIXTURE_PLAYER_ID]: PLAYER }}
        governedRightsContext={governedContext}
        onSignAndTradeFreeAgent={vi.fn()}
      />
    );

    expect(
      screen.getByTestId('cap-sheet-full-fa-decision-row')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('cap-sheet-full-fa-sign-and-trade-button')
    ).not.toBeInTheDocument();
  });

  it('renders the replayed Bird tier and Free Agent Amount instead of snapshot fallbacks', () => {
    const renounceCapHold = vi.fn();
    render(
      <CapSheetFull
        teamCapSheet={team as never}
        currentYear={2027}
        playersMap={{ [RIGHTS_FIXTURE_PLAYER_ID]: PLAYER }}
        governedRightsContext={governedContext}
        onRenounceCapHold={renounceCapHold}
      />
    );

    expect(screen.getByTitle('Full Bird rights')).toBeInTheDocument();
    const resignCell = screen.getByTestId('cap-sheet-full-fa-resign-cell');
    expect(resignCell).not.toHaveTextContent('$999');
    expect(resignCell).toHaveAttribute(
      'title',
      expect.stringContaining('$21,850,000')
    );

    const absolve = screen.getByTestId('cap-sheet-full-fa-absolve-button');
    expect(absolve).toBeEnabled();
    fireEvent.click(absolve);
    expect(renounceCapHold).toHaveBeenCalledTimes(1);
  });

  it('blocks the row and affected yearly total when governed evidence is missing', () => {
    render(
      <CapSheetFull
        teamCapSheet={{ ...team, rightsLedger: null } as never}
        currentYear={2027}
        playersMap={{ [RIGHTS_FIXTURE_PLAYER_ID]: PLAYER }}
        governedRightsContext={governedContext}
      />
    );

    expect(
      screen.getByTestId('cap-sheet-full-rights-totals-incomplete')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('cap-sheet-full-rights-needs-input')
    ).toHaveTextContent('Needs input');
    expect(screen.getByTestId('cap-sheet-full-fa-absolve-button')).toBeDisabled();
    expect(
      screen.getAllByTestId('cap-sheet-full-total-cell').some((cell) =>
        cell.textContent?.includes('Needs input')
      )
    ).toBe(true);
  });

  it('fails a future-season hold closed when its rights package is incomplete', () => {
    const futureAsOfDate = '2027-07-01T12:00:00-04:00';
    const root = makeRightsEstablishedEvent();
    const futureLedger = makeRightsLedger({
      ...root,
      eventId: 'rights-established-player-bze-273-2028',
      salaryCapYear: 2028,
      executedAt: '2027-07-01',
      effectiveAt: '2027-07-01',
      recordedAt: '2027-07-01T16:00:00Z',
      serviceSeasons: root.serviceSeasons.map((entry) => ({
        ...entry,
        salaryCapYear: entry.salaryCapYear + 1,
        source: {
          ...entry.source,
          effectiveFrom: '2027-07-01',
          effectiveThrough: '2028-06-30',
        },
      })),
      priorContract: {
        ...root.priorContract,
        finalSalaryCapYear: 2027,
        source: {
          ...root.priorContract.source,
          effectiveFrom: '2027-07-01',
          effectiveThrough: '2028-06-30',
        },
      },
      amountRecords: root.amountRecords.map((record) => ({
        ...record,
        salaryCapYear: 2028,
        source: {
          ...record.source,
          effectiveFrom: '2027-07-01',
          effectiveThrough: '2028-06-30',
        },
      })),
    });

    const futureTeam = withGovernedSalaryBooks(
      {
        ...team,
        capHolds: [
          {
            ...team.capHolds[0],
            season: '2027-28',
          },
        ],
        rightsLedger: futureLedger,
      },
      {
        salaryCapYear: 2028,
        asOfDate: futureAsOfDate,
        teamSalary: 40_471_733,
      }
    );

    render(
      <CapSheetFull
        teamCapSheet={futureTeam as never}
        currentYear={2027}
        playersMap={{ [RIGHTS_FIXTURE_PLAYER_ID]: PLAYER }}
        governedRightsContext={{ ...governedContext, asOfDate: futureAsOfDate }}
      />
    );

    expect(
      screen.getByTestId('cap-sheet-full-rights-totals-incomplete')
    ).toBeInTheDocument();
    const futureSeasonTotal = screen
      .getAllByTestId('cap-sheet-full-total-cell')
      .find((cell) => cell.getAttribute('data-salary-cap-year') === '2028');
    // The hold remains visible, but the combined future salary book fails
    // closed because the future rights package is not fully authoritative.
    expect(futureSeasonTotal).toHaveTextContent('Needs input');
    fireEvent.click(
      screen.getByTestId('cap-sheet-full-cap-holds-toggle')
    );
    expect(screen.queryByText('$21,850,000')).not.toBeInTheDocument();
  });

  it('identifies an incompatible pre-ledger world and requires recreation', () => {
    render(
      <CapSheetFull
        teamCapSheet={team as never}
        currentYear={2027}
        playersMap={{ [RIGHTS_FIXTURE_PLAYER_ID]: PLAYER }}
        governedRightsContext={{ ...governedContext, worldVersion: null }}
      />
    );

    expect(
      screen.getByTestId('cap-sheet-full-rights-incompatible')
    ).toHaveTextContent('Recreate it');
    expect(
      screen.queryByTestId('cap-sheet-full-fa-decision-row')
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByTestId('cap-sheet-full-total-cell').some((cell) =>
        cell.textContent?.includes('Needs input')
      )
    ).toBe(true);
  });
});
