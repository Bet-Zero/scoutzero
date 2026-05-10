// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TradePlayerRow } from '@/features/architect/tradeMachine/TradePlayerRow';
import { buildSyntheticSntPlayers } from '@/features/architect/tradeMachine/utils/devSntInjector';

type TradePlayerRowPlayer = Parameters<typeof TradePlayerRow>[0]['player'];
type SyntheticSntPlayer = ReturnType<typeof buildSyntheticSntPlayers>[number];

const otherTeams = [{ id: 'BOS', teamName: 'Boston Celtics' }];
const baseHandlers = {
  onSetPlayerTrade: vi.fn(),
  onUndoPlayerTrade: vi.fn(),
  setOpenMenu: vi.fn(),
  setContractPlayer: vi.fn(),
  onRequestSignAndTrade: vi.fn(),
};

const normalizeNullableString = (
  value: string | number | null | undefined
): string | null | undefined =>
  value == null ? value : String(value);

function renderOpenMenuRow(player: SyntheticSntPlayer) {
  const rowPlayer: TradePlayerRowPlayer = {
    ...player,
    teamCode: normalizeNullableString(player.teamCode),
    teamAbbr: normalizeNullableString(player.teamAbbr),
    teamId: normalizeNullableString(player.teamId),
    team:
      'team' in player &&
      (typeof player.team === 'string' ||
        typeof player.team === 'number' ||
        player.team == null)
        ? normalizeNullableString(player.team)
        : undefined,
    bio: {
      ...player.bio,
      team: normalizeNullableString(player.bio.team),
    },
  };

  return render(
    <TradePlayerRow
      player={rowPlayer}
      included={false}
      yearKey={2026}
      incoming={false}
      otherTeams={otherTeams}
      playersMap={{}}
      openMenu={rowPlayer.name}
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
