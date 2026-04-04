// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
    expect(screen.getByTestId('team-history-active-source-detail')).toHaveTextContent(
      'deriving local fallback rows from waived contracts'
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
    expect(screen.getByTestId('team-history-base-truth-label')).toHaveTextContent(
      'Direct local timeline rows'
    );
    expect(screen.getByTestId('team-history-base-truth-detail')).toHaveTextContent(
      'already timeline-shaped local entries'
    );
    expect(screen.getByText('LOCAL_TIMELINE_ENTRY')).toBeInTheDocument();
    expect(useWorldTeamEventsMock).not.toHaveBeenCalled();
  });

  it('keeps synthesized fallback rows source-specific and exposes their derived source in the detail view', () => {
    render(
      <TeamHistoryTab
        teamCapSheet={{
          ...baseTeam,
          waivedContracts: [
            {
              id: 'waive-1',
              name: 'Fallback Forward',
              waivedOn: '2026-02-01',
              stretched: true,
              deadCap: {
                2026: 3000000,
                2027: 3000000,
              },
            },
          ],
          exceptionHistory: [
            {
              id: 'exception-1',
              type: 'consumeTradeException',
              timestamp: '2026-02-03T12:00:00.000Z',
              amountCreated: 6250000,
              amountConsumed: 1750000,
              amountRemaining: 4500000,
              sourcePlayerName: 'Wing Creator',
              sourceTeamCode: 'LAL',
              targetTeamCode: 'BOS',
              expiresAt: '2027-02-03T12:00:00.000Z',
            },
          ],
          pickLog: [
            {
              id: 'pick-1',
              date: '2026-02-02',
              action: 'Acquired',
              pick: '2029 2nd Round (top-55 protected)',
              partner: 'SAS',
            },
          ],
        }}
        worldId={null}
      />
    );

    const row0 = screen.getByTestId('team-history-event-row-0');
    const row1 = screen.getByTestId('team-history-event-row-1');
    const row2 = screen.getByTestId('team-history-event-row-2');

    expect(row0).toHaveTextContent('Trade Exception Consumed');
    expect(row0).toHaveTextContent(
      'Exception history record: Wing Creator exception reduced to $4,500,000.'
    );
    expect(row1).toHaveTextContent('Pick Acquired');
    expect(row1).toHaveTextContent(
      'Pick log record: acquired 2029 2nd Round (top-55 protected) from SAS.'
    );
    expect(row2).toHaveTextContent('Waived & Stretched Contract Record');
    expect(row2).toHaveTextContent(
      'Waiver record: Fallback Forward was waived and stretched.'
    );

    fireEvent.click(row0);

    expect(screen.getByTestId('team-history-detail-sections')).toHaveTextContent(
      'Derived from exceptionHistory[]'
    );
    expect(screen.getByTestId('team-history-detail-sections')).toHaveTextContent(
      'Timestamp sourced from timestamp'
    );
    expect(screen.getByTestId('team-history-detail-sections')).toHaveTextContent(
      'Action: consumeTradeException'
    );
    expect(screen.getByTestId('team-history-detail-sections')).toHaveTextContent(
      'Counterparty: BOS'
    );
  });
});
