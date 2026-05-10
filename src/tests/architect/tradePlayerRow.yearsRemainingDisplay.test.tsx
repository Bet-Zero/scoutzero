import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TradePlayerRow } from '@/features/architect/tradeMachine/TradePlayerRow';

type TradePlayerRowPlayer = Parameters<typeof TradePlayerRow>[0]['player'];

const baseHandlers = {
  onSetPlayerTrade: vi.fn(),
  onUndoPlayerTrade: vi.fn(),
  setOpenMenu: vi.fn(),
  setContractPlayer: vi.fn(),
};

function renderTradePlayerRow(player: TradePlayerRowPlayer) {
  return render(
    <TradePlayerRow
      player={player}
      included={false}
      yearKey={2026}
      incoming={false}
      otherTeams={[]}
      playersMap={{}}
      openMenu={null}
      onSetPlayerTrade={baseHandlers.onSetPlayerTrade}
      onUndoPlayerTrade={baseHandlers.onUndoPlayerTrade}
      setOpenMenu={baseHandlers.setOpenMenu}
      setContractPlayer={baseHandlers.setContractPlayer}
    />
  );
}

describe('TradePlayerRow years remaining display', () => {
  it('includes futureContract extension years in displayed years remaining', () => {
    renderTradePlayerRow({
      id: 'player_ext',
      player_id: 'player_ext',
      name: 'Extension Player',
      bio: { displayName: 'Extension Player', playerId: 'player_ext' },
      contract: {
        salariesByYear: [
          { season: '2025-26', salary: 10_000_000, capHit: 10_000_000 },
          { season: '2026-27', salary: 11_000_000, capHit: 11_000_000 },
        ],
      },
      futureContract: {
        salariesByYear: [
          { season: '2027-28', salary: 12_000_000, capHit: 12_000_000 },
        ],
      },
    });

    expect(screen.getByText('3 YRS')).toBeInTheDocument();
  });

  it('shows correct years remaining without extension years', () => {
    renderTradePlayerRow({
      id: 'player_base',
      player_id: 'player_base',
      name: 'Base Player',
      bio: { displayName: 'Base Player', playerId: 'player_base' },
      contract: {
        salariesByYear: [
          { season: '2025-26', salary: 9_000_000, capHit: 9_000_000 },
        ],
      },
      futureContract: null,
    });

    expect(screen.getByText('1 YRS')).toBeInTheDocument();
  });
});
