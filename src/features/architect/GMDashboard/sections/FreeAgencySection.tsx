/**
 * FILE: src/features/architect/GMDashboard/sections/FreeAgencySection.tsx
 * PURPOSE: Render the GM Dashboard free agency section that wires dashboard state into the FreeAgentPool view.
 * OWNERSHIP: Feature: architect/GMDashboard (free agency section)
 *
 * HISTORY:
 *  - 2025-12-12: Created ad-hoc while adding required file header (no plan).
 *  - 2026-03-14: Migrated authoritative implementation to TypeScript for E91.
 *
 * LINKS:
 *  - Return Package: return_packages/trade_machine/TM_VALIDATOR_TS_FREE_AGENCY_OFFER_SHEET_SURFACE_E91_RETURN_PACKAGE.md
 *  - Master Doc: docs/architect/TRADE_MACHINE_MASTER.md
 */
import FreeAgentPool from '@/features/architect/freeAgency/FreeAgentPool';
import OfferSheetList from '@/features/architect/GMDashboard/components/OfferSheetList';
import type { FreeAgentPoolProps } from '@/features/architect/freeAgency/FreeAgentPool/types';

import type {
  FreeAgencySectionProps,
  OfferSheetLifecycleActionEvent,
  OfferSheetListProps,
} from '../offerSheetTypes';

type FreeAgencyWorldOnlyActionOwner = NonNullable<
  FreeAgencySectionProps['actionOwner']['worldOnly']
>;
type OfferSheetLifecycleActionHandler = NonNullable<
  OfferSheetListProps['onLifecycleAction']
>;
type OfferSheetFinalizeArg = Parameters<
  FreeAgencyWorldOnlyActionOwner['finalizeOfferSheet']
>[0];

const FreeAgencySection = ({
  freeAgents,
  currentYear,
  actionOwner,
  playersMap,
  outgoingOfferSheets,
  incomingOfferSheets,
}: FreeAgencySectionProps) => {
  const worldOnlyActionOwner = actionOwner.worldOnly;
  const hasWorldOnlyActions = Boolean(worldOnlyActionOwner);
  const incomingOfferSheetSurface = {
    title: 'Incoming Offer Sheets (Action Required)',
    offerSheets: incomingOfferSheets,
    surfaceRole: 'incoming' as const,
  };
  const outgoingOfferSheetSurface = {
    title: 'My Pending Offer Sheets',
    offerSheets: outgoingOfferSheets,
    surfaceRole: 'outgoing' as const,
  };

  const handleOfferSheetLifecycleAction: OfferSheetLifecycleActionHandler = ({
    action,
    offerSheet,
    surfaceRole,
  }: OfferSheetLifecycleActionEvent) => {
    switch (`${surfaceRole}:${action}`) {
      case 'incoming:match':
        worldOnlyActionOwner?.matchOfferSheet(
          String(offerSheet.offeringTeamCode || ''),
          String(offerSheet.id || '')
        );
        return;
      case 'incoming:decline':
        worldOnlyActionOwner?.declineOfferSheet(
          String(offerSheet.offeringTeamCode || ''),
          String(offerSheet.id || '')
        );
        return;
      case 'incoming:finalizeMatched':
      case 'outgoing:finalizeDeclined':
        worldOnlyActionOwner?.finalizeOfferSheet(
          offerSheet as OfferSheetFinalizeArg
        );
        return;
      default:
        return;
    }
  };

  return (
    <div>
      {/*
        Offer-sheet actions are persist-only world mutations.
        In vacuum mode these controls are explicitly gated to avoid silent no-ops.
      */}
      {!hasWorldOnlyActions && (
        <p className="text-xs text-amber-400 mb-2">
          Offer sheets and sign-and-trade require an active world to commit.
        </p>
      )}

      {/* Incoming Offers (Home Team View) */}
      <OfferSheetList
        {...incomingOfferSheetSurface}
        onLifecycleAction={handleOfferSheetLifecycleAction}
        actionsDisabled={!hasWorldOnlyActions}
        actionsDisabledReason="Requires an active world to commit."
      />

      {/* Outgoing Offers (Offering Team View) */}
      <OfferSheetList
        {...outgoingOfferSheetSurface}
        onLifecycleAction={handleOfferSheetLifecycleAction}
        actionsDisabled={!hasWorldOnlyActions}
        actionsDisabledReason="Requires an active world to commit."
      />

      <FreeAgentPool
        freeAgents={freeAgents as FreeAgentPoolProps['freeAgents']}
        currentYear={currentYear}
        actionOwner={actionOwner as FreeAgentPoolProps['actionOwner']}
        playersMap={playersMap as FreeAgentPoolProps['playersMap']}
      />
    </div>
  );
};

export { FreeAgencySection };
