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
  currentYear,
  onSign,
  onSignAndTrade,
  onStoreOfferSheet,
  playersMap,
  // New props for Phase 16
  outgoingOfferSheets,
  incomingOfferSheets,
  onMatch,
  onDecline,
  onFinalize,
  worldId,
}) => (
  <div>
      {/*
        Offer-sheet actions are persist-only world mutations.
        In vacuum mode these controls are explicitly gated to avoid silent no-ops.
      */}
      {!worldId && (
        <p className="text-xs text-amber-400 mb-2">
          Offer sheets and sign-and-trade require an active world to commit.
        </p>
      )}

      {/* Incoming Offers (Home Team View) */}
      <OfferSheetList 
          title="Incoming Offer Sheets (Action Required)"
          offerSheets={incomingOfferSheets}
          isIncoming={true}
          onMatch={onMatch}
          onDecline={onDecline}
          onFinalize={onFinalize}
          actionsDisabled={!worldId}
          actionsDisabledReason="Requires an active world to commit."
      />

      {/* Outgoing Offers (Offering Team View) */}
      <OfferSheetList 
          title="My Pending Offer Sheets"
          offerSheets={outgoingOfferSheets}
          isIncoming={false}
          onFinalize={onFinalize}
          actionsDisabled={!worldId}
          actionsDisabledReason="Requires an active world to commit."
      />

      <FreeAgentPool
        freeAgents={freeAgents}
        currentYear={currentYear}
        onSign={onSign}
        onSignAndTrade={onSignAndTrade}
        onStoreOfferSheet={onStoreOfferSheet}
        playersMap={playersMap}
        worldId={worldId}
      />
  </div>
);

export { FreeAgencySection };
