/**
 * FILE: src/tests/architect/stage2d.historyActivityDeeplink.test.tsx
 * PURPOSE: Targeted tests for Stage 2D History / Activity deep-linking.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * Covers committed-event detail requests from post-action handoff and the
 * activity rail. Deep-linking remains read-only navigation/detail selection.
 */

// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React, { useState } from 'react';
import '@testing-library/jest-dom/vitest';
import {
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  act,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArchitectPostActionHandoff } from '@/features/architect/GMDashboard/components/ArchitectPostActionHandoff';
import { ScenarioMoveRail } from '@/features/architect/GMDashboard/components/ScenarioMoveRail';
import { useHistoryEventDetailRequest } from '@/features/architect/GMDashboard/hooks/useHistoryEventDetailRequest';
import { TeamHistoryTab } from '@/features/architect/history/TeamHistoryTab';
import { WorldEventsTimeline } from '@/features/architect/history/TeamHistoryTab/WorldEventsTimeline';
import { DEV_TEAM_HISTORY_FIXTURE_FLAG } from '@/features/architect/history/devTeamHistoryFixtures';
import type {
  ArchitectPostActionImpact,
  ArchitectPostActionPersistence,
  ArchitectPostActionReceipt,
} from '@/features/architect/GMDashboard/postActionHandoff/types';
import type {
  RequestedHistoryEventDetail,
  TeamHistoryCapSheetLike,
} from '@/features/architect/history/TeamHistoryTab/types';
import type { WorldEventRecord } from '@/features/architect/history/hooks/useWorldTeamEvents';

const useWorldTeamEventsMock = vi.fn();

vi.mock('@/features/architect/history/hooks/useWorldTeamEvents', () => ({
  useWorldTeamEvents: (...args: unknown[]) => useWorldTeamEventsMock(...args),
}));

const teamCapSheet: TeamHistoryCapSheetLike = {
  teamCode: 'LAL',
  waivedContracts: [],
  exceptionHistory: [],
  mleHistory: [],
  pickLog: [],
  currentPicks: {},
  historyTimeline: [],
};

const makeReceiptPersistence = (): ArchitectPostActionPersistence => ({
  status: 'world-saved',
  saveStateStatus: 'saved',
  label: 'Committed world',
  detail: 'Saved to the active durable Team Plan world.',
});

const makeReceiptImpact = (): ArchitectPostActionImpact => {
  const section = {
    status: 'not-applicable' as const,
    summary: 'No direct effect expected.',
    deltas: [],
  };
  return {
    actionType: 'trade',
    mutationType: 'executeTrade',
    teamCode: 'LAL',
    playerId: 'player_1',
    playerName: null,
    affectedSeasons: [],
    roster: section,
    cap: section,
    exceptions: section,
    rights: section,
    deadMoney: section,
    contract: section,
    notes: [],
  };
};

const makeReceipt = (
  overrides: Partial<ArchitectPostActionReceipt> = {}
): ArchitectPostActionReceipt => ({
  kind: 'trade',
  eventId: 'evt_trade_1',
  occurredAt: '2026-05-01T00:00:00.000Z',
  headline: 'Trade applied',
  changedTeamCodes: ['LAL', 'BOS'],
  primaryTeamCode: 'LAL',
  primaryPlayerIds: ['player_1'],
  ...overrides,
  actionType: overrides.actionType ?? 'trade',
  persistence: overrides.persistence ?? makeReceiptPersistence(),
  impact: overrides.impact ?? makeReceiptImpact(),
  authority: overrides.authority ?? 'committed-world',
});

const makeTradeEvent = (
  overrides: Partial<WorldEventRecord> = {}
): WorldEventRecord => ({
  id: 'evt_trade_1',
  eventId: 'evt_trade_1',
  mutationType: 'executeTrade',
  occurredAt: '2026-05-01T00:00:00.000Z',
  teamCodes: ['LAL', 'BOS'],
  playerIds: ['player_1'],
  operationId: 'op_trade_1',
  beforeTotalsByTeam: {
    LAL: { totalCapAllocations: 150000000 },
  },
  afterTotalsByTeam: {
    LAL: { totalCapAllocations: 149000000 },
  },
  ...overrides,
});

