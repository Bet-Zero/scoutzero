// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import EditContractModal from '@/shared/components/EditContractModal';

vi.mock('@/features/architect/hooks/useCapValidation', () => ({
  __esModule: true,
  default: () => ({
    warnings: [],
    errors: [],
    isValid: true,
  }),
  buildSigningGuardrails: () => null,
}));

const PLAYER = {
  id: 'p1',
  player_id: 'p1',
  name: 'Test Player',
  displayName: 'Test Player',
  contract: {
    salariesByYear: [
      {
        season: '2025-26',
        salary: 12_000_000,
        capHit: 12_000_000,
        guaranteed: true,
      },
    ],
  },
};

const TEAM_CAP_SHEET = {
  teamCode: 'LAL',
  players: [PLAYER],
  deadCap: [],
  capHolds: [],
};

describe('EditContractModal buyout + close gating behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('collects buyout amount and forwards it via onWaive payload', async () => {
    const onClose = vi.fn();
    const onWaive = vi.fn().mockResolvedValue({ success: true });

    render(
      <EditContractModal
        isOpen
        onClose={onClose}
        player={PLAYER}
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2026}
        initialAction="buyout"
        onWaive={onWaive}
      />
    );

    const buyoutInput = screen.getByLabelText(/buyout amount/i);
    fireEvent.change(buyoutInput, { target: { value: '5000000' } });

    fireEvent.click(screen.getByRole('button', { name: /confirm action/i }));

    await waitFor(() => {
      expect(onWaive).toHaveBeenCalledWith(
        PLAYER,
        expect.objectContaining({
          stretch: false,
          buyout: true,
          buyoutAmount: 5_000_000,
        })
      );
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('keeps modal open and shows inline error when handler reports canceled confirm', async () => {
    const onClose = vi.fn();
    const onWaive = vi
      .fn()
      .mockResolvedValue({
        success: false,
        message: 'Action canceled. No changes were saved.',
      });

    render(
      <EditContractModal
        isOpen
        onClose={onClose}
        player={PLAYER}
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2026}
        initialAction="waive"
        onWaive={onWaive}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /confirm action/i }));

    await waitFor(() => {
      expect(onWaive).toHaveBeenCalledTimes(1);
    });

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      /action canceled\. no changes were saved\./i
    );
  });
});
