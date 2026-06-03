/**
 * FILE: src/tests/architect/cockpit/architectActivityRail.render.test.tsx
 * PURPOSE: Render coverage for the Activity Rail audit (interconnectivity
 *          Slice 1): empty/unavailable states, authority labels routed through
 *          the shared helper, watchlist destinations, and collapsed-state
 *          indicators that never bury a danger behind a lower-priority dot.
 * OWNERSHIP: Feature: architect/cockpit
 */
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {
  deriveArchitectWorkspaceContext,
  type ArchitectWorkspaceContext,
} from '@/features/architect/GMDashboard/hooks/useArchitectWorkspaceContext';
import { ActivityRail } from '@/features/architect/cockpit/ActivityRail';
import type { ArchitectPostActionReceipt } from '@/features/architect/GMDashboard/postActionHandoff/types';

// ScenarioMoveRail reaches into a Firestore-backed hook; stub it so these
// rail tests stay free of Firebase (same trick as the cockpit smoke test).
vi.mock(
  '@/features/architect/GMDashboard/components/ScenarioMoveRail',
  () => ({
    ScenarioMoveRail: () => <div data-testid="scenario-move-rail-stub" />,
  })
);

/** Sandbox workspace with no cap sheet → cap posture is `unavailable`. */
function makeSandboxWorkspace(): ArchitectWorkspaceContext {
  return deriveArchitectWorkspaceContext({
    teamId: 'LAL',
    currentYear: 2025,
    worldId: null,
    isLoading: false,
    isSaving: false,
    error: null,
    worldModeBoundary: null,
  });
}

/**
 * Override the cap summary directly to an available posture above the 2nd
 * apron. Overriding the derived field (rather than feeding a synthetic cap
 * sheet through the cap engine) keeps the danger watch entry deterministic and
 * decoupled from `computeTeamCapTotals` internals.
 */
function withAboveSecondApron(
  workspace: ArchitectWorkspaceContext
): ArchitectWorkspaceContext {
  return {
    ...workspace,
    cap: {
      status: 'available',
      season: 2025,
      seasonLabel: '2025-26',
      totalCapAllocations: 250_000_000,
      salaryCap: 140_000_000,
      capSpace: -110_000_000,
      luxuryTax: 170_000_000,
      taxSpace: -80_000_000,
      firstApron: 178_000_000,
      firstApronSpace: -72_000_000,
      secondApron: 188_000_000,
      secondApronSpace: -62_000_000,
      isOverCap: true,
      isOverTax: true,
      isAtOrAboveFirstApron: true,
      isAboveSecondApron: true,
      source: 'computeTeamCapTotals',
    } as ArchitectWorkspaceContext['cap'],
  };
}

/** Override the season context to force a viewing/world season mismatch. */
function withSeasonMismatch(
  workspace: ArchitectWorkspaceContext
): ArchitectWorkspaceContext {
  return {
    ...workspace,
    seasons: {
      ...workspace.seasons,
      selectedViewingSeason: 2026,
      selectedViewingSeasonLabel: '2026-27',
      authoritativeWorldSeason: '2025-26',
      authoritativeWorldSeasonLabel: '2025-26',
      authoritativeWorldSeasonStatus: 'available',
      viewingSeasonDiffersFromWorldSeason: true,
    },
  };
}

const RECEIPT: ArchitectPostActionReceipt = {
  kind: 'trade',
  eventId: 'evt_1',
  occurredAt: '2026-01-15T00:00:00.000Z',
  headline: 'Trade applied',
  changedTeamCodes: ['LAL'],
  primaryTeamCode: 'LAL',
  primaryPlayerIds: ['p1'],
  authority: 'committed-world',
};

function renderRail(props: Partial<React.ComponentProps<typeof ActivityRail>> = {}) {
  const handlers = {
    onNavigateToCapSheet: vi.fn(),
    onNavigateToRoster: vi.fn(),
    onNavigateToOffseason: vi.fn(),
    onOpenHistory: vi.fn(),
    onOpenHistoryEntry: vi.fn(),
    onNavigateReceiptHistory: vi.fn(),
    onDismissReceipt: vi.fn(),
  };
  render(
    <ActivityRail
      workspace={makeSandboxWorkspace()}
      receipt={null}
      receiptGeneration={0}
      worldId={null}
      historyTeamCode="LAL"
      {...handlers}
      {...props}
    />
  );
  return handlers;
}

