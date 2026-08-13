import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TradeReceiptPanel } from '@/features/architect/tradeMachine/TradeReceiptPanel';
import { TWO_WAY_TRADE_MATCHING_EXPLANATION } from '@/features/architect/utils/tradeMachine/utils/twoWayTradeSalary';
import type { TradeReceiptLike } from '@/features/architect/tradeMachine/validationPresentationTypes';

const receipt: TradeReceiptLike = {
  isLegal: true,
  validatorVersion: '2.0',
  yearKey: 2026,
  seasonKey: '2025-26',
  teams: [
    {
      teamName: 'Boston Celtics',
      teamCode: 'BOS',
      preTradeTeamSalary: 160_000_000,
      preTradeTeamSalarySource: 'teamTotalSalary',
      salaryMatchingEvaluation: {
        ruleApplied: 'FA_EXCEPTION',
        formulaUsed: 'Two-Way salary excluded',
        allowableIncoming: 8_000_000,
        actualIncoming: 8_000_000,
        margin: 0,
      },
      totals: {
        outgoingBaseTotal: 636_435,
        outgoingMatchingTotal: 0,
        incomingBaseTotal: 636_435,
        incomingMatchingTotal: 0,
      },
      outgoingPlayers: [
        {
          name: 'Outgoing Two-Way',
          baseSalary: 636_435,
          matchingValue: 0,
          flags: {
            isTwoWay: true,
            isBYC: true,
            hasTradeKicker: true,
            tradeKickerPct: 0.15,
          },
        },
      ],
      incomingPlayers: [
        {
          name: 'Incoming Two-Way',
          baseSalary: 636_435,
          matchingValue: 0,
          flags: {
            isTwoWay: true,
            isPoisonPill: true,
            hasTradeKicker: true,
            tradeKickerPct: 0.15,
          },
        },
      ],
    },
  ],
};

describe('TradeReceiptPanel Two-Way presentation', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it('shows the Two-Way explanation and suppresses incompatible adjustment badges', () => {
    vi.stubEnv('VITE_SHOW_TRADE_RECEIPT', 'true');

    render(<TradeReceiptPanel receipt={receipt} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show Details' }));

    expect(screen.getByText('Outgoing Two-Way')).toBeTruthy();
    expect(screen.getByText('Incoming Two-Way')).toBeTruthy();
    expect(screen.getAllByText('2W')).toHaveLength(2);
    expect(
      screen.getAllByText(TWO_WAY_TRADE_MATCHING_EXPLANATION)
    ).toHaveLength(2);
    expect(screen.queryByText('BYC')).toBeNull();
    expect(screen.queryByText('PP')).toBeNull();
    expect(screen.queryByText('TK')).toBeNull();
    expect(screen.queryByText('Adj')).toBeNull();
  });
});
