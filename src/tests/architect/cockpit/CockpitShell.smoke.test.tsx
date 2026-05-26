/**
 * FILE: src/tests/architect/cockpit/CockpitShell.smoke.test.tsx
 * PURPOSE: Render-only smoke test for the Architect cockpit shell (Phase 1).
 *          Verifies all 9 nav items are reachable, the active room renders,
 *          and the persistent chrome (TopBar, NavRail, ActivityRail) mounts.
 * OWNERSHIP: Test suite
 */
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {
  deriveArchitectWorkspaceContext,
  type ArchitectWorkspaceContext,
} from '@/features/architect/GMDashboard/hooks/useArchitectWorkspaceContext';
import {
  CockpitShell,
  type NavRailItem,
  type RoomDescriptor,
} from '@/features/architect/cockpit';
import type { ActiveTab } from '@/features/architect/GMDashboard/hooks/useArchitectState.types';

// ScenarioMoveRail reaches into a Firestore-backed hook; stub it to keep the
// smoke test free of Firebase. Same trick used by GMDashboard.smoke.
vi.mock(
  '@/features/architect/GMDashboard/components/ScenarioMoveRail',
  () => ({
    ScenarioMoveRail: () => <div data-testid="scenario-move-rail-stub" />,
  })
);

function makeWorkspace(): ArchitectWorkspaceContext {
  // Derive a real context from a minimal cap sheet shape so all internal
  // discriminated unions stay in sync with the source-of-truth deriver.
  const teamCapSheet = {
    teamCode: 'LAL',
    teamName: 'Lakers',
    abbreviation: 'LAL',
    players: new Array(15).fill(null).map((_, idx) => ({
      id: `p${idx}`,
      contracts: { '2025-26': { salary: 0 } },
    })),
    salaryCapByYear: { '2025-26': 140_000_000 },
    luxuryTaxByYear: { '2025-26': 170_000_000 },
    firstApronByYear: { '2025-26': 178_000_000 },
    secondApronByYear: { '2025-26': 188_000_000 },
    exceptions: { mle: { available: true } },
  } as unknown as Parameters<typeof deriveArchitectWorkspaceContext>[0]['teamCapSheet'];

  return deriveArchitectWorkspaceContext({
    teamCapSheet,
    teamId: 'LAL',
    currentYear: 2025,
    worldId: null,
    activeWorldLabel: null,
    worldAsOfDate: null,
    worldCurrentSeason: null,
    worldMetadataLoading: false,
    isLoading: false,
    isSaving: false,
    error: null,
    worldModeBoundary: null,
  });
}

const ROOM_LABELS: Record<ActiveTab, string> = {
  roster: 'Roster',
  cap: 'Cap Sheet',
  capfull: 'Full Cap Table',
  trade: 'Trade Machine',
  fa: 'Free Agency',
  offseason: 'Offseason',
  history: 'Team History',
  compare: 'Compare',
  guide: 'Guide',
};

function makeNavItems(setActive: (id: ActiveTab) => void): NavRailItem[] {
  return (Object.keys(ROOM_LABELS) as ActiveTab[]).map((id) => ({
    id,
    label: ROOM_LABELS[id],
    glyph: ROOM_LABELS[id][0],
    onActivate: () => setActive(id),
  }));
}

function makeRooms(): Record<ActiveTab, RoomDescriptor> {
  return (Object.keys(ROOM_LABELS) as ActiveTab[]).reduce(
    (acc, id) => {
      acc[id] = {
        id,
        title: ROOM_LABELS[id],
        content: <div data-testid={`room-content-${id}`}>{ROOM_LABELS[id]} body</div>,
      };
      return acc;
    },
    {} as Record<ActiveTab, RoomDescriptor>
  );
}

