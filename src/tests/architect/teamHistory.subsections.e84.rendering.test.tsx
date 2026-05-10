// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExceptionHistoryTracker } from '@/features/architect/capSheet/ExceptionHistoryTracker';
import { DraftPickTracker } from '@/features/architect/offseason/DraftPickTracker';
import { WaiveStretchTracker } from '@/features/architect/offseason/WaiveStretchTracker';

describe('Team History E84 subsection rendering', () => {
  it('preserves exception history row order and empty states', () => {
    const { rerender } = render(
      <ExceptionHistoryTracker
        exceptionHistory={[
          {
            id: 'tpe_1',
            date: '2026-02-10',
            action: 'Created',
            amount: 1200000,
            sourcePlayerName: 'Player A',
            expires: '2027-02-10',
          },
          {
            id: 'tpe_2',
            date: '2026-01-05',
            action: 'Used',
            amountRemaining: 500000,
            sourcePlayerName: 'Player B',
            expiresAt: '2027-01-05',
          },
        ]}
        mleHistory={[
          {
            id: 'mle_1',
            year: '2026',
            total: 14100000,
            used: 4000000,
            notes: 'First use',
          },
          {
            id: 'mle_2',
            year: '2027',
            total: 15000000,
            used: 2000000,
            notes: 'Second use',
          },
        ]}
      />
    );

    expect(screen.getByTestId('team-history-tpe-row-0')).toHaveTextContent(
      '2026-02-10'
    );
    expect(screen.getByTestId('team-history-tpe-row-1')).toHaveTextContent(
      '2026-01-05'
    );
    expect(screen.getByTestId('team-history-mle-row-0')).toHaveTextContent(
      '2026'
    );
    expect(screen.getByTestId('team-history-mle-row-1')).toHaveTextContent(
      '2027'
    );

    rerender(<ExceptionHistoryTracker exceptionHistory={[]} mleHistory={[]} />);

    expect(screen.getByText('No TPE activity logged.')).toBeInTheDocument();
    expect(screen.getByText('No MLE activity logged.')).toBeInTheDocument();
  });

  it('preserves draft pick log and current pick inventory ordering plus empty states', () => {
    const { rerender } = render(
      <DraftPickTracker
        pickLog={[
          {
            date: '2026-02-11',
            action: 'Sent',
            pick: '2028 1st',
            partner: 'BOS',
            notes: 'First row',
          },
          {
            date: '2026-01-08',
            action: 'Received',
            pick: '2027 2nd',
            partner: 'ATL',
            notes: 'Second row',
          },
        ]}
        currentPicks={{
          2028: { first: 'Own', second: '—' },
          2026: { first: 'Conveyed', second: 'Own' },
          2027: { first: 'Swap rights', second: 'Own' },
        }}
      />
    );

    expect(screen.getByTestId('team-history-pick-log-row-0')).toHaveTextContent(
      '2026-02-11'
    );
    expect(screen.getByTestId('team-history-pick-log-row-1')).toHaveTextContent(
      '2026-01-08'
    );
    expect(
      screen.getByTestId('team-history-current-picks-row-2026')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('team-history-current-picks-row-2027')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('team-history-current-picks-row-2028')
    ).toBeInTheDocument();

    rerender(<DraftPickTracker pickLog={[]} currentPicks={{}} />);

    expect(screen.getByText('No draft pick trades logged.')).toBeInTheDocument();
    expect(screen.getByText('No picks currently owned.')).toBeInTheDocument();
  });

  it('preserves waive/stretch row ordering and empty states', () => {
    const { rerender } = render(
      <WaiveStretchTracker
        waivedContracts={[
          {
            name: 'Player First',
            waivedOn: '2026-02-01',
            stretched: true,
            deadCap: {
              2026: 1000000,
              2027: 500000,
            },
          },
          {
            name: 'Player Second',
            waivedOn: '2026-01-01',
            stretched: false,
            deadCap: {
              2026: 250000,
            },
          },
        ]}
      />
    );

    expect(screen.getByTestId('team-history-waived-row-0')).toHaveTextContent(
      'Player First'
    );
    expect(screen.getByTestId('team-history-waived-row-1')).toHaveTextContent(
      'Player Second'
    );
    expect(screen.getByTestId('team-history-dead-cap-row-2026')).toHaveTextContent(
      '2026'
    );
    expect(screen.getByTestId('team-history-dead-cap-row-2027')).toHaveTextContent(
      '2027'
    );

    rerender(<WaiveStretchTracker waivedContracts={[]} />);

    expect(screen.getByText('No waived contracts.')).toBeInTheDocument();
    expect(screen.getByText('No dead money on the books.')).toBeInTheDocument();
  });
});