const mockWorldEvents = (events: WorldEventRecord[]) => {
  useWorldTeamEventsMock.mockReturnValue({
    events,
    loading: false,
    loadingMore: false,
    error: null,
    hasMore: false,
    resolution: 'authoritative',
    loadMore: null,
    refetch: vi.fn(),
  });
};

type Stage2DHarnessProps = {
  receipt?: ArchitectPostActionReceipt | null;
  worldId?: string;
  teamCode?: string;
};

const Stage2DHarness = ({
  receipt = makeReceipt(),
  worldId = 'world_lal',
  teamCode = 'LAL',
}: Stage2DHarnessProps) => {
  const [activeTab, setActiveTab] = useState<'home' | 'history'>('home');
  const {
    requestedHistoryEventDetail,
    openHistoryRoot,
    requestHistoryEventDetail,
    handleHistoryEventDetailHandled,
  } = useHistoryEventDetailRequest({
    worldId,
    teamCode,
    onOpenHistory: () => setActiveTab('history'),
  });

  return (
    <div>
      <ArchitectPostActionHandoff
        receipt={receipt}
        onNavigateToCapSheet={vi.fn()}
        onNavigateToRoster={vi.fn()}
        onNavigateToHistory={() =>
          requestHistoryEventDetail(
            receipt?.eventId ?? null,
            'post-action-handoff'
          )
        }
        onDismiss={vi.fn()}
      />
      <ScenarioMoveRail
        worldId={worldId}
        teamCode={teamCode}
        onOpenHistory={openHistoryRoot}
        onOpenHistoryEntry={(eventId) =>
          requestHistoryEventDetail(eventId, 'activity-rail')
        }
        highlightEventId={receipt?.eventId ?? null}
      />
      {activeTab === 'history' ? (
        <TeamHistoryTab
          teamCapSheet={{ ...teamCapSheet, teamCode }}
          worldId={worldId}
          requestedHistoryEventDetail={requestedHistoryEventDetail}
          onRequestedHistoryEventDetailHandled={
            handleHistoryEventDetailHandled
          }
        />
      ) : (
        <div data-testid="stage2d-home">Home</div>
      )}
    </div>
  );
};

