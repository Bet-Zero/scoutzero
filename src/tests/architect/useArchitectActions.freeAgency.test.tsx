import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { useArchitectActions } from '@/features/architect/GMDashboard/hooks/useArchitectActions';

const mutationMocks = vi.hoisted(() => ({
  applyWorldMutation: vi.fn(),
  computeWorldMutation: vi.fn(),
}));

const validationMocks = vi.hoisted(() => ({
  validateSigning: vi.fn(),
}));

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/features/architect/utils/mutationPipeline', () => ({
  applyWorldMutation: mutationMocks.applyWorldMutation,
  computeWorldMutation: mutationMocks.computeWorldMutation,
}));

vi.mock('@/features/architect/utils/capLegalityValidation', () => ({
  validateSigning: validationMocks.validateSigning,
}));

vi.mock('react-hot-toast', () => ({
  default: toastMocks,
}));

const playerFixture = {
  id: 'player_1',
  player_id: 'player_1',
  name: 'Test Player',
  displayName: 'Test Player',
  teamCode: 'LAL',
  contract: {
    salariesByYear: [],
  },
};

const contractFixture = {
  salariesByYear: [
    {
      season: '2025-26',
      salary: 12_000_000,
      capHit: 12_000_000,
      guaranteed: true,
    },
  ],
  totalValue: 12_000_000,
  signedUsing: 'Full MLE',
};

const baseTeamFixture = {
  teamCode: 'LAL',
  teamName: 'Los Angeles Lakers',
  roster: [],
  players: [],
  capHolds: [{ playerId: 'player_1', amount: 9_000_000 }],
  exceptions: {
    mle: {
      type: 'non-taxpayer',
      usedAmount: 0,
      remainingAmount: 12_900_000,
    },
  },
  totals: {
    isHardCapped: false,
  },
};

function renderActionsHarness({
  worldId,
  userId = 'user_1',
  initialTeam = baseTeamFixture,
}: {
  worldId: string | null;
  userId?: string | null;
  initialTeam?: any;
}) {
  const refreshWorldRosterIndex = vi.fn().mockResolvedValue(new Set<string>());
  const startSave = vi.fn();
  const finishSave = vi.fn();

  const modals = {
    openContractModal: vi.fn(),
    closeContractModal: vi.fn(),
  };

  const { result } = renderHook(() => {
    const [teamCapSheet, setTeamCapSheet] = useState<any>(initialTeam);
    const [selectedRulesYear, setSelectedRulesYear] = useState<number>(2026);
    const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
    const [freeAgents, setFreeAgents] = useState<any[]>([playerFixture]);
    const [offseasonRun, setOffseasonRun] = useState<boolean>(false);
    const [offseasonSummary, setOffseasonSummary] = useState<any>(null);

    const actions = useArchitectActions({
      teamId: 'LAL',
      userId: userId ?? null,
      authLoading: false,
      state: {
        teamCapSheet,
        currentYear: 2026,
        setTeamCapSheet,
        setSelectedRulesYear,
        setSelectedPlayer,
        setFreeAgents,
        startSave,
        finishSave,
        setOffseasonRun,
        setOffseasonSummary,
        refreshWorldRosterIndex,
      },
      playersMap: {
        [playerFixture.id]: playerFixture,
        [playerFixture.player_id]: playerFixture,
        [playerFixture.name]: playerFixture,
      },
      modals,
      worldId,
      seasonId: '2025-26',
    });

    return {
      actions,
      teamCapSheet,
      freeAgents,
      selectedRulesYear,
      selectedPlayer,
      offseasonRun,
      offseasonSummary,
    };
  });

  return {
    result,
    refreshWorldRosterIndex,
    startSave,
    finishSave,
  };
}

describe('useArchitectActions Free Agency SSOT wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validationMocks.validateSigning.mockReturnValue({
      valid: true,
      violations: [],
      warnings: [],
    });
  });

  it('applies canonical changedTeams snapshot immediately after world-mode sign', async () => {
    const updatedTeam = {
      ...baseTeamFixture,
      roster: ['player_1'],
      players: [
        {
          ...playerFixture,
          contract: {
            salariesByYear: contractFixture.salariesByYear,
          },
        },
      ],
      capHolds: [],
      exceptions: {
        mle: {
          type: 'non-taxpayer',
          usedAmount: 12_000_000,
          remainingAmount: 900_000,
        },
      },
      totals: {
        isHardCapped: true,
        hardCapLevel: 'firstApron',
      },
    };

    mutationMocks.applyWorldMutation.mockResolvedValue({
      success: true,
      changedTeams: [{ teamCode: 'LAL', team: updatedTeam }],
      changedPlayers: [],
    });

    const { result, refreshWorldRosterIndex } = renderActionsHarness({
      worldId: 'world_1',
    });

    act(() => {
      result.current.actions.handleSign(playerFixture as any, contractFixture as any);
    });

    await waitFor(() => {
      expect(result.current.teamCapSheet.capHolds).toHaveLength(0);
      expect(result.current.teamCapSheet.totals?.isHardCapped).toBe(true);
      expect(result.current.teamCapSheet.exceptions?.mle?.usedAmount).toBe(
        12_000_000
      );
    });

    expect(mutationMocks.applyWorldMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        mutationType: 'signFreeAgent',
        worldId: 'world_1',
      })
    );
    expect(refreshWorldRosterIndex).toHaveBeenCalled();
  });

  it('blocks sign-and-trade in vacuum mode with explicit error (no silent no-op)', async () => {
    const { result } = renderActionsHarness({ worldId: null });

    act(() => {
      result.current.actions.handleSignAndTrade(
        playerFixture as any,
        contractFixture as any,
        'BOS'
      );
    });

    await waitFor(() => {
      expect(toastMocks.error).toHaveBeenCalledWith(
        expect.stringContaining('requires an active world')
      );
    });
    expect(mutationMocks.applyWorldMutation).not.toHaveBeenCalled();
  });

  it('surfaces clear error when finalize is invoked without offer sheet args', async () => {
    const { result } = renderActionsHarness({ worldId: 'world_1' });

    act(() => {
      result.current.actions.handleFinalizeOfferSheet(undefined);
    });

    await waitFor(() => {
      expect(toastMocks.error).toHaveBeenCalledWith(
        expect.stringContaining('offer sheet data is missing')
      );
    });
    expect(mutationMocks.applyWorldMutation).not.toHaveBeenCalled();
  });
});
