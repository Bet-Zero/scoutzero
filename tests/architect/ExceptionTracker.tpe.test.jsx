/**
 * FILE: tests/architect/ExceptionTracker.tpe.test.jsx
 * PURPOSE: Gap D guard — verifies ExceptionTracker reads TPEs via getTeamTpeList (canonical + legacy fallback).
 * OWNERSHIP: Test suite — TM-1 fixpack
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ExceptionTracker from '@/features/architect/capSheet/ExceptionTracker/ExceptionTracker';

// Stub out capSettingsProvider to remove external dependency
vi.mock('@/features/architect/utils/tradeMachine/utils/capSettingsProvider', () => ({
  getCapSettingsForYear: () => ({
    fullMLE: 12_900_000,
    taxpayerMLE: 3_100_000,
    bae: 3_500_000,
    firstApron: 150_000_000,
    secondApron: 175_000_000,
  }),
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

    expect(screen.getByText('$5,000,000')).toBeInTheDocument();
    expect(screen.getByText(/from Trade vs BOS/)).toBeInTheDocument();
  });

  it('falls back to legacy tradeExceptions when exceptions.tpe is empty', () => {
    const sheet = {
      tradeExceptions: [
        { amount: 3_000_000, createdFrom: 'Trade vs MIA', expires: '2026-06' },
      ],
    };

    render(<ExceptionTracker teamCapSheet={sheet} currentYear={2026} />);

    expect(screen.getByText('$3,000,000')).toBeInTheDocument();
    expect(screen.getByText(/from Trade vs MIA/)).toBeInTheDocument();
  });

  it('shows "No Active TPEs" when both paths are empty', () => {
    const sheet = {
      exceptions: { tpe: [] },
    };

    render(<ExceptionTracker teamCapSheet={sheet} currentYear={2026} />);

    expect(screen.getByText(/No Active TPEs/)).toBeInTheDocument();
  });
});
