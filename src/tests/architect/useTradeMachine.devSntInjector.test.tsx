// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useTradeMachine } from '@/features/architect/hooks/useTradeMachine';

function assertDefined<T>(value: T | null | undefined, message: string): T {
  if (value == null) {
    throw new Error(message);
  }
  return value;
}

const primaryTeamData = {
  id: 'lal',
  teamCode: 'LAL',
  teamName: 'Los Angeles Lakers',
  abbreviation: 'LAL',
  players: [
    {
      id: 'base_player',
      player_id: 'base_player',
      name: 'Base Player',
      teamCode: 'LAL',
      bio: {
        displayName: 'Base Player',
        playerId: 'base_player',
        position: 'G',
      },
      freeAgentYear: 2028,
      contract: {
        salariesByYear: [
          { season: '2025-26', salary: 10_000_000, capHit: 10_000_000 },
        ],
      },
    },
  ],
  teamTotalSalary: 170_000_000,
  totalSalary: 170_000_000,
  capHolds: [],
  deadCap: [],
  entitlementIds: [],
  totals: {},
};

describe('useTradeMachine DEV S&T injector lifecycle', () => {
  it('injects synthetic players and resetTrade clears them from session state', async () => {
    const { result } = renderHook(() =>
      useTradeMachine('LAL', {}, 2026, primaryTeamData, null)
    );

    await waitFor(() => {
      expect(result.current.teams[0]?.team?.players?.length).toBeGreaterThan(0);
    });

    act(() => {
      result.current.injectDevSntPlayers();
    });

    await waitFor(() => {
      expect(result.current.hasInjectedDevSntPlayers).toBe(true);
    });
    const injectedTeam = assertDefined(
      result.current.teams[0]?.team,
      'Expected injected primary team'
    );
    expect(
      assertDefined(injectedTeam.players, 'Expected injected players').some((p) =>
        (p as Record<string, unknown>).name?.toString().includes('TM DEV S&T')
      )
    ).toBe(true);

    act(() => {
      result.current.resetTrade();
    });

    await waitFor(() => {
      expect(result.current.hasInjectedDevSntPlayers).toBe(false);
    });
    const resetTeam = assertDefined(
      result.current.teams[0]?.team,
      'Expected reset primary team'
    );
    expect(
      assertDefined(resetTeam.players, 'Expected reset players').some((p) =>
        (p as Record<string, unknown>).name?.toString().includes('TM DEV S&T')
      )
    ).toBe(false);
  });
});
