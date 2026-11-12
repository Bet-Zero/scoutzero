import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { EntitlementPickRow } from '@/features/architect/tradeMachine/EntitlementPickRow';
import { SimulationPickStatusContext } from '@/features/architect/tradeMachine/simulationPickStatusContext';

const id = 'ent:BOS:2033:1:own:abcd1234';
const row = (statuses: Record<string, { tradeable: boolean; text: string }>) =>
  render(
    <SimulationPickStatusContext.Provider value={statuses}>
      <EntitlementPickRow
        entitlement={{
          id,
          holderTeam: 'BOS',
          originalTeam: 'BOS',
          seasonYear: 2033,
          round: 1,
          kind: 'pick_ownership',
        }}
        teamId="BOS"
        otherTeams={[{ id: 'TOR', teamCode: 'TOR', teamName: 'Toronto' }]}
        onSetDestination={vi.fn()}
        openMenu={id}
        setOpenMenu={vi.fn()}
      />
    </SimulationPickStatusContext.Provider>
  );

describe('EntitlementPickRow in a SIMULATION world (E1)', () => {
  afterEach(cleanup);
  it('shows why a pick cannot be traded and offers no trade', () => {
    row({
      [id]: {
        tradeable: false,
        text: 'Not tradeable until the 2026 Draft is over',
      },
    });
    expect(
      screen.getByText('Not tradeable until the 2026 Draft is over')
    ).toBeInTheDocument();
    expect(screen.queryByText('Trade to Toronto')).not.toBeInTheDocument();
  });

  it('labels a tradeable pick and keeps its trade option', () => {
    row({ [id]: { tradeable: true, text: 'Unprotected, held outright' } });
    expect(screen.getByText('Unprotected, held outright')).toBeInTheDocument();
    expect(screen.getByText('Trade to Toronto')).toBeInTheDocument();
  });

  it('is unchanged outside SIMULATION worlds', () => {
    row({});
    expect(screen.getByText('Trade to Toronto')).toBeInTheDocument();
  });
});
