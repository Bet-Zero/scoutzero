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
import {
  ActivityRail,
  type ActivityRailHandle,
  type PinnedPlayer,
} from './ActivityRail';
import type { PlayerAction, PlayerActionContext } from './playerActionContext';
import type { HardCapCockpitStatus } from './TeamStatusStrip';
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
  pinnedPlayers?: PinnedPlayer[];
  onUnpinPlayer?: (playerId: string) => void;
  onOpenPinnedPlayer?: (playerId: string) => void;
  onTradePinnedPlayer?: (playerId: string) => void;
  onTradeAllPinned?: () => void;
  onPlayerAction?: (action: PlayerAction, context: PlayerActionContext) => void;
  resolvePlayerLabel?: (playerId: string) => string;
  tradeDraftActive?: boolean;
  onResumeTradeDraft?: () => void;
  onNavigateToCompare?: () => void;
  onNavigateToGuide?: () => void;
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
  pinnedPlayers,
  onUnpinPlayer,
  onOpenPinnedPlayer,
  onTradePinnedPlayer,
  onTradeAllPinned,
  onPlayerAction,
  resolvePlayerLabel,
  tradeDraftActive = false,
  onResumeTradeDraft,
  onNavigateToCompare,
  onNavigateToGuide,
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

      {banner ? <div className="shrink-0">{banner}</div> : null}

      <div className="flex min-h-0 flex-1">
        <NavRail activeTab={activeTab} items={navItems} />
        <Workbench activeTab={activeTab} rooms={rooms} />
        <ActivityRail
          ref={activityRailRef}
          workspace={workspace}
          hardCapStatus={hardCapStatus}
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
          pinnedPlayers={pinnedPlayers}
          onUnpinPlayer={onUnpinPlayer}
          onOpenPinnedPlayer={onOpenPinnedPlayer}
          onTradePinnedPlayer={onTradePinnedPlayer}
          onTradeAllPinned={onTradeAllPinned}
          onPlayerAction={onPlayerAction}
          resolvePlayerLabel={resolvePlayerLabel}
          tradeDraftActive={tradeDraftActive}
          onResumeTradeDraft={onResumeTradeDraft}
          onNavigateToCompare={onNavigateToCompare}
          onNavigateToGuide={onNavigateToGuide}
        />
      </div>

      {modals}
    </div>
  );
};
