import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ExceptionTracker from '@/features/architect/capSheet/ExceptionTracker/ExceptionTracker';
import ManageExceptionsModal from '@/features/architect/capSheet/modals/ManageExceptionsModal';
import ManageDeadMoneyModal from '@/features/architect/capSheet/modals/ManageDeadMoneyModal';

const hoistedMocks = vi.hoisted(() => ({
  tpeList: [],
}));

vi.mock(
  '@/features/architect/utils/tradeMachine/utils/capSettingsProvider',
  () => ({
    getCapSettingsForYear: vi.fn(() => ({
      fullMLE: 12_800_000,
      taxpayerMLE: 5_000_000,
      bae: 4_700_000,
      roomMLE: 7_900_000,
      firstApron: 179_000_000,
      secondApron: 189_000_000,
    })),
  })
);

vi.mock('@/features/architect/utils/capTotals/computeTeamCapTotals', () => ({
  canUseRoomException: vi.fn(() => ({ eligible: true })),
}));

vi.mock('@/features/architect/utils/persistenceContracts/normalizeTeamTpe', () => ({
  getTeamTpeList: vi.fn(() => hoistedMocks.tpeList),
}));

describe('Cap Sheet Exception Wiring (E1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoistedMocks.tpeList = [];
  });

  afterEach(() => {
    cleanup();
  });

  it('updates ExceptionTracker cards after modal save in the same page session', async () => {
    const ExceptionSaveHarness = () => {
      const [teamCapSheet, setTeamCapSheet] = React.useState({
        hardCapped: 0,
        exceptions: {},
        mle: {
          amount: 9_876_543,
          used: 111_111,
        },
      });

      const handleSave = async () => {
        setTeamCapSheet((prev) => ({
          ...prev,
          exceptions: {
            ...(prev.exceptions || {}),
            mle: {
              enabled: true,
              totalAmount: 9_876_543,
              usedAmount: 1_234_567,
            },
          },
        }));
        return true;
      };

      return (
        <>
          <ExceptionTracker teamCapSheet={teamCapSheet} currentYear={2026} />
          <ManageExceptionsModal
            isOpen
            onClose={() => {}}
            teamCapSheet={teamCapSheet}
            onSave={handleSave}
            currentYear={2026}
          />
        </>
      );
    };

    render(<ExceptionSaveHarness />);

    expect(screen.getByText('$9,765,432')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.queryByText('$9,765,432')).not.toBeInTheDocument();
    });
    expect(screen.getAllByText('$8,641,976').length).toBeGreaterThan(0);
  });

  it('does not render or persist unsupported DPE exception key', async () => {
    const onSave = vi.fn().mockResolvedValue(true);

    render(
      <ManageExceptionsModal
        isOpen
        onClose={() => {}}
        onSave={onSave}
        currentYear={2026}
        teamCapSheet={{
          exceptions: {
            dpe: {
              enabled: true,
              totalAmount: 3_000_000,
              usedAmount: 1_000_000,
            },
            mle: {
              enabled: true,
              totalAmount: 6_000_000,
              usedAmount: 2_000_000,
            },
          },
        }}
      />
    );

    expect(
      screen.queryByText(/Disabled Player Exception \(DPE\)/i)
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    const savedPayload = onSave.mock.calls[0][0];
    expect(savedPayload).toHaveProperty('mle');
    expect(savedPayload).not.toHaveProperty('dpe');
  });

  it('uses TPE expiry fallback fields and prefers expiresOn when present', () => {
    hoistedMocks.tpeList = [
      {
        amount: 1_500_000,
        createdFrom: 'Trade A',
        expirationDate: '2027-06-30',
      },
    ];

    const { rerender } = render(
      <ExceptionTracker teamCapSheet={{ hardCapped: 0 }} currentYear={2026} />
    );
    expect(screen.getByText('2027-06-30')).toBeInTheDocument();

    hoistedMocks.tpeList = [
      {
        amount: 1_500_000,
        createdFrom: 'Trade A',
        expiresOn: '2027-07-15',
        expirationDate: '2027-06-30',
        expires: '2027-05-01',
      },
    ];

    rerender(
      <ExceptionTracker teamCapSheet={{ hardCapped: 0 }} currentYear={2026} />
    );

    expect(screen.getByText('2027-07-15')).toBeInTheDocument();
    expect(screen.queryByText('2027-06-30')).not.toBeInTheDocument();
  });

  it('keeps exceptions modal open with inline error when save fails', async () => {
    const onClose = vi.fn();
    const onSave = vi.fn().mockResolvedValue(false);

    render(
      <ManageExceptionsModal
        isOpen
        onClose={onClose}
        onSave={onSave}
        currentYear={2026}
        teamCapSheet={{ exceptions: {} }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Failed to save exceptions'
      );
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps dead money modal open with inline error when save fails', async () => {
    const onClose = vi.fn();
    const onSave = vi.fn().mockResolvedValue(false);

    render(
      <ManageDeadMoneyModal
        isOpen
        onClose={onClose}
        onSave={onSave}
        currentYear={2026}
        teamCapSheet={{ deadCap: [] }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Failed to save dead money changes'
      );
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});
