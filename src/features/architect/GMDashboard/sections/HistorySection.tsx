/**
 * FILE: src/features/architect/GMDashboard/sections/HistorySection.jsx
 * PURPOSE: Render the GM Dashboard history section by passing cap sheet data into the TeamHistoryTab view.
 * OWNERSHIP: Feature: architect/GMDashboard (history section)
 *
 * HISTORY:
 *  - 2025-12-12: Created ad-hoc while adding required file header (no plan).
 *
 * LINKS:
 *  - Plan: N/A (ad-hoc change)
 *  - Latest Chunk: N/A
 */
import { TeamHistoryTab } from '@/features/architect/history/TeamHistoryTab';
import type {
  RequestedHistoryEventDetail,
  TeamHistoryCapSheetLike,
  HistoryOutboundCallbacks,
} from '@/features/architect/history/TeamHistoryTab/types';

type HistorySectionProps = {
  teamCapSheet: TeamHistoryCapSheetLike | null | undefined;
  worldId?: string | null;
  resolvePlayerTeamCode?: ((playerId: string) => string | null) | null;
  requestedHistoryEventDetail?: RequestedHistoryEventDetail | null;
  onRequestedHistoryEventDetailHandled?: ((requestKey: number) => void) | null;
  onInjectTeamHistoryFixtures?: (() => void) | null;
  onClearTeamHistoryFixtures?: (() => void) | null;
  hasInjectedTeamHistoryFixtures?: boolean;
} & HistoryOutboundCallbacks;

const HistorySection = ({
  teamCapSheet,
  worldId,
  resolvePlayerTeamCode,
  requestedHistoryEventDetail,
  onRequestedHistoryEventDetailHandled,
  onInjectTeamHistoryFixtures,
  onClearTeamHistoryFixtures,
  hasInjectedTeamHistoryFixtures,
  onNavigateRoom,
  onOpenTradeWithRequest,
  onPlayerAction,
  resolvePlayerLabel,
}: HistorySectionProps) => (
  <TeamHistoryTab
    teamCapSheet={teamCapSheet!}
    worldId={worldId}
    resolvePlayerTeamCode={resolvePlayerTeamCode}
    requestedHistoryEventDetail={requestedHistoryEventDetail}
    onRequestedHistoryEventDetailHandled={onRequestedHistoryEventDetailHandled}
    onInjectTeamHistoryFixtures={onInjectTeamHistoryFixtures}
    onClearTeamHistoryFixtures={onClearTeamHistoryFixtures}
    hasInjectedTeamHistoryFixtures={hasInjectedTeamHistoryFixtures}
    onNavigateRoom={onNavigateRoom}
    onOpenTradeWithRequest={onOpenTradeWithRequest}
    onPlayerAction={onPlayerAction}
    resolvePlayerLabel={resolvePlayerLabel}
  />
);

export { HistorySection };
