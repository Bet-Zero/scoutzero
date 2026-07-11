// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { OwnFreeAgentsPanel } from '@/features/architect/freeAgency/OwnFreeAgentsPanel/OwnFreeAgentsPanel';
import type { OwnFreeAgentEntry } from '@/features/architect/utils/ownFreeAgents';

const GRANT_PLAYER = {
  id: 'mia_grant_holloway',
  displayName: 'Grant Holloway',
};

const grantEntry: OwnFreeAgentEntry = {
  key: 'own-fa-mia_grant_holloway-0',
  playerId: 'mia_grant_holloway',
  playerName: 'Grant Holloway',
  faType: 'UFA',
  capHoldAmount: 15_000_000,
  player: GRANT_PLAYER,
  rights: { placement: 'main' } as OwnFreeAgentEntry['rights'],
  hold: {},
};

afterEach(() => cleanup());

describe('OwnFreeAgentsPanel (BZE-249)', () => {
  it('lists own free agents and hands the resolved player to the Trade Machine on Sign & Trade', () => {
    const onSignAndTrade = vi.fn();
    render(
      <OwnFreeAgentsPanel
        ownFreeAgents={[grantEntry]}
        onSignAndTrade={onSignAndTrade}
      />
    );

    const row = screen.getByTestId('own-free-agent-row');
    expect(row).toHaveTextContent('Grant Holloway');
    expect(row).toHaveTextContent('UFA');
    expect(row).toHaveTextContent('$15,000,000');

    fireEvent.click(
      screen.getByTestId('own-free-agent-sign-and-trade-button')
    );
    expect(onSignAndTrade).toHaveBeenCalledTimes(1);
    expect(onSignAndTrade.mock.calls[0][0]).toBe(GRANT_PLAYER);
  });

  it('falls back to a minimal player when no full record resolved', () => {
    const onSignAndTrade = vi.fn();
    render(
      <OwnFreeAgentsPanel
        ownFreeAgents={[{ ...grantEntry, player: null }]}
        onSignAndTrade={onSignAndTrade}
      />
    );

    fireEvent.click(
      screen.getByTestId('own-free-agent-sign-and-trade-button')
    );
    expect(onSignAndTrade).toHaveBeenCalledTimes(1);
    expect(onSignAndTrade.mock.calls[0][0]).toMatchObject({
      playerId: 'mia_grant_holloway',
      displayName: 'Grant Holloway',
    });
  });

  it('renders nothing when the team has no own free agents', () => {
    const { container } = render(
      <OwnFreeAgentsPanel ownFreeAgents={[]} onSignAndTrade={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
