// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { EditContractModal } from '@/shared/components/EditContractModal';

vi.mock('@/features/architect/hooks/useCapValidation', () => {
  const useCapValidation = () => ({
    warnings: [],
    errors: [],
    isValid: true,
  });
  return {
    __esModule: true,
    default: useCapValidation,
    useCapValidation,
    buildSigningGuardrails: () => null,
  };
});

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

  it('shows governed extension evidence gaps and cannot save through override', () => {
    const onExtend = vi.fn();
    render(
      <EditContractModal
        isOpen
        onClose={vi.fn()}
        player={PLAYER}
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2026}
        initialAction="extend"
        onExtend={onExtend}
        extensionAvailability={{
          status: 'needs-input',
          playerId: 'p1',
          contractId: 'contract-p1',
          reasons: [
            'Exact transaction history and original compensation bases are missing.',
          ],
          suggestedRoute: null,
          allowedRoutes: [],
          firstExtendedSeason: null,
        }}
      />
    );

    expect(screen.getByText(/needs governed input/i)).toBeInTheDocument();
    expect(
      screen.getAllByText(/exact transaction history/i).length
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole('button', { name: /authoritative preflight pending/i })
    ).toBeDisabled();
    expect(onExtend).not.toHaveBeenCalled();
  });

  it('collects exact signature evidence and dispatches a governed Veteran proposal', async () => {
    const onClose = vi.fn();
    const onExtend = vi.fn().mockResolvedValue({ success: true });
    render(
      <EditContractModal
        isOpen
        onClose={onClose}
        player={PLAYER}
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2026}
        initialAction="extend"
        onExtend={onExtend}
        extensionAvailability={{
          status: 'ready',
          playerId: 'p1',
          contractId: 'contract-p1',
          reasons: [],
          suggestedRoute: 'veteran',
          allowedRoutes: ['veteran'],
          firstExtendedSeason: '2026-27',
        }}
      />
    );

    const confirm = screen.getByRole('button', {
      name: /authoritative preflight pending/i,
    });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByTestId('governed-extension-signed-at'), {
      target: { value: '2026-07-08T12:00:00-04:00' },
    });
    const enabledConfirm = await screen.findByRole('button', {
      name: /confirm action/i,
    });
    expect(enabledConfirm).toBeEnabled();
    fireEvent.click(enabledConfirm);

    await waitFor(() => {
      expect(onExtend).toHaveBeenCalledWith(
        PLAYER,
        expect.objectContaining({
          proposalVersion: 1,
          contractId: 'contract-p1',
          route: 'veteran',
          signedAt: '2026-07-08T12:00:00-04:00',
          conditionalHigherMaxPercentage: null,
          agreedDesignatedVeteranPercentage: null,
          salariesByYear: expect.arrayContaining([
            expect.objectContaining({
              season: '2026-27',
              salaryExcludingIncentive: expect.any(Number),
              regularSalary: expect.any(Number),
              bonuses: [],
            }),
          ]),
        })
      );
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('dispatches an optional Rookie Scale Higher Max clause as pending evidence', async () => {
    const onExtend = vi.fn().mockResolvedValue({ success: true });
    render(
      <EditContractModal
        isOpen
        onClose={vi.fn()}
        player={PLAYER}
        teamCapSheet={TEAM_CAP_SHEET}
        currentYear={2026}
        initialAction="extend"
        onExtend={onExtend}
        extensionAvailability={{
          status: 'ready',
          playerId: 'p1',
          contractId: 'contract-p1',
          reasons: [],
          suggestedRoute: 'rookie-scale',
          allowedRoutes: ['rookie-scale'],
          firstExtendedSeason: '2026-27',
        }}
      />
    );

    fireEvent.change(screen.getByTestId('governed-extension-signed-at'), {
      target: { value: '2026-07-08T12:00:00-04:00' },
    });
    fireEvent.change(
      await screen.findByTestId(
        'governed-extension-higher-max-percentage'
      ),
      { target: { value: '30' } }
    );
    fireEvent.click(
      await screen.findByRole('button', { name: /confirm action/i })
    );

    await waitFor(() => {
      expect(onExtend).toHaveBeenCalledWith(
        PLAYER,
        expect.objectContaining({
          route: 'rookie-scale',
          conditionalHigherMaxPercentage: 30,
          agreedDesignatedVeteranPercentage: null,
        })
      );
    });
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
