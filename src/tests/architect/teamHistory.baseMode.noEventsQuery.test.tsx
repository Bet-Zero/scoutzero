// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import TeamHistoryTab from '@/features/architect/TeamHistoryTab';

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

  it('keeps base mode empty state and does not invoke world events query hook', () => {
    render(<TeamHistoryTab teamCapSheet={baseTeam} worldId={null} />);

    expect(screen.getByTestId('team-history-base-banner')).toBeInTheDocument();
    expect(screen.getByText('No timeline entries yet.')).toBeInTheDocument();
    expect(useWorldTeamEventsMock).not.toHaveBeenCalled();
  });
});