describe('CockpitShell — Phase 1 smoke', () => {
  afterEach(() => {
    cleanup();
  });

  it('mounts persistent chrome (TopBar, NavRail, ActivityRail)', () => {
    const setActive = vi.fn();
    render(
      <CockpitShell
        workspace={makeWorkspace()}
        isEmulator={true}
        activeTab="roster"
        navItems={makeNavItems(setActive)}
        rooms={makeRooms()}
        receipt={null}
        receiptGeneration={0}
        worldId={null}
        historyTeamCode="LAL"
        paletteIdentifier="LAL"
        onNavigateToCapSheet={vi.fn()}
        onNavigateToRoster={vi.fn()}
        onNavigateToOffseason={vi.fn()}
        onOpenHistory={vi.fn()}
        onOpenHistoryEntry={vi.fn()}
        onNavigateReceiptHistory={vi.fn()}
        onDismissReceipt={vi.fn()}
      />
    );

    expect(screen.getByTestId('cockpit-shell')).toBeInTheDocument();
    expect(screen.getByTestId('cockpit-top-bar')).toBeInTheDocument();
    expect(screen.getByTestId('cockpit-nav-rail')).toBeInTheDocument();
    expect(screen.getByTestId('cockpit-workbench')).toBeInTheDocument();
    expect(screen.getByTestId('cockpit-activity-rail')).toBeInTheDocument();
  });

  it('exposes all 9 nav items via accessible name', () => {
    const setActive = vi.fn();
    render(
      <CockpitShell
        workspace={makeWorkspace()}
        isEmulator={false}
        activeTab="roster"
        navItems={makeNavItems(setActive)}
        rooms={makeRooms()}
        receipt={null}
        receiptGeneration={0}
        worldId={null}
        historyTeamCode="LAL"
        paletteIdentifier="LAL"
        onNavigateToCapSheet={vi.fn()}
        onNavigateToRoster={vi.fn()}
        onNavigateToOffseason={vi.fn()}
        onOpenHistory={vi.fn()}
        onOpenHistoryEntry={vi.fn()}
        onNavigateReceiptHistory={vi.fn()}
        onDismissReceipt={vi.fn()}
      />
    );

    for (const label of Object.values(ROOM_LABELS)) {
      const matches = screen.getAllByRole('tab', { name: new RegExp(label, 'i') });
      expect(matches.length).toBeGreaterThan(0);
    }
  });

  it('renders the active room body', () => {
    const setActive = vi.fn();
    render(
      <CockpitShell
        workspace={makeWorkspace()}
        isEmulator={false}
        activeTab="cap"
        navItems={makeNavItems(setActive)}
        rooms={makeRooms()}
        receipt={null}
        receiptGeneration={0}
        worldId={null}
        historyTeamCode="LAL"
        paletteIdentifier="LAL"
        onNavigateToCapSheet={vi.fn()}
        onNavigateToRoster={vi.fn()}
        onNavigateToOffseason={vi.fn()}
        onOpenHistory={vi.fn()}
        onOpenHistoryEntry={vi.fn()}
        onNavigateReceiptHistory={vi.fn()}
        onDismissReceipt={vi.fn()}
      />
    );

    expect(screen.getByTestId('room-content-cap')).toBeInTheDocument();
    const titles = screen.getAllByTestId('cockpit-room-frame-title');
    expect(titles[0]).toHaveTextContent(/Cap Sheet/i);
  });

  it('fires onActivate when a nav item is clicked', () => {
    const setActive = vi.fn();
    render(
      <CockpitShell
        workspace={makeWorkspace()}
        isEmulator={false}
        activeTab="roster"
        navItems={makeNavItems(setActive)}
        rooms={makeRooms()}
        receipt={null}
        receiptGeneration={0}
        worldId={null}
        historyTeamCode="LAL"
        paletteIdentifier="LAL"
        onNavigateToCapSheet={vi.fn()}
        onNavigateToRoster={vi.fn()}
        onNavigateToOffseason={vi.fn()}
        onOpenHistory={vi.fn()}
        onOpenHistoryEntry={vi.fn()}
        onNavigateReceiptHistory={vi.fn()}
        onDismissReceipt={vi.fn()}
      />
    );

    // The nav-rail tablist is the one rendered inside `cockpit-nav-rail`.
    const navRail = screen.getByTestId('cockpit-nav-rail');
    const navButtons = navRail.querySelectorAll('button[role="tab"]');
    const tradeButton = Array.from(navButtons).find(
      (button) => button.getAttribute('aria-label') === 'Trade Machine'
    );
    expect(tradeButton).toBeTruthy();
    fireEvent.click(tradeButton as Element);
    expect(setActive).toHaveBeenCalledWith('trade');
  });

  it('preserves the dashboard title heading for existing smoke tests', () => {
    render(
      <CockpitShell
        workspace={makeWorkspace()}
        isEmulator={false}
        activeTab="roster"
        navItems={makeNavItems(vi.fn())}
        rooms={makeRooms()}
        receipt={null}
        receiptGeneration={0}
        worldId={null}
        historyTeamCode="LAL"
        paletteIdentifier="LAL"
        onNavigateToCapSheet={vi.fn()}
        onNavigateToRoster={vi.fn()}
        onNavigateToOffseason={vi.fn()}
        onOpenHistory={vi.fn()}
        onOpenHistoryEntry={vi.fn()}
        onNavigateReceiptHistory={vi.fn()}
        onDismissReceipt={vi.fn()}
      />
    );

    const titles = screen.getAllByRole('heading', {
      name: /HoopZero Architect.*GM Dashboard/i,
    });
    expect(titles.length).toBeGreaterThan(0);
  });
});
