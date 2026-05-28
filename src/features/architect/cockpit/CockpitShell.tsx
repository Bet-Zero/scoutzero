/**
 * FILE: src/features/architect/cockpit/CockpitShell.tsx
 * PURPOSE: Top-level fixed-viewport shell for the Architect cockpit. Composes
 *          TopBar + NavRail + Workbench + ActivityRail. Subscribes to
 *          existing Architect hooks; introduces no new state authorities.
 * OWNERSHIP: Feature: architect/cockpit
 *
 * Phase 1 notes:
 *  - Strict viewport sizing (h-[100dvh] + min-h-0 chain) — the page must
 *    not scroll. Overflow happens only inside RoomFrame body and the
 *    activity rail.
 *  - Team palette CSS variables are injected onto the root element via
 *    useTeamPalette so the active team accent is available to every
 *    descendant via var(--team-primary).
 *  - The cockpit owns the viewport. SiteLayout suppresses the global site
 *    header on /gm routes so this is the only top chrome.
 */
import { useMemo, useRef, type ReactNode } from 'react';
import type { ActiveTab } from '@/features/architect/GMDashboard/hooks/useArchitectState.types';
import type { ArchitectWorkspaceContext } from '@/features/architect/GMDashboard/hooks/useArchitectWorkspaceContext';
import type { ArchitectPostActionReceipt } from '@/features/architect/GMDashboard/postActionHandoff/types';
import { TopBar } from './TopBar';
import { NavRail, type NavRailItem } from './NavRail';
import { Workbench, type RoomDescriptor } from './Workbench';
import { ActivityRail, type ActivityRailHandle } from './ActivityRail';
import { TeamStatusStrip, type HardCapCockpitStatus } from './TeamStatusStrip';
import { useTeamPalette } from './useTeamPalette';

interface CockpitShellProps {
  workspace: ArchitectWorkspaceContext;
  isEmulator: boolean;
  activeTab: ActiveTab;
  navItems: NavRailItem[];
  rooms: Record<ActiveTab, RoomDescriptor>;
  receipt: ArchitectPostActionReceipt | null;
  receiptGeneration: number;
  worldId: string | null;
  historyTeamCode: string;
  paletteIdentifier: string | null;
  hardCapStatus?: HardCapCockpitStatus;
  worldSelectorSlot?: ReactNode;
  worldTimeControlsSlot?: ReactNode;
  seasonSelectorSlot?: ReactNode;
  onNavigateToCapSheet: () => void;
  onNavigateToRoster: () => void;
  onNavigateToOffseason: () => void;
  onOpenHistory: () => void;
  onOpenHistoryEntry: (eventId: string) => void;
  onNavigateReceiptHistory: () => void;
  onDismissReceipt: () => void;
  banner?: ReactNode;
  modals?: ReactNode;
}

export const CockpitShell = ({
  workspace,
  isEmulator,
  activeTab,
  navItems,
  rooms,
  receipt,
  receiptGeneration,
  worldId,
  historyTeamCode,
  paletteIdentifier,
  hardCapStatus,
  worldSelectorSlot,
  worldTimeControlsSlot,
  seasonSelectorSlot,
  onNavigateToCapSheet,
  onNavigateToRoster,
  onNavigateToOffseason,
  onOpenHistory,
  onOpenHistoryEntry,
  onNavigateReceiptHistory,
  onDismissReceipt,
  banner,
  modals,
}: CockpitShellProps) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const activityRailRef = useRef<ActivityRailHandle | null>(null);

  useTeamPalette(paletteIdentifier, { target: rootRef });

  const handleExpandActivity = useMemo(
    () => () => {
      activityRailRef.current?.expand();
    },
    []
  );

  return (
    <div
      ref={rootRef}
      className="flex h-[100dvh] w-full flex-col overflow-hidden bg-cockpit-void text-cockpit-text-primary"
      data-testid="cockpit-shell"
    >
      <TopBar
        workspace={workspace}
        isEmulator={isEmulator}
        receipt={receipt}
        onExpandActivity={handleExpandActivity}
        worldSelectorSlot={worldSelectorSlot}
        worldTimeControlsSlot={worldTimeControlsSlot}
        seasonSelectorSlot={seasonSelectorSlot}
      />

      <TeamStatusStrip workspace={workspace} hardCapStatus={hardCapStatus} />

      {banner ? <div className="shrink-0">{banner}</div> : null}

      <div className="flex min-h-0 flex-1">
        <NavRail activeTab={activeTab} items={navItems} />
        <Workbench activeTab={activeTab} rooms={rooms} />
        <ActivityRail
          ref={activityRailRef}
          workspace={workspace}
          receipt={receipt}
          receiptGeneration={receiptGeneration}
          worldId={worldId}
          historyTeamCode={historyTeamCode}
          onNavigateToCapSheet={onNavigateToCapSheet}
          onNavigateToRoster={onNavigateToRoster}
          onNavigateToOffseason={onNavigateToOffseason}
          onOpenHistory={onOpenHistory}
          onOpenHistoryEntry={onOpenHistoryEntry}
          onNavigateReceiptHistory={onNavigateReceiptHistory}
          onDismissReceipt={onDismissReceipt}
        />
      </div>

      {modals}
    </div>
  );
};
