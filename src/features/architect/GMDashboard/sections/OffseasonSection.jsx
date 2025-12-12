/**
 * FILE: src/features/architect/GMDashboard/sections/OffseasonSection.jsx
 * PURPOSE: Wraps the OffseasonTab component for the GM dashboard Offseason view.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * HISTORY:
 *  - 2025-12-12: Created outside plan mode (no chunks); header added per request.
 *
 * LINKS:
 *  - Plan: N/A (not created via plan)
 *  - Latest Chunk: N/A
 */

import OffseasonTab from '@/features/architect/OffseasonTab';

const OffseasonSection = ({
  teamCapSheet,
  setTeamCapSheet,
  currentYear,
  setCurrentYear,
  capProjections,
  setLastCapSheet,
  setOffseasonRun,
  setOffseasonSummary,
  setShowModal,
  playersMap,
}) => (
  <OffseasonTab
    teamCapSheet={teamCapSheet}
    setTeamCapSheet={setTeamCapSheet}
    currentYear={currentYear}
    setCurrentYear={setCurrentYear}
    capProjections={capProjections}
    setLastCapSheet={setLastCapSheet}
    setOffseasonRun={setOffseasonRun}
    setOffseasonSummary={setOffseasonSummary}
    setShowModal={setShowModal}
    playersMap={playersMap}
  />
);

export { OffseasonSection };
