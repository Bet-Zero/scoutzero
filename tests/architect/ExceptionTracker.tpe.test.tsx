/**
 * FILE: tests/architect/ExceptionTracker.tpe.test.tsx
 * PURPOSE: Gap D guard — verifies ExceptionTracker reads TPEs via getTeamTpeList (canonical + legacy fallback).
 * OWNERSHIP: Test suite — TM-1 fixpack
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ExceptionTracker } from '@/features/architect/capSheet/ExceptionTracker/ExceptionTracker';

// Stub out capSettingsProvider to remove external dependency
vi.mock('@/features/architect/utils/tradeMachine/utils/capSettingsProvider', () => ({
  getCapSettingsForYear: () => ({
    fullMLE: 12_900_000,
    taxpayerMLE: 3_100_000,
    bae: 3_500_000,
    roomMLE: 8_000_000,
    salaryCap: 141_000_000,
    firstApron: 150_000_000,
    secondApron: 175_000_000,
  }),
  yearToSeasonKey: (year: number | string) =>
    `${Number(year) - 1}-${String(year).slice(-2)}`,
  getExceptionDefaultAmountFromCapSettings: (
    type: 'mle' | 'tpmle' | 'bae' | 'room',
    capSettings?: {
      fullMLE?: number;
      taxpayerMLE?: number;
      bae?: number;
      roomMLE?: number;
    }
  ) =>
    ({
        mle: capSettings?.fullMLE ?? 0,
        tpmle: capSettings?.taxpayerMLE ?? 0,
        bae: capSettings?.bae ?? 0,
        room: capSettings?.roomMLE ?? 0,
      })[type] ?? 0,
}));

describe('ExceptionTracker — TPE persistence via getTeamTpeList', () => {
  it('renders TPEs from canonical exceptions.tpe when tradeExceptions is absent', () => {
    const sheet = {
      exceptions: {
        tpe: [
          { amount: 5_000_000, createdFrom: 'Trade vs BOS', expires: '2026-07' },
        ],
      },
    };

    render(<ExceptionTracker teamCapSheet={sheet} currentYear={2026} />);

    expect(screen.getAllByText('$5,000,000').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/from Trade vs BOS/).length).toBeGreaterThan(0);
  });

  it('prefers canonical exceptions.tpe over conflicting legacy tradeExceptions', () => {
    const sheet = {
      exceptions: {
        tpe: [
          { amount: 5_000_000, createdFrom: 'Trade vs BOS', expires: '2026-07' },
        ],
      },
      tradeExceptions: [
        { amount: 9_000_000, createdFrom: 'Legacy Trade vs LAL', expires: '2026-08' },
      ],
    };

    render(<ExceptionTracker teamCapSheet={sheet} currentYear={2026} />);

    expect(screen.getAllByText('$5,000,000').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/from Trade vs BOS/).length).toBeGreaterThan(0);
    expect(screen.queryByText('$9,000,000')).not.toBeInTheDocument();
    expect(screen.queryByText(/from Legacy Trade vs LAL/)).not.toBeInTheDocument();
  });

  it('falls back to legacy tradeExceptions when exceptions.tpe is empty', () => {
    const sheet = {
      tradeExceptions: [
        { amount: 3_000_000, createdFrom: 'Trade vs MIA', expires: '2026-06' },
      ],
    };

    render(<ExceptionTracker teamCapSheet={sheet} currentYear={2026} />);

    expect(screen.getByText('$3,000,000')).toBeInTheDocument();
    expect(screen.getAllByText(/from Trade vs MIA/).length).toBeGreaterThan(0);
  });

  it('shows "No Active TPEs" when both paths are empty', () => {
    const sheet = {
      exceptions: { tpe: [] },
    };

    render(<ExceptionTracker teamCapSheet={sheet} currentYear={2026} />);

    expect(screen.getByText(/No Active TPEs/)).toBeInTheDocument();
  });
});
