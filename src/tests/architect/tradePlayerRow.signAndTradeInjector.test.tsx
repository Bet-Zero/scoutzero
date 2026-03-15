// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import TradePlayerRow from '@/features/architect/tradeMachine/TradePlayerRow';
import { buildSyntheticSntPlayers } from '@/features/architect/tradeMachine/utils/devSntInjector';

const otherTeams = [{ id: 'BOS', teamName: 'Boston Celtics' }];
const baseHandlers = {
  onSetPlayerTrade: vi.fn(),
  onUndoPlayerTrade: vi.fn(),
  setOpenMenu: vi.fn(),
  setContractPlayer: vi.fn(),
  onRequestSignAndTrade: vi.fn(),
};

function renderOpenMenuRow(player: any) {
  return render(
    <TradePlayerRow
      player={player}
      included={false}
      yearKey={2026}
      incoming={false}
      otherTeams={otherTeams}
      playersMap={{}}
      openMenu={player.name}
      onSetPlayerTrade={baseHandlers.onSetPlayerTrade}
      onUndoPlayerTrade={baseHandlers.onUndoPlayerTrade}
      setOpenMenu={baseHandlers.setOpenMenu}
      setContractPlayer={baseHandlers.setContractPlayer}
      onRequestSignAndTrade={baseHandlers.onRequestSignAndTrade}
      sourceTeamId="LAL"
    />
  );
}

afterEach(() => {
  cleanup();
});

describe('TradePlayerRow DEV S&T injector eligibility surface', () => {
  it('shows Sign-and-Trade for the eligible synthetic player', () => {
    const [eligiblePlayer] = buildSyntheticSntPlayers({ teamCode: 'LAL' }, 2026);
    renderOpenMenuRow(eligiblePlayer);

    expect(screen.getByRole('button', { name: 'Sign-and-Trade' })).toBeInTheDocument();
  });

  it('does not show Sign-and-Trade for the ineligible synthetic player', () => {
    const [, ineligiblePlayer] = buildSyntheticSntPlayers(
      { teamCode: 'LAL' },
      2026
    );
    renderOpenMenuRow(ineligiblePlayer);

    expect(
      screen.queryByRole('button', { name: 'Sign-and-Trade' })
    ).not.toBeInTheDocument();
  });
});
