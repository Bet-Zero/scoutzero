// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CapSheetFull } from '@/features/architect/capSheet/CapSheetFull';
import { RIGHTS_LEDGER_WORLD_VERSION } from '@/features/architect/utils/rightsHistory';
import {
  RIGHTS_FIXTURE_AS_OF_DATE,
  RIGHTS_FIXTURE_PLAYER_ID,
  RIGHTS_FIXTURE_TEAM_ID,
  RIGHTS_FIXTURE_WORLD_ID,
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