describe('ActivityRail — Slice 1 audit', () => {
  afterEach(() => {
    cleanup();
    // Collapse state persists to localStorage; reset between tests.
    try {
      window.localStorage.clear();
    } catch {
      /* ignore */
    }
  });

  it('shows the honest cap-posture-unavailable state with a Cap Sheet link', () => {
    const handlers = renderRail();
    expect(
      screen.getByTestId('cockpit-activity-rail-cap-posture-unavailable')
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByTestId('cockpit-activity-rail-cap-posture-cap-sheet')
    );
    expect(handlers.onNavigateToCapSheet).toHaveBeenCalledTimes(1);
  });

  it('renders the empty receipt and empty watchlist copy in sandbox', () => {
    renderRail();
    expect(screen.getByText('No recent committed actions.')).toBeInTheDocument();
    expect(screen.getByText('No active watch items.')).toBeInTheDocument();
  });

  it('hides Pinned and In Progress sections when there is nothing to show', () => {
    renderRail();
    expect(screen.queryByTestId('cockpit-activity-rail-pinned')).toBeNull();
    expect(screen.queryByTestId('cockpit-activity-rail-in-progress')).toBeNull();
  });

  it('labels an in-progress trade draft as Local draft via the shared helper', () => {
    renderRail({ tradeDraftActive: true, onResumeTradeDraft: vi.fn() });
    const chip = screen.getByTestId(
      'cockpit-activity-rail-in-progress-authority'
    );
    expect(chip).toHaveTextContent('Local draft');
    expect(chip).toHaveAttribute('data-authority-tone', 'local');
  });

  it('surfaces an above-2nd-apron danger warning that routes to the Cap Sheet', () => {
    const handlers = renderRail({
      workspace: withAboveSecondApron(makeSandboxWorkspace()),
    });
    expect(
      screen.getByTestId('cockpit-activity-rail-watch-apron2')
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByTestId('cockpit-activity-rail-watch-apron2-action')
    );
    expect(handlers.onNavigateToCapSheet).toHaveBeenCalledTimes(1);
  });

  it('labels a season mismatch and routes it to Offseason', () => {
    const handlers = renderRail({
      workspace: withSeasonMismatch(makeSandboxWorkspace()),
    });
    const chip = screen.getByTestId(
      'cockpit-activity-rail-watch-season-mismatch-authority'
    );
    expect(chip).toHaveTextContent('Season mismatch');
    fireEvent.click(
      screen.getByTestId('cockpit-activity-rail-watch-season-mismatch-action')
    );
    expect(handlers.onNavigateToOffseason).toHaveBeenCalledTimes(1);
  });

  it('keeps the danger dot visible alongside receipt/in-progress dots when collapsed', () => {
    renderRail({
      workspace: withAboveSecondApron(makeSandboxWorkspace()),
      receipt: RECEIPT,
      tradeDraftActive: true,
      onResumeTradeDraft: vi.fn(),
    });
    fireEvent.click(screen.getByTestId('cockpit-activity-rail-collapse'));
    expect(
      screen.getByTestId('cockpit-activity-rail-dot-danger')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('cockpit-activity-rail-dot-receipt')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('cockpit-activity-rail-dot-in-progress')
    ).toBeInTheDocument();
  });

  it('badges FA-target pins and routes pinned-row actions through onPlayerAction', () => {
    const onPlayerAction = vi.fn();
    renderRail({
      pinnedPlayers: [
        { id: 'p1', label: 'Reg Player' },
        { id: 'fa1', label: 'FA Target', isTarget: true },
      ],
      onPlayerAction,
    });

    // Target badge only on the FA-target pin.
    expect(
      screen.getByTestId('cockpit-activity-rail-pinned-target-fa1')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('cockpit-activity-rail-pinned-target-p1')
    ).toBeNull();

    // Trade + Unpin route through the unified sink with rail context.
    fireEvent.click(
      screen.getByTestId('cockpit-activity-rail-pinned-p1-actions-trade')
    );
    expect(onPlayerAction).toHaveBeenCalledWith(
      'trade',
      expect.objectContaining({ playerId: 'p1', sourceRoom: 'rail' })
    );
    fireEvent.click(
      screen.getByTestId('cockpit-activity-rail-pinned-fa1-actions-unpin')
    );
    expect(onPlayerAction).toHaveBeenCalledWith(
      'unpin',
      expect.objectContaining({ playerId: 'fa1', isFreeAgentTarget: true })
    );
  });

  it('lists receipt changed-players with inspection actions, carries eventId, and never offers pin', () => {
    const onPlayerAction = vi.fn();
    renderRail({
      receipt: RECEIPT,
      onPlayerAction,
      resolvePlayerLabel: (id) => (id === 'p1' ? 'Anthony Davis' : id),
    });

    const row = screen.getByTestId('cockpit-activity-rail-receipt-player-p1');
    expect(row).toHaveTextContent('Anthony Davis');

    fireEvent.click(
      screen.getByTestId(
        'cockpit-activity-rail-receipt-player-p1-actions-overflow'
      )
    );
    // No pin affordance on receipt rows (no auto-pin contract).
    expect(
      screen.queryByTestId(
        'cockpit-activity-rail-receipt-player-p1-actions-overflow-pin'
      )
    ).toBeNull();
    fireEvent.click(
      screen.getByTestId(
        'cockpit-activity-rail-receipt-player-p1-actions-overflow-view-on-roster'
      )
    );
    expect(onPlayerAction).toHaveBeenCalledWith(
      'view-on-roster',
      expect.objectContaining({
        playerId: 'p1',
        sourceRoom: 'receipt',
        eventId: 'evt_1',
      })
    );
  });
});
