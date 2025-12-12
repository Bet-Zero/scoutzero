/**
 * FILE: src/features/architect/GMDashboard/sections/FreeAgencySection.jsx
 * PURPOSE: Render the GM Dashboard free agency section that wires dashboard state into the FreeAgentPool view.
 * OWNERSHIP: Feature: architect/GMDashboard (free agency section)
 *
 * HISTORY:
 *  - 2025-12-12: Created ad-hoc while adding required file header (no plan).
 *
 * LINKS:
 *  - Plan: N/A (ad-hoc change)
 *  - Latest Chunk: N/A
 */
import FreeAgentPool from '@/features/architect/FreeAgentPool';

const FreeAgencySection = ({
  freeAgents,
  teamCapSheet,
  capProjections,
  currentYear,
  onSign,
  playersMap,
}) => (
  <FreeAgentPool
    freeAgents={freeAgents}
    teamCapSheet={teamCapSheet}
    capProjections={capProjections}
    currentYear={currentYear}
    onSign={onSign}
    playersMap={playersMap}
  />
);

export { FreeAgencySection };