describe('Stage 2D — History / Activity deep-linking', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockWorldEvents([makeTradeEvent()]);
    // BZE-229: the history detail modal's event/operation-ID inspector is gated
    // behind the existing developer toggle; enable it for these deep-link checks.
    window.localStorage.setItem(DEV_TEAM_HISTORY_FIXTURE_FLAG, 'true');
  });

  it('opens the matching History detail from post-action handoff View History when eventId exists', async () => {
    render(<Stage2DHarness />);

    fireEvent.click(screen.getByTestId('post-action-handoff-nav-history'));

    await waitFor(() => {
      expect(screen.getByTestId('team-history-detail-modal')).toBeInTheDocument();
      expect(screen.getByTestId('team-history-detail-event-id')).toHaveTextContent(
        'evt_trade_1'
      );
    });
    expect(screen.getByTestId('team-history-detail-truth-note')).toHaveTextContent(
      'Authoritative world-event row'
    );
  });

  it('falls back to History root from post-action handoff View History when eventId is null', async () => {
    render(
      <Stage2DHarness receipt={makeReceipt({ eventId: null })} />
    );

    fireEvent.click(screen.getByTestId('post-action-handoff-nav-history'));

    await waitFor(() => {
      expect(screen.getByTestId('team-history-section-timeline')).toBeInTheDocument();
      expect(screen.getByTestId('team-history-row-0')).toBeInTheDocument();
    });
    expect(
      screen.queryByTestId('team-history-detail-modal')
    ).not.toBeInTheDocument();
  });

  it('opens the matching History detail from an activity rail committed row click', async () => {
    render(<Stage2DHarness />);

    fireEvent.click(screen.getByTestId('scenario-move-rail-entry-button'));

    await waitFor(() => {
      expect(screen.getByTestId('team-history-detail-modal')).toBeInTheDocument();
      expect(screen.getByTestId('team-history-detail-event-id')).toHaveTextContent(
        'evt_trade_1'
      );
    });
    expect(screen.getByTestId('scenario-move-rail-entry-just-committed')).toBeInTheDocument();
    expect(screen.getByText('Local and pending activity not shown.')).toBeInTheDocument();
    expect(screen.getAllByTestId('scenario-move-rail-entry-button')).toHaveLength(1);
  });

  it('keeps the Full History button as History-root navigation', async () => {
    render(<Stage2DHarness />);

    fireEvent.click(screen.getByTestId('scenario-move-rail-open-history'));

    await waitFor(() => {
      expect(screen.getByTestId('team-history-section-timeline')).toBeInTheDocument();
      expect(screen.getByTestId('team-history-row-0')).toBeInTheDocument();
    });
    expect(
      screen.queryByTestId('team-history-detail-modal')
    ).not.toBeInTheDocument();
  });

  it('reopens the same event when repeated clicks create a new requestKey', async () => {
    render(<Stage2DHarness />);

    fireEvent.click(screen.getByTestId('post-action-handoff-nav-history'));
    await waitFor(() => {
      expect(screen.getByTestId('team-history-detail-modal')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('team-history-detail-close'));
    expect(
      screen.queryByTestId('team-history-detail-modal')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('post-action-handoff-nav-history'));
    await waitFor(() => {
      expect(screen.getByTestId('team-history-detail-modal')).toBeInTheDocument();
      expect(screen.getByTestId('team-history-detail-event-id')).toHaveTextContent(
        'evt_trade_1'
      );
    });
  });

  it('WorldEventsTimeline consumes a matching request and calls onSelectEntry', async () => {
    const onSelectEntry = vi.fn();
    const onHandled = vi.fn();
    const request: RequestedHistoryEventDetail = {
      requestKey: 1,
      requestedSelectedEntryId: 'evt_trade_1',
      worldId: 'world_lal',
      teamCode: 'LAL',
      source: 'post-action-handoff',
    };

    render(
      <WorldEventsTimeline
        worldId="world_lal"
        teamCode="LAL"
        onSelectEntry={onSelectEntry}
        requestedHistoryEventDetail={request}
        onRequestedHistoryEventDetailHandled={onHandled}
      />
    );

    await waitFor(() => {
      expect(onSelectEntry).toHaveBeenCalledTimes(1);
      expect(onSelectEntry.mock.calls[0][0].eventId).toBe('evt_trade_1');
      expect(onHandled).toHaveBeenCalledWith(1);
    });
  });

  it('waits for committed timeline rows before acknowledging a request', async () => {
    const onSelectEntry = vi.fn();
    const onHandled = vi.fn();
    const request: RequestedHistoryEventDetail = {
      requestKey: 2,
      requestedSelectedEntryId: 'evt_trade_1',
      worldId: 'world_lal',
      teamCode: 'LAL',
      source: 'activity-rail',
    };

    useWorldTeamEventsMock.mockReturnValueOnce({
      events: [],
      loading: true,
      loadingMore: false,
      error: null,
      hasMore: false,
      resolution: 'authoritative',
      loadMore: null,
      refetch: vi.fn(),
    });

    const { rerender } = render(
      <WorldEventsTimeline
        worldId="world_lal"
        teamCode="LAL"
        onSelectEntry={onSelectEntry}
        requestedHistoryEventDetail={request}
        onRequestedHistoryEventDetailHandled={onHandled}
      />
    );

    expect(onSelectEntry).not.toHaveBeenCalled();
    expect(onHandled).not.toHaveBeenCalled();

    mockWorldEvents([makeTradeEvent()]);
    rerender(
      <WorldEventsTimeline
        worldId="world_lal"
        teamCode="LAL"
        onSelectEntry={onSelectEntry}
        requestedHistoryEventDetail={request}
        onRequestedHistoryEventDetailHandled={onHandled}
      />
    );

    await waitFor(() => {
      expect(onSelectEntry).toHaveBeenCalledTimes(1);
      expect(onHandled).toHaveBeenCalledWith(2);
    });
  });

  it('acknowledges a missing requested id without selecting or synthesizing a row', async () => {
    const onSelectEntry = vi.fn();
    const onHandled = vi.fn();
    const request: RequestedHistoryEventDetail = {
      requestKey: 7,
      requestedSelectedEntryId: 'evt_missing',
      worldId: 'world_lal',
      teamCode: 'LAL',
      source: 'activity-rail',
    };

    render(
      <WorldEventsTimeline
        worldId="world_lal"
        teamCode="LAL"
        onSelectEntry={onSelectEntry}
        requestedHistoryEventDetail={request}
        onRequestedHistoryEventDetailHandled={onHandled}
      />
    );

    await waitFor(() => {
      expect(onHandled).toHaveBeenCalledWith(7);
    });
    expect(onSelectEntry).not.toHaveBeenCalled();
    expect(screen.getAllByTestId(/team-history-row-/)).toHaveLength(1);
    expect(screen.queryByText('evt_missing')).not.toBeInTheDocument();
  });

  it('clears a pending request when world/team scope changes', async () => {
    const onOpenHistory = vi.fn();
    const { result, rerender } = renderHook(
      ({ worldId, teamCode }: { worldId: string; teamCode: string }) =>
        useHistoryEventDetailRequest({
          worldId,
          teamCode,
          onOpenHistory,
        }),
      { initialProps: { worldId: 'world_lal', teamCode: 'LAL' } }
    );

    act(() => {
      result.current.requestHistoryEventDetail('evt_trade_1', 'activity-rail');
    });
    expect(result.current.requestedHistoryEventDetail?.worldId).toBe('world_lal');

    rerender({ worldId: 'world_bos', teamCode: 'BOS' });

    await waitFor(() => {
      expect(result.current.requestedHistoryEventDetail).toBeNull();
    });
  });

  it('increments requestKey for repeated same-event requests', () => {
    const onOpenHistory = vi.fn();
    const { result } = renderHook(() =>
      useHistoryEventDetailRequest({
        worldId: 'world_lal',
        teamCode: 'LAL',
        onOpenHistory,
      })
    );

    act(() => {
      result.current.requestHistoryEventDetail('evt_trade_1', 'activity-rail');
    });
    const firstKey = result.current.requestedHistoryEventDetail?.requestKey;

    act(() => {
      result.current.requestHistoryEventDetail('evt_trade_1', 'activity-rail');
    });

    expect(result.current.requestedHistoryEventDetail?.requestKey).toBe(
      Number(firstKey) + 1
    );
    expect(onOpenHistory).toHaveBeenCalledTimes(2);
  });

  it('wires dashboard History requests and rail reads through resolved team codes', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/features/architect/GMDashboard/GMDashboard.tsx'
      ),
      'utf8'
    );

    expect(source).toContain('const resolvedHistoryTeamCode = useMemo');
    expect(source).toContain('resolveTeamCode(normalizedTeamId)');
    expect(source).toMatch(
      /useHistoryEventDetailRequest\(\{\s*worldId,\s*teamCode: resolvedHistoryTeamCode,/
    );
    expect(source).not.toMatch(
      /useHistoryEventDetailRequest\(\{\s*worldId,\s*teamCode: normalizedTeamId,/
    );
    // Cockpit refactor relocated <ScenarioMoveRail> into cockpit/ActivityRail.
    // GMDashboard now passes the resolved code down as historyTeamCode; the rail
    // wires that prop straight into ScenarioMoveRail's teamCode. The resolved-code
    // (not raw normalizedTeamId) seam is preserved across the handoff.
    expect(source).toContain('historyTeamCode={resolvedHistoryTeamCode}');
    expect(source).not.toContain('historyTeamCode={normalizedTeamId}');

    const activityRailSource = readFileSync(
      resolve(
        process.cwd(),
        'src/features/architect/cockpit/ActivityRail.tsx'
      ),
      'utf8'
    );
    expect(activityRailSource).toMatch(
      /<ScenarioMoveRail[\s\S]*?teamCode=\{historyTeamCode\}/
    );
    expect(activityRailSource).not.toMatch(
      /<ScenarioMoveRail[\s\S]*?teamCode=\{normalizedTeamId\}/
    );
  });
});
