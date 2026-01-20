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
import OfferSheetList from '@/features/architect/GMDashboard/components/OfferSheetList';

const FreeAgencySection = ({
  freeAgents,
  teamCapSheet,
  capProjections,
  currentYear,
  onSign,
  playersMap,
  // New props for Phase 16
  outgoingOfferSheets,
  incomingOfferSheets,
  onMatch,
  onDecline,
  onFinalize,
}) => (
  <div>
      {/* Incoming Offers (Home Team View) */}
      <OfferSheetList 
          title="Incoming Offer Sheets (Action Required)"
          offerSheets={incomingOfferSheets}
          isIncoming={true}
          onMatch={onMatch}
          onDecline={onDecline}
      />

      {/* Outgoing Offers (Offering Team View) */}
      <OfferSheetList 
          title="My Pending Offer Sheets"
          offerSheets={outgoingOfferSheets}
          isIncoming={false}
          onFinalize={onFinalize}
      />

      <FreeAgentPool
        freeAgents={freeAgents}
        teamCapSheet={teamCapSheet}
        capProjections={capProjections}
        currentYear={currentYear}
        onSign={onSign}
        playersMap={playersMap}
      />
  </div>
);

export { FreeAgencySection };
