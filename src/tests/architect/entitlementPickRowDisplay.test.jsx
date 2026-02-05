/**
 * FILE: src/tests/architect/entitlementPickRowDisplay.test.jsx
 * PURPOSE: Ensure entitlement display reflects edited fields.
 * OWNERSHIP: Test suite
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { EntitlementPicksList } from '@/features/architect/tradeMachine/EntitlementPicksList';

describe('EntitlementPicksList display', () => {
  it('renders protection ladder, swap, and conveyance details', () => {
    const entitlements = [
      {
        id: 'ent:LAL:2026:1:own:ladder',
        holderTeam: 'LAL',
        seasonYear: 2026,
        round: 1,
        kind: 'pick_ownership',
        underlyingPickId: 'LAL_2026_1st',
        protectionLadder: [
          {
            year: 2026,
            condition: 'Top 3',
            ifTriggered: 'roll',
            rollToYear: 2027,
          },
        ],
      },
      {
        id: 'ent:LAL:2027:1:swap:abc',
        holderTeam: 'LAL',
        seasonYear: 2027,
        round: 1,
        kind: 'swap_right',
        swapControllerPickId: 'LAL_2027_1st',
        swapTargetDefinition: 'Option to swap with MIL',
      },
      {
        id: 'ent:LAL:2028:1:conv:def',
        holderTeam: 'LAL',
        seasonYear: 2028,
        round: 1,
        kind: 'conveyance_right',
        poolUnderlyingPickIds: ['ATL_2028_1st', 'SAS_2028_1st'],
        receivesRank: [1],
        receivesComparator: 'less_favorable',
      },
    ];

    render(<EntitlementPicksList entitlements={entitlements} teamId="LAL" />);

    expect(screen.getByText(/Top 3/i)).toBeInTheDocument();
    expect(screen.getByText(/Option to swap with MIL/i)).toBeInTheDocument();
    expect(screen.getByText(/Less favorable #1 of 2/i)).toBeInTheDocument();
  });
});
