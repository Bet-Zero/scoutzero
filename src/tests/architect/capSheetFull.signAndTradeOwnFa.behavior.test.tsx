// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { CapSheetFull } from '@/features/architect/capSheet/CapSheetFull';

// BZE-190: the sign-and-trade entry lives on the Full Cap Table own-FA decision
// row (where your departing free agents surface), next to Re-sign / Absolve.
// Selecting it hands the player to the Trade Machine; legality is checked there.

const CURRENT_YEAR = 2027; // end-year of the 2026-27 season being planned

// An own free agent for the 2026-27 season: contract expired after 2025-26 (so
// he drops off the visible roster rows), Bird rights held, freeAgency.year 2026
// (== the season start year) so his cap hold resolves to the 'main' decision row.
const GRANT = {
  id: 'mia_grant_holloway',
  player_id: 'mia_grant_holloway',
  name: 'Grant Holloway',
  displayName: 'Grant Holloway',
  bio: { playerId: 'mia_grant_holloway', displayName: 'Grant Holloway' },
  contract: {
    salariesByYear: [
      {
        year: 2026,
        season: '2025-26',
        salary: 12_000_000,
        capHit: 12_000_000,
        guaranteed: true,
      },
    ],
    birdRights: { status: 'Bird' },
    freeAgency: { type: 'UFA', year: 2026, capHold: 15_000_000 },
  },
};

const ownFaTeamCapSheet = {
  teamId: 'MIA',
  teamCode: 'MIA',
  players: [GRANT],
  capHolds: [
    {
      playerId: 'mia_grant_holloway',
      playerName: 'Grant Holloway',
      amount: 15_000_000,
      season: '2026-27',
      type: 'UFA',
      active: true,
      isSigned: false,
    },
  ],
} as never;

// resolveCapHoldPlayer reads the full player record (with freeAgency) from the
// league lookup map, keyed by the hold's player id.
const playersMap = { mia_grant_holloway: GRANT } as never;

afterEach(() => cleanup());

describe('CapSheetFull own-FA sign-and-trade entry (BZE-190)', () => {
  it('offers Sign & Trade on the own-FA decision row and hands the player to the Trade Machine', () => {
    const onSignAndTradeFreeAgent = vi.fn();
    render(
      <CapSheetFull
        teamCapSheet={ownFaTeamCapSheet}
        currentYear={CURRENT_YEAR}
        playersMap={playersMap}
        onSignAndTradeFreeAgent={onSignAndTradeFreeAgent}
      />
    );

    const decisionRow = screen.getByTestId('cap-sheet-full-fa-decision-row');
    expect(decisionRow).toHaveTextContent('Grant Holloway');

    fireEvent.click(
      screen.getByTestId('cap-sheet-full-fa-sign-and-trade-button')
    );

    expect(onSignAndTradeFreeAgent).toHaveBeenCalledTimes(1);
    const handed = onSignAndTradeFreeAgent.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(handed?.playerId ?? handed?.id ?? handed?.player_id).toBe(
      'mia_grant_holloway'
    );
  });

  it('omits Sign & Trade in base/preview mode (no handler wired)', () => {
    render(
      <CapSheetFull
        teamCapSheet={ownFaTeamCapSheet}
        currentYear={CURRENT_YEAR}
        playersMap={playersMap}
      />
    );

    expect(
      screen.getByTestId('cap-sheet-full-fa-decision-row')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('cap-sheet-full-fa-sign-and-trade-button')
    ).not.toBeInTheDocument();
  });
});
