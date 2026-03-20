// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import TeamHistoryTab from '@/features/architect/TeamHistoryTab';
import { injectTeamHistoryFixtures } from '@/features/architect/history/devTeamHistoryFixtures';

const baseTeam = {
  teamCode: 'LAL',
  waivedContracts: [],
  exceptionHistory: [],
  mleHistory: [],
  pickLog: [],
  currentPicks: {},
  historyTimeline: [],
};

function buildWorldTeam(teamCode: string, marker: string) {
  const injected = injectTeamHistoryFixtures({
    teamCode,
    waivedContracts: [],
    exceptionHistory: [],
    mleHistory: [],
    pickLog: [],
    currentPicks: {},
    historyTimeline: [],
  });

  return {
    ...injected,
    historyTimeline: [
      {
        id: `${teamCode}-marker`,
        category: 'world-marker',
        type: marker,
        timestamp: '2026-02-11T00:00:00.000Z',
        teamsInvolved: [teamCode],
        summary: marker,
        primaryDeltas: marker,
        capDelta: 0,
      },
      ...(Array.isArray(injected.historyTimeline)
        ? injected.historyTimeline
        : []),
    ],
  };
}

function WorldSwitchHarness() {
  const [activeWorldId, setActiveWorldId] = React.useState<
    'world-a' | 'world-b'
  >('world-a');

  const worlds = {
    'world-a': buildWorldTeam('ATL', 'WORLD_A_MARKER'),
    'world-b': buildWorldTeam('BOS', 'WORLD_B_MARKER'),
  } as const;

  return (
    <div>
      <button
        type="button"
        data-testid="switch-world-a"
        onClick={() => setActiveWorldId('world-a')}
      >
        World A
      </button>
      <button
        type="button"
        data-testid="switch-world-b"
        onClick={() => setActiveWorldId('world-b')}
      >
        World B
      </button>

      <TeamHistoryTab
        worldId={activeWorldId}
        teamCapSheet={worlds[activeWorldId]}
      />
    </div>
  );
}

describe('Team History world boundary integration', () => {
  it('shows base banner and empty state in base mode', () => {
    render(<TeamHistoryTab teamCapSheet={baseTeam} worldId={null} />);

    expect(screen.getByTestId('team-history-base-banner')).toBeInTheDocument();
    expect(screen.getByText('No timeline entries yet.')).toBeInTheDocument();
  });

  it('uses world-scoped source and updates entries when world context switches', () => {
    render(<WorldSwitchHarness />);

    expect(screen.getByTestId('team-history-world-banner')).toBeInTheDocument();
    expect(screen.getByText('WORLD_A_MARKER')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('switch-world-b'));

    expect(screen.getByText('WORLD_B_MARKER')).toBeInTheDocument();
    expect(screen.queryByText('WORLD_A_MARKER')).not.toBeInTheDocument();
  });
});
