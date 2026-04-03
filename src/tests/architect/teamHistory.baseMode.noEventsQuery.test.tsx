// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import TeamHistoryTab from '@/features/architect/history/TeamHistoryTab';

const useWorldTeamEventsMock = vi.fn();

vi.mock('@/features/architect/history/hooks/useWorldTeamEvents', () => ({
  useWorldTeamEvents: (...args: unknown[]) => useWorldTeamEventsMock(...args),
}));

const baseTeam = {
  teamCode: 'LAL',
  waivedContracts: [],
  exceptionHistory: [],
  mleHistory: [],
  pickLog: [],
  currentPicks: {},
  historyTimeline: [],
};

describe('Team History base mode no-events query', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('keeps base mode empty state and does not invoke world events query hook', () => {
    render(<TeamHistoryTab teamCapSheet={baseTeam} worldId={null} />);

    expect(screen.getByTestId('team-history-base-banner')).toBeInTheDocument();
    expect(screen.getByTestId('team-history-active-source-label')).toHaveTextContent(
      'Section-derived fallback'
    );
    expect(screen.getByText('No timeline entries yet.')).toBeInTheDocument();
    expect(useWorldTeamEventsMock).not.toHaveBeenCalled();
  });

  it('prefers explicit local historyTimeline rows before synthesized fallback in base mode', () => {
    render(
      <TeamHistoryTab
        teamCapSheet={{
          ...baseTeam,
          historyTimeline: [
            {
              id: 'local-entry-1',
              category: 'custom',
              type: 'Manual Entry',
              timestamp: '2026-02-01T00:00:00.000Z',
              summary: 'LOCAL_TIMELINE_ENTRY',
            },
          ],
        }}
        worldId={null}
      />
    );

    expect(screen.getByTestId('team-history-active-source-label')).toHaveTextContent(
      'Explicit local timeline'
    );
    expect(screen.getByText('LOCAL_TIMELINE_ENTRY')).toBeInTheDocument();
    expect(useWorldTeamEventsMock).not.toHaveBeenCalled();
  });
});
