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
} from '@/features/architect/history/TeamHistoryTab/types';

type HistorySectionProps = {
  teamCapSheet: TeamHistoryCapSheetLike | null | undefined;
  worldId?: string | null;
  requestedHistoryEventDetail?: RequestedHistoryEventDetail | null;
  onRequestedHistoryEventDetailHandled?: ((requestKey: number) => void) | null;
  onInjectTeamHistoryFixtures?: (() => void) | null;
  onClearTeamHistoryFixtures?: (() => void) | null;
  hasInjectedTeamHistoryFixtures?: boolean;
};

const HistorySection = ({
  teamCapSheet,
  worldId,
  requestedHistoryEventDetail,
  onRequestedHistoryEventDetailHandled,
  onInjectTeamHistoryFixtures,
  onClearTeamHistoryFixtures,
  hasInjectedTeamHistoryFixtures,
}: HistorySectionProps) => (
  <TeamHistoryTab
    teamCapSheet={teamCapSheet!}
    worldId={worldId}
    requestedHistoryEventDetail={requestedHistoryEventDetail}
    onRequestedHistoryEventDetailHandled={
      onRequestedHistoryEventDetailHandled
    }
    onInjectTeamHistoryFixtures={onInjectTeamHistoryFixtures}
    onClearTeamHistoryFixtures={onClearTeamHistoryFixtures}
    hasInjectedTeamHistoryFixtures={hasInjectedTeamHistoryFixtures}
  />
);

export { HistorySection };
