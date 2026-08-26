// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';

import { TradeApronRestrictionReceipt } from '@/features/architect/tradeMachine/TradeApronRestrictionReceipt';
import type { TradeApronRestrictionEvaluation } from '@/features/architect/utils/tradeMachine/utils/tradeApronRestrictions';

afterEach(cleanup);

describe('TradeApronRestrictionReceipt', () => {
  it('labels a Row C trigger as sign-and-trade', () => {
    const proof = {
      registryId: 'registry',
      registryVersion: 1,
      canonCandidateCommit: 'candidate',
      canonSha256: 'sha256',
      calendarRecordId: 'calendar',
      calendarRecordVersion: 1,
      apronRecordId: 'apron',
      apronRecordVersion: 1,
    };
    const evaluation: TradeApronRestrictionEvaluation = {
      version: 1,
      status: 'PASS',
      passed: true,
      restrictionRow: 'C',
      salaryMatchingPath: 'ROOM',
      apronLevel: 'FIRST_APRON',
      ceiling: 195_945_000,
      postTransactionApronTeamSalary: 190_000_000,
      margin: 5_945_000,
      transactionDate: '2026-07-15T12:00:00-04:00',
      salaryCapYear: 2027,
      tpeId: null,
      tpeCreatedOn: null,
      tpeExpiresOn: null,
      tpeTimings: [],
      attachedRestrictions: [
        {
          restrictionRow: 'C',
          componentId: 'sign-and-trade:player-1',
          componentKind: 'SIGN_AND_TRADE',
          salaryMatchingPath: 'ROOM',
          apronLevel: 'FIRST_APRON',
          ceiling: 195_945_000,
          incomingPlayers: [
            { playerId: 'player-1', playerName: 'Test Player', salary: 12_000_000 },
          ],
          cashAmountCents: null,
          tpeTiming: null,
          regularSeasonClosing: null,
          canonLeafIds: ['CBA2-A07.6'],
          proof,
        },
      ],
      regularSeasonClosing: '2027-04-11',
      hardCapWillPersist: true,
      canonLeafIds: ['CBA2-A07.6'],
      missingInputs: [],
      violations: [],
      proof,
    };

    render(
      <TradeApronRestrictionReceipt evaluation={evaluation} teamCode="BOS" />
    );

    expect(screen.getByTestId('trade-apron-restriction-BOS')).toHaveTextContent(
      'Row C · Sign-and-trade component sign-and-trade:player-1'
    );
    expect(screen.queryByText(/Aggregated Standard TPE/)).not.toBeInTheDocument();
  });
});
