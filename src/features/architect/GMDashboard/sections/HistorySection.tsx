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
import TeamHistoryTab from '@/features/architect/history/TeamHistoryTab';

type HistorySectionProps = {
  teamCapSheet: Record<string, unknown> | null | undefined;
  worldId?: string | null;
  onInjectTeamHistoryFixtures?: (() => void) | null;
  onClearTeamHistoryFixtures?: (() => void) | null;
  hasInjectedTeamHistoryFixtures?: boolean;
};

const HistorySection = ({
  teamCapSheet,
  worldId,
  onInjectTeamHistoryFixtures,
  onClearTeamHistoryFixtures,
  hasInjectedTeamHistoryFixtures,
}: HistorySectionProps) => (
  <TeamHistoryTab
    teamCapSheet={teamCapSheet}
    worldId={worldId}
    onInjectTeamHistoryFixtures={onInjectTeamHistoryFixtures}
    onClearTeamHistoryFixtures={onClearTeamHistoryFixtures}
    hasInjectedTeamHistoryFixtures={hasInjectedTeamHistoryFixtures}
  />
);

export { HistorySection };
